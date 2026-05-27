import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import AutomationPanel from '../components/AutomationPanel'
import SchedulesPanel from '../components/SchedulesPanel'
import DeviceSettingsPanel from '../components/DeviceSettingsPanel'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DevicesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    if (!showProfileMenu) return;
    const close = () => setShowProfileMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showProfileMenu])
  
  // Parse query parameter to render appropriate view tab
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab') || 'overview'

  const [devices, setDevices] = useState([])
  const [activeDevice, setActiveDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sensorDevices = useMemo(() => {
    return devices.filter(d => d.externalId && !d.externalId.startsWith('esp32s3-'))
  }, [devices])

  const s3Controllers = useMemo(() => {
    return devices.filter(d => d.externalId && d.externalId.startsWith('esp32s3-'))
  }, [devices])

  const s3Controller = useMemo(() => {
    return devices.find(d => d.externalId && d.externalId.startsWith('esp32s3-'))
  }, [devices])

  // Selected device states
  const [latest, setLatest] = useState(null)
  const [chartsData, setChartsData] = useState([])
  const [cmdFan, setCmdFan] = useState('OFF')
  const [cmdLight, setCmdLight] = useState('OFF')
  const [cmdPump, setCmdPump] = useState('OFF')
  const [sseStatus, setSseStatus] = useState('disconnected')
  const [opMode, setOpMode] = useState('auto') // 'manual' | 'auto' | 'scheduled'
  const [modeChanging, setModeChanging] = useState(false)
  const [overrideNotice, setOverrideNotice] = useState('')

  const sseRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const isRequestActiveRef = useRef(false)

  // Track live status updates for all devices via SSE
  const [deviceStatuses, setDeviceStatuses] = useState({})

  // Fetch all devices
  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/api/devices')
        if (!ignore) {
          const devs = res.data || []
          setDevices(devs)
          // Prefer sensor node (non-S3) as default activeDevice for telemetry display
          const sensorNode = devs.find(d => d.externalId && !d.externalId.startsWith('esp32s3-'))
          if (sensorNode) {
            setActiveDevice(sensorNode)
          } else if (devs.length > 0) {
            setActiveDevice(devs[0])
          }
        }
      } catch (e) {
        if (!ignore) setError(e.response?.data?.message || 'Không thể tải danh sách thiết bị')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  // Auto-sync active device type depending on activeTab
  useEffect(() => {
    if (devices.length === 0) return
    const isTelemetryTab = ['overview', 'analytics', 'ai'].includes(activeTab)
    const isControlTab = activeTab === 'control'

    if (isTelemetryTab) {
      const isCurrentSensor = activeDevice && activeDevice.externalId && !activeDevice.externalId.startsWith('esp32s3-')
      if (!isCurrentSensor) {
        const firstSensor = devices.find(d => d.externalId && !d.externalId.startsWith('esp32s3-'))
        if (firstSensor) {
          setActiveDevice(firstSensor)
        }
      }
    } else if (isControlTab) {
      const isCurrentS3 = activeDevice && activeDevice.externalId && activeDevice.externalId.startsWith('esp32s3-')
      if (!isCurrentS3) {
        const firstS3 = devices.find(d => d.externalId && d.externalId.startsWith('esp32s3-'))
        if (firstS3) {
          setActiveDevice(firstS3)
        }
      }
    }
  }, [activeTab, devices, activeDevice?._id])

  // Sync device automation states to client-side opMode
  useEffect(() => {
    if (isRequestActiveRef.current) return // Skip sync while a manual mode request is in flight
    const syncDevice = s3Controller || activeDevice
    if (!syncDevice) return
    if (syncDevice.opMode) {
      setOpMode(syncDevice.opMode)
    } else {
      if (syncDevice.autoFanEnabled || syncDevice.autoPumpEnabled || syncDevice.autoLightEnabled) {
        setOpMode('auto')
      } else {
        setOpMode(prev => (prev === 'scheduled' ? 'scheduled' : 'manual'))
      }
    }
    if (syncDevice.lastFanState) setCmdFan(syncDevice.lastFanState)
    if (syncDevice.lastLightState) setCmdLight(syncDevice.lastLightState)
    if (syncDevice.lastPumpState) setCmdPump(syncDevice.lastPumpState)
  }, [
    s3Controller?.lastFanState, s3Controller?.lastLightState, s3Controller?.lastPumpState,
    s3Controller?.autoFanEnabled, s3Controller?.autoPumpEnabled, s3Controller?.autoLightEnabled,
    s3Controller?.opMode,
    activeDevice?.lastFanState, activeDevice?.lastLightState, activeDevice?.lastPumpState,
    activeDevice?.autoFanEnabled, activeDevice?.autoPumpEnabled, activeDevice?.autoLightEnabled,
    activeDevice?.opMode
  ])

  // Load telemetry sensors data for the selected device
  const loadTelemetry = async (deviceId) => {
    try {
      const res = await api.get('/api/sensors', { params: { deviceId, limit: 30 } })
      const arr = res.data || []
      // Guard: don't reset existing SSE data if DB returns empty
      if (arr.length === 0) return
      const reversed = arr.slice().reverse()
      // format timestamps for chart labels
      const formatted = reversed.map(d => ({
        ...d,
        timeLabel: new Date(d.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        soilMoisture: d.soilMoisture ?? d.soil_pct ?? 0,
      }))
      setChartsData(formatted)
      if (formatted.length > 0) {
        setLatest(formatted[formatted.length - 1])
      }
    } catch (e) { }
  }

  // Reset chart/metrics when switching to a different device
  useEffect(() => {
    setLatest(null)
    setChartsData([])
  }, [activeDevice?._id])

  // Load telemetry initially and check for updates
  // Use activeDevice?._id (primitive) instead of full object to avoid re-running on status-only updates
  useEffect(() => {
    if (!activeDevice) return
    loadTelemetry(activeDevice._id)
    
    // Poll telemetry data when SSE is disconnected
    const interval = setInterval(() => {
      if (sseStatus !== 'connected') {
        loadTelemetry(activeDevice._id)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [activeDevice?._id, sseStatus])

  // SSE Real-time telemetry receiver
  useEffect(() => {
    if (!activeDevice || !activeDevice.externalId) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    function connect() {
      setSseStatus('connecting')
      const url = `${import.meta.env.VITE_API_BASE_URL || 'https://api.duongle.io.vn'}/api/stream/devices/${activeDevice.externalId}?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      sseRef.current = es
      
      es.onopen = () => { 
        reconnectAttemptsRef.current = 0
        setSseStatus('connected') 
      }
      es.onerror = () => {
        setSseStatus('error')
        es.close()
        const delay = Math.min(30000, Math.pow(2, ++reconnectAttemptsRef.current) * 1000)
        setTimeout(connect, delay)
      }
      
      es.addEventListener('telemetry', (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          if (payload.relayFan) setCmdFan(payload.relayFan)
          if (payload.relayLight) setCmdLight(payload.relayLight)
          if (payload.relayPump) setCmdPump(payload.relayPump)
          
          const hasSensorData = payload.temperature !== undefined || 
                                payload.humidity !== undefined || 
                                payload.soilMoisture !== undefined || 
                                payload.soil_pct !== undefined || 
                                payload.lux !== undefined

          setLatest(prev => {
            if (!prev) {
              return {
                timestamp: payload.timestamp || Date.now(),
                temperature: payload.temperature,
                humidity: payload.humidity,
                soilMoisture: payload.soilMoisture ?? payload.soil_pct ?? 0,
                lux: payload.lux,
              }
            }
            return {
              ...prev,
              timestamp: payload.timestamp || Date.now(),
              temperature: payload.temperature !== undefined ? payload.temperature : prev.temperature,
              humidity: payload.humidity !== undefined ? payload.humidity : prev.humidity,
              soilMoisture: (payload.soilMoisture ?? payload.soil_pct) !== undefined ? (payload.soilMoisture ?? payload.soil_pct) : prev.soilMoisture,
              lux: payload.lux !== undefined ? payload.lux : prev.lux,
            }
          })

          if (hasSensorData) {
            setChartsData(prev => {
              const next = [...prev]
              const ts = payload.timestamp || Date.now()
              const timeLabel = new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              if (!next.some(d => d.timestamp === ts)) {
                next.push({
                  timestamp: ts,
                  timeLabel,
                  temperature: payload.temperature,
                  humidity: payload.humidity,
                  soilMoisture: payload.soilMoisture ?? payload.soil_pct ?? 0,
                  lux: payload.lux
                })
                if (next.length > 50) next.splice(0, next.length - 50)
              }
              return next
            })
          }
        } catch { }
      })

      es.addEventListener('status', (evt) => {
        try {
          const s = JSON.parse(evt.data)
          // Update both activeDevice and global deviceStatuses map
          setActiveDevice(prev => prev ? { ...prev, status: s.status } : prev)
          setDevices(prev => prev.map(d => d.externalId === s.externalId ? { ...d, status: s.status } : d))
          setDeviceStatuses(prev => ({ ...prev, [s.externalId]: s.status }))
        } catch { }
      })
    }
    
    connect()
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [activeDevice?.externalId])

  // SSE watcher for all OTHER devices (not activeDevice) - tracks online/offline status
  const otherSseRefs = useRef([])
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token || devices.length === 0) return

    // Close previous connections
    otherSseRefs.current.forEach(es => { try { es.close() } catch (_) {} })
    otherSseRefs.current = []

    // Subscribe to devices that are NOT the activeDevice
    const otherDevices = devices.filter(
      d => d.externalId && d.externalId !== activeDevice?.externalId
    )

    otherDevices.forEach(dev => {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'https://api.duongle.io.vn'}/api/stream/devices/${dev.externalId}?token=${encodeURIComponent(token)}`
      try {
        const es = new EventSource(url)
        es.addEventListener('status', (evt) => {
          try {
            const s = JSON.parse(evt.data)
            setDevices(prev => prev.map(d => d.externalId === s.externalId ? { ...d, status: s.status } : d))
            setDeviceStatuses(prev => ({ ...prev, [s.externalId]: s.status }))
          } catch (_) {}
        })
        es.addEventListener('telemetry', (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            setDevices(prev => prev.map(d => {
              if (d.externalId === dev.externalId) {
                return {
                  ...d,
                  lastFanState: payload.relayFan || d.lastFanState,
                  lastLightState: payload.relayLight || d.lastLightState,
                  lastPumpState: payload.relayPump || d.lastPumpState,
                }
              }
              return d
            }))
          } catch (_) {}
        })
        otherSseRefs.current.push(es)
      } catch (_) {}
    })

    return () => {
      otherSseRefs.current.forEach(es => { try { es.close() } catch (_) {} })
      otherSseRefs.current = []
    }
  }, [devices.length, activeDevice?.externalId])

  // Helper to toggle manual relays
  const toggleRelay = async (target, currentState, customDeviceId = null) => {
    const id = customDeviceId || activeDevice?._id
    if (!id) return
    const action = currentState === 'ON' ? 'OFF' : 'ON'
    
    // Optimistic UI updates
    if (target === 'pump') setCmdPump(action)
    if (target === 'light') setCmdLight(action)
    if (target === 'fan') setCmdFan(action)

    try {
      await api.post('/api/commands', { deviceId: id, target, action })
      // If we execute a manual toggle in AUTO mode, warn user that auto logic might override it shortly
      if (opMode === 'auto') {
        setOverrideNotice('Hệ thống đang ở chế độ TỰ ĐỘNG. Thiết bị sẽ tự điều chỉnh lại dựa trên ngưỡng cảm biến.')
        setTimeout(() => setOverrideNotice(''), 5000)
      }
    } catch (e) {
      // Revert on error
      if (target === 'pump') setCmdPump(currentState)
      if (target === 'light') setCmdLight(currentState)
      if (target === 'fan') setCmdFan(currentState)
    }
  }

  // Handle changing operational modes
  const handleModeChange = async (mode, customDeviceId = null) => {
    const id = customDeviceId || activeDevice?._id
    if (!id || modeChanging) return
    
    const prevMode = opMode
    setOpMode(mode) // Optimistic update
    setModeChanging(true)
    isRequestActiveRef.current = true
    
    try {
      const isAuto = mode === 'auto'
      const payload = {
        opMode: mode,
        autoFanEnabled: isAuto,
        autoPumpEnabled: isAuto,
        autoLightEnabled: isAuto,
      }
      const res = await api.put(`/api/devices/${id}`, payload)
      setDevices(prev => prev.map(d => d._id === id ? res.data : d))
      if (activeDevice && activeDevice._id === id) {
        setActiveDevice(res.data)
      }
    } catch (e) {
      // Revert if API fail
      setOpMode(prevMode)
    } finally {
      setModeChanging(false)
      isRequestActiveRef.current = false
    }
  }

  // Dynamic user initials avatar
  const userInitials = useMemo(() => {
    const displayName = user?.name || user?.username || user?.email || 'User'
    const parts = displayName.split(' ')
    return parts.map(p => p ? p[0] : '').join('').toUpperCase().slice(0, 2)
  }, [user])

  // Dynamic TinyML Logic prediction
  const tinymlText = useMemo(() => {
    const soil = latest?.soilMoisture ?? 50
    const temp = latest?.temperature ?? 26.5
    if (soil < 55) {
      return '• TINYML LOGIC: DỰ ĐOÁN NHU CẦU NƯỚC CAO'
    } else if (temp > 30) {
      return '• TINYML LOGIC: DỰ ĐOÁN NHU CẦU LÀM MÁT CAO'
    }
    return '• TINYML LOGIC: HỆ THỐNG HOẠT ĐỘNG ỔN ĐỊNH'
  }, [latest])

  const filteredSelectDevices = useMemo(() => {
    const isTelemetryTab = ['overview', 'analytics', 'ai'].includes(activeTab)
    const isControlTab = activeTab === 'control'
    if (isTelemetryTab) {
      return sensorDevices
    }
    if (isControlTab) {
      return s3Controllers
    }
    return devices
  }, [devices, sensorDevices, s3Controllers, activeTab])

  // AI Chat Bot state
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `Xin chào ${user?.name || user?.username || user?.email || 'bạn'}! Tôi là trợ lý GreenGuard AI. Tôi có thể giúp gì cho bạn hôm nay?`
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const handleSendChat = (e) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping) return
    
    const userMsg = chatInput.trim()
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }])
    setChatInput('')
    setIsTyping(true)

    // Simulate AI response based on real-time data
    setTimeout(() => {
      let aiResponse = 'Tôi đã tiếp nhận yêu cầu của bạn. Tôi khuyên bạn nên duy trì chế độ tự động để bảo vệ trang trại cây trồng.'
      
      const soil = latest?.soilMoisture ?? 50
      const temp = latest?.temperature ?? 26.5
      const lowerMsg = userMsg.toLowerCase()
      
      if (lowerMsg.includes('nước') || lowerMsg.includes('bơm') || lowerMsg.includes('tưới')) {
        aiResponse = `Độ ẩm đất hiện tại đang ở mức ${soil}%. ${
          soil < 55 
            ? 'Theo thuật toán TinyML dự đoán nhu cầu nước đang ở mức cao. Bạn nên kích hoạt máy bơm hoặc duy trì chế độ TỰ ĐỘNG để hệ thống tự tưới.' 
            : 'Độ ẩm đất hiện đang ổn định trên 55%. Chưa cần tưới nước thêm lúc này.'
        }`
      } else if (lowerMsg.includes('nhiệt độ') || lowerMsg.includes('nóng') || lowerMsg.includes('quạt')) {
        aiResponse = `Nhiệt độ hiện tại trong nhà kính đo được là ${temp}°C. ${
          temp > 28 
            ? 'Mức nhiệt khá cao, quạt thông gió nên được bật để đối lưu không khí.' 
            : 'Mức nhiệt này nằm trong ngưỡng phát triển tốt của cây.'
        }`
      } else if (lowerMsg.includes('trạng thái') || lowerMsg.includes('ổn định') || lowerMsg.includes('sao')) {
        aiResponse = `Hệ thống GreenGuard AI báo cáo: Nhiệt độ ${temp}°C, Độ ẩm đất ${soil}%, Độ ẩm không khí ${latest?.humidity ?? 64}%, Ánh sáng ${latest?.lux ?? 6264} lux. Mọi thông số hoạt động ở mức lý tưởng.`
      }

      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }])
      setIsTyping(false)
    }, 1500)
  }

  // Loading indicator for page setup
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: '#10b981',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div className="muted">Đang tải cấu hình bảng điều khiển...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24, color: '#ef9a9a', textAlign: 'center' }}>
        ⚠ {error}
      </div>
    )
  }

  // Handle empty state (No device added yet)
  if (devices.length === 0 && activeTab !== 'device-settings') {
    return (
      <div className="page-enter">
        <div className="dashboard-header">
          <div className="dashboard-title-group">
            <h1>HỆ THỐNG GREENBOARD</h1>
            <div className="subtitle">GIÁM SÁT SẢN XUẤT NÔNG NGHIỆP</div>
          </div>
          <div className="user-profile">
            <div className="user-profile-info">
              <div className="user-profile-name">{user?.name || user?.username || user?.email || 'User'}</div>
            </div>
            <div className="user-avatar">{userInitials}</div>
          </div>
        </div>
        
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-dim)' }}>
              Chưa có thiết bị nào được kết nối
            </div>
            <div className="small muted" style={{ marginBottom: 20, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Hãy thêm thiết bị ESP32 của bạn vào hệ thống GreenGuard AI để bắt đầu theo dõi nông nghiệp thông minh.
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/devices/new')}>
              + Thêm thiết bị mới
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isOnline = activeDevice?.status === 'online'

  return (
    <div className="page-enter">
      {/* Universal Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>{activeTab === 'overview' ? 'Tổng Quan' : activeTab === 'control' ? 'Điều Khiển' : activeTab === 'map' ? 'Bản Đồ Trang Trại' : activeTab === 'analytics' ? 'Phân Tích Dữ Liệu' : 'Trợ Lý AI'}</h1>
          <div className="subtitle">HỆ THỐNG GIÁM SÁT V2.4</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {filteredSelectDevices.length > 1 && (
            <select 
              value={activeDevice?._id} 
              onChange={(e) => setActiveDevice(devices.find(d => d._id === e.target.value))}
              style={{ width: 'auto', padding: '6px 12px', fontSize: 13, borderRadius: 10, background: '#121620' }}
            >
              {filteredSelectDevices.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          )}

          <Link 
            to="/devices/new" 
            className="btn btn-primary" 
            style={{ 
              padding: '6px 12px', 
              fontSize: 13, 
              borderRadius: 10, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              textDecoration: 'none'
            }}
          >
            ➕ Thêm thiết bị
          </Link>
          
          <div 
            className="user-profile" 
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
          >
            <div className="user-profile-info">
              <div className="user-profile-name">{user?.name || user?.username || user?.email || 'User'}</div>
            </div>
            <div className="user-avatar">{userInitials}</div>

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                background: '#0f121a',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                padding: '8px',
                zIndex: 1000,
                minWidth: 150,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <Link to="/devices" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  transition: 'background 0.2s',
                }} className="profile-menu-item">
                  <span>🖥️</span> Trang thiết bị
                </Link>
                <Link to="/settings" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  transition: 'background 0.2s',
                }} className="profile-menu-item">
                  <span>⚙️</span> Cài đặt
                </Link>
                <div onClick={logout} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#ef5350',
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }} className="profile-menu-item">
                  <span>🚪</span> Đăng xuất
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render selected view tab */}
      {/* Render selected view tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* TinyML Banner & Status Label Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div className="tinyml-banner" style={{ marginBottom: 0 }}>
              {tinymlText}
            </div>
            
            {activeDevice && (
              <span className={`live-indicator ${(deviceStatuses[activeDevice.externalId] || activeDevice.status) === 'online' ? 'connected' : 'disconnected'}`} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}>
                <span className="live-dot" />
                Thiết bị: <strong style={{ marginLeft: 4 }}>{(deviceStatuses[activeDevice.externalId] || activeDevice.status) === 'online' ? 'Online' : 'Offline'}</strong>
              </span>
            )}
          </div>

          {/* Metric cards grid */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="metric-card-new">
              <div className="metric-card-header">
                <span className="metric-card-title">Nhiệt độ</span>
                <span className="metric-card-icon" style={{ color: '#ff7043' }}>🌡️</span>
              </div>
              <div className="metric-card-value">
                {latest ? (typeof latest.temperature === 'number' ? latest.temperature.toFixed(2) : latest.temperature) : '26.50'}
                <span className="metric-card-unit">°C</span>
              </div>
            </div>

            <div className="metric-card-new">
              <div className="metric-card-header">
                <span className="metric-card-title">Độ ẩm không khí</span>
                <span className="metric-card-icon" style={{ color: '#29b6f6' }}>💧</span>
              </div>
              <div className="metric-card-value">
                {latest ? (typeof latest.humidity === 'number' ? latest.humidity.toFixed(2) : latest.humidity) : '64.00'}
                <span className="metric-card-unit">%</span>
              </div>
            </div>

            {/* Độ ẩm đất highlighted card with left border */}
            <div className="metric-card-new highlighted">
              <div className="metric-card-header">
                <span className="metric-card-title">Độ ẩm đất</span>
                <span className="metric-card-icon" style={{ color: '#10b981' }}>🪴</span>
              </div>
              <div className="metric-card-value">
                {latest ? latest.soilMoisture : '50'}
                <span className="metric-card-unit">%</span>
              </div>
            </div>

            <div className="metric-card-new">
              <div className="metric-card-header">
                <span className="metric-card-title">Ánh sáng</span>
                <span className="metric-card-icon" style={{ color: '#ffa726' }}>☀️</span>
              </div>
              <div className="metric-card-value">
                {latest ? latest.lux : '6264'}
                <span className="metric-card-unit">lux</span>
              </div>
            </div>
          </div>

          {/* Split grid for Telemetry Chart and Device Matrix */}
          <div className="dashboard-grid">
            {/* Left Column: Area Chart card */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                    Lịch sử telemetry (Theo thời gian thực)
                  </h3>
                  <span className="badge ok" style={{ fontSize: 9 }}>LIVE DATA</span>
                </div>
                <span className={`live-indicator ${sseStatus}`} style={{ fontSize: 11 }}>
                  <span className="live-dot" />
                  {sseStatus === 'connected' ? 'Live Streaming' : 'Reconnecting...'}
                </span>
              </div>

              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff7043" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ff7043" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorSoil" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="timeLabel"
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="temperature" 
                      name="Nhiệt độ (°C)" 
                      stroke="#ff7043" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorTemp)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="soilMoisture" 
                      name="Độ ẩm đất (%)" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSoil)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Column: Device Matrix Switches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {overrideNotice && (
                <div style={{
                  background: 'rgba(255, 167, 38, 0.1)',
                  border: '1px solid rgba(255, 167, 38, 0.2)',
                  color: '#ffa726',
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  ⚠️ {overrideNotice}
                </div>
              )}

              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Device Matrix
                  </h3>
                </div>

                {/* Toggles list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">💦</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Máy bơm</span>
                        <span className="switch-control-status">{(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    {opMode === 'manual' ? (
                      <label className="ios-switch">
                        <input 
                          type="checkbox" 
                          checked={cmdPump === 'ON'} 
                          onChange={() => toggleRelay('pump', cmdPump, s3Controller?._id)} 
                          disabled={!s3Controller}
                        />
                        <span className="ios-slider"></span>
                      </label>
                    ) : (
                      <span style={{ 
                        fontSize: 11, fontWeight: 700,
                        color: (s3Controller?.lastPumpState || 'OFF') === 'ON' ? '#10b981' : 'var(--text-muted)',
                        background: (s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                        padding: '3px 8px', borderRadius: 6,
                        border: `1px solid ${(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`
                      }}>
                        {(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                      </span>
                    )}
                  </div>

                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">💡</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Hệ thống đèn</span>
                        <span className="switch-control-status">{(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    {opMode === 'manual' ? (
                      <label className="ios-switch">
                        <input 
                          type="checkbox" 
                          checked={cmdLight === 'ON'} 
                          onChange={() => toggleRelay('light', cmdLight, s3Controller?._id)} 
                          disabled={!s3Controller}
                        />
                        <span className="ios-slider"></span>
                      </label>
                    ) : (
                      <span style={{ 
                        fontSize: 11, fontWeight: 700,
                        color: (s3Controller?.lastLightState || 'OFF') === 'ON' ? '#ffa726' : 'var(--text-muted)',
                        background: (s3Controller?.lastLightState || 'OFF') === 'ON' ? 'rgba(255,167,38,0.1)' : 'rgba(255,255,255,0.02)',
                        padding: '3px 8px', borderRadius: 6,
                        border: `1px solid ${(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'rgba(255,167,38,0.2)' : 'var(--border)'}`
                      }}>
                        {(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                      </span>
                    )}
                  </div>

                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">🌀</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Quạt thông gió</span>
                        <span className="switch-control-status">{(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    {opMode === 'manual' ? (
                      <label className="ios-switch">
                        <input 
                          type="checkbox" 
                          checked={cmdFan === 'ON'} 
                          onChange={() => toggleRelay('fan', cmdFan, s3Controller?._id)} 
                          disabled={!s3Controller}
                        />
                        <span className="ios-slider"></span>
                      </label>
                    ) : (
                      <span style={{ 
                        fontSize: 11, fontWeight: 700,
                        color: (s3Controller?.lastFanState || 'OFF') === 'ON' ? '#29b6f6' : 'var(--text-muted)',
                        background: (s3Controller?.lastFanState || 'OFF') === 'ON' ? 'rgba(41,182,246,0.1)' : 'rgba(255,255,255,0.02)',
                        padding: '3px 8px', borderRadius: 6,
                        border: `1px solid ${(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'rgba(41,182,246,0.2)' : 'var(--border)'}`
                      }}>
                        {(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Operational mode buttons */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>
                    ⚙️ Operational Mode
                  </div>
                  <div className="mode-selector">
                    <button 
                      className={`mode-btn ${opMode === 'manual' ? 'active' : ''}`}
                      onClick={() => handleModeChange('manual', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Manual
                    </button>
                    <button 
                      className={`mode-btn ${opMode === 'auto' ? 'active' : ''}`}
                      onClick={() => handleModeChange('auto', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Auto
                    </button>
                    <button 
                      className={`mode-btn ${opMode === 'scheduled' ? 'active' : ''}`}
                      onClick={() => handleModeChange('scheduled', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Scheduled
                    </button>
                  </div>
                </div>
              </div>

              {/* Safety Windows Configuration Panel - only if opMode is 'scheduled' */}
              {opMode === 'scheduled' && s3Controller && (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>⏰ Khung giờ an toàn</h4>
                      <div className="small muted" style={{ marginTop: 2 }}>Khoảng thời gian AI được phép bật máy bơm</div>
                    </div>
                  </div>

                  {/* List of safety windows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {!s3Controller.safetyWindows || s3Controller.safetyWindows.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13, background: 'rgba(0,0,0,0.15)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                        Chưa thiết lập khung giờ nào (Bơm đang bị khóa hoàn toàn)
                      </div>
                    ) : (
                      s3Controller.safetyWindows.map((w, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                          borderRadius: 10,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>⏰</span>
                            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#81c784' }}>
                              {w.start} - {w.end}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              const updatedWindows = s3Controller.safetyWindows.filter((_, i) => i !== idx);
                              try {
                                const res = await api.put(`/api/devices/${s3Controller._id}`, { safetyWindows: updatedWindows });
                                setDevices(prev => prev.map(d => d._id === s3Controller._id ? res.data : d));
                              } catch (e) {
                                alert('Không thể xóa khung giờ an toàn');
                              }
                            }}
                            className="btn"
                            style={{
                              padding: '4px 8px', fontSize: 11,
                              background: 'rgba(239,83,80,0.1)',
                              borderColor: 'rgba(239,83,80,0.25)',
                              color: '#ef9a9a',
                              borderRadius: 6
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add form */}
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const startVal = e.target.start.value;
                    const endVal = e.target.end.value;
                    if (!startVal || !endVal) return;
                    const updatedWindows = [...(s3Controller.safetyWindows || []), { start: startVal, end: endVal }];
                    try {
                      const res = await api.put(`/api/devices/${s3Controller._id}`, { safetyWindows: updatedWindows });
                      setDevices(prev => prev.map(d => d._id === s3Controller._id ? res.data : d));
                      e.target.reset();
                    } catch (e) {
                      alert('Không thể thêm khung giờ an toàn');
                    }
                  }} style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 12,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Thêm khung giờ cho phép</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="time" name="start" required style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, background: '#0b0d13', border: '1px solid var(--border)', color: '#fff' }} />
                      <span className="muted" style={{ fontSize: 12 }}>đến</span>
                      <input type="time" name="end" required style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6, background: '#0b0d13', border: '1px solid var(--border)', color: '#fff' }} />
                      <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}>
                        + Thêm
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'control' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* S3 Controllers Status Row */}
          {s3Controllers.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
                🎛️ Trạng thái bộ điều khiển S3 ({s3Controllers.length})
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {s3Controllers.map(dev => {
                  const liveStatus = deviceStatuses[dev.externalId] || dev.status
                  const isOnlineDev = liveStatus === 'online'
                  return (
                    <div
                      key={dev._id}
                      onClick={() => setActiveDevice(dev)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: activeDevice?._id === dev._id ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activeDevice?._id === dev._id ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: 200,
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isOnlineDev ? '#10b981' : '#ef5350',
                        boxShadow: isOnlineDev ? '0 0 6px rgba(16,185,129,0.6)' : '0 0 6px rgba(239,83,80,0.4)',
                        flexShrink: 0,
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🎛️ {dev.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                          S3 Controller · {liveStatus}
                        </div>
                      </div>
                      <span className={`badge ${isOnlineDev ? 'ok' : 'err'}`} style={{ fontSize: 9, marginLeft: 'auto', flexShrink: 0 }}>
                        {liveStatus}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Control Grid */}
          <div className="dashboard-grid">
            
            {/* Left Column: Automation and Schedules */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {activeDevice ? (
                <>
                  <AutomationPanel device={activeDevice} onSaved={(d) => { setActiveDevice(d) }} />
                  <SchedulesPanel deviceId={activeDevice._id} />
                </>
              ) : (
                <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Vui lòng thêm hoặc chọn thiết bị S3 để thiết lập tự động hoá và hẹn giờ.
                </div>
              )}
            </div>

            {/* Right Column: Device Matrix Switches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {overrideNotice && (
                <div style={{
                  background: 'rgba(255, 167, 38, 0.1)',
                  border: '1px solid rgba(255, 167, 38, 0.2)',
                  color: '#ffa726',
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  ⚠️ {overrideNotice}
                </div>
              )}

              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Device Matrix
                  </h3>
                </div>

                {/* Toggles list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">💦</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Máy bơm</span>
                        <span className="switch-control-status">{cmdPump === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    <label className="ios-switch">
                      <input 
                        type="checkbox" 
                        checked={cmdPump === 'ON'} 
                        onChange={() => toggleRelay('pump', cmdPump, s3Controller?._id)} 
                        disabled={!s3Controller}
                      />
                      <span className="ios-slider"></span>
                    </label>
                  </div>

                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">💡</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Hệ thống đèn</span>
                        <span className="switch-control-status">{cmdLight === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    <label className="ios-switch">
                      <input 
                        type="checkbox" 
                        checked={cmdLight === 'ON'} 
                        onChange={() => toggleRelay('light', cmdLight, s3Controller?._id)} 
                        disabled={!s3Controller}
                      />
                      <span className="ios-slider"></span>
                    </label>
                  </div>

                  <div className="switch-control">
                    <div className="switch-control-left">
                      <div className="switch-control-icon">🌀</div>
                      <div className="switch-control-info">
                        <span className="switch-control-name">Quạt thông gió</span>
                        <span className="switch-control-status">{cmdFan === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                      </div>
                    </div>
                    <label className="ios-switch">
                      <input 
                        type="checkbox" 
                        checked={cmdFan === 'ON'} 
                        onChange={() => toggleRelay('fan', cmdFan, s3Controller?._id)} 
                        disabled={!s3Controller}
                      />
                      <span className="ios-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Operational mode buttons */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>
                    ⚙️ Operational Mode
                  </div>
                  <div className="mode-selector">
                    <button 
                      className={`mode-btn ${opMode === 'manual' ? 'active' : ''}`}
                      onClick={() => handleModeChange('manual', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Manual
                    </button>
                    <button 
                      className={`mode-btn ${opMode === 'auto' ? 'active' : ''}`}
                      onClick={() => handleModeChange('auto', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Auto
                    </button>
                    <button 
                      className={`mode-btn ${opMode === 'scheduled' ? 'active' : ''}`}
                      onClick={() => handleModeChange('scheduled', s3Controller?._id)}
                      disabled={modeChanging || !s3Controller}
                    >
                      Scheduled
                    </button>
                  </div>
                </div>

                {/* Expected Consumption Info Banner */}
                <div className="water-info-banner" style={{ marginTop: 'auto' }}>
                  <span className="water-info-icon">ℹ️</span>
                  <span>Dự kiến tiêu thụ: 20L nước sạch dựa trên chu kỳ vận hành</span>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
            Bản Đồ Phân Phối Thiết Bị
          </h3>
          <div style={{ 
            height: 380, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'rgba(0,0,0,0.3)', 
            borderRadius: 12,
            border: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Blinking Grid Background */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            
            {/* SVG Farm Plot layout */}
            <svg viewBox="0 0 400 240" width="100%" height="80%" style={{ position: 'relative', maxWidth: 500 }}>
              <rect x="20" y="20" width="360" height="200" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
              
              {/* Agricultural zones grid */}
              <line x1="140" y1="20" x2="140" y2="220" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="260" y1="20" x2="260" y2="220" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              
              <text x="75" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC A (RAU SẠCH)</text>
              <text x="200" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC B (CÂY ĂN QUẢ)</text>
              <text x="325" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC C (HOA KIỂNG)</text>
              
              {/* Nodes and Sensor coordinates */}
              <circle cx="80" cy="120" r="25" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)" />
              <circle cx="80" cy="120" r="4" fill="#10b981" />
              <text x="80" y="160" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">NODE 1 (HOẠT ĐỘNG)</text>
              
              <circle cx="200" cy="120" r="25" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
              <circle cx="200" cy="120" r="4" fill="rgba(255,255,255,0.3)" />
              <text x="200" y="160" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">NODE 2 (OFFLINE)</text>

              <circle cx="320" cy="120" r="25" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
              <circle cx="320" cy="120" r="4" fill="rgba(255,255,255,0.3)" />
              <text x="320" y="160" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">NODE 3 (OFFLINE)</text>

              {/* Water Valve Line Connection */}
              <path d="M 80 120 L 200 120 L 320 120" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
            
            {/* Blinking Live Indicator overlay */}
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#81c784', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-green 1.5s infinite' }} />
              BẢN ĐỒ TRỰC TUYẾN
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="grid grid-2">
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>NHIỆT ĐỘ CẢM BIẾN (°C)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="temperature" stroke="#ff7043" strokeWidth={2} fill="rgba(255,112,67,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>ĐỘ ẨM KHÔNG KHÍ (%)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="humidity" stroke="#29b6f6" strokeWidth={2} fill="rgba(41,182,246,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>ĐỘ ẨM ĐẤT (%)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="soilMoisture" stroke="#10b981" strokeWidth={2} fill="rgba(16,185,129,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>CƯỜNG ĐỘ ÁNH SÁNG (LUX)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="lux" stroke="#ffa726" strokeWidth={2} fill="rgba(255,167,38,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="card" style={{ padding: 0, height: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border)',
            background: 'rgba(16,185,129,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#10b981', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Trợ lý GreenGuard AI</div>
              <div style={{ fontSize: 10, color: '#81c784', fontWeight: 600 }}>TINYML KẾT NỐI TRỰC TUYẾN</div>
            </div>
          </div>

          {/* Chat message logs */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                style={{
                  alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end',
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: m.sender === 'ai' ? 'rgba(255,255,255,0.04)' : '#10b981',
                  color: '#fff',
                  border: m.sender === 'ai' ? '1px solid var(--border)' : 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                {m.text}
              </div>
            ))}
            
            {isTyping && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: 4,
                alignItems: 'center'
              }}>
                <span className="dot-typing" />
                <span className="dot-typing" />
                <span className="dot-typing" />
                <style>{`
                  .dot-typing {
                    width: 6px; height: 6px;
                    background-color: var(--text-dim);
                    border-radius: 50%;
                    display: inline-block;
                    animation: bounce 1.4s infinite ease-in-out both;
                  }
                  .dot-typing:nth-child(1) { animation-delay: -0.32s; }
                  .dot-typing:nth-child(2) { animation-delay: -0.16s; }
                  @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                  }
                `}</style>
              </div>
            )}
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendChat} style={{ 
            padding: 16, 
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10
          }}>
            <input 
              type="text" 
              placeholder="Hỏi trợ lý về tưới nước, nhiệt độ hoặc độ ẩm..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isTyping}
              style={{ flex: 1, padding: '10px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 10, outline: 'none', color: '#fff' }}
            />
            <button 
              className="btn btn-primary" 
              type="submit" 
              disabled={isTyping || !chatInput.trim()}
              style={{ borderRadius: 10, padding: '10px 16px' }}
            >
              Gửi
            </button>
          </form>
        </div>
      )}

      {activeTab === 'device-settings' && (
        <DeviceSettingsPanel 
          devices={devices} 
          setDevices={setDevices} 
          activeDevice={activeDevice} 
          setActiveDevice={setActiveDevice} 
        />
      )}
    </div>
  )
}
