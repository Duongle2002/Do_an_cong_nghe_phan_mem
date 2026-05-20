import React, { createContext, useContext, useMemo, useState } from 'react'
import api from '../api/client'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'))
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'))
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'))

  const isAuthed = !!accessToken

  async function login(email, password) {
    const res = await api.post('/api/auth/login', { email, password })
    const { accessToken, refreshToken, user } = res.data
    setAccessToken(accessToken)
    setRefreshToken(refreshToken)
    setUser(user)
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
  }

  function logout() {
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  const value = useMemo(() => ({ user, accessToken, refreshToken, isAuthed, login, logout }), [user, accessToken, refreshToken, isAuthed])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
