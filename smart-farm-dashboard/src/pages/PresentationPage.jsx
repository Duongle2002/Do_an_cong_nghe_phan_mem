import React from 'react'
import { useNavigate } from 'react-router-dom'
import presentationHtml from '../../public/presentation.html?raw'

export default function PresentationPage() {
  const navigate = useNavigate()

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0, position: 'relative' }}>
      <button
        onClick={() => navigate('/devices')}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '10px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          color: 'var(--text, #0f172a)',
          fontWeight: '600',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--green-dim, rgba(5, 150, 105, 0.08))';
          e.currentTarget.style.borderColor = 'var(--green, #059669)';
          e.currentTarget.style.color = 'var(--green, #059669)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-card, #ffffff)';
          e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
          e.currentTarget.style.color = 'var(--text, #0f172a)';
        }}
      >
        <span>🏠</span>
        <span>Quay lại trang chính</span>
      </button>

      <iframe
        srcDoc={presentationHtml}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Bài thuyết trình"
      />
    </div>
  )
}
