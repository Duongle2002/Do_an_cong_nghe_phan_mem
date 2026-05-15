import React, { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import { Link } from 'react-router-dom'

const metricConfig = [
  { key: 'temperature', label: '°C', icon: '🌡', color: '#ff7043' },
  { key: 'humidity', label: '%RH', icon: '💧', color: '#29b6f6' },
  { key: 'soilMoisture', label: 'Đất%', icon: '🪴', color: '#66bb6a' },
  { key: 'lux', label: 'Lux', icon: '☀', color: '#ffa726' },
]

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
      } catch (e) { }
    }

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
              setLatest({
                timestamp: p.timestamp || Date.now(),
                temperature: p.temperature,
                humidity: p.humidity,
                soilMoisture: p.soilMoisture ?? p.soil_pct,
                lux: p.lux,
              })
            } catch { }
          })
        } catch {
          setSseStatus('error')
          fetchLatest()
        }
      } else {
        fetchLatest()
      }
    } else {
      fetchLatest()
      const t = setInterval(fetchLatest, 10000)
      return () => { mounted = false; clearInterval(t) }
    }

    return () => { mounted = false; if (esRef.current) { esRef.current.close(); esRef.current = null } }
  }, [device._id, device.externalId])

  const isOnline = device.status === 'online'

  return (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      overflow: 'hidden',
      transition: 'all 0.25s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(16, 185, 129,0.2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Status bar top */}
      <div style={{
        height: 3,
        background: isOnline
          ? 'linear-gradient(90deg, #10b981, #34d399)'
          : 'rgba(239,83,80,0.4)',
      }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px', marginBottom: 4 }}>
              {device.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              {device.externalId || 'No External ID'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span className={`badge ${isOnline ? 'ok' : 'err'}`}>
              {device.status || 'unknown'}
            </span>
            <span className={`live-indicator ${sseStatus}`} style={{ fontSize: 11 }}>
              <span className="live-dot" />
              {sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        {latest ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {metricConfig.map(m => (
              <div key={m.key} style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {m.icon} {m.label}
                </div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: 'DM Mono, monospace',
                  color: m.color,
                }}>
                  {latest[m.key] ?? '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--text-muted)',
            fontSize: 13,
            marginBottom: 14,
          }}>
            🌐 Không có dữ liệu telemetry
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/devices/${device._id}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
            Mở chi tiết →
          </Link>
          <button
            className="btn btn-outline"
            style={{ fontSize: 13 }}
            onClick={async () => {
              try { await api.post('/api/commands', { deviceId: device._id, target: 'ping', action: 'PING' }) } catch { }
            }}
          >
            Ping
          </button>
        </div>
      </div>
    </div>
  )
}
