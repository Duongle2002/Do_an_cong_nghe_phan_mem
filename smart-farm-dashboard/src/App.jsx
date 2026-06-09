import React from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DevicesPage from './pages/DevicesPage'
import CreateDevicePage from './pages/CreateDevicePage'
import SettingsPage from './pages/SettingsPage'
import PresentationPage from './pages/PresentationPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
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
  const { isAuthed, logout, user } = useAuth()
  const location = useLocation()

  React.useEffect(() => {
    // Apply theme
    const savedTheme = localStorage.getItem('pref_theme') || 'emerald';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Request notification permission
    if (localStorage.getItem('pref_alert_notify') !== 'false' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  if (location.pathname === '/presentation') {
    return <PresentationPage />
  }

  // Parse query params to highlight active sidebar link
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab') || 'overview'

  if (isAuthed) {
    // Redirect Admin to admin dashboard if accessing base /devices or /
    if (user?.role === 'Admin' && (location.pathname === '/' || location.pathname === '/devices' || location.pathname === '/devices/')) {
      return <Navigate to="/admin?tab=overview" replace />
    }

    return (
      <div className="app-layout-sidebar">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,1.75,3.75C7,8,17,8,17,8Z" />
              </svg>
              <span>GreenGuard AI</span>
            </div>
            <div className="sidebar-subtitle">TINYML INTEGRATED</div>
          </div>

          <nav className="sidebar-menu">
            {user?.role === 'Admin' ? (
              <>
                <Link
                  to="/admin?tab=overview"
                  className={`sidebar-link ${location.pathname.startsWith('/admin') && activeTab === 'overview' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>📊</span>
                  <span>Tổng quan hệ thống</span>
                </Link>

                <Link
                  to="/admin?tab=smtp"
                  className={`sidebar-link ${location.pathname.startsWith('/admin') && activeTab === 'smtp' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>📧</span>
                  <span>Cấu hình SMTP</span>
                </Link>

                <Link
                  to="/admin?tab=users"
                  className={`sidebar-link ${location.pathname.startsWith('/admin') && activeTab === 'users' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>👥</span>
                  <span>Quản lý User</span>
                </Link>

                <Link
                  to="/admin?tab=devices"
                  className={`sidebar-link ${location.pathname.startsWith('/admin') && activeTab === 'devices' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>🔌</span>
                  <span>Quản lý Thiết bị</span>
                </Link>

                <Link
                  to="/admin?tab=logs"
                  className={`sidebar-link ${location.pathname.startsWith('/admin') && activeTab === 'logs' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>📜</span>
                  <span>Nhật ký hệ thống</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/devices?tab=overview"
                  className={`sidebar-link ${activeTab === 'overview' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>📊</span>
                  <span>Tổng quan</span>
                </Link>

                <Link
                  to="/devices?tab=control"
                  className={`sidebar-link ${activeTab === 'control' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>⚙️</span>
                  <span>Điều khiển</span>
                </Link>

                <Link
                  to="/devices?tab=analytics"
                  className={`sidebar-link ${activeTab === 'analytics' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>📈</span>
                  <span>Phân tích</span>
                </Link>

                <Link
                  to="/devices?tab=ai"
                  className={`sidebar-link ${activeTab === 'ai' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>💬</span>
                  <span>Trợ lý AI</span>
                </Link>

                <Link
                  to="/devices?tab=device-settings"
                  className={`sidebar-link ${activeTab === 'device-settings' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 16 }}>🔌</span>
                  <span>Cài đặt thiết bị</span>
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/login" element={<Navigate to="/devices" replace />} />
            <Route path="/register" element={<Navigate to="/devices" replace />} />
            <Route path="/devices" element={<Private><DevicesPage /></Private>} />
            <Route path="/devices/new" element={<Private><CreateDevicePage /></Private>} />
            <Route path="/devices/:id" element={<Private><DevicesPage /></Private>} />
            <Route path="/settings" element={<Private><SettingsPage /></Private>} />
            <Route path="/admin/*" element={<Private><AdminDashboardPage /></Private>} />
            <Route path="*" element={<Navigate to="/devices" replace />} />
          </Routes>
        </main>
      </div>
    )
  }

  // Otherwise, render old top navbar layout for login/register
  return (
    <div className="container">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}
