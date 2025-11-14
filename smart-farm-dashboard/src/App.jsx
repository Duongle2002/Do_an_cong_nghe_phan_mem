import React from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
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

export default function App() {
  const { isAuthed, logout } = useAuth()
  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-badge"><span>SF</span></div>
          <div>
            <div style={{ fontSize:16 }}>Smart Farm Dashboard</div>
            <div className="small muted">Giám sát và điều khiển thiết bị</div>
          </div>
        </div>
        <nav className="nav">
          <Link to="/devices">Thiết bị</Link>
          {isAuthed ? (
            <button className="btn btn-outline" onClick={logout}>Đăng xuất</button>
          ) : (
            <>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </>
          )}
        </nav>
      </header>
      <div style={{ height:16 }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
  <Route path="/devices" element={<Private><DevicesPage /></Private>} />
  <Route path="/devices/new" element={<Private><CreateDevicePage /></Private>} />
        <Route path="/devices/:id" element={<Private><DeviceDetailPage /></Private>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/devices" replace />} />
      </Routes>
    </div>
  )
}
