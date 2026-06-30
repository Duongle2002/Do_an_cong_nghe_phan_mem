import React, { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

function formatTimeLocal(d) {
  try {
    const dt = new Date(d)
    return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}

const weekdays = [
  { value: 0, label: 'CN' }, { value: 1, label: 'T2' }, { value: 2, label: 'T3' },
  { value: 3, label: 'T4' }, { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' },
]

const targetIcons = { main: '⚙', fan: '🌀', light: '💡', pump: '💦' }
const actionColors = { ON: { bg: 'rgba(16, 185, 129,0.15)', border: 'rgba(16, 185, 129,0.3)', color: '#81c784' }, OFF: { bg: 'rgba(239,83,80,0.12)', border: 'rgba(239,83,80,0.3)', color: '#ef9a9a' } }

export default function SchedulesPanel({ deviceId }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ target: 'fan', action: 'ON', repeat: 'daily', time: '08:00', weekday: new Date().getDay(), active: true })
  const [showForm, setShowForm] = useState(false)

  function setField(k, v) { setForm(s => ({ ...s, [k]: v })) }

  async function load() {
    try {
      setError('')
      const res = await api.get('/api/schedules', { params: { deviceId } })
      setItems(res.data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi tải lịch')
    }
  }

  useEffect(() => { if (deviceId) load() }, [deviceId])

  function buildTime() {
    const now = new Date()
    const [hh, mm] = (form.time || '00:00').split(':').map(Number)
    const t = new Date(now)
    t.setHours(hh, mm, 0, 0)
    if (form.repeat === 'weekly') {
      const diff = Number(form.weekday) - t.getDay()
      t.setDate(t.getDate() + diff)
    }
    return t
  }

  async function create(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api.post('/api/schedules', { deviceId, target: form.target, action: form.action, repeat: form.repeat, time: buildTime().toISOString(), active: !!form.active })
      await load()
      setShowForm(false) // collapse form on success
    } catch (e) {
      const apiErr = e.response?.data
      setError(Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message || 'Lỗi tạo lịch')
    } finally { setBusy(false) }
  }

  async function toggleActive(s) {
    try {
      await api.put(`/api/schedules/${s._id}`, { active: !s.active })
      setItems(items => items.map(it => it._id === s._id ? { ...it, active: !s.active } : it))
    } catch { }
  }

  async function remove(id) {
    if (!confirm('Xóa lịch này?')) return
    try {
      await api.delete(`/api/schedules/${id}`)
      setItems(items => items.filter(it => it._id !== id))
    } catch { }
  }

  const sorted = useMemo(() => (items || []).slice().sort((a, b) => new Date(a.time) - new Date(b.time)), [items])

  const targetNames = { fan: 'QUẠT THÔNG GIÓ', light: 'HỆ THỐNG ĐÈN', pump: 'MÁY BƠM NƯỚC', main: 'HỆ THỐNG CHÍNH' }
  const actionNames = { ON: 'BẬT', OFF: 'TẮT' }

  return (
    <div className="matrix-card-new">
      <div className="matrix-header-new">
        <div className="matrix-title-new">
          <span>⏰</span>
          <span>SCHEDULER MATRIX ({sorted.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && <div style={{ fontSize: 12, color: '#ef9a9a' }}>⚠ {error}</div>}
          <button 
            className="matrix-row-btn-new"
            onClick={() => setShowForm(!showForm)}
            style={{ 
              borderColor: showForm ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)',
              color: showForm ? '#10b981' : 'var(--text-dim)'
            }}
          >
            {showForm ? '✕ Đóng lại' : '➕ Thêm lịch'}
          </button>
        </div>
      </div>

      {/* Collapsible Create form */}
      {showForm && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 'var(--radius-sm)',
          padding: 16,
          marginBottom: 20,
          animation: 'slideUpFade 0.3s ease-out'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>
            Thiết lập lịch hẹn giờ mới
          </div>
          <form onSubmit={create} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Thiết bị', field: 'target', opts: [['fan', '🌀 Quạt'], ['light', '💡 Đèn'], ['pump', '💦 Bơm'], ['main', '⚙ Main']] },
              { label: 'Hành động', field: 'action', opts: [['ON', 'ON'], ['OFF', 'OFF']] },
              { label: 'Lặp lại', field: 'repeat', opts: [['daily', 'Hàng ngày'], ['weekly', 'Hàng tuần']] },
            ].map(({ label, field, opts }) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
                <select value={form[field]} onChange={e => setField(field, e.target.value)} style={{ padding: '8px 10px', fontSize: 13, background: 'var(--bg-sidebar)' }}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}

            {form.repeat === 'weekly' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 80 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Thứ</span>
                <select value={form.weekday} onChange={e => setField('weekday', Number(e.target.value))} style={{ padding: '8px 10px', fontSize: 13, background: 'var(--bg-sidebar)' }}>
                  {weekdays.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 100 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Giờ</span>
              <input type="time" value={form.time} onChange={e => setField('time', e.target.value)} style={{ padding: '8px 10px', fontSize: 13, background: 'var(--bg-sidebar)', width: 'auto' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10 }}>
              <input type="checkbox" checked={form.active} onChange={e => setField('active', e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Kích hoạt</span>
            </label>

            <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 13, padding: '9px 16px', height: 38 }}>
              {busy ? '...' : '+ Thêm lịch'}
            </button>
          </form>
        </div>
      )}

      {/* Schedule list */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Chưa có lịch hẹn nào được thiết lập. Chọn "+ Thêm lịch" ở trên để bắt đầu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(s => {
            const timeStr = formatTimeLocal(s.time)
            const repeatLabel = s.repeat === 'daily' ? 'DAILY CYCLE' : 'WEEKLY CYCLE'
            const targetLabel = targetNames[s.target] || s.target.toUpperCase()
            const actionLabel = actionNames[s.action] || s.action
            const durationLabel = s.target === 'pump' ? '10p' : s.target === 'fan' ? '15p' : '30p'

            return (
              <div key={s._id} className="matrix-row-new">
                <div className="matrix-left-new">
                  <div className="matrix-time-new">{timeStr}</div>
                  <div className="matrix-details-new">
                    <div className="matrix-cycle-info-new">
                      {repeatLabel} • {targetLabel} • {actionLabel}
                    </div>
                  </div>
                </div>

                <div className="matrix-actions-new">
                  {s.active && (
                    <div className="matrix-duration-badge-new">
                      {durationLabel}
                    </div>
                  )}
                  <button
                    className={`matrix-row-btn-new ${s.active ? 'active-on' : ''}`}
                    onClick={() => toggleActive(s)}
                  >
                    {s.active ? 'Active' : 'Standby'}
                  </button>
                  <button
                    className="matrix-row-btn-new delete-btn-new"
                    onClick={() => remove(s._id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
