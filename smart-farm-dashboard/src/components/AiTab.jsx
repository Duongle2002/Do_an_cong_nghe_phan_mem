import React from 'react'

export default function AiTab({
  user,
  messages,
  chatInput,
  setChatInput,
  isTyping,
  handleSendChat,
}) {
  const displayName = user?.name || user?.username || user?.email || 'bạn'

  return (
    <div className="card" style={{ padding: 0, height: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(16,185,129,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#10b981', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
        }}>🤖</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Trợ lý GreenGuard AI</div>
          <div style={{ fontSize: 10, color: '#81c784', fontWeight: 600 }}>TINYML KẾT NỐI TRỰC TUYẾN</div>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(217, 119, 6, 0.1)',
        borderBottom: '1px solid rgba(217, 119, 6, 0.2)',
        fontSize: 12,
        color: '#fbbf24',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        lineHeight: 1.4
      }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
        <span>
          <strong>Lưu ý:</strong> Đây chưa phải là trí tuệ nhân tạo (AI) thực sự. Chức năng này đang trong quá trình phát triển, các câu trả lời hiện tại chỉ mang tính chất mô phỏng theo dữ liệu cảm biến thực tế.
        </span>
      </div>

      {/* Chat message logs */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end',
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              background: m.sender === 'ai' ? 'rgba(255,255,255,0.04)' : '#10b981',
              color: '#fff',
              border: m.sender === 'ai' ? '1px solid var(--border)' : 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {m.text}
          </div>
        ))}

        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            display: 'flex',
            gap: 4,
            alignItems: 'center'
          }}>
            <span className="dot-typing" />
            <span className="dot-typing" />
            <span className="dot-typing" />
            <style>{`
              .dot-typing {
                width: 6px; height: 6px;
                background-color: var(--text-dim);
                border-radius: 50%;
                display: inline-block;
                animation: bounce 1.4s infinite ease-in-out both;
              }
              .dot-typing:nth-child(1) { animation-delay: -0.32s; }
              .dot-typing:nth-child(2) { animation-delay: -0.16s; }
              @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Chat input form */}
      <form onSubmit={handleSendChat} style={{
        padding: 16,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 10
      }}>
        <input
          type="text"
          placeholder="Hỏi trợ lý về tưới nước, nhiệt độ hoặc độ ẩm..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          disabled={isTyping}
          style={{ flex: 1, padding: '10px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 10, outline: 'none', color: '#fff' }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={isTyping || !chatInput.trim()}
          style={{ borderRadius: 10, padding: '10px 16px' }}
        >
          Gửi
        </button>
      </form>
    </div>
  )
}
