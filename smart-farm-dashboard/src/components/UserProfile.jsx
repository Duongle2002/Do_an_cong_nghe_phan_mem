import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

export default function UserProfile({ user, logout }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    if (!showProfileMenu) return
    const close = () => setShowProfileMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showProfileMenu])

  const userInitials = useMemo(() => {
    const displayName = user?.name || user?.username || user?.email || 'User'
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      const last = parts[parts.length - 1]
      const prev = parts[parts.length - 2]
      return ((prev ? prev[0] : '') + (last ? last[0] : '')).toUpperCase()
    }
    return parts.map(p => p ? p[0] : '').join('').toUpperCase().slice(0, 2)
  }, [user])

  const displayName = user?.name || user?.username || user?.email || 'User'

  return (
    <div 
      className="user-profile" 
      style={{ position: 'relative', cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
    >
      <div className="user-profile-info">
        <div className="user-profile-title">GIÁM SÁT VIÊN</div>
        <div className="user-profile-name">{displayName}</div>
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
  )
}
