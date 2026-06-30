import React, { useState, useEffect, useRef, useMemo } from 'react'
import mqtt from 'mqtt'
import '../styles/SimulatorTab.css'

export default function SimulatorTab({ devices, activeDevice, setActiveDevice }) {
  // Device selection states
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [mqttStatus, setMqttStatus] = useState('disconnected')
  const [logs, setLogs] = useState([])
  const consoleRef = useRef(null)
  
  // Weather environmental settings (user slider inputs - remain stable)
  const [weatherTemp, setWeatherTemp] = useState(26.5)
  const [weatherHum, setWeatherHum] = useState(62)
  const [weatherSoil, setWeatherSoil] = useState(48)
  const [weatherLux, setWeatherLux] = useState(850)
  const [ph, setPh] = useState(6.2)

  // Active internal greenhouse readings (change dynamically based on physics & actuators)
  const [activeTemp, setActiveTemp] = useState(26.5)
  const [activeHum, setActiveHum] = useState(62)
  const [activeSoil, setActiveSoil] = useState(48)

  const displayLux = Math.round(weatherLux + (light ? 1200 : 0))

  // Actuator states (updated locally or by incoming MQTT commands)
  const [fan, setFan] = useState(false)
  const [pump, setPump] = useState(false)
  const [light, setLight] = useState(false)
  const [opMode, setOpMode] = useState('auto')

  // Auto-send settings
  const [autoPublish, setAutoPublish] = useState(true)
  const [publishInterval, setPublishInterval] = useState(5) // in seconds

  const mqttClientRef = useRef(null)
  const autoPublishTimerRef = useRef(null)

  // Create a list of selectable devices, including a virtual Demo Device
  const selectableDevices = useMemo(() => {
    const list = [...devices]
    // Add virtual demo device if it doesn't exist
    if (!list.some(d => d.externalId === 'demo-sensor-node')) {
      list.push({
        _id: 'demo-device-id',
        name: '⭐ Thiết bị Demo (Mô phỏng)',
        externalId: 'demo-sensor-node',
        pairedSensorId: 'demo-sensor-node',
        status: 'online',
        opMode: 'auto',
        isDemo: true
      })
    }
    return list
  }, [devices])

  // Sync initial selection
  useEffect(() => {
    if (activeDevice) {
      setSelectedDeviceId(activeDevice._id)
    } else if (selectableDevices.length > 0) {
      setSelectedDeviceId(selectableDevices[0]._id)
    }
  }, [activeDevice, selectableDevices])

  // Select target device
  const currentDevice = useMemo(() => {
    return selectableDevices.find(d => d._id === selectedDeviceId)
  }, [selectedDeviceId, selectableDevices])

  // Helper to append console logs
  const addLog = (text, type = 'system') => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false })
    setLogs(prev => [...prev, { id: Math.random().toString(), time: timeStr, text, type }].slice(-50)) // Keep last 50 logs
  };

  // Scroll terminal logs to bottom (scrollTop only, avoids page shifting)
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  // Handle MQTT client connection
  const connectMqtt = () => {
    if (mqttClientRef.current) {
      mqttClientRef.current.end()
    }

    if (!currentDevice) {
      addLog('Lỗi: Chưa chọn thiết bị để mô phỏng', 'err')
      return
    }

    const extId = currentDevice.externalId || 'demo-sensor-node'
    // For Demo or WROOM nodes we also figure out control topics
    // We determine paired controllers
    let pairedExtId = currentDevice.pairedSensorId || ''
    if (!pairedExtId && extId.startsWith('esp32s3-')) {
      // If S3 is selected, paired sensor is pairedSensorId. Wait, sometimes it's reversed.
      // Let's look for pairing in devices list
      const pairedDev = devices.find(d => d.pairedSensorId === extId || d.externalId === currentDevice.pairedSensorId)
      if (pairedDev) pairedExtId = pairedDev.externalId
    } else if (!pairedExtId && (extId.startsWith('esp32-') || extId.startsWith('wroom-'))) {
      const s3Dev = devices.find(d => d.pairedSensorId === extId)
      if (s3Dev) pairedExtId = s3Dev.externalId
    }

    // Set initial actuator states from selected device data
    setFan(currentDevice.lastFanState === 'ON')
    setLight(currentDevice.lastLightState === 'ON')
    setPump(currentDevice.lastPumpState === 'ON')
    setOpMode(currentDevice.opMode || 'auto')

    setMqttStatus('connecting')
    addLog(`Đang kết nối tới broker EMQX (broker.emqx.io)...`, 'system')

    const clientId = `smartfarm-sim-${Math.random().toString(16).slice(2, 10)}`
    
    // Connect over Secure WebSockets (wss)
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 2000,
    })

    mqttClientRef.current = client

    client.on('connect', () => {
      setMqttStatus('connected')
      addLog(`[MQTT] Đã kết nối thành công! Client ID: ${clientId}`, 'system')

      // Subscribe to control topics for the device and its paired controller
      const subscribeTopics = [
        `farm/${extId}/control/#`,
        `controllers/${extId}/control/#`,
        `controllers/${extId}/control`
      ]
      
      if (pairedExtId) {
        subscribeTopics.push(`farm/${pairedExtId}/control/#`)
        subscribeTopics.push(`controllers/${pairedExtId}/control/#`)
        subscribeTopics.push(`controllers/${pairedExtId}/control`)
      }

      client.subscribe(subscribeTopics, { qos: 1 }, (err) => {
        if (err) {
          addLog(`[MQTT] Đăng ký topic điều khiển thất bại: ${err.message}`, 'err')
        } else {
          addLog(`[MQTT] Đã đăng ký lắng nghe lệnh điều khiển trên:`, 'system')
          subscribeTopics.forEach(t => addLog(`  ↳ ${t}`, 'system'))
        }
      })

      // Send online status immediately
      client.publish(`sensors/${extId}/status`, 'online', { qos: 1 })
      addLog(`[MQTT Out] Đã gửi trạng thái: sensors/${extId}/status -> online`, 'out')

      // If it's a paired S3 controller, also announce online
      if (pairedExtId && pairedExtId.startsWith('esp32s3-')) {
        client.publish(`sensors/${pairedExtId}/status`, 'online', { qos: 1 })
        addLog(`[MQTT Out] Đã gửi trạng thái: sensors/${pairedExtId}/status -> online`, 'out')
      }
    })

    client.on('message', (topic, message) => {
      const payload = message.toString()
      addLog(`[MQTT In] Nhận lệnh từ topic [${topic}]: ${payload}`, 'in')

      // Parse control target
      const parts = topic.split('/')
      const target = parts[parts.length - 1] // e.g. 'fan', 'pump', 'light', 'mode' or 'control'

      let updated = false
      let newFan = fan
      let newPump = pump
      let newLight = light
      let newMode = opMode

      if (target === 'fan') {
        newFan = (payload === 'ON')
        setFan(newFan)
        addLog(`[SIMULATOR] Cập nhật thiết bị: Quạt gió -> ${payload}`, 'system')
        updated = true
      } else if (target === 'pump') {
        newPump = (payload === 'ON')
        setPump(newPump)
        addLog(`[SIMULATOR] Cập nhật thiết bị: Máy bơm -> ${payload}`, 'system')
        updated = true
      } else if (target === 'light') {
        newLight = (payload === 'ON')
        setLight(newLight)
        addLog(`[SIMULATOR] Cập nhật thiết bị: Đèn chiếu -> ${payload}`, 'system')
        updated = true
      } else if (target === 'mode' || target === 'control' && ['auto', 'manual', 'scheduled'].includes(payload)) {
        newMode = payload
        setOpMode(newMode)
        addLog(`[SIMULATOR] Chuyển chế độ hoạt động -> ${payload.toUpperCase()}`, 'system')
        updated = true
      }

      // Publish ACK state back if anything updated
      if (updated) {
        const statePayload = JSON.stringify({
          fan: newFan,
          relay_fan: newFan,
          light: newLight,
          relay_light: newLight,
          pump: newPump,
          relay_pump: newPump,
          opMode: newMode,
          timestamp: new Date().toISOString()
        })
        
        // Publish to both target topic and paired topic to update backend
        client.publish(`farm/${extId}/state`, statePayload, { qos: 1 })
        addLog(`[MQTT Out] Phản hồi trạng thái: farm/${extId}/state -> ${statePayload}`, 'out')
        
        if (pairedExtId) {
          client.publish(`farm/${pairedExtId}/state`, statePayload, { qos: 1 })
          addLog(`[MQTT Out] Phản hồi trạng thái: farm/${pairedExtId}/state -> ${statePayload}`, 'out')
        }
      }
    })

    client.on('error', (err) => {
      addLog(`[MQTT Error] Kết nối lỗi: ${err.message}`, 'err')
      setMqttStatus('disconnected')
    })

    client.on('close', () => {
      addLog(`[MQTT] Đã ngắt kết nối với Broker`, 'system')
      setMqttStatus('disconnected')
    })
  }

  const disconnectMqtt = () => {
    if (mqttClientRef.current) {
      const extId = currentDevice?.externalId || 'demo-sensor-node'
      mqttClientRef.current.publish(`sensors/${extId}/status`, 'offline', { qos: 1 })
      addLog(`[MQTT Out] Gửi thông điệp offline trước khi ngắt kết nối`, 'out')
      
      mqttClientRef.current.end()
      mqttClientRef.current = null
    }
    setMqttStatus('disconnected')
  }

  // Publish telemetry manually
  const publishTelemetry = () => {
    if (!mqttClientRef.current || mqttStatus !== 'connected') {
      addLog('Không thể gửi: Bộ mô phỏng chưa kết nối MQTT Broker', 'err')
      return
    }

    const extId = currentDevice?.externalId || 'demo-sensor-node'
    const telemetryPayload = {
      temperature: parseFloat(Number(activeTemp).toFixed(1)),
      humidity: parseFloat(Number(activeHum).toFixed(1)),
      soil_pct: parseInt(activeSoil, 10),
      soil: parseInt(activeSoil, 10),
      soilMoisture: parseInt(activeSoil, 10),
      lux: weatherLux,
      pH: parseFloat(Number(ph).toFixed(1)),
      relay_fan: fan,
      relay_light: light,
      relay_pump: pump,
      fan,
      light,
      pump,
      timestamp: new Date().toISOString()
    }

    const payloadString = JSON.stringify(telemetryPayload)
    
    // Publish to the new telemetry topic
    mqttClientRef.current.publish(`farm/${extId}/telemetry`, payloadString, { qos: 1 })
    addLog(`[MQTT Out] Gửi dữ liệu cảm biến: farm/${extId}/telemetry -> Temp=${activeTemp}°C, Soil=${activeSoil}%, Lux=${weatherLux} Lux`, 'out')
    
    // Also publish to the old telemetry topic for compatibility
    mqttClientRef.current.publish(`sensors/${extId}/data`, payloadString, { qos: 1 })
  }

  // Effect to clean up MQTT on unmount
  useEffect(() => {
    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end()
      }
      if (autoPublishTimerRef.current) {
        clearInterval(autoPublishTimerRef.current)
      }
    }
  }, [])

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

  // Telemetry auto-publishing timer
  useEffect(() => {
    if (autoPublishTimerRef.current) {
      clearInterval(autoPublishTimerRef.current)
      autoPublishTimerRef.current = null
    }

    if (mqttStatus === 'connected' && autoPublish) {
      autoPublishTimerRef.current = setInterval(() => {
        publishTelemetry()
      }, publishInterval * 1000)
    }

    return () => {
      if (autoPublishTimerRef.current) {
        clearInterval(autoPublishTimerRef.current)
      }
    }
  }, [mqttStatus, autoPublish, publishInterval, activeTemp, activeHum, activeSoil, weatherLux, ph, fan, pump, light])

  // CSS Soil color mapping based on activeSoil
  const soilColor = useMemo(() => {
    // dry sandy: HSL 28, 40%, 35%
    // moist: HSL 20, 50%, 22%
    // wet: HSL 200, 30%, 15% (muddy/dark blue hues)
    const s = Number(activeSoil)
    if (s < 30) {
      const ratio = s / 30
      const h = 28 - (8 * ratio)
      const saturation = 40 + (10 * ratio)
      const l = 35 - (13 * ratio)
      return `hsl(${h}, ${saturation}%, ${l}%)`
    } else {
      const ratio = (s - 30) / 70
      const h = 20 + (10 * ratio) // Shift slightly blueish if very wet
      const saturation = 50 - (20 * ratio)
      const l = 22 - (10 * ratio)
      return `hsl(${h}, ${saturation}%, ${l}%)`
    }
  }, [activeSoil])

  // Plant state: withered, healthy, overwatered (depends on activeSoil and activeTemp)
  const plantState = useMemo(() => {
    const s = Number(activeSoil)
    const t = Number(activeTemp)
    if (s < 20 || t > 38) return 'withered'
    if (s > 85) return 'wet'
    return 'healthy'
  }, [activeSoil, activeTemp])

  return (
    <div className="simulator-container">
      {/* Simulation Controls Panel (Left) */}
      <div className="simulator-card">
        <div className="simulator-title-row">
          <h2 className="simulator-title">Bảng Điều Khiển</h2>
          <span className={`status-badge ${mqttStatus}`}>
            <span className="pulse-dot" />
            {mqttStatus === 'connected' ? 'Đã kết nối' : mqttStatus === 'connecting' ? 'Kết nối...' : 'Ngắt kết nối'}
          </span>
        </div>

        {/* Device Select */}
        <div className="sim-form-group">
          <label>Thiết bị mô phỏng</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value)
              disconnectMqtt()
            }}
            disabled={mqttStatus === 'connected'}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-sidebar)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {selectableDevices.map(d => (
              <option key={d._id} value={d._id}>{d.name} ({d.externalId})</option>
            ))}
          </select>
        </div>

        {/* Connect Action Button */}
        <div>
          {mqttStatus === 'connected' ? (
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={disconnectMqtt}>
              ⏹ Ngắt Kết Nối Mô Phỏng
            </button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={connectMqtt} disabled={mqttStatus === 'connecting'}>
              🚀 Bắt Đầu Mô Phỏng (Connect)
            </button>
          )}
        </div>

        {/* Sliders for Sensors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 4px 0', color: 'var(--text)' }}>Giá trị cảm biến ảo</h3>

          <div className="sim-form-group">
            <label>
              <span>Nhiệt độ</span>
              <span className="sim-slider-val">{weatherTemp}°C</span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={weatherTemp}
              onChange={(e) => setWeatherTemp(parseFloat(e.target.value))}
              className="sim-slider"
            />
          </div>

          <div className="sim-form-group">
            <label>
              <span>Độ ẩm không khí</span>
              <span className="sim-slider-val">{weatherHum}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={weatherHum}
              onChange={(e) => setWeatherHum(parseInt(e.target.value, 10))}
              className="sim-slider"
            />
          </div>

          <div className="sim-form-group">
            <label>
              <span>Độ ẩm đất</span>
              <span className="sim-slider-val">{weatherSoil}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={weatherSoil}
              onChange={(e) => setWeatherSoil(parseInt(e.target.value, 10))}
              className="sim-slider"
            />
          </div>

          <div className="sim-form-group">
            <label>
              <span>Ánh sáng</span>
              <span className="sim-slider-val">{weatherLux} Lux</span>
            </label>
            <input
              type="range"
              min="0"
              max="5000"
              step="50"
              value={weatherLux}
              onChange={(e) => setWeatherLux(parseInt(e.target.value, 10))}
              className="sim-slider"
            />
          </div>

          <div className="sim-form-group">
            <label>
              <span>Độ pH</span>
              <span className="sim-slider-val">{ph} pH</span>
            </label>
            <input
              type="range"
              min="0"
              max="14"
              step="0.1"
              value={ph}
              onChange={(e) => setPh(parseFloat(e.target.value))}
              className="sim-slider"
            />
          </div>
        </div>

        {/* Telemetry Sending Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="auto-pub"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <label htmlFor="auto-pub" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>
              Tự động gửi dữ liệu cảm biến
            </label>
          </div>

          {autoPublish && (
            <div className="sim-form-group">
              <label>Chu kỳ gửi (giây): <span className="sim-slider-val">{publishInterval}s</span></label>
              <select
                value={publishInterval}
                onChange={(e) => setPublishInterval(parseInt(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-sidebar)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="3">3 giây</option>
                <option value="5">5 giây</option>
                <option value="10">10 giây</option>
                <option value="30">30 giây</option>
              </select>
            </div>
          )}

          <button className="btn btn-outline" onClick={publishTelemetry} disabled={mqttStatus !== 'connected'}>
            ⚡ Gửi dữ liệu ngay
          </button>
        </div>
      </div>

      {/* Visual Sandbox and Terminal Logs (Right) */}
      <div className="visualization-panel">
        <h2 className="simulator-title">Mô hình nhà kính ảo (Greenhouse Simulation)</h2>

        {/* Graphical Canvas */}
        <div className="greenhouse-canvas">
          <div className="greenhouse-structure" />

          {/* Actuator: Sprinkler System */}
          <div className="sprinkler-system">
            <span className="nozzle nozzle-1" />
            <span className="nozzle nozzle-2" />
            <span className="nozzle nozzle-3" />
          </div>

          {/* Water sprays falling down */}
          <div className={`water-spray spraying nozzle-1`} style={{ left: '17%', display: pump ? 'block' : 'none' }} />
          <div className={`water-spray spraying nozzle-2`} style={{ left: '42%', display: pump ? 'block' : 'none' }} />
          <div className={`water-spray spraying nozzle-3`} style={{ left: '67%', display: pump ? 'block' : 'none' }} />

          {/* Actuator: Light Bulb */}
          <div className="bulb-container">
            <div className="bulb-wire" />
            <div className={`bulb-body ${light ? 'glowing' : ''}`} />
            <div className="bulb-glow" />
          </div>

          {/* Actuator: Fan */}
          <div className="fan-container">
            <div className="fan-frame">
              <div className={`fan-blades ${fan ? 'spinning' : ''}`} />
            </div>
            <div style={{ color: '#fff', fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>QUẠT</div>
          </div>

          {/* Simulated Plants in soil */}
          <div className="plant-row">
            {[1, 2, 3].map(i => (
              <div key={i} className="plant">
                <svg viewBox="0 0 100 120" width="100%" height="100%">
                  {/* Stem */}
                  <path d="M 50,110 Q 50,70 50,40" stroke="#047857" strokeWidth="4" fill="none" />
                  
                  {/* Leaf 1 (Left) */}
                  <path
                    d="M 50,85 Q 20,80 15,60 Q 30,55 50,75"
                    className={`leaf-green ${
                      plantState === 'withered' ? 'leaf-withered' : plantState === 'wet' ? 'leaf-wet' : ''
                    }`}
                  />
                  
                  {/* Leaf 2 (Right) */}
                  <path
                    d="M 50,70 Q 80,65 85,45 Q 70,40 50,60"
                    className={`leaf-green ${
                      plantState === 'withered' ? 'leaf-withered' : plantState === 'wet' ? 'leaf-wet' : ''
                    }`}
                  />
                  
                  {/* Leaf 3 (Top) */}
                  <path
                    d="M 50,40 Q 35,20 50,5 Q 65,20 50,40"
                    className={`leaf-green ${
                      plantState === 'withered' ? 'leaf-withered' : plantState === 'wet' ? 'leaf-wet' : ''
                    }`}
                  />
                </svg>
              </div>
            ))}
          </div>

          {/* Interactive Soil Bed */}
          <div className="soil-bed" style={{ backgroundColor: soilColor }}>
            <div className="soil-grass" />
          </div>
        </div>

        {/* Live Status Badges */}
        <div className="vis-badge-panel">
          <div className="actuator-status-card">
            <span className="actuator-label">💨 QUẠT LÀM MÁT</span>
            <span className={`actuator-state-badge ${fan ? 'on' : 'off'}`}>{fan ? 'ON' : 'OFF'}</span>
          </div>
          <div className="actuator-status-card">
            <span className="actuator-label">💧 BƠM TƯỚI NƯỚC</span>
            <span className={`actuator-state-badge ${pump ? 'on' : 'off'}`}>{pump ? 'ON' : 'OFF'}</span>
          </div>
          <div className="actuator-status-card">
            <span className="actuator-label">💡 ĐÈN QUANG HỢP</span>
            <span className={`actuator-state-badge ${light ? 'on' : 'off'}`}>{light ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Console Log Terminal */}
        <div className="sim-console" ref={consoleRef}>
          {logs.length === 0 ? (
            <div className="console-line console-msg-system">Chào mừng! Nhấp nút "Bắt Đầu Mô Phỏng" ở bảng điều khiển để kích hoạt thiết bị ảo và xem nhật ký MQTT.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="console-line">
                <span className="console-time">[{log.time}]</span>
                <span className={`console-msg-${log.type}`}>{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
