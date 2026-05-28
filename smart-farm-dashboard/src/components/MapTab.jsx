import React from 'react'

export default function MapTab() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        Bản Đồ Phân Phối Thiết Bị
      </h3>
      <div style={{
        height: 380,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Blinking Grid Background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        {/* SVG Farm Plot layout */}
        <svg viewBox="0 0 400 240" width="100%" height="80%" style={{ position: 'relative', maxWidth: 500 }}>
          <rect x="20" y="20" width="360" height="200" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />

          {/* Agricultural zones grid */}
          <line x1="140" y1="20" x2="140" y2="220" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1="260" y1="20" x2="260" y2="220" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

          <text x="75" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC A (RAU SẠCH)</text>
          <text x="200" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC B (CÂY ĂN QUẢ)</text>
          <text x="325" y="45" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="bold" textAnchor="middle">KHU VỰC C (HOA KIỂNG)</text>

          {/* Nodes and Sensor coordinates */}
          <circle cx="80" cy="120" r="25" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)" />
          <circle cx="80" cy="120" r="4" fill="#10b981" />
          <text x="80" y="160" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">NODE 1 (HOẠT ĐỘNG)</text>

          <circle cx="200" cy="120" r="25" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
          <circle cx="200" cy="120" r="4" fill="rgba(255,255,255,0.3)" />
          <text x="200" y="160" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">NODE 2 (OFFLINE)</text>

          <circle cx="320" cy="120" r="25" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
          <circle cx="320" cy="120" r="4" fill="rgba(255,255,255,0.3)" />
          <text x="320" y="160" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">NODE 3 (OFFLINE)</text>

          {/* Water Valve Line Connection */}
          <path d="M 80 120 L 200 120 L 320 120" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" strokeDasharray="3 3" />
        </svg>

        {/* Blinking Live Indicator overlay */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#81c784', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-green 1.5s infinite' }} />
          BẢN ĐỒ TRỰC TUYẾN
        </div>
      </div>
    </div>
  )
}
