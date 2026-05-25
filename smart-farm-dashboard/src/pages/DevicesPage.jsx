import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import AutomationPanel from '../components/AutomationPanel'
import SchedulesPanel from '../components/SchedulesPanel'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DevicesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  
  const [showDropdown, setShowDropdown] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Parse query parameter to render appropriate view tab
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab') || 'overview'

  const [devices, setDevices] = useState([])
  const [activeDevice, setActiveDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          if (devs.length > 0) {
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

  // Sync active device automation states to client-side opMode
  useEffect(() => {
    if (!activeDevice) return
    if (activeDevice.autoFanEnabled || activeDevice.autoPumpEnabled || activeDevice.autoLightEnabled) {
      setOpMode('auto')
    } else {
      const savedMode = localStorage.getItem(`device_mode_${activeDevice._id}`)
      if (savedMode === 'scheduled') {
        setOpMode('scheduled')
      } else {
        setOpMode('manual')
      }
    }
    if (activeDevice.lastFanState) setCmdFan(activeDevice.lastFanState)
    if (activeDevice.lastLightState) setCmdLight(activeDevice.lastLightState)
    if (activeDevice.lastPumpState) setCmdPump(activeDevice.lastPumpState)
  }, [activeDevice])

  // Load telemetry sensors data for the selected device
  const loadTelemetry = async (deviceId) => {
    try {
      const res = await api.get('/api/sensors', { params: { deviceId, limit: 30 } })
      const arr = res.data || []
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

  // Load schedules for selected device when control tab is active
  useEffect(() => {
    if (!activeDevice || activeTab !== 'control') return
    async function loadSchedules() {
      try {
        const res = await api.get('/api/schedules', { params: { deviceId: activeDevice._id } })
        setSchedules(res.data || [])
      } catch (e) {}
    }
    loadSchedules()
  }, [activeDevice, activeTab])

  // Load telemetry initially and check for updates
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
  }, [activeDevice, sseStatus])

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
          
          setLatest({
            timestamp: payload.timestamp || Date.now(),
            temperature: payload.temperature,
            humidity: payload.humidity,
            soilMoisture: payload.soilMoisture ?? payload.soil_pct ?? 0,
            lux: payload.lux,
          })

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
        } catch { }
      })

      es.addEventListener('status', (evt) => {
        try {
          const s = JSON.parse(evt.data)
          setActiveDevice(prev => prev ? { ...prev, status: s.status } : prev)
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

  // Helper to toggle manual relays
  const toggleRelay = async (target, currentState) => {
    if (!activeDevice) return
    const action = currentState === 'ON' ? 'OFF' : 'ON'
    
    // Optimistic UI updates
    if (target === 'pump') setCmdPump(action)
    if (target === 'light') setCmdLight(action)
    if (target === 'fan') setCmdFan(action)

    try {
      await api.post('/api/commands', { deviceId: activeDevice._id, target, action })
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
  const handleModeChange = async (mode) => {
    if (!activeDevice || modeChanging) return
    
    // Save the client-side preference for non-auto modes (manual vs scheduled)
    localStorage.setItem(`device_mode_${activeDevice._id}`, mode)
    
    setOpMode(mode)
    setModeChanging(true)
    
    try {
      const isAuto = mode === 'auto'
      const payload = {
        autoFanEnabled: isAuto,
        autoPumpEnabled: isAuto,
        autoLightEnabled: isAuto,
      }
      const res = await api.put(`/api/devices/${activeDevice._id}`, payload)
      setActiveDevice(res.data)
    } catch (e) {
      // Revert if API fail
      setOpMode(opMode)
    } finally {
      setModeChanging(false)
    }
  }

  // Dynamic user initials avatar
  const userInitials = useMemo(() => {
    const displayName = user?.name || user?.username || user?.email || 'User'
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      const last = parts[parts.length - 1]
      const prev = parts[parts.length - 2]
      return ((prev ? prev[0] : '') + (last ? last[0] : '')).toUpperCase()
    }
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
  if (devices.length === 0) {
    return (
      <div className="page-enter">
        <div className="dashboard-header">
          <div className="dashboard-title-group">
            <h1>HỆ THỐNG GREENBOARD</h1>
            <div className="subtitle">GIÁM SÁT SẢN XUẤT NÔNG NGHIỆP</div>
          </div>
          <div 
            ref={profileRef}
            className="user-profile" 
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="user-profile-info">
              <div className="user-profile-title">GIÁM SÁT VIÊN</div>
              <div className="user-profile-name">{user?.name || user?.username || user?.email || 'User'}</div>
            </div>
            <div className="user-avatar">{userInitials}</div>
            {showDropdown && (
              <div className="user-profile-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className="dropdown-item" onClick={logout}>
                  <span>🚪</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
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
          {devices.length > 1 && (
            <select 
              value={activeDevice?._id} 
              onChange={(e) => setActiveDevice(devices.find(d => d._id === e.target.value))}
              style={{ width: 'auto', padding: '6px 12px', fontSize: 13, borderRadius: 10, background: '#121620' }}
            >
              {devices.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          )}
          
          <div 
            ref={profileRef}
            className="user-profile" 
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="user-profile-info">
              <div className="user-profile-title">GIÁM SÁT VIÊN</div>
              <div className="user-profile-name">{user?.name || user?.username || user?.email || 'User'}</div>
            </div>
            <div className="user-avatar">{userInitials}</div>
            {showDropdown && (
              <div className="user-profile-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className="dropdown-item" onClick={logout}>
                  <span>🚪</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render selected view tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* TinyML Banner */}
          <div className="tinyml-banner">
            {tinymlText}
          </div>

          {/* Metric cards grid */}
          <div className="metrics-grid">
            <div className="metric-card-new">
              <div className="metric-card-header">
                <span className="metric-card-title">Nhiệt độ</span>
                <span className="metric-card-icon" style={{ color: '#ff7043' }}>🌡️</span>
              </div>
              <div className="metric-card-value">
                {latest ? latest.temperature : '26.5'}
                <span className="metric-card-unit">°C</span>
              </div>
            </div>

            <div className="metric-card-new">
              <div className="metric-card-header">
                <span className="metric-card-title">Độ ẩm không khí</span>
                <span className="metric-card-icon" style={{ color: '#29b6f6' }}>💧</span>
              </div>
              <div className="metric-card-value">
                {latest ? latest.humidity : '64'}
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

          {/* Device matrix notices */}
          {overrideNotice && (
            <div style={{
              background: 'rgba(255, 167, 38, 0.1)',
              border: '1px solid rgba(255, 167, 38, 0.2)',
              color: '#ffa726',
              padding: '10px 16px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
            }}>
              ⚠️ {overrideNotice}
            </div>
          )}

          {/* Split grid: Chart & Matrix */}
          <div className="dashboard-grid">
            
            {/* Left Column: Line Chart */}
            <div className="card" style={{ padding: 20 }}>
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
                      onChange={() => toggleRelay('pump', cmdPump)} 
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
                      onChange={() => toggleRelay('light', cmdLight)} 
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
                      onChange={() => toggleRelay('fan', cmdFan)} 
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
                    onClick={() => handleModeChange('manual')}
                    disabled={modeChanging}
                  >
                    Manual
                  </button>
                  <button 
                    className={`mode-btn ${opMode === 'auto' ? 'active' : ''}`}
                    onClick={() => handleModeChange('auto')}
                    disabled={modeChanging}
                  >
                    Auto
                  </button>
                  <button 
                    className={`mode-btn ${opMode === 'scheduled' ? 'active' : ''}`}
                    onClick={() => handleModeChange('scheduled')}
                    disabled={modeChanging}
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
      )}

      {activeTab === 'control' && (() => {
        const getTargetLabel = (target) => {
          if (target === 'pump') return 'DAILY CYCLE • WATER PUMP'
          if (target === 'light') return 'DAILY CYCLE • GROW LIGHTS'
          if (target === 'fan') return 'DAILY CYCLE • EXHAUST FAN'
          return `DAILY CYCLE • ${target.toUpperCase()}`
        }
        const getMockDuration = (target) => {
          if (target === 'pump') return '10p'
          if (target === 'light') return '12h'
          return '30p'
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Left Column: Chế độ hệ thống */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.5px' }}>
                  VẬN HÀNH LỐI
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>
                  Chế độ hệ thống
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* THỦ CÔNG */}
                  <div 
                    onClick={() => handleModeChange('manual')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: opMode === 'manual' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${opMode === 'manual' ? '#10b981' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: opMode === 'manual' ? '#10b981' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: opMode === 'manual' ? '#fff' : 'var(--text-dim)',
                        fontSize: 18,
                      }}>
                        ⏻
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: opMode === 'manual' ? '#10b981' : 'var(--text)' }}>THỦ CÔNG</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ghi đè trực tiếp bởi người dùng</div>
                      </div>
                    </div>
                    {opMode === 'manual' && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    )}
                  </div>

                  {/* TỰ ĐỘNG (AI) */}
                  <div 
                    onClick={() => handleModeChange('auto')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: opMode === 'auto' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${opMode === 'auto' ? '#10b981' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: opMode === 'auto' ? '#10b981' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: opMode === 'auto' ? '#fff' : 'var(--text-dim)',
                        fontSize: 18,
                      }}>
                        🧠
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: opMode === 'auto' ? '#10b981' : 'var(--text)' }}>TỰ ĐỘNG (AI)</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TinyML phân tích logic tại biên</div>
                      </div>
                    </div>
                    {opMode === 'auto' && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    )}
                  </div>

                  {/* LỊCH TRÌNH */}
                  <div 
                    onClick={() => handleModeChange('scheduled')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: opMode === 'scheduled' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${opMode === 'scheduled' ? '#10b981' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: opMode === 'scheduled' ? '#10b981' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: opMode === 'scheduled' ? '#fff' : 'var(--text-dim)',
                        fontSize: 18,
                      }}>
                        🕒
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: opMode === 'scheduled' ? '#10b981' : 'var(--text)' }}>LỊCH TRÌNH</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Theo mốc thời gian thiết lập</div>
                      </div>
                    </div>
                    {opMode === 'scheduled' && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Devices Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Pump */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      ⏻
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Water Pump</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                        {cmdPump === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleRelay('pump', cmdPump)}
                    disabled={opMode !== 'manual'}
                    style={{
                      backgroundColor: opMode !== 'manual' 
                        ? '#121620' 
                        : (cmdPump === 'ON' ? '#10b981' : '#1f2937'),
                      color: opMode !== 'manual' 
                        ? 'rgba(255,255,255,0.15)' 
                        : (cmdPump === 'ON' ? '#fff' : 'var(--text-dim)'),
                      border: opMode !== 'manual' ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: opMode !== 'manual' ? 'not-allowed' : 'pointer',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      opacity: opMode !== 'manual' ? 0.35 : 1,
                    }}
                  >
                    {cmdPump === 'ON' ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Light */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      ☀️
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Grow Lights</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                        {cmdLight === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleRelay('light', cmdLight)}
                    disabled={opMode !== 'manual'}
                    style={{
                      backgroundColor: opMode !== 'manual' 
                        ? '#121620' 
                        : (cmdLight === 'ON' ? '#10b981' : '#1f2937'),
                      color: opMode !== 'manual' 
                        ? 'rgba(255,255,255,0.15)' 
                        : (cmdLight === 'ON' ? '#fff' : 'var(--text-dim)'),
                      border: opMode !== 'manual' ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: opMode !== 'manual' ? 'not-allowed' : 'pointer',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      opacity: opMode !== 'manual' ? 0.35 : 1,
                    }}
                  >
                    {cmdLight === 'ON' ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Fan */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      🌀
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Exhaust Fan</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                        {cmdFan === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleRelay('fan', cmdFan)}
                    disabled={opMode !== 'manual'}
                    style={{
                      backgroundColor: opMode !== 'manual' 
                        ? '#121620' 
                        : (cmdFan === 'ON' ? '#10b981' : '#1f2937'),
                      color: opMode !== 'manual' 
                        ? 'rgba(255,255,255,0.15)' 
                        : (cmdFan === 'ON' ? '#fff' : 'var(--text-dim)'),
                      border: opMode !== 'manual' ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: opMode !== 'manual' ? 'not-allowed' : 'pointer',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      opacity: opMode !== 'manual' ? 0.35 : 1,
                    }}
                  >
                    {cmdFan === 'ON' ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Scheduler Matrix */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 16 }}>🕒</span>
                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  SCHEDULER MATRIX
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {schedules.length === 0 ? (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800, fontFamily: 'DM Mono, monospace' }}>06:00</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>DAILY CYCLE • WATER PUMP</div>
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#121620',
                        border: '1px solid var(--border)',
                        color: 'var(--text-dim)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        10p
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800, fontFamily: 'DM Mono, monospace' }}>07:00</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>DAILY CYCLE • GROW LIGHTS</div>
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#121620',
                        border: '1px solid var(--border)',
                        color: 'var(--text-dim)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        12h
                      </div>
                    </div>
                  </>
                ) : (
                  schedules.map(s => (
                    <div key={s._id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800, fontFamily: 'DM Mono, monospace' }}>
                          {new Date(s.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
                          {getTargetLabel(s.target)} • {s.action === 'ON' ? 'BẬT' : 'TẮT'}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#121620',
                        border: '1px solid var(--border)',
                        color: 'var(--text-dim)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {getMockDuration(s.target)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {activeTab === 'map' && (
        <div style={{ 
          height: 480, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'rgba(0,0,0,0.2)', 
          borderRadius: 16,
          border: '1px dashed var(--border)',
          padding: 32,
          textAlign: 'center'
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            background: '#121620',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 24,
            boxShadow: 'var(--shadow)'
          }}>
            🗺️
          </div>
          <h2 style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: 8
          }}>
            GEOLOCATION ENGINE OFFLINE
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            maxWidth: 400,
            margin: '0 auto'
          }}>
            Vui lòng cung cấp GOOGLE_MAPS_PLATFORM_KEY để kích hoạt<br />bản đồ vệ tinh giám sát Node.
          </p>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* AI Strategic Report */}
          <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                AI Strategic Report
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Phân tích dữ liệu lịch sử và đưa ra chiến lược tưới lâu dài
              </p>
              {aiReportText && (
                <div style={{ 
                  marginTop: 12, 
                  padding: 12, 
                  background: 'rgba(16,185,129,0.05)', 
                  border: '1px solid rgba(16,185,129,0.15)', 
                  borderRadius: 8, 
                  fontSize: 13, 
                  color: '#81c784', 
                  lineHeight: 1.5,
                  maxWidth: 700,
                  animation: 'dropdownFadeIn 0.3s ease both'
                }}>
                  🤖 {aiReportText}
                </div>
              )}
            </div>
            <button 
              className="btn btn-primary" 
              onClick={generateReport}
              disabled={generatingReport}
              style={{ borderRadius: 20, padding: '10px 24px', fontSize: 12 }}
            >
              {generatingReport ? 'GENERATING...' : 'GENERATE AI SUMMARY'}
            </button>
          </div>

          {/* Grid: Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Soil Moisture */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
                SOIL MOISTURE MATRIX (%)
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSoilAnalytic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                    <Area type="monotone" dataKey="soilMoisture" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSoilAnalytic)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lux */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
                LUMINOUS INTENSITY (LUX)
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLuxAnalytic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffa726" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ffa726" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                    <Area type="stepAfter" dataKey="lux" stroke="#ffa726" strokeWidth={2} fillOpacity={1} fill="url(#colorLuxAnalytic)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Raw Telemetry Table */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
              RAW TELEMETRY TABLE
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>TIMELINE</th>
                    <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>TEMP</th>
                    <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>HUM</th>
                    <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>SOIL</th>
                    <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>LUM</th>
                  </tr>
                </thead>
                <tbody>
                  {chartsData.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        Không có dữ liệu telemetry
                      </td>
                    </tr>
                  ) : (
                    [...chartsData].reverse().slice(0, 10).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}>
                          {row.timestamp ? new Date(row.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#ff7043' }}>
                          {row.temperature !== undefined ? `${row.temperature} °C` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#29b6f6' }}>
                          {row.humidity !== undefined ? `${row.humidity} %` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
                          {row.soilMoisture !== undefined ? `${row.soilMoisture} %` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#ffa726' }}>
                          {row.lux !== undefined ? `${row.lux} lx` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
    </div>
  )
}
