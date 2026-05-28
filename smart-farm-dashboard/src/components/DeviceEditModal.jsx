import React, { useState, useEffect } from 'react'
import api from '../api/client'

export default function DeviceEditModal({ isOpen, onClose, device, onSaved, showMsg }) {
  const [editForm, setEditForm] = useState({ name: '', externalId: '', location: '' })
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  useEffect(() => {
    if (device && isOpen) {
      setEditForm({
        name: device.name || '',
        externalId: device.externalId || '',
        location: device.location || '',
      })
      setEditError('')
    }
  }, [device, isOpen])

  if (!isOpen || !device) return null

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError('')
    if (!editForm.name.trim()) return setEditError('Tên không được để trống')
    setEditBusy(true)
    try {
      const res = await api.put(`/api/devices/${device._id}`, {
        name: editForm.name.trim(),
        externalId: editForm.externalId.trim() || undefined,
        location: editForm.location.trim(),
      })
      onSaved(res.data)
      onClose()
      if (showMsg) showMsg('Cập nhật thiết bị thành công!', 'ok')
    } catch (err) {
      setEditError(err.response?.data?.message || 'Không thể cập nhật thiết bị')
    } finally {
      setEditBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#0f121a',
        border: '1px solid var(--border)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 480,
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.8)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ Chỉnh sửa thiết bị</h3>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleEditSubmit} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Tên thiết bị</label>
            <input 
              type="text" 
              value={editForm.name} 
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              required 
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>External ID (Khớp với cấu hình ESP)</label>
            <input 
              type="text" 
              value={editForm.externalId} 
              onChange={e => setEditForm(prev => ({ ...prev, externalId: e.target.value }))}
              placeholder="esp32-XXXX"
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Vị trí / Khu vực</label>
            <input 
              type="text" 
              value={editForm.location} 
              onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>
          {editError && (
            <div style={{ color: '#ef5350', fontSize: 12, fontWeight: 500 }}>
              ⚠️ {editError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={onClose}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={editBusy}
            >
              {editBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
