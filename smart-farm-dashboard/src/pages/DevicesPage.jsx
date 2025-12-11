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

  if (loading) return <div className="muted">Loading devices...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>Devices</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/devices/new')}>+ Create Device</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {items.map(d => (
          <RealtimeDeviceCard key={d._id} device={d} />
        ))}
      </div>
    </div>
  )
}
