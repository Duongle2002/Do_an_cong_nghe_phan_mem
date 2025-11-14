import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/client'
import MetricChart from '../components/MetricChart'
import AutomationPanel from '../components/AutomationPanel'
import SchedulesPanel from '../components/SchedulesPanel'
// Tabs removed per request; showing Schedules above Automation

function ControlBox({ title, state, onChange }){
  return (
    <div className="card" style={{ minWidth: 220 }}>
      <div className="card-header">
        <div style={{ fontWeight:600 }}>{title}</div>
        <span className={`badge ${state==='ON' ? 'ok' : 'warn'}`}>Trạng thái: {state}</span>
      </div>
      <div className="card-body">
        <div className="toggle">
          <button className="btn btn-primary" onClick={()=>onChange('ON')} disabled={state==='ON'}>Bật</button>
          <button className="btn" onClick={()=>onChange('OFF')} disabled={state==='OFF'}>Tắt</button>
        </div>
      </div>
    </div>
  )
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const [device, setDevice] = useState(null)
  const [data, setData] = useState([])
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [cmdFan, setCmdFan] = useState('OFF')
  const [cmdLight, setCmdLight] = useState('OFF')
  const [cmdPump, setCmdPump] = useState('OFF')
  const [autoForm, setAutoForm] = useState({ autoPumpEnabled: false, autoPumpSoilBelow: '', autoFanEnabled: false, autoFanTempAbove: '' })
  const sseRef = useRef(null)
  const [sseStatus, setSseStatus] = useState('disconnected')
  const reconnectAttemptsRef = useRef(0)

  async function loadDevice() {
    try {
      const devRes = await api.get(`/api/devices/${id}`)
      setDevice(devRes.data)
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to load device')
    }
  }

  async function loadSensors(silent = false) {
    if (!silent) { setLoading(true); setMsg('') }
    try {
      const sensRes = await api.get(`/api/sensors`, { params: { deviceId: id, limit } })
      setData(sensRes.data || [])
    } catch (e) {
      if (!silent) setMsg(e.response?.data?.message || 'Failed to load data')
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
    } catch (e) {
      // ignore silent errors for state polling
    }
  }

  // Initial load: fetch device (once) and sensors
  useEffect(() => {
    setLoading(true)
    Promise.resolve()
      .then(() => loadDevice())
      .then(() => loadSensors(false))
      .then(() => loadDeviceState())
      .finally(() => setLoading(false))
  }, [id, limit])
  // Polling fallback: only refresh sensor data silently when SSE not healthy
  useEffect(() => {
    const t = setInterval(() => {
      if (sseStatus !== 'connected') {
        loadSensors(true); loadDeviceState();
      }
    }, 5000)
    return () => clearInterval(t)
  }, [id, limit, sseStatus])

  // Establish SSE stream
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
        setSseStatus('error')
        es.close()
        // exponential backoff reconnect
        const attempt = ++reconnectAttemptsRef.current
        const delay = Math.min(30000, Math.pow(2, attempt) * 500)
        setTimeout(() => { connect() }, delay)
      }
      es.addEventListener('welcome', () => {})
      es.addEventListener('telemetry', (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          // Update actuator states
          if (payload.relayFan) setCmdFan(payload.relayFan)
          if (payload.relayLight) setCmdLight(payload.relayLight)
            if (payload.relayPump) setCmdPump(payload.relayPump)
          if (payload.status) setDevice(prev => prev ? { ...prev, status: payload.status } : prev)
          // Merge telemetry into charts data
          setData(prev => {
            const next = [...prev]
            const ts = payload.timestamp || Date.now()
            // Avoid duplicate by timestamp match
            if (!next.some(d => d.timestamp === ts)) {
              next.push({
                timestamp: ts,
                temperature: payload.temperature,
                humidity: payload.humidity,
                soilMoisture: payload.soilMoisture ?? payload.soil_pct,
                lux: payload.lux,
              })
              // Limit size
              if (next.length > limit) next.splice(0, next.length - limit)
            }
            return next
          })
        } catch (e) {
          // ignore parse errors
        }
      })
      es.addEventListener('status', (evt) => {
        try {
          const s = JSON.parse(evt.data)
          setDevice(prev => prev ? { ...prev, status: s.status } : prev)
        } catch {}
      })
    }
    connect()
    return () => { sseRef.current && sseRef.current.close(); sseRef.current = null }
  }, [device, limit])

  const chartsData = useMemo(() => data?.slice().reverse(), [data])
  const latest = useMemo(() => (chartsData && chartsData.length ? chartsData[chartsData.length - 1] : null), [chartsData])

  async function sendTarget(target, action) {
    setMsg('')
    try {
      await api.post('/api/commands', { deviceId: id, target, action })
      setMsg(`Sent ${target} -> ${action}`)
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to send command')
    }
  }

  function localApplyAutoFromDevice(d){
    setAutoForm({
      autoPumpEnabled: !!d.autoPumpEnabled,
      autoPumpSoilBelow: d.autoPumpSoilBelow ?? '',
      autoFanEnabled: !!d.autoFanEnabled,
      autoFanTempAbove: d.autoFanTempAbove ?? '',
    })
  }

  useEffect(() => { if(device) localApplyAutoFromDevice(device) }, [device])

  async function saveAutomation(e){
    e.preventDefault()
    setMsg('')
    try {
      const payload = {
        autoPumpEnabled: autoForm.autoPumpEnabled,
        autoPumpSoilBelow: autoForm.autoPumpSoilBelow === '' ? undefined : Number(autoForm.autoPumpSoilBelow),
        autoFanEnabled: autoForm.autoFanEnabled,
        autoFanTempAbove: autoForm.autoFanTempAbove === '' ? undefined : Number(autoForm.autoFanTempAbove),
      }
      const res = await api.put(`/api/devices/${id}`, payload)
      setMsg('Automation saved')
      setDevice(res.data)
    } catch(e){
      setMsg(e.response?.data?.message || 'Failed to save automation')
    }
  }

  if (loading) return <div className="muted">Loading...</div>
  if (!device) return <div className="muted">{msg || 'Device not found'}</div>

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="section-title">{device.name}</h3>
            <div className="small muted">ID: {device.externalId || '-'}</div>
          </div>
          <div>
            <span className={`badge ${device.status==='online' ? 'ok' : (device.status==='offline' ? 'err' : '')}`}>Status: {device.status}</span>
          </div>
        </div>
        <div className="card-body">
          <div className="row center between wrap">
            <div className="small muted">Luồng trực tiếp: <b style={{ color: sseStatus==='connected' ? '#7cffc5' : sseStatus==='connecting' ? '#ffe08a' : '#ff9b9b' }}>{sseStatus}</b></div>
            {latest && (
              <div className="latest">
                <span className="pill"><b>°C</b> {latest.temperature ?? '-'}</span>
                <span className="pill"><b>%RH</b> {latest.humidity ?? '-'}</span>
                <span className="pill"><b>Đất%</b> {latest.soilMoisture ?? '-'}</span>
                <span className="pill"><b>Lux</b> {latest.lux ?? '-'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-3">
            <ControlBox title="Fan" state={cmdFan} onChange={(next)=>{ setCmdFan(next); sendTarget('fan', next) }} />
            <ControlBox title="Light" state={cmdLight} onChange={(next)=>{ setCmdLight(next); sendTarget('light', next) }} />
            <ControlBox title="Pump" state={cmdPump} onChange={(next)=>{ setCmdPump(next); sendTarget('pump', next) }} />
          </div>
        </div>
      </div>
      {msg && <div style={{ color:'#7cffc5' }}>{msg}</div>}
      <SchedulesPanel deviceId={id} />
      <AutomationPanel device={device} onSaved={(d)=>{ setDevice(d); setMsg('Automation saved'); }} />

      {/* Latest metrics moved to header card for compactness */}

      <div className="grid grid-2">
        <MetricChart title="Temperature (°C)" data={chartsData} dataKey="temperature" color="#d32f2f" />
        <MetricChart title="Humidity (%)" data={chartsData} dataKey="humidity" color="#0288d1" />
        <MetricChart title="Soil Moisture (%)" data={chartsData} dataKey="soilMoisture" color="#2e7d32" />
        <MetricChart title="Lux" data={chartsData} dataKey="lux" color="#f9a825" />
      </div>

      <div className="row between center wrap">
        <div className="small muted">Biểu đồ theo thời gian</div>
        <label className="small muted">
          Hiển thị gần nhất
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ marginLeft: 6, maxWidth: 120 }}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          bản ghi
        </label>
      </div>
    </div>
  )
}
