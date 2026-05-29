import React from 'react'

export default function PresentationPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      <iframe
        src="/presentation.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Bài thuyết trình"
      />
    </div>
  )
}
