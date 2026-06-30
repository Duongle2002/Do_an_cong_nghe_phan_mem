import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/devices', { replace: true })
    } catch (err) {
      if (err.response?.data?.unverified) {
        navigate('/register', { state: { email, step: 'otp' } })
        return
      }
      const msg = err?.response?.data?.message || err?.message || 'Đăng nhập thất bại'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '90vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Ambient glow behind card */}
      <div style={{
        position: 'fixed',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
        left: '50%',
        top: '50%',
      }} />

      <div className="page-enter" style={{
        width: '100%',
        maxWidth: 420,
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="floating-logo" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            marginBottom: 8,
          }}>
            <svg viewBox="0 0 24 24" fill="var(--primary)" width="64" height="64">
              <path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,1.75,3.75C7,8,17,8,17,8Z"/>
            </svg>
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '1px',
            color: 'var(--text)',
            textTransform: 'uppercase',
          }}>Smart Farm</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 2, fontWeight: 500 }}>
            Digital Agriculture Control
          </div>
        </div>

        {/* Card */}
        <div className="card floating-card" style={{
          background: 'var(--border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)',
            backgroundSize: '200% 100%',
          }} />

          <div className="card-body" style={{ padding: '28px 32px 32px' }}>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-dim)',
                  marginBottom: 8,
                }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: 15,
                    pointerEvents: 'none',
                  }}>✉</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-dim)',
                  marginBottom: 8,
                }}>Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    pointerEvents: 'none',
                  }}>🔒</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,83,80,0.12)',
                  border: '1px solid rgba(239,83,80,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: '#e53935',
                  fontSize: 13,
                }}>
                  ⚠ {error}
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '13px 16px',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 16, height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Đang đăng nhập...
                  </span>
                ) : 'Đăng nhập'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Hoặc</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <a
                href="/demo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.22) 100%)';
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.6)';
                  e.currentTarget.style.color = '#34d399';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)';
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.35)';
                  e.currentTarget.style.color = '#10b981';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.1)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                🎮 Trải Nghiệm Bản Demo Ngay
              </a>

              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Chưa có tài khoản?{' '}
                <a href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Đăng ký ngay
                </a>
              </div>
            </form>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
