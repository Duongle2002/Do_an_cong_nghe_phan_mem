import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import RealtimeDeviceCard from '../components/RealtimeDeviceCard'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/api/devices')
        if (!ignore) setItems(res.data || [])
      } catch (e) {
        if (!ignore) setError(e.response?.data?.message || 'Failed to load devices')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 16 }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(16, 185, 129,0.2)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <div className="muted">Đang tải thiết bị...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error) return (
    <div className="card" style={{ padding: 24, color: '#ef9a9a', textAlign: 'center' }}>
      ⚠ {error}
    </div>
  )

  return (
    <div className="page-enter">
      {/* Page header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4 }}>
            Thiết bị
          </h2>
          <div className="small muted">{items.length} thiết bị đã đăng ký</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/devices/new')}
          style={{ gap: 8 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Thêm thiết bị
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-dim)' }}>
              Chưa có thiết bị nào
            </div>
            <div className="small muted" style={{ marginBottom: 20 }}>
              Thêm thiết bị ESP32 đầu tiên của bạn để bắt đầu giám sát
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/devices/new')}>
              + Thêm thiết bị
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {items.map(d => (
            <RealtimeDeviceCard key={d._id} device={d} />
          ))}
        </div>
      )}
    </div>
  )
}
