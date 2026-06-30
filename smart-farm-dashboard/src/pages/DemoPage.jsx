import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import '../styles/DemoPage.css'

export default function DemoPage() {
  // Weather environmental settings (user slider inputs - remain stable)
  const [weatherTemp, setWeatherTemp] = useState(26.5)
  const [weatherHum, setWeatherHum] = useState(60)
  const [weatherSoil, setWeatherSoil] = useState(52)
  const [weatherLux, setWeatherLux] = useState(1200)
  const [ph, setPh] = useState(6.2)

  // Active internal greenhouse readings (change dynamically based on physics & actuators)
  const [activeTemp, setActiveTemp] = useState(26.5)
  const [activeHum, setActiveHum] = useState(60)
  const [activeSoil, setActiveSoil] = useState(52)

  // Live chart history data
  const initialHistory = useMemo(() => {
    const list = []
    const now = Date.now()
    for (let i = 11; i >= 0; i--) {
      const timeVal = new Date(now - i * 4000)
      list.push({
        time: timeVal.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        temp: 26.5 + (Math.random() - 0.5) * 1.5,
        soil: 50 + Math.round((Math.random() - 0.5) * 5),
        lux: 1000 + Math.round((Math.random() - 0.5) * 200)
      })
    }
    return list
  }, [])
  const [chartHistory, setChartHistory] = useState(initialHistory)

  // Actuator states (Fan, Pump, Light)
  const [fan, setFan] = useState(false)
  const [pump, setPump] = useState(false)
  const [light, setLight] = useState(false)
  const [opMode, setOpMode] = useState('auto') // 'auto' | 'manual'

  // Append current metrics to live chart history every 2.5 seconds
  const displayLux = Math.round(weatherLux + (light ? 1200 : 0))

  useEffect(() => {
    const interval = setInterval(() => {
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setChartHistory(prev => {
        const next = [...prev, {
          time: timeStr,
          temp: parseFloat(Number(activeTemp).toFixed(1)),
          soil: parseInt(activeSoil, 10),
          lux: displayLux
        }]
        return next.slice(-15) // Keep last 15 ticks for smooth chart
      })
    }, 2500)

    return () => clearInterval(interval)
  }, [activeTemp, activeSoil, displayLux])

  // Terminal Console Logs
  const [logs, setLogs] = useState([])
  const consoleRef = useRef(null)

  const addLog = (text, type = 'system') => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false })
    setLogs(prev => [...prev, { id: Math.random().toString(), time: timeStr, text, type }].slice(-40))
  }

  // Initial welcome log
  useEffect(() => {
    addLog('Hệ thống nhà kính ảo GreenGuard AI khởi động thành công.', 'system')
    addLog('Chế độ mặc định: TỰ ĐỘNG. Trực tiếp kéo các thanh trượt để thử nghiệm quy tắc tự động hóa.', 'automation')
  }, [])

  // Auto scroll console logs (scrollTop only, prevents page jump)
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  // Local Rule-based Automation (Auto Mode) - checks internal sensors for fan/pump and weatherLux for lighting
  useEffect(() => {
    if (opMode !== 'auto') return

    // 1. Temp threshold -> Fan control (checks activeTemp)
    if (activeTemp >= 31 && !fan) {
      setFan(true)
      addLog(`[Tự động] Nhiệt độ cao (${activeTemp}°C >= 31°C) ➜ Kích hoạt QUẠT LÀM MÁT`, 'automation')
    } else if (activeTemp <= 27.5 && fan) {
      setFan(false)
      addLog(`[Tự động] Nhiệt độ an toàn (${activeTemp}°C <= 27.5°C) ➜ Tắt QUẠT LÀM MÁT`, 'automation')
    }

    // 2. Soil Moisture threshold -> Pump control (checks activeSoil)
    if (activeSoil <= 45 && !pump) {
      setPump(true)
      addLog(`[Tự động] Độ ẩm đất khô (${activeSoil}% <= 45%) ➜ Kích hoạt MÁY BƠM TƯỚI NƯỚC`, 'automation')
    } else if (activeSoil >= 55 && pump) {
      setPump(false)
      addLog(`[Tự động] Đất đủ ẩm (${activeSoil}% >= 55%) ➜ Tắt MÁY BƠM TƯỚI NƯỚC`, 'automation')
    }

    // 3. Lux threshold -> Light control (checks ambient weatherLux directly)
    if (weatherLux <= 1000 && !light) {
      setLight(true)
      addLog(`[Tự động] Ánh sáng yếu (${weatherLux} Lux <= 1000 Lux) ➜ Bật ĐÈN QUANG HỢP`, 'automation')
    } else if (weatherLux > 1000 && light) {
      setLight(false)
      addLog(`[Tự động] Ánh sáng đầy đủ (${weatherLux} Lux > 1000 Lux) ➜ Tắt ĐÈN QUANG HỢP`, 'automation')
    }
  }, [activeTemp, activeSoil, weatherLux, opMode, fan, pump, light])

  // Periodic simulated telemetry report logs
  useEffect(() => {
    const timer = setInterval(() => {
      addLog(`[Dữ liệu] Gửi telemetry: Nhiệt độ=${activeTemp}°C, Đất=${activeSoil}%, Sáng=${displayLux} Lux, Bơm=${pump?'ON':'OFF'}, Quạt=${fan?'ON':'OFF'}`, 'telemetry')
    }, 8000)

    return () => clearInterval(timer)
  }, [activeTemp, activeSoil, displayLux, pump, fan])

  // Gradual environment parameter updates based on active actuators (with ambient weather drift)
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Soil moisture: pump increases it, otherwise dries to weatherSoil
      if (pump) {
        setActiveSoil(prev => Math.min(95, Number((Number(prev) + 1.2).toFixed(1))))
      } else {
        setActiveSoil(prev => {
          const current = Number(prev)
          if (current > weatherSoil) return Number(Math.max(weatherSoil, current - 0.08).toFixed(2))
          if (current < weatherSoil) return Number(Math.min(weatherSoil, current + 0.08).toFixed(2))
          return current
        })
      }

      // 2. Temperature: fan cools it, otherwise drifts back to weatherTemp
      if (fan) {
        setActiveTemp(prev => Math.max(22.5, Number((Number(prev) - 0.18).toFixed(2))))
      } else {
        setActiveTemp(prev => {
          const current = Number(prev)
          if (current < weatherTemp) return Number((current + 0.05).toFixed(2))
          if (current > weatherTemp) return Number((current - 0.05).toFixed(2))
          return current
        })
      }

      // 3. Air Humidity: pump increases it (evaporation), fan decreases it (ventilation), otherwise drifts to weatherHum
      if (pump && !fan) {
        setActiveHum(prev => Math.min(85, Number((Number(prev) + 0.8).toFixed(1))))
      } else if (fan) {
        setActiveHum(prev => Math.max(45, Number((Number(prev) - 0.6).toFixed(1))))
      } else {
        setActiveHum(prev => {
          const current = Number(prev)
          if (current < weatherHum) return Number((current + 0.1).toFixed(2))
          if (current > weatherHum) return Number((current - 0.1).toFixed(2))
          return current
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [fan, pump, weatherTemp, weatherHum, weatherSoil])

  // Change Operational Mode
  const handleModeChange = (mode) => {
    if (mode === opMode) return
    setOpMode(mode)
    addLog(`[Hệ thống] Đã chuyển chế độ điều khiển sang: ${mode === 'auto' ? 'TỰ ĐỘNG' : 'THỦ CÔNG'}`, 'system')

    if (mode === 'auto') {
      addLog('[Tự động] Hệ thống đang tự điều chỉnh thiết bị theo trị số cảm biến.', 'automation')
    }
  }

  // Toggle Actuators manually (only works in manual mode)
  const toggleActuator = (target, currentState, setter) => {
    if (opMode !== 'manual') return
    const newState = !currentState
    setter(newState)
    addLog(`[Điều khiển] Người dùng bật/tắt thiết bị: ${target.toUpperCase()} ➜ ${newState ? 'ON' : 'OFF'}`, 'control')
  }

  // Interpolated soil color (depends on activeSoil)
  const soilBgColor = useMemo(() => {
    const s = Number(activeSoil)
    if (s < 30) {
      const ratio = s / 30
      const h = 28 - (8 * ratio)
      const saturation = 40 + (10 * ratio)
      const l = 35 - (13 * ratio)
      return `hsl(${h}, ${saturation}%, ${l}%)`
    } else {
      const ratio = (s - 30) / 70
      const h = 20 + (10 * ratio)
      const saturation = 50 - (20 * ratio)
      const l = 22 - (10 * ratio)
      return `hsl(${h}, ${saturation}%, ${l}%)`
    }
  }, [activeSoil])

  // Plant health display state (depends on activeSoil and activeTemp)
  const plantState = useMemo(() => {
    const s = Number(activeSoil)
    const t = Number(activeTemp)
    if (s < 20 || t > 38) return 'withered'
    if (s > 85) return 'wet'
    return 'healthy'
  }, [activeSoil, activeTemp])

  return (
    <div className="demo-workspace">
      {/* Header Banner */}
      <header className="demo-header">
        <div className="demo-brand">
          <svg className="demo-logo-icon" viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
            <path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,1.75,3.75C7,8,17,8,17,8Z" />
          </svg>
          <div className="demo-title-group">
            <h1>GreenGuard AI - Hệ thống Giám sát Demo</h1>
            <p>Trải nghiệm thực tế ảo không cần phần cứng</p>
          </div>
        </div>

        <div className="demo-cta-actions">
          <Link to="/login" className="btn-demo-login">
            🔑 Đăng nhập
          </Link>
          <Link to="/register" className="btn-demo-register">
            🌱 Đăng ký dùng thật
          </Link>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="demo-grid">
        {/* Left Side: Physical Simulator Panel */}
        <div className="demo-card">
          <h2 className="demo-card-title">🎮 Bảng mô phỏng vật lý (Cảm biến ảo)</h2>

          {/* Environmental sliders */}
          <div className="demo-sliders-list">
            <div className="demo-slider-item">
              <label className="demo-slider-label">
                <span>Nhiệt độ môi trường</span>
                <span className="demo-slider-val">{weatherTemp}°C</span>
              </label>
              <input
                type="range"
                min="10"
                max="48"
                step="0.5"
                value={weatherTemp}
                onChange={(e) => setWeatherTemp(parseFloat(e.target.value))}
                className="demo-slider-control"
              />
            </div>

            <div className="demo-slider-item">
              <label className="demo-slider-label">
                <span>Độ ẩm không khí</span>
                <span className="demo-slider-val">{weatherHum}%</span>
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={weatherHum}
                onChange={(e) => setWeatherHum(parseInt(e.target.value, 10))}
                className="demo-slider-control"
              />
            </div>

            <div className="demo-slider-item">
              <label className="demo-slider-label">
                <span>Độ ẩm đất trồng</span>
                <span className="demo-slider-val">{weatherSoil}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={weatherSoil}
                onChange={(e) => setWeatherSoil(parseInt(e.target.value, 10))}
                className="demo-slider-control"
              />
            </div>

            <div className="demo-slider-item">
              <label className="demo-slider-label">
                <span>Cường độ ánh sáng</span>
                <span className="demo-slider-val">{weatherLux} Lux</span>
              </label>
              <input
                type="range"
                min="100"
                max="4500"
                step="50"
                value={weatherLux}
                onChange={(e) => setWeatherLux(parseInt(e.target.value, 10))}
                className="demo-slider-control"
              />
            </div>

            <div className="demo-slider-item">
              <label className="demo-slider-label">
                <span>Độ pH của đất</span>
                <span className="demo-slider-val">{ph} pH</span>
              </label>
              <input
                type="range"
                min="3"
                max="10"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(parseFloat(e.target.value))}
                className="demo-slider-control"
              />
            </div>
          </div>

          {/* Interactive Greenhouse Visualization */}
          <div className="demo-canvas">
            <div className="demo-greenhouse-frame" />

            {/* Actuator: Fan */}
            <div className="demo-fan-box">
              <div className="demo-fan-frame">
                <div className={`demo-fan-blades ${fan ? 'spinning' : ''}`} />
              </div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4, fontWeight: '700' }}>QUẠT</div>
            </div>

            {/* Actuator: Sprinkler spray system */}
            <div className="demo-sprinkler-bar">
              <span className="demo-nozzle demo-nozzle-1" />
              <span className="demo-nozzle demo-nozzle-2" />
              <span className="demo-nozzle demo-nozzle-3" />
            </div>

            <div className={`demo-water-spray spraying`} style={{ left: '17%', display: pump ? 'block' : 'none' }} />
            <div className={`demo-water-spray spraying`} style={{ left: '42%', display: pump ? 'block' : 'none' }} />
            <div className={`demo-water-spray spraying`} style={{ left: '67%', display: pump ? 'block' : 'none' }} />

            {/* Actuator: Bulb light */}
            <div className="demo-bulb-box">
              <div className="demo-bulb-wire" />
              <div className={`demo-bulb-body ${light ? 'glowing' : ''}`} />
              <div className="demo-bulb-glow" />
            </div>

            {/* Crops */}
            <div className="demo-plant-row">
              {[1, 2, 3].map(i => (
                <div key={i} className="demo-plant">
                  <svg viewBox="0 0 100 120" width="100%" height="100%">
                    <path d="M 50,110 Q 50,70 50,40" stroke="#047857" strokeWidth="4" fill="none" />
                    <path
                      d="M 50,85 Q 20,80 15,60 Q 30,55 50,75"
                      className={`demo-leaf ${
                        plantState === 'withered' ? 'demo-leaf-withered' : plantState === 'wet' ? 'demo-leaf-wet' : ''
                      }`}
                    />
                    <path
                      d="M 50,70 Q 80,65 85,45 Q 70,40 50,60"
                      className={`demo-leaf ${
                        plantState === 'withered' ? 'demo-leaf-withered' : plantState === 'wet' ? 'demo-leaf-wet' : ''
                      }`}
                    />
                    <path
                      d="M 50,40 Q 35,20 50,5 Q 65,20 50,40"
                      className={`demo-leaf ${
                        plantState === 'withered' ? 'demo-leaf-withered' : plantState === 'wet' ? 'demo-leaf-wet' : ''
                      }`}
                    />
                  </svg>
                </div>
              ))}
            </div>

            {/* Soil Bed */}
            <div className="demo-soil-bed" style={{ backgroundColor: soilBgColor }}>
              <div className="demo-soil-grass" />
            </div>
          </div>
        </div>

        {/* Right Side: Mock Monitor Dashboard */}
        <div className="demo-dashboard-col">
          {/* Card: Live Telemetry Indicators */}
          <div className="demo-card">
            <h2 className="demo-card-title">📊 Bảng chỉ số đo đạc thời gian thực</h2>
            <div className="demo-metrics-grid">
              <div className="demo-metric-card">
                <span className="demo-metric-label">Nhiệt độ</span>
                <span className="demo-metric-icon">🌡️</span>
                <span className="demo-metric-val">{activeTemp}°C</span>
              </div>
              <div className="demo-metric-card">
                <span className="demo-metric-label">Độ ẩm khí</span>
                <span className="demo-metric-icon">💧</span>
                <span className="demo-metric-val">{activeHum}%</span>
              </div>
              <div className="demo-metric-card">
                <span className="demo-metric-label">Độ ẩm đất</span>
                <span className="demo-metric-icon">🪴</span>
                <span className="demo-metric-val" style={{ color: activeSoil <= 45 ? '#ef4444' : activeSoil >= 85 ? '#38bdf8' : '#10b981' }}>{activeSoil}%</span>
              </div>
              <div className="demo-metric-card">
                <span className="demo-metric-label">Ánh sáng</span>
                <span className="demo-metric-icon">☀️</span>
                <span className="demo-metric-val">{displayLux} Lx</span>
              </div>
            </div>

            {/* Simulated Live charts graph representation */}
            <div style={{ height: 180, padding: '10px 0 0 0', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartHistory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 9, fill: '#10b981' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[10, 50]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 9, fill: '#0ea5e9' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temp"
                    name="Nhiệt độ (°C)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="soil"
                    name="Độ ẩm đất (%)"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card: Operational Mode and Actuators switches */}
          <div className="demo-card">
            <h2 className="demo-card-title">⚙️ Điều khiển & Cấu hình thiết bị</h2>
            
            <div className="demo-controls-card">
              {/* Op mode panel */}
              <div className="demo-opmode-panel">
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Chế độ vận hành</div>
                <button
                  className={`demo-mode-btn ${opMode === 'auto' ? 'active' : ''}`}
                  onClick={() => handleModeChange('auto')}
                >
                  🤖 TỰ ĐỘNG
                </button>
                <button
                  className={`demo-mode-btn ${opMode === 'manual' ? 'active' : ''}`}
                  onClick={() => handleModeChange('manual')}
                >
                  🔧 THỦ CÔNG
                </button>
              </div>

              {/* Switches panel */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>Trạng thái công tắc</div>
                
                <div className="demo-switches-panel">
                  <div className={`demo-switch-card ${fan ? 'active' : ''}`}>
                    <span className="demo-switch-label">💨 QUẠT</span>
                    <button
                      className={`btn-toggle-switch ${fan ? 'on' : ''}`}
                      disabled={opMode === 'auto'}
                      onClick={() => toggleActuator('quạt', fan, setFan)}
                    />
                  </div>

                  <div className={`demo-switch-card ${pump ? 'active' : ''}`}>
                    <span className="demo-switch-label">💧 BƠM NƯỚC</span>
                    <button
                      className={`btn-toggle-switch ${pump ? 'on' : ''}`}
                      disabled={opMode === 'auto'}
                      onClick={() => toggleActuator('máy bơm', pump, setPump)}
                    />
                  </div>

                  <div className={`demo-switch-card ${light ? 'active' : ''}`}>
                    <span className="demo-switch-label">💡 ĐÈN LED</span>
                    <button
                      className={`btn-toggle-switch ${light ? 'on' : ''}`}
                      disabled={opMode === 'auto'}
                      onClick={() => toggleActuator('đèn led', light, setLight)}
                    />
                  </div>
                </div>

                {opMode === 'auto' && (
                  <div style={{ marginTop: 12, fontSize: 11, color: '#ffa726', background: 'rgba(255,167,38,0.1)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,167,38,0.2)' }}>
                    ℹ️ Chế độ tự động đang được bật. Bạn không thể bật/tắt thiết bị thủ công. Thay đổi thanh trượt cảm biến ở cột bên trái để kiểm tra quy luật tự động bật/tắt.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Console logger output block */}
          <div className="demo-console" ref={consoleRef}>
            {logs.map(log => (
              <div key={log.id} className="demo-log-line">
                <span className="demo-log-time">[{log.time}]</span>
                <span className={`demo-log-msg-${log.type}`}>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Footer banner */}
      <footer className="demo-footer-banner">
        <h2>Bạn muốn triển khai mô hình này vào nông trại thực tế?</h2>
        <p>
          Hệ thống GreenGuard AI hỗ trợ đồng bộ dữ liệu thời gian thực từ vi điều khiển ESP32, ESP32-S3 qua giao thức MQTT. <br />
          Tích hợp hệ thống phân tích TinyML dự báo thông minh và gửi email cảnh báo tự động khi thông số lệch chuẩn.
        </p>
        <Link to="/register" className="btn-demo-register" style={{ padding: '12px 30px', fontSize: 15 }}>
          🚀 Đăng ký tài khoản dùng thử hệ thống thật ngay!
        </Link>
      </footer>
    </div>
  )
}
