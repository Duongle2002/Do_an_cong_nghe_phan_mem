import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  const { login } = useAuth()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/auth/register', { name, email, password })
      // Try auto login after successful registration
      await login(email, password)
      navigate('/devices', { replace: true })
    } catch (e) {
      const apiErr = e.response?.data
      const detail = Array.isArray(apiErr?.errors)
        ? apiErr.errors.map((x) => x.msg).join(', ')
        : apiErr?.message
      setError(detail || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '48px auto' }}>
      <h3>Create account</h3>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Confirm password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Register'}</button>
        <div>
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  )
}
