import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function CreateDevicePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', externalId: '', location: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function setField(k, v) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Name is required')
    if (!user?.id) return setError('Not authenticated')
    setBusy(true)
    try {
      const body = { name: form.name.trim(), ownerId: user.id, location: form.location.trim(), externalId: form.externalId.trim() || undefined }
      const res = await api.post('/api/devices', body)
      navigate(`/devices/${res.data._id}`)
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message
      setError(detail || 'Failed to create device')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '24px auto' }}>
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin:0 }}>Tạo thiết bị</h3>
          <span className="small muted">Nhập External ID trùng với ESP</span>
        </div>
        <div className="card-body">
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
            <label>
              Tên
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            </label>
            <label>
              External ID (giống ESP)
              <input value={form.externalId} onChange={(e) => setField('externalId', e.target.value)} placeholder="esp32-XXXX" />
            </label>
            <label>
              Vị trí (tùy chọn)
              <input value={form.location} onChange={(e) => setField('location', e.target.value)} />
            </label>
            {error && <div style={{ color: '#ff9b9b' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo'}</button>
              <button className="btn" type="button" onClick={() => navigate(-1)}>Hủy</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
