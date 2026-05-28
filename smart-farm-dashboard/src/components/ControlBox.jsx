import React from 'react'

export default function ControlBox({ title, icon, state, onChange }) {
  const isOn = state === 'ON'
  return (
    <div className="card" style={{
      background: isOn
        ? 'linear-gradient(135deg, rgba(16, 185, 129,0.15), rgba(16, 185, 129,0.05))'
        : 'var(--border)',
      borderColor: isOn ? 'rgba(16, 185, 129,0.35)' : 'var(--border)',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
    }}>
      <div style={{ height: 2, background: isOn ? 'linear-gradient(90deg, #10b981, #34d399)' : 'var(--border)' }} />
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          </div>
          <span className={`badge ${isOn ? 'ok' : 'warn'}`} style={{ fontSize: 10 }}>
            {state}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => onChange('ON')}
            disabled={isOn}
            style={{
              flex: 1, justifyContent: 'center',
              background: isOn ? 'rgba(16, 185, 129,0.25)' : 'transparent',
              borderColor: isOn ? 'rgba(16, 185, 129,0.5)' : 'var(--border)',
              color: isOn ? '#81c784' : 'var(--text-dim)',
              fontSize: 13,
            }}
          >
            Bật
          </button>
          <button
            className="btn"
            onClick={() => onChange('OFF')}
            disabled={!isOn}
            style={{
              flex: 1, justifyContent: 'center',
              background: !isOn ? 'rgba(239,83,80,0.15)' : 'transparent',
              borderColor: !isOn ? 'rgba(239,83,80,0.4)' : 'var(--border)',
              color: !isOn ? '#ef9a9a' : 'var(--text-dim)',
              fontSize: 13,
            }}
          >
            Tắt
          </button>
        </div>
      </div>
    </div>
  )
}
