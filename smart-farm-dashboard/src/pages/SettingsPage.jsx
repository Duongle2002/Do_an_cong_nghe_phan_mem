import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    if (!showProfileMenu) return;
    const close = () => setShowProfileMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showProfileMenu])
  
  // App preferences state
  const [tempUnit, setTempUnit] = useState(localStorage.getItem('pref_temp_unit') || 'C')
  const [refreshRate, setRefreshRate] = useState(localStorage.getItem('pref_refresh_rate') || '8')
  const [theme, setTheme] = useState(localStorage.getItem('pref_theme') || 'emerald')
  const [alertNotify, setAlertNotify] = useState(localStorage.getItem('pref_alert_notify') === 'true' || true)

  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    setSaving(true)
    
    // Save to localStorage
    localStorage.setItem('pref_temp_unit', tempUnit)
    localStorage.setItem('pref_refresh_rate', refreshRate)
    localStorage.setItem('pref_theme', theme)
    localStorage.setItem('pref_alert_notify', alertNotify ? 'true' : 'false')
    
    // Request permission if enabled
    if (alertNotify && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', theme);
    
    setTimeout(() => {
      setSaving(false)
      setSuccessMsg('Đã lưu cấu hình cài đặt hệ thống!')
      setTimeout(() => setSuccessMsg(''), 3000)
    }, 800)
  }

  // Dynamic user initials avatar
  const userInitials = React.useMemo(() => {
    const displayName = user?.name || user?.username || user?.email || 'User'
    const parts = displayName.split(' ')
    return parts.map(p => p ? p[0] : '').join('').toUpperCase().slice(0, 2)
  }, [user])

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            <Link to="/devices" style={{ color: 'var(--accent)', fontWeight: 500 }}>Bảng điều khiển</Link>
            <span>/</span>
            <span>Cài đặt</span>
          </div>
          <h1>Cài đặt hệ thống</h1>
          <div className="subtitle">Cấu hình & thông tin tài khoản</div>
        </div>

        <div 
          className="user-profile" 
          style={{ position: 'relative', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
        >
          <div className="user-profile-info">
            <div className="user-profile-name">{user?.name || user?.username || user?.email || 'User'}</div>
          </div>
          <div className="user-avatar">{userInitials}</div>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: '#0f121a',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              padding: '8px',
              zIndex: 1000,
              minWidth: 150,
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <Link to="/devices" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-dim)',
                transition: 'background 0.2s',
              }} className="profile-menu-item">
                <span>🖥️</span> Trang thiết bị
              </Link>
              <Link to="/settings" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-dim)',
                transition: 'background 0.2s',
              }} className="profile-menu-item">
                <span>⚙️</span> Cài đặt
              </Link>
              <div onClick={logout} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                color: '#ef5350',
                transition: 'background 0.2s',
                cursor: 'pointer'
              }} className="profile-menu-item">
                <span>🚪</span> Đăng xuất
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Settings Forms */}
      <div className="grid grid-2" style={{ gap: 20, gridTemplateColumns: '1.2fr 1fr' }}>
        
        {/* Left Column: System settings */}
        <form onSubmit={handleSave} className="card">
          <div className="card-header">
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>⚙️ Thiết lập hệ thống</h4>
              <div className="small muted" style={{ marginTop: 2 }}>Thay đổi hiển thị và chu kỳ đồng bộ dữ liệu</div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {successMsg && (
              <div style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#81c784',
                fontSize: 13,
                fontWeight: 500,
              }}>
                ✓ {successMsg}
              </div>
            )}

            {/* Temp Unit Option */}
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Đơn vị đo nhiệt độ</label>
              <select value={tempUnit} onChange={(e) => setTempUnit(e.target.value)}>
                <option value="C">Độ C (°C)</option>
                <option value="F">Độ F (°F)</option>
              </select>
            </div>

            {/* Refresh rate Option */}
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Chu kỳ làm tươi biểu đồ (Giây)</label>
              <select value={refreshRate} onChange={(e) => setRefreshRate(e.target.value)}>
                <option value="5">5 giây (Mặc định AI)</option>
                <option value="8">8 giây</option>
                <option value="15">15 giây</option>
                <option value="30">30 giây</option>
              </select>
            </div>

            {/* Theme Option */}
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Giao diện hiển thị</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="emerald">Emerald Dark (Mặc định)</option>
                <option value="classic">Classic Dark Mode</option>
                <option value="neon">Neon Blue Glass</option>
                <option value="light">Pure Light Mode</option>
              </select>
            </div>

            {/* Notification Switch Option */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Thông báo đẩy cảnh báo</div>
                <div className="small muted" style={{ marginTop: 2 }}>Nhận thông báo khi cảm biến vượt ngưỡng an toàn</div>
              </div>
              <label className="ios-switch">
                <input 
                  type="checkbox" 
                  checked={alertNotify} 
                  onChange={(e) => setAlertNotify(e.target.checked)} 
                />
                <span className="ios-slider"></span>
              </label>
            </div>

            {/* Form actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : '💾 Lưu cài đặt'}
              </button>
              <Link to="/devices" className="btn btn-outline">
                Quay lại
              </Link>
            </div>
          </div>
        </form>

        {/* Right Column: Account & TinyML Information */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Account Card */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>👤 Thông tin tài khoản</h4>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Họ và tên</span>
                <span style={{ fontWeight: 600 }}>{user?.name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Username</span>
                <span style={{ fontWeight: 600 }}>{user?.username || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Email</span>
                <span style={{ fontWeight: 600 }}>{user?.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 4 }}>
                <span className="muted">Vai trò</span>
                <span className="badge ok" style={{ textTransform: 'uppercase', fontSize: 9 }}>{user?.role || 'User'}</span>
              </div>
            </div>
          </div>

          {/* TinyML Info Card */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🧠 TinyML Model Info</h4>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Kiểu mô hình</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>TensorFlow Lite (Float32)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Dung lượng bộ nhớ</span>
                <span style={{ fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>2060 Bytes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Độ chính xác (Bơm)</span>
                <span style={{ fontWeight: 600 }}>89.7%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="muted">Độ chính xác (Quạt)</span>
                <span style={{ fontWeight: 600 }}>81.0%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 4 }}>
                <span className="muted">Độ chính xác (Ánh sáng)</span>
                <span style={{ fontWeight: 600 }}>85.3%</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
