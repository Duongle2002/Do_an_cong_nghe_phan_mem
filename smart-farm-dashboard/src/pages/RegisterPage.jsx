import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  
  const [showOtpScreen, setShowOtpScreen] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)
  const [otpError, setOtpError] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  
  const { loginWithSession } = useAuth()

  useEffect(() => {
    if (location.state?.step === 'otp' && location.state?.email) {
      setRegisteredEmail(location.state.email)
      setShowOtpScreen(true)
    }
  }, [location.state])

  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Mật khẩu phải ít nhất 6 ký tự')
    if (password !== confirm) return setError('Mật khẩu xác nhận không khớp')
    setBusy(true)
    try {
      await api.post('/api/auth/register', { name, email, password })
      setRegisteredEmail(email)
      setShowOtpScreen(true)
      setResendCountdown(60)
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message
      setError(detail || 'Đăng ký thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault()
    setOtpError('')
    if (otpCode.length !== 6) return setOtpError('Mã OTP phải gồm 6 chữ số')
    setOtpBusy(true)
    try {
      const res = await api.post('/api/auth/verify-otp', { email: registeredEmail, otpCode })
      loginWithSession(res.data)
      navigate('/devices', { replace: true })
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message
      setOtpError(detail || 'Xác thực OTP thất bại')
    } finally {
      setOtpBusy(false)
    }
  }

  async function onResendOtp() {
    if (resendCountdown > 0) return
    setOtpError('')
    setOtpBusy(true)
    try {
      await api.post('/api/auth/resend-otp', { email: registeredEmail })
      setResendCountdown(60)
      setOtpError('Đã gửi lại mã OTP thành công. Vui lòng kiểm tra hộp thư.')
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors) ? apiErr.errors.map(x => x.msg).join(', ') : apiErr?.message
      setOtpError(detail || 'Gửi lại mã OTP thất bại')
    } finally {
      setOtpBusy(false)
    }
  }

  const fields = [
    { label: 'Họ tên', type: 'text', val: name, set: setName, placeholder: 'Nguyen Van A', icon: '👤' },
    { label: 'Email', type: 'email', val: email, set: setEmail, placeholder: 'you@example.com', icon: '✉' },
    { label: 'Mật khẩu', type: 'password', val: password, set: setPassword, placeholder: '••••••••', icon: '🔒' },
    { label: 'Xác nhận mật khẩu', type: 'password', val: confirm, set: setConfirm, placeholder: '••••••••', icon: '🔒' },
  ]

  if (showOtpScreen) {
    return (
      <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="page-enter" style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 60, height: 60, borderRadius: 18,
              background: 'linear-gradient(135deg, #10b981, #34d399)',
              boxShadow: '0 8px 28px rgba(16, 185, 129,0.4)', marginBottom: 14,
            }}>
              <span style={{ fontSize: 26 }}>✉</span>
            </div>
            <div style={{
              fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Xác minh email</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Chúng tôi đã gửi mã OTP 6 chữ số đến email <strong style={{ color: 'var(--accent)' }}>{registeredEmail}</strong>
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
            <div className="card-body" style={{ padding: '24px 28px 28px' }}>
              <form onSubmit={onVerifyOtp} style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: 12, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: 'var(--text-dim)', marginBottom: 8,
                  }}>Mã xác thực OTP</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
                    }}>🔑</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Nhập 6 chữ số"
                      required
                      style={{ paddingLeft: 36, letterSpacing: '2px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}
                    />
                  </div>
                </div>

                {otpError && (
                  <div style={{
                    background: otpError.includes('thành công') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239,83,80,0.12)',
                    border: otpError.includes('thành công') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239,83,80,0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    color: otpError.includes('thành công') ? 'var(--primary-600)' : '#e53935', fontSize: 13,
                  }}>
                    {otpError.includes('thành công') ? '✓' : '⚠'} {otpError}
                  </div>
                )}

                <button className="btn btn-primary" type="submit" disabled={otpBusy || otpCode.length !== 6} style={{ justifyContent: 'center', padding: '12px 16px', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                  {otpBusy ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 15, height: 15,
                        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                        borderRadius: '50%', display: 'inline-block',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      Đang xác minh...
                    </span>
                  ) : 'Xác minh & Hoàn tất →'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginTop: 8 }}>
                  <button 
                    type="button" 
                    onClick={onResendOtp} 
                    disabled={otpBusy || resendCountdown > 0} 
                    style={{
                      background: 'none', border: 'none', 
                      color: resendCountdown > 0 ? 'var(--text-muted)' : 'var(--accent)', 
                      cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 600, padding: 0,
                    }}
                  >
                    {resendCountdown > 0 ? `Gửi lại mã (${resendCountdown}s)` : 'Gửi lại mã OTP'}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setShowOtpScreen(false)
                      setOtpCode('')
                      setOtpError('')
                    }} 
                    style={{
                      background: 'none', border: 'none', 
                      color: 'var(--text-dim)', 
                      cursor: 'pointer',
                      fontWeight: 500, padding: 0,
                    }}
                  >
                    Quay lại đăng ký
                  </button>
                </div>
              </form>
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="page-enter" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #10b981, #34d399)',
            boxShadow: '0 8px 28px rgba(16, 185, 129,0.4)', marginBottom: 14,
          }}>
            <span style={{ fontSize: 26 }}>🌱</span>
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Tạo tài khoản</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Smart Farm Dashboard
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div className="card-body" style={{ padding: '24px 28px 28px' }}>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
              {fields.map(f => (
                <div key={f.label}>
                  <label style={{
                    display: 'block', fontSize: 12, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: 'var(--text-dim)', marginBottom: 6,
                  }}>{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
                    }}>{f.icon}</span>
                    <input
                      type={f.type}
                      value={f.val}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      required
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                </div>
              ))}

              {error && (
                <div style={{
                  background: 'rgba(239,83,80,0.12)',
                  border: '1px solid rgba(239,83,80,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: '#e53935', fontSize: 13,
                }}>
                  ⚠ {error}
                </div>
              )}

              <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: 'center', padding: '12px 16px', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {busy ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 15, height: 15,
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                      borderRadius: '50%', display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Đang đăng ký...
                  </span>
                ) : 'Đăng ký →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                Đã có tài khoản?{' '}
                <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Đăng nhập</Link>
              </div>
            </form>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
