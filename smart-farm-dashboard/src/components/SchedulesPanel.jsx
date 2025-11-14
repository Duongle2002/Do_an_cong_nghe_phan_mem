import React, { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

function formatTimeLocal(d) {
  try {
    const dt = new Date(d)
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch { return '-' }
}

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export default function SchedulesPanel({ deviceId }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    target: 'main',
    action: 'ON',
    repeat: 'daily',
    time: '08:00',
    weekday: new Date().getDay(),
    active: true,
  })

  function setField(k, v){ setForm(s => ({ ...s, [k]: v })) }

  async function load() {
    try {
      setError('')
      const res = await api.get('/api/schedules', { params: { deviceId } })
      setItems(res.data || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load schedules')
    }
  }

  useEffect(() => { if (deviceId) load() }, [deviceId])

  function buildTime() {
    const now = new Date()
    const [hh, mm] = (form.time || '00:00').split(':').map(x => Number(x))
    const t = new Date(now)
    t.setSeconds(0, 0)
    t.setHours(hh, mm, 0, 0)
    if (form.repeat === 'weekly') {
      const curDow = t.getDay()
      const targetDow = Number(form.weekday)
      const diff = targetDow - curDow
      t.setDate(t.getDate() + diff)
    }
    return t
  }

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = {
        deviceId,
        target: form.target,
        action: form.action,
        repeat: form.repeat,
        time: buildTime().toISOString(),
        active: !!form.active,
      }
      await api.post('/api/schedules', body)
      await load()
      // reset minimal
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message
      setError(detail || 'Failed to create schedule')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(s) {
    try {
      await api.put(`/api/schedules/${s._id}`, { active: !s.active })
      setItems(items => items.map(it => it._id === s._id ? { ...it, active: !s.active } : it))
    } catch {}
  }

  async function remove(id) {
    if (!confirm('Delete this schedule?')) return
    try {
      await api.delete(`/api/schedules/${id}`)
      setItems(items => items.filter(it => it._id !== id))
    } catch {}
  }

  const sorted = useMemo(() => (items || []).slice().sort((a,b) => new Date(a.time) - new Date(b.time)), [items])

  return (
    <div className="card">
      <div className="card-header">
        <h4 style={{ margin: 0 }}>Hẹn giờ</h4>
        {error && <div style={{ color: '#ff9b9b' }}>{error}</div>}
      </div>
      <div className="card-body">
      <form onSubmit={create} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
        <label>
          Target
          <select value={form.target} onChange={e => setField('target', e.target.value)}>
            <option value="main">Main</option>
            <option value="fan">Fan</option>
            <option value="light">Light</option>
            <option value="pump">Pump</option>
          </select>
        </label>
        <label>
          Action
          <select value={form.action} onChange={e => setField('action', e.target.value)}>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
        </label>
        <label>
          Repeat
          <select value={form.repeat} onChange={e => setField('repeat', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        {form.repeat === 'weekly' && (
          <label>
            Weekday
            <select value={form.weekday} onChange={e => setField('weekday', Number(e.target.value))}>
              {weekdays.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
        )}
        <label>
          Time
          <input type="time" value={form.time} onChange={e => setField('time', e.target.value)} />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={form.active} onChange={e => setField('active', e.target.checked)} /> Active
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Đang thêm...' : 'Thêm'}</button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Repeat</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Target</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Action</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Active</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Last run</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s._id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{formatTimeLocal(s.time)}</td>
                <td style={{ padding: '6px 8px' }}>{s.repeat}</td>
                <td style={{ padding: '6px 8px' }}>{s.target}</td>
                <td style={{ padding: '6px 8px' }}>{s.action}</td>
                <td style={{ padding: '6px 8px' }}>
                  <button className="btn" onClick={() => toggleActive(s)} style={{ minWidth: 64 }}>{s.active ? 'On' : 'Off'}</button>
                </td>
                <td style={{ padding: '6px 8px' }}>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '-'}</td>
                <td style={{ padding: '6px 8px' }}>
                  <button className="btn btn-danger" onClick={() => remove(s._id)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={7} style={{ padding: 8, color: '#666' }}>No schedules yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
