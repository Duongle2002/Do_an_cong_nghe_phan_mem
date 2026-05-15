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

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>⏰ Hẹn giờ</h4>
          <div className="small muted" style={{ marginTop: 2 }}>{sorted.length} lịch đã cấu hình</div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef9a9a' }}>⚠ {error}</div>}
      </div>

      <div className="card-body">
        {/* Create form */}
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 'var(--radius-sm)',
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>
            Thêm lịch mới
          </div>
          <form onSubmit={create} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Thiết bị', field: 'target', opts: [['fan', '🌀 Quạt'], ['light', '💡 Đèn'], ['pump', '💦 Bơm'], ['main', '⚙ Main']] },
              { label: 'Hành động', field: 'action', opts: [['ON', 'ON'], ['OFF', 'OFF']] },
              { label: 'Lặp lại', field: 'repeat', opts: [['daily', 'Hàng ngày'], ['weekly', 'Hàng tuần']] },
            ].map(({ label, field, opts }) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 120 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
                <select value={form[field]} onChange={e => setField(field, e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}

            {form.repeat === 'weekly' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Thứ</span>
                <select value={form.weekday} onChange={e => setField('weekday', Number(e.target.value))} style={{ padding: '8px 10px', fontSize: 13 }}>
                  {weekdays.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Giờ</span>
              <input type="time" value={form.time} onChange={e => setField('time', e.target.value)} style={{ padding: '8px 10px', fontSize: 13, width: 'auto' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
              <input type="checkbox" checked={form.active} onChange={e => setField('active', e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Kích hoạt</span>
            </label>

            <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 13, padding: '9px 16px' }}>
              {busy ? '...' : '+ Thêm'}
            </button>
          </form>
        </div>

        {/* Schedule list */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Chưa có lịch nào
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {sorted.map(s => {
              const ac = actionColors[s.action] || actionColors.ON
              return (
                <div key={s._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{targetIcons[s.target] || '⚙'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'DM Mono, monospace' }}>
                        {formatTimeLocal(s.time)}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit', marginLeft: 6 }}>
                          {s.repeat === 'daily' ? 'Hàng ngày' : `Hàng tuần`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.target} · {s.lastRunAt ? `Lần cuối: ${new Date(s.lastRunAt).toLocaleString('vi-VN')}` : 'Chưa chạy'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 700,
                      background: ac.bg, border: `1px solid ${ac.border}`, color: ac.color,
                    }}>
                      {s.action}
                    </span>
                    <button
                      className="btn"
                      onClick={() => toggleActive(s)}
                      style={{
                        fontSize: 11, padding: '5px 10px',
                        background: s.active ? 'rgba(16, 185, 129,0.12)' : 'var(--border)',
                        borderColor: s.active ? 'rgba(16, 185, 129,0.3)' : 'var(--border)',
                        color: s.active ? '#81c784' : 'var(--text-muted)',
                      }}
                    >
                      {s.active ? '● Bật' : '○ Tắt'}
                    </button>
                    <button
                      className="btn"
                      onClick={() => remove(s._id)}
                      style={{
                        fontSize: 11, padding: '5px 10px',
                        background: 'rgba(239,83,80,0.1)',
                        borderColor: 'rgba(239,83,80,0.25)',
                        color: '#ef9a9a',
                      }}
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
    </div>
  )
}
