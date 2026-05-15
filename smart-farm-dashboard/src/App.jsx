import React from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DevicesPage from './pages/DevicesPage'
import DeviceDetailPage from './pages/DeviceDetailPage'
import CreateDevicePage from './pages/CreateDevicePage'
import { useAuth } from './context/AuthContext'

function Private({ children }) {
  const { isAuthed } = useAuth()
  return isAuthed ? children : <Navigate to="/login" replace />
}

function NavLink({ to, children }) {
  const loc = useLocation()
  const active = loc.pathname.startsWith(to)
  return (
    <Link
      to={to}
      style={{
        padding: '7px 14px',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        background: active ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        border: active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
        transition: 'all 0.3s ease',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.1)' : 'none'
      }}
    >
      {children}
    </Link>
  )
}

export default function App() {
  const { isAuthed, logout } = useAuth()
  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-badge floating-logo">
            <svg viewBox="0 0 24 24" fill="#fff" width="24" height="24">
              <path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,1.75,3.75C7,8,17,8,17,8Z"/>
            </svg>
          </div>
          <div>
            <div className="brand-name">Smart Farm</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginTop: -2 }}>
              Digital Agriculture Control
            </div>
          </div>
        </div>

        <nav className="nav">
          {isAuthed && <NavLink to="/devices">Thiết bị</NavLink>}
          {isAuthed ? (
            <button
              className="btn btn-outline"
              onClick={logout}
              style={{ fontSize: 13 }}
            >
              Đăng xuất
            </button>
          ) : (
            <>
              <NavLink to="/login">Đăng nhập</NavLink>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </header>

      <div style={{ height: 20 }} />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/devices" element={<Private><DevicesPage /></Private>} />
        <Route path="/devices/new" element={<Private><CreateDevicePage /></Private>} />
        <Route path="/devices/:id" element={<Private><DeviceDetailPage /></Private>} />
        <Route path="*" element={<Navigate to="/devices" replace />} />
      </Routes>
    </div>
  )
}
