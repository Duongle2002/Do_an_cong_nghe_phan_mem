import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth()
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

  // User profile states
  const [profileName, setProfileName] = useState(user?.name || '')
  const [alertEmail, setAlertEmail] = useState(user?.alertEmail || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await api.get('/api/auth/profile')
      setProfileName(res.data.name || '')
      setAlertEmail(res.data.alertEmail || '')
      updateUser({ ...user, name: res.data.name, alertEmail: res.data.alertEmail })
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    try {
      const res = await api.put('/api/auth/profile', {
        name: profileName,
        alertEmail: alertEmail
      })
      showProfileMsg('Cập nhật thông tin tài khoản thành công!', 'success')
      updateUser({ ...user, name: res.data.name, alertEmail: res.data.alertEmail })
    } catch (err) {
      showProfileMsg(err.response?.data?.message || 'Cập nhật thất bại', 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  const showProfileMsg = (text, type) => {
    setProfileMsg({ text, type })
    setTimeout(() => setProfileMsg({ text: '', type: '' }), 5000)
  }

  // SMTP Settings state for Admin
  const [smtp, setSmtp] = useState({ host: 'smtp.gmail.com', port: 587, user: '', pass: '', enabled: false })
  const [showPass, setShowPass] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [smtpMsg, setSmtpMsg] = useState({ text: '', type: '' }) // type: 'success' | 'error'

  useEffect(() => {
    if (user?.role === 'Admin') {
      loadSmtp()
    }
  }, [user])

  const loadSmtp = async () => {
    try {
      const res = await api.get('/api/system-config/smtp')
      setSmtp(res.data)
    } catch (err) {
      showSmtpMsg('Không thể tải cấu hình SMTP', 'error')
    }
  }

  const handleSaveSmtp = async (e) => {
    e.preventDefault()
    setSmtpSaving(true)
    try {
      await api.put('/api/system-config/smtp', smtp)
      showSmtpMsg('Cấu hình SMTP đã được lưu thành công!', 'success')
    } catch (err) {
      showSmtpMsg(err.response?.data?.message || 'Không thể lưu cấu hình SMTP', 'error')
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleTestSmtp = async () => {
    setSmtpTesting(true)
    showSmtpMsg('Đang gửi thử email kết nối...', 'info')
    try {
      const res = await api.post('/api/system-config/smtp/test', smtp)
      showSmtpMsg(res.data.message || 'Gửi email test thành công!', 'success')
    } catch (err) {
      showSmtpMsg(err.response?.data?.message || 'Kiểm tra kết nối SMTP thất bại!', 'error')
    } finally {
      setSmtpTesting(false)
    }
  }

  const showSmtpMsg = (text, type) => {
    setSmtpMsg({ text, type })
    if (type !== 'info') {
      setTimeout(() => setSmtpMsg({ text: '', type: '' }), 5000)
    }
  }

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

          {user?.role === 'Admin' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📧 Cấu hình SMTP (Email gửi đi)</h4>
                  <div className="small muted" style={{ marginTop: 2 }}>Thay đổi tài khoản gửi thông báo cảnh báo của hệ thống</div>
                </div>
              </div>
              <div className="card-body">
                {smtpMsg.text && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 16,
                    background: smtpMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : smtpMsg.type === 'error' ? 'rgba(239, 83, 80, 0.12)' : 'rgba(41, 182, 246, 0.12)',
                    border: `1px solid ${smtpMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : smtpMsg.type === 'error' ? 'rgba(239, 83, 80, 0.3)' : 'rgba(41, 182, 246, 0.3)'}`,
                    color: smtpMsg.type === 'success' ? '#81c784' : smtpMsg.type === 'error' ? '#e57373' : '#64b5f6',
                    fontSize: 13,
                    fontWeight: 500
                  }}>
                    {smtpMsg.text}
                  </div>
                )}
                
                <form onSubmit={handleSaveSmtp} style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>SMTP Server Host</label>
                    <input
                      type="text"
                      value={smtp.host}
                      onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>SMTP Server Port</label>
                    <input
                      type="number"
                      value={smtp.port}
                      onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                      placeholder="587"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Tài khoản Email</label>
                    <input
                      type="email"
                      value={smtp.user}
                      onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                      placeholder="example@gmail.com"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Mật khẩu ứng dụng (App Password)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={smtp.pass}
                        onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                        placeholder="••••••••••••••••"
                        required
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setShowPass(!showPass)}
                        style={{ padding: '0 12px' }}
                      >
                        {showPass ? '👁️' : '🕶️'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Kích hoạt gửi Email cảnh báo</div>
                      <div className="small muted" style={{ marginTop: 2 }}>Bật tính năng gửi thông báo qua email cho toàn hệ thống</div>
                    </div>
                    <label className="ios-switch">
                      <input
                        type="checkbox"
                        checked={smtp.enabled}
                        onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
                      />
                      <span className="ios-slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={smtpSaving}>
                      {smtpSaving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={handleTestSmtp}
                      disabled={smtpTesting || !smtp.user || !smtp.pass}
                    >
                      {smtpTesting ? 'Đang kiểm tra...' : '🧪 Gửi thử email'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Account & TinyML Information */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Account Card */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>👤 Thông tin tài khoản</h4>
            </div>
            <div className="card-body">
              {profileMsg.text && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  marginBottom: 12,
                  background: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 83, 80, 0.12)',
                  border: `1px solid ${profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 83, 80, 0.3)'}`,
                  color: profileMsg.type === 'success' ? '#81c784' : '#e57373',
                  fontSize: 12,
                  fontWeight: 500
                }}>
                  {profileMsg.text}
                </div>
              )}
              
              <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Họ và tên</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Tên đăng nhập / Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ padding: '8px 12px', fontSize: 13, background: 'rgba(0,0,0,0.15)', cursor: 'not-allowed' }}
                  />
                </div>

                <div style={{ display: 'grid', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Email nhận cảnh báo</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="Bỏ trống để dùng email đăng nhập"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <span className="small muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Các email cảnh báo của hệ thống sẽ được gửi về đây.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="small muted" style={{ fontSize: 11 }}>Vai trò tài khoản</span>
                    <span className="badge ok" style={{ textTransform: 'uppercase', fontSize: 9, width: 'fit-content', marginTop: 2 }}>
                      {user?.role || 'User'}
                    </span>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={profileSaving} style={{ padding: '8px 16px', fontSize: 13 }}>
                    {profileSaving ? 'Đang lưu...' : '💾 Lưu thông tin'}
                  </button>
                </div>
              </form>
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
