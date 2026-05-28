import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import DeviceSettingsPanel from '../components/DeviceSettingsPanel'
import UserProfile from '../components/UserProfile'
import OverviewTab from '../components/OverviewTab'
import ControlTab from '../components/ControlTab'
import AnalyticsTab from '../components/AnalyticsTab'
import AiTab from '../components/AiTab'

export default function DevicesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()


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
  const [generatingReport, setGeneratingReport] = useState(false)
  const [aiReportText, setAiReportText] = useState('')
  const [schedules, setSchedules] = useState([])

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
          if (payload.opMode) setOpMode(payload.opMode)

          // Sync devices array and activeDevice object
          setDevices(prev => prev.map(d => {
            if (d.externalId === payload.externalId) {
              return {
                ...d,
                lastFanState: payload.relayFan || d.lastFanState,
                lastLightState: payload.relayLight || d.lastLightState,
                lastPumpState: payload.relayPump || d.lastPumpState,
                opMode: payload.opMode || d.opMode,
              }
            }
            // If the message is from WROOM and this device is the paired S3 controller, also update its opMode and states
            if (payload.externalId && (payload.externalId.startsWith('esp32-') || payload.externalId.startsWith('wroom-'))) {
              if (d.externalId && d.externalId.startsWith('esp32s3-') && d.pairedSensorId === payload.externalId) {
                return {
                  ...d,
                  lastFanState: payload.relayFan || d.lastFanState,
                  lastLightState: payload.relayLight || d.lastLightState,
                  lastPumpState: payload.relayPump || d.lastPumpState,
                  opMode: payload.opMode || d.opMode,
                }
              }
            }
            return d
          }))

          setActiveDevice(prev => {
            if (prev && prev.externalId === payload.externalId) {
              return {
                ...prev,
                lastFanState: payload.relayFan || prev.lastFanState,
                lastLightState: payload.relayLight || prev.lastLightState,
                lastPumpState: payload.relayPump || prev.lastPumpState,
                opMode: payload.opMode || prev.opMode,
              }
            }
            // If the message is from WROOM and activeDevice is the paired S3 controller, also update it
            if (prev && payload.externalId && (payload.externalId.startsWith('esp32-') || payload.externalId.startsWith('wroom-'))) {
              if (prev.externalId && prev.externalId.startsWith('esp32s3-') && prev.pairedSensorId === payload.externalId) {
                return {
                  ...prev,
                  lastFanState: payload.relayFan || prev.lastFanState,
                  lastLightState: payload.relayLight || prev.lastLightState,
                  lastPumpState: payload.relayPump || prev.lastPumpState,
                  opMode: payload.opMode || prev.opMode,
                }
              }
            }
            return prev
          })

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
    otherSseRefs.current.forEach(es => { try { es.close() } catch (_) { } })
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
          } catch (_) { }
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
                  opMode: payload.opMode || d.opMode,
                }
              }
              return d
            }))
          } catch (_) { }
        })
        otherSseRefs.current.push(es)
      } catch (_) { }
    })

    return () => {
      otherSseRefs.current.forEach(es => { try { es.close() } catch (_) { } })
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
    console.log('[handleModeChange] Enter:', { mode, id, modeChanging, opMode })
    if (!id || modeChanging) {
      console.warn('[handleModeChange] Bailed out due to missing ID or modeChanging is true:', { id, modeChanging })
      return
    }

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
      console.log('[handleModeChange] PUT payload:', payload)
      const res = await api.put(`/api/devices/${id}`, payload)
      console.log('[handleModeChange] Success:', res.data)
      setDevices(prev => prev.map(d => d._id === id ? res.data : d))
      if (activeDevice && activeDevice._id === id) {
        setActiveDevice(res.data)
      }
    } catch (e) {
      console.error('[handleModeChange] Failed:', e)
      setOpMode(prevMode)
    } finally {
      setModeChanging(false)
      isRequestActiveRef.current = false
      console.log('[handleModeChange] Reset modeChanging to false')
    }
  }



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
      let aiResponse = 'Tôi chưa hiểu câu hỏi của bạn lắm. Bạn có thể hỏi tôi về nhiệt độ, độ ẩm đất, thiết bị bơm, hoặc gõ "trạng thái" để tôi báo cáo tổng quan nhé!'

      const soil = latest?.soilMoisture ?? 50
      const temp = latest?.temperature ?? 26.5
      const lowerMsg = userMsg.toLowerCase()
      const words = lowerMsg.trim().split(/\s+/)

      const greetingKeywords = ['hello', 'hi', 'hé', 'he', 'alo', 'hey', 'nhô']
      const isGreeting = lowerMsg.includes('chào') || words.some(w => greetingKeywords.includes(w))

      if (lowerMsg.includes('nước') || lowerMsg.includes('bơm') || lowerMsg.includes('tưới')) {
        aiResponse = `Độ ẩm đất hiện tại đang ở mức ${soil}%. ${soil < 55
            ? 'Theo thuật toán TinyML dự đoán nhu cầu nước đang ở mức cao. Bạn nên kích hoạt máy bơm hoặc duy trì chế độ TỰ ĐỘNG để hệ thống tự tưới.'
            : 'Độ ẩm đất hiện đang ổn định trên 55%. Chưa cần tưới nước thêm lúc này.'
          }`
      } else if (lowerMsg.includes('nhiệt độ') || lowerMsg.includes('nóng') || lowerMsg.includes('quạt')) {
        aiResponse = `Nhiệt độ hiện tại trong nhà kính đo được là ${temp}°C. ${temp > 28
            ? 'Mức nhiệt khá cao, quạt thông gió nên được bật để đối lưu không khí.'
            : 'Mức nhiệt này nằm trong ngưỡng phát triển tốt của cây.'
          }`
      } else if (lowerMsg.includes('chuyện gì') || lowerMsg.includes('có chuyện gì') || lowerMsg.includes('có gì') || lowerMsg.includes('bị sao')) {
        aiResponse = `Hệ thống nhà kính của bạn vẫn đang hoạt động bình thường, không có sự cố gì xảy ra cả. Nhiệt độ hiện tại là ${temp}°C và độ ẩm đất là ${soil}%.`
      } else if (lowerMsg.includes('trạng thái') || lowerMsg.includes('ổn định') || lowerMsg.includes('sao')) {
        aiResponse = `Hệ thống GreenGuard AI báo cáo: Nhiệt độ ${temp}°C, Độ ẩm đất ${soil}%, Độ ẩm không khí ${latest?.humidity ?? 64}%, Ánh sáng ${latest?.lux ?? 6264} lux. Mọi thông số hoạt động ở mức lý tưởng.`
      } else if (isGreeting) {
        aiResponse = `Xin chào! Tôi là trợ lý GreenGuard AI. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi tôi về trạng thái nhà kính, nhiệt độ, độ ẩm hoặc hệ thống tưới nước nhé.`
      }

      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }])
      setIsTyping(false)
    }, 1500)
  }

  const generateReport = () => {
    setGeneratingReport(true)
    setAiReportText('')
    setTimeout(() => {
      setGeneratingReport(false)
      setAiReportText('Báo cáo phân tích: Độ ẩm đất duy trì trung bình ở mức 58%, nhiệt độ nhà kính ổn định ở mức 32.5°C. TinyML khuyến nghị duy trì chu kỳ tưới vào lúc 06:00 hàng ngày và tối ưu hóa hệ thống chiếu sáng từ 18:00 đến 22:00 để thúc đẩy sinh trưởng.')
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
          <UserProfile user={user} logout={logout} />
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
          <h1>{activeTab === 'overview' ? 'Tổng Quan' : activeTab === 'control' ? 'Điều Khiển' : activeTab === 'analytics' ? 'Phân Tích Dữ Liệu' : activeTab === 'ai' ? 'Trợ Lý AI' : 'Cài Đặt Thiết Bị'}</h1>
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

          <UserProfile user={user} logout={logout} />
        </div>
      </div>

      {/* Render selected view tab */}
      {activeTab === 'overview' && (
        <OverviewTab
          tinymlText={tinymlText}
          activeDevice={activeDevice}
          deviceStatuses={deviceStatuses}
          latest={latest}
          chartsData={chartsData}
          sseStatus={sseStatus}
          cmdPump={cmdPump}
          cmdLight={cmdLight}
          cmdFan={cmdFan}
          toggleRelay={toggleRelay}
          s3Controller={s3Controller}
          opMode={opMode}
          handleModeChange={handleModeChange}
          modeChanging={modeChanging}
          overrideNotice={overrideNotice}
          setDevices={setDevices}
        />
      )}

      {activeTab === 'control' && (
        <ControlTab
          s3Controllers={s3Controllers}
          deviceStatuses={deviceStatuses}
          activeDevice={activeDevice}
          setActiveDevice={setActiveDevice}
          overrideNotice={overrideNotice}
          cmdPump={cmdPump}
          cmdLight={cmdLight}
          cmdFan={cmdFan}
          toggleRelay={toggleRelay}
          s3Controller={s3Controller}
          opMode={opMode}
          handleModeChange={handleModeChange}
          modeChanging={modeChanging}
          setDevices={setDevices}
        />
      )}



      {activeTab === 'analytics' && (
        <AnalyticsTab
          chartsData={chartsData}
          aiReportText={aiReportText}
          generateReport={generateReport}
          generatingReport={generatingReport}
        />
      )}

      {activeTab === 'ai' && (
        <AiTab
          user={user}
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isTyping={isTyping}
          handleSendChat={handleSendChat}
        />
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
