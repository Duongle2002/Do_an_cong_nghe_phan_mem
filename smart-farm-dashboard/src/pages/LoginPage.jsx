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
      // support axios-like and generic errors
      const msg = err?.response?.data?.message || err?.message || 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
      <div className="card" style={{ width: 420 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div className="brand-badge"><span>SF</span></div>
            <div>
              <h2 style={{ margin: 0 }}>Smart Farm</h2>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sign in to continue</div>
            </div>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
            <label>
              Email
              <input className="" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-cta" type="submit" disabled={loading} aria-busy={loading}>{loading ? 'Signing...' : 'Sign in'}</button>
              <a style={{ color: 'var(--muted)', fontSize: 13 }} href="/register">Create account</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
