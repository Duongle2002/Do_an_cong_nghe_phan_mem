import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import MetricChart from '../components/MetricChart'
import AutomationPanel from '../components/AutomationPanel'
import SchedulesPanel from '../components/SchedulesPanel'
import PairingPanel from '../components/PairingPanel'
import UserProfile from '../components/UserProfile'
import ControlBox from '../components/ControlBox'
import DeviceEditModal from '../components/DeviceEditModal'
import { checkSensorThresholds } from '../utils/preferences'



const metricDisplay = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', icon: '🌡', color: '#ff7043' },
  { key: 'humidity', label: 'Độ ẩm KK', unit: '%RH', icon: '💧', color: '#29b6f6' },
  { key: 'soilMoisture', label: 'Độ ẩm đất', unit: '%', icon: '🪴', color: '#66bb6a' },
  { key: 'lux', label: 'Ánh sáng', unit: 'lux', icon: '☀', color: '#ffa726' },
]

export default function DeviceDetailPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [showEditModal, setShowEditModal] = useState(false)
  const [device, setDevice] = useState(null)
  const [data, setData] = useState([])
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')
  const [cmdFan, setCmdFan] = useState('OFF')
  const [cmdLight, setCmdLight] = useState('OFF')
  const [cmdPump, setCmdPump] = useState('OFF')
  const sseRef = useRef(null)
  const [sseStatus, setSseStatus] = useState('disconnected')
  const reconnectAttemptsRef = useRef(0)

  function showMsg(text, type = 'ok') { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 3000) }

  async function handleDeleteDevice() {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thiết bị này không?')) return;
    try {
      await api.delete(`/api/devices/${id}`);
      navigate('/devices');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Xóa thiết bị thất bại', 'err');
    }
  }

  async function loadDevice() {
    try {
      const devRes = await api.get(`/api/devices/${id}`)
      setDevice(devRes.data)
    } catch (e) {
      showMsg(e.response?.data?.message || 'Failed to load device', 'err')
    }
  }

  async function loadSensors(silent = false) {
    if (!silent) { setLoading(true) }
    try {
      const sensRes = await api.get(`/api/sensors`, { params: { deviceId: id, limit } })
      const arr = sensRes.data || []
      setData(arr)

      // Safety check on loaded/polled data
      if (arr.length > 0 && device) {
        checkSensorThresholds(device, arr[0]);
      }
    } catch (e) {
      if (!silent) showMsg(e.response?.data?.message || 'Failed to load data', 'err')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function loadDeviceState() {
    try {
      const devRes = await api.get(`/api/devices/${id}`)
      const d = devRes.data || {}
      if (d.lastFanState) setCmdFan(d.lastFanState)
      if (d.lastLightState) setCmdLight(d.lastLightState)
      if (d.lastPumpState) setCmdPump(d.lastPumpState)
    } catch { }
  }

  useEffect(() => {
    setLoading(true)
    Promise.resolve()
      .then(() => loadDevice())
      .then(() => loadSensors(false))
      .then(() => loadDeviceState())
      .finally(() => setLoading(false))
  }, [id, limit])

  useEffect(() => {
    const refreshSeconds = parseInt(localStorage.getItem('pref_refresh_rate') || '8', 10);
    const intervalTime = refreshSeconds * 1000;
    const t = setInterval(() => {
      if (sseStatus !== 'connected') { loadSensors(true); loadDeviceState() }
    }, intervalTime)
    return () => clearInterval(t)
  }, [id, limit, sseStatus])

  useEffect(() => {
    if (!device || !device.externalId) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    function connect() {
      setSseStatus('connecting')
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/stream/devices/${device.externalId}?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      sseRef.current = es
      es.onopen = () => { reconnectAttemptsRef.current = 0; setSseStatus('connected') }
      es.onerror = () => {
        setSseStatus('error'); es.close()
        const delay = Math.min(30000, Math.pow(2, ++reconnectAttemptsRef.current) * 500)
        setTimeout(connect, delay)
      }
      es.addEventListener('telemetry', (evt) => {
        try {
          const payload = JSON.parse(evt.data)

          // Safety threshold check
          checkSensorThresholds(device, payload);

          if (payload.relayFan) setCmdFan(payload.relayFan)
          if (payload.relayLight) setCmdLight(payload.relayLight)
          if (payload.relayPump) setCmdPump(payload.relayPump)
          if (payload.status) setDevice(prev => prev ? { ...prev, status: payload.status } : prev)
          if (payload.opMode) setDevice(prev => prev ? { ...prev, opMode: payload.opMode } : prev)
          
          const hasSensorData = payload.temperature !== undefined || 
                                payload.humidity !== undefined || 
                                payload.soilMoisture !== undefined || 
                                payload.soil_pct !== undefined || 
                                payload.lux !== undefined

          if (hasSensorData) {
            setData(prev => {
              const next = [...prev]
              const ts = payload.timestamp || Date.now()
              if (!next.some(d => d.timestamp === ts)) {
                next.push({ 
                  timestamp: ts, 
                  temperature: payload.temperature, 
                  humidity: payload.humidity, 
                  soilMoisture: payload.soilMoisture ?? payload.soil_pct, 
                  lux: payload.lux 
                })
                if (next.length > limit) next.splice(0, next.length - limit)
              }
              return next
            })
          }
        } catch { }
      })
      es.addEventListener('status', (evt) => {
        try { const s = JSON.parse(evt.data); setDevice(prev => prev ? { ...prev, status: s.status } : prev) } catch { }
      })
    }
    connect()
    return () => { sseRef.current && sseRef.current.close(); sseRef.current = null }
  }, [device, limit])

  const chartsData = useMemo(() => data?.slice().reverse(), [data])
  const latest = useMemo(() => chartsData?.length ? chartsData[chartsData.length - 1] : null, [chartsData])

  async function sendTarget(target, action) {
    try {
      await api.post('/api/commands', { deviceId: id, target, action })
      showMsg(`✓ ${target} → ${action}`, 'ok')
    } catch (e) {
      showMsg(e.response?.data?.message || 'Failed to send command', 'err')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(16, 185, 129,0.2)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!device) return (
    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
      Không tìm thấy thiết bị
    </div>
  )

  const isOnline = device.status === 'online'

  return (
    <div className="page-enter grid" style={{ gap: 16 }}>
      {/* Breadcrumb & Profile */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link to="/devices" style={{ color: 'var(--accent)', fontWeight: 500 }}>Thiết bị</Link>
          <span>/</span>
          <span>{device.name}</span>
        </div>

        <UserProfile user={user} logout={logout} />
      </div>

      {/* Device overview card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 3, background: isOnline ? 'linear-gradient(90deg, #10b981, #34d399)' : 'rgba(239,83,80,0.4)' }} />
        <div className="card-body" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 6 }}>{device.name}</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 6 }}>
                  {device.externalId || 'No External ID'}
                </span>
                <span className={`badge ${isOnline ? 'ok' : 'err'}`}>{device.status}</span>
                <span className={`live-indicator ${sseStatus}`}>
                  <span className="live-dot" />
                  {sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowEditModal(true)}
                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ✏️ Sửa
                </button>
                <button 
                  className="btn" 
                  onClick={handleDeleteDevice}
                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,83,80,0.15)', borderColor: 'rgba(239,83,80,0.3)', color: '#ef9a9a' }}
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>

            {/* Latest metrics pills */}
            {latest && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {metricDisplay.map(m => (
                  <div key={m.key} style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '8px 14px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                      {m.icon} {m.label}
                    </div>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: 'DM Mono, monospace',
                      color: m.color,
                    }}>
                      {latest[m.key] !== undefined && latest[m.key] !== null 
                        ? (typeof latest[m.key] === 'number' && (m.key === 'temperature' || m.key === 'humidity') 
                          ? (m.key === 'temperature' && localStorage.getItem('pref_temp_unit') === 'F'
                            ? (latest[m.key] * 1.8 + 32).toFixed(2)
                            : latest[m.key].toFixed(2)) 
                          : latest[m.key])
                        : '—'}
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>
                        {m.key === 'temperature' ? (localStorage.getItem('pref_temp_unit') === 'F' ? '°F' : '°C') : m.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast message */}
      {msg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 'var(--radius-sm)',
          background: msgType === 'ok' ? 'rgba(16, 185, 129,0.15)' : 'rgba(239,83,80,0.15)',
          border: `1px solid ${msgType === 'ok' ? 'rgba(16, 185, 129,0.3)' : 'rgba(239,83,80,0.3)'}`,
          color: msgType === 'ok' ? '#81c784' : '#ef9a9a',
          fontSize: 13,
          fontWeight: 500,
        }}>
          {msg}
        </div>
      )}

      {/* Controls */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>
          Điều khiển thủ công
        </div>
        <div className="grid grid-3">
          <ControlBox title="Quạt" icon="🌀" state={cmdFan} onChange={(v) => { setCmdFan(v); sendTarget('fan', v) }} />
          <ControlBox title="Đèn" icon="💡" state={cmdLight} onChange={(v) => { setCmdLight(v); sendTarget('light', v) }} />
          <ControlBox title="Bơm" icon="💦" state={cmdPump} onChange={(v) => { setCmdPump(v); sendTarget('pump', v) }} />
        </div>
      </div>

      <SchedulesPanel deviceId={id} />
      <PairingPanel device={device} onSaved={(d) => { setDevice(d); }} />
      <AutomationPanel device={device} onSaved={(d) => { setDevice(d); showMsg('Đã lưu cấu hình tự động', 'ok') }} />

      {/* Charts */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Biểu đồ theo thời gian
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            Hiển thị
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 'auto', padding: '5px 10px' }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            bản ghi
          </label>
        </div>
        <div className="grid grid-2">
          <MetricChart title={`Nhiệt độ (${localStorage.getItem('pref_temp_unit') === 'F' ? '°F' : '°C'})`} data={chartsData} dataKey="temperature" color="#ff7043" />
          <MetricChart title="Độ ẩm không khí (%)" data={chartsData} dataKey="humidity" color="#29b6f6" />
          <MetricChart title="Độ ẩm đất (%)" data={chartsData} dataKey="soilMoisture" color="#66bb6a" />
          <MetricChart title="Ánh sáng (Lux)" data={chartsData} dataKey="lux" color="#ffa726" />
        </div>
      </div>

      <DeviceEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        device={device}
        onSaved={(d) => setDevice(d)}
        showMsg={showMsg}
      />
    </div>
  )
}
