import React, { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { Link } from 'react-router-dom'

// Show latest telemetry for a device, using SSE when externalId is present, else polling
export default function RealtimeDeviceCard({ device }) {
  const [latest, setLatest] = useState(null)
  const [sseStatus, setSseStatus] = useState('disconnected')
  const esRef = useRef(null)

  useEffect(() => {
    let mounted = true
    async function fetchLatest() {
      try {
        const res = await api.get('/api/sensors', { params: { deviceId: device._id, limit: 1 } })
        if (!mounted) return
        const arr = res.data || []
        if (arr.length) setLatest(arr[0])
      } catch (e) {
        // ignore
      }
    }

    // If device has externalId, try SSE
    if (device.externalId) {
      const token = localStorage.getItem('accessToken')
      if (token) {
        setSseStatus('connecting')
        const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/stream/devices/${device.externalId}?token=${encodeURIComponent(token)}`
        try {
          const es = new EventSource(url)
          esRef.current = es
          es.onopen = () => setSseStatus('connected')
          es.onerror = () => { setSseStatus('error'); es.close() }
          es.addEventListener('telemetry', (evt) => {
            try {
              const p = JSON.parse(evt.data)
              const entry = {
                timestamp: p.timestamp || Date.now(),
                temperature: p.temperature,
                humidity: p.humidity,
                soilMoisture: p.soilMoisture ?? p.soil_pct,
                lux: p.lux
              }
              setLatest(entry)
            } catch (err) {}
          })
        } catch (err) {
          setSseStatus('error')
          fetchLatest()
        }
      } else {
        fetchLatest()
      }
    } else {
      // no externalId -> polling every 10s
      fetchLatest()
      const t = setInterval(fetchLatest, 10000)
      return () => { mounted = false; clearInterval(t) }
    }

    return () => { mounted = false; if (esRef.current) { esRef.current.close(); esRef.current = null } }
  }, [device._id, device.externalId])

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{device.name}</div>
          <div className="small muted">ID: {device.externalId || '-'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`badge ${device.status==='online' ? 'ok' : (device.status==='offline' ? 'err' : '')}`}> {device.status} </div>
          <div className="small muted" style={{ marginTop: 6 }}>{sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting' : '—'}</div>
        </div>
      </div>

      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          <div className="pill"><b>°C</b> {latest.temperature ?? '-'}</div>
          <div className="pill"><b>%RH</b> {latest.humidity ?? '-'}</div>
          <div className="pill"><b>Đất%</b> {latest.soilMoisture ?? '-'}</div>
          <div className="pill"><b>Lux</b> {latest.lux ?? '-'}</div>
        </div>
      ) : (
        <div className="muted">No telemetry</div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Link to={`/devices/${device._id}`} className="btn btn-outline">Open</Link>
        <button className="btn btn-primary" onClick={async () => {
          try { await api.post('/api/commands', { deviceId: device._id, target: 'ping', action: 'PING' }) } catch (e) {}
        }}>Ping</button>
      </div>
    </div>
  )
}
