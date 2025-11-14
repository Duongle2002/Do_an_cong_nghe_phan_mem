import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'

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

  if (loading) return <div>Loading devices...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Devices</h3>
        <button onClick={() => navigate('/devices/new')}>+ Create Device</button>
      </div>
      <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>External ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(d => (
            <tr key={d._id}>
              <td>{d.name}</td>
              <td>{d.status}</td>
              <td>{d.externalId || '-'}</td>
              <td><Link to={`/devices/${d._id}`}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
