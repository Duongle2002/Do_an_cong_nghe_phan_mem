import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import UserProfile from '../components/UserProfile'

export default function AdminDashboardPage() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const activeSubTab = searchParams.get('tab') || 'overview'
  
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' }) // type: 'success' | 'error'

  // System Overview state
  const [overview, setOverview] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)

  // SMTP state
  const [smtp, setSmtp] = useState({ host: 'smtp.gmail.com', port: 587, user: '', pass: '', enabled: false })
  const [showPass, setShowPass] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)

  // Email Logs state
  const [emailLogs, setEmailLogs] = useState([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)

  // Users state
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Farmer' })
  const [userFormBusy, setUserFormBusy] = useState(false)

  // Devices state
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [deviceForm, setDeviceForm] = useState({ name: '', externalId: '', location: '', ownerId: '' })
  const [deviceFormBusy, setDeviceFormBusy] = useState(false)

  // Logs state
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFilter, setLogsFilter] = useState('ALL')

  // Load active tab data
  useEffect(() => {
    setMsg({ text: '', type: '' })
    if (activeSubTab === 'overview') {
      loadOverview()
    } else if (activeSubTab === 'smtp') {
      loadSmtp()
      loadEmailLogs()
    } else if (activeSubTab === 'users') {
      loadUsers()
    } else if (activeSubTab === 'devices') {
      loadDevices()
      loadUsers() // Needed to populate owners list in creation form
    } else if (activeSubTab === 'logs') {
      loadLogs()
    }
  }, [activeSubTab])

  // --- Overview Logic ---
  const loadOverview = async () => {
    setOverviewLoading(true)
    try {
      const res = await api.get('/api/system-config/overview')
      setOverview(res.data || [])
    } catch (err) {
      showMsg('Không thể tải tổng quan hệ thống', 'error')
    } finally {
      setOverviewLoading(false)
    }
  }

  // --- SMTP Logic ---
  const loadSmtp = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/system-config/smtp')
      setSmtp(res.data)
    } catch (err) {
      showMsg('Không thể tải cấu hình SMTP', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadEmailLogs = async () => {
    setEmailLogsLoading(true)
    try {
      const res = await api.get('/api/system-config/email-logs')
      setEmailLogs(res.data || [])
    } catch (err) {
      showMsg('Không thể tải nhật ký email', 'error')
    } finally {
      setEmailLogsLoading(false)
    }
  }

  const handleSaveSmtp = async (e) => {
    e.preventDefault()
    setSmtpSaving(true)
    try {
      await api.put('/api/system-config/smtp', smtp)
      showMsg('Cấu hình SMTP đã được lưu thành công!', 'success')
      loadEmailLogs()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Không thể lưu cấu hình SMTP', 'error')
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleTestSmtp = async () => {
    setSmtpTesting(true)
    setMsg({ text: 'Đang gửi thử email kết nối...', type: 'info' })
    try {
      const res = await api.post('/api/system-config/smtp/test', smtp)
      showMsg(res.data.message || 'Gửi email test thành công!', 'success')
      loadEmailLogs()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Kiểm tra kết nối SMTP thất bại!', 'error')
      loadEmailLogs()
    } finally {
      setSmtpTesting(false)
    }
  }

  // --- Users Logic ---
  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await api.get('/api/users')
      setUsers(res.data || [])
    } catch (err) {
      showMsg('Không thể tải danh sách người dùng', 'error')
    } finally {
      setUsersLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      return showMsg('Vui lòng nhập đầy đủ thông tin', 'error')
    }
    setUserFormBusy(true)
    try {
      await api.post('/api/users', userForm)
      showMsg('Tạo người dùng thành công!', 'success')
      setShowUserModal(false)
      setUserForm({ name: '', email: '', password: '', role: 'Farmer' })
      loadUsers()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Không thể tạo người dùng', 'error')
    } finally {
      setUserFormBusy(false)
    }
  }

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này? Tất cả thiết bị của họ sẽ mất liên kết.')) return
    try {
      await api.delete(`/api/users/${id}`)
      showMsg('Đã xóa người dùng thành công!', 'success')
      loadUsers()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Không thể xóa người dùng', 'error')
    }
  }

  const handleUpdateUserRole = async (id, currentRole) => {
    const nextRole = currentRole === 'Admin' ? 'Farmer' : 'Admin'
    if (!window.confirm(`Thay đổi vai trò của người dùng này thành ${nextRole}?`)) return
    try {
      await api.put(`/api/users/${id}`, { role: nextRole })
      showMsg('Cập nhật vai trò người dùng thành công!', 'success')
      loadUsers()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Cập nhật vai trò thất bại', 'error')
    }
  }

  // --- Devices Logic ---
  const loadDevices = async () => {
    setDevicesLoading(true)
    try {
      const res = await api.get('/api/devices')
      setDevices(res.data || [])
    } catch (err) {
      showMsg('Không thể tải danh sách thiết bị', 'error')
    } finally {
      setDevicesLoading(false)
    }
  }

  const handleCreateDevice = async (e) => {
    e.preventDefault()
    if (!deviceForm.name.trim() || !deviceForm.ownerId) {
      return showMsg('Tên thiết bị và Chủ sở hữu là bắt buộc', 'error')
    }
    setDeviceFormBusy(true)
    try {
      const body = {
        name: deviceForm.name.trim(),
        ownerId: deviceForm.ownerId,
        location: deviceForm.location.trim(),
        externalId: deviceForm.externalId.trim() || undefined
      }
      await api.post('/api/devices', body)
      showMsg('Thêm thiết bị thành công!', 'success')
      setShowDeviceModal(false)
      setDeviceForm({ name: '', externalId: '', location: '', ownerId: '' })
      loadDevices()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Không thể thêm thiết bị', 'error')
    } finally {
      setDeviceFormBusy(false)
    }
  }

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) return
    try {
      await api.delete(`/api/devices/${id}`)
      showMsg('Xóa thiết bị thành công!', 'success')
      loadDevices()
    } catch (err) {
      showMsg('Không thể xóa thiết bị', 'error')
    }
  }

  // --- Logs Logic ---
  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await api.get('/api/logs')
      setLogs(res.data || [])
    } catch (err) {
      showMsg('Không thể tải nhật ký hệ thống', 'error')
    } finally {
      setLogsLoading(false)
    }
  }

  // --- Utilities ---
  const showMsg = (text, type) => {
    setMsg({ text, type })
    if (type !== 'info') {
      setTimeout(() => setMsg({ text: '', type: '' }), 5000)
    }
  }

  const getCardStatus = (devices) => {
    let hasRed = false;
    let hasYellow = false;
    let reasons = [];

    for (const device of devices) {
      const isOnline = device.status === 'online';
      const isS3 = device.externalId && device.externalId.startsWith('esp32s3-');

      if (!isOnline) {
        hasYellow = true;
        continue;
      }

      if (!isS3) {
        if (!device.latestData) {
          hasYellow = true;
          reasons.push(`${device.name} Chưa có dữ liệu`);
        } else {
          const { temperature, soilMoisture, pH, timestamp } = device.latestData;
          const timeDiff = Date.now() - new Date(timestamp).getTime();

          if (timeDiff > 5 * 60 * 1000) {
            hasYellow = true;
            reasons.push(`${device.name} Trễ tín hiệu (>5 phút)`);
          }

          if (temperature !== undefined && (temperature > 35 || temperature < 12)) {
            hasRed = true;
            reasons.push(`${device.name}: Nhiệt độ bất thường (${temperature.toFixed(1)}°C)`);
          }
          if (soilMoisture !== undefined && (soilMoisture < 40)) {
            hasRed = true;
            reasons.push(`${device.name}: Độ ẩm đất quá khô (${soilMoisture.toFixed(0)}%)`);
          }
          if (pH !== undefined && pH !== null && (pH < 5.0 || pH > 8.0)) {
            hasRed = true;
            reasons.push(`${device.name}: Độ pH đất bất thường (${pH.toFixed(1)})`);
          }
        }
      }
    }

    if (hasRed) {
      return { 
        level: 'red', 
        border: '1px solid rgba(239, 83, 80, 0.85)', 
        bg: 'linear-gradient(135deg, rgba(239, 83, 80, 0.25) 0%, rgba(22, 11, 14, 0.98) 100%)', 
        boxShadow: '0 8px 32px rgba(239, 83, 80, 0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        badgeColor: '#ef5350', 
        reasons 
      };
    }
    if (hasYellow) {
      return { 
        level: 'yellow', 
        border: '1px solid rgba(255, 167, 38, 0.85)', 
        bg: 'linear-gradient(135deg, rgba(255, 167, 38, 0.22) 0%, rgba(22, 19, 12, 0.98) 100%)', 
        boxShadow: '0 8px 32px rgba(255, 167, 38, 0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
        badgeColor: '#ffa726', 
        reasons 
      };
    }
    return { 
      level: 'green', 
      border: '1px solid rgba(16, 185, 129, 0.3)', 
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 18, 26, 0.98) 100%)', 
      boxShadow: '0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
      badgeColor: '#10b981', 
      reasons: [] 
    };
  };

  const filteredLogs = React.useMemo(() => {
    if (logsFilter === 'ALL') return logs
    return logs.filter(l => l.actor === logsFilter)
  }, [logs, logsFilter])

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>🛡️ Quản Trị Hệ Thống</h1>
          <div className="subtitle">BẢNG ĐIỀU KHIỂN DÀNH CHO ADMIN</div>
        </div>
        <UserProfile user={user} logout={logout} />
      </div>

      {/* Global Status/Message display */}
      {msg.text && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 12,
          marginBottom: 20,
          background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : msg.type === 'error' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(41, 182, 246, 0.15)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : msg.type === 'error' ? 'rgba(239, 83, 80, 0.4)' : 'rgba(41, 182, 246, 0.4)'}`,
          color: msg.type === 'success' ? '#81c784' : msg.type === 'error' ? '#e57373' : '#64b5f6',
          fontSize: 14,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <span>{msg.type === 'success' ? '✓' : msg.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Content Area based on Tab */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }} className="muted">Đang tải dữ liệu...</div>
      ) : (
        <>
          {/* 0. SYSTEM OVERVIEW TAB */}
          {activeSubTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {overviewLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }} className="muted">Đang tải dữ liệu tổng quan...</div>
              ) : (
                <div className="grid grid-3" style={{ gap: 20 }}>
                  {overview.map((item) => {
                    const status = getCardStatus(item.devices)
                    return (
                      <div className="card" key={item.farmer.id} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%', 
                        padding: '16px',
                        border: status.border,
                        background: status.bg,
                        boxShadow: status.boxShadow,
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ 
                          height: 4, 
                          background: status.badgeColor, 
                          margin: '-16px -16px 12px -16px', 
                          borderRadius: '16px 16px 0 0',
                          boxShadow: status.level !== 'green' ? `0 2px 8px ${status.badgeColor}` : 'none'
                        }} />
                        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 12, marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 14
                            }}>
                              {item.farmer.name ? item.farmer.name.slice(0, 2).toUpperCase() : 'US'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{item.farmer.name}</h4>
                              <span className="small muted" style={{ fontSize: 11 }}>{item.farmer.email}</span>
                            </div>
                            {status.level !== 'green' && (
                              <span className="badge" style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: `1px solid ${status.badgeColor}`,
                                color: status.badgeColor,
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: 'uppercase'
                              }}>
                                {status.level === 'red' ? 'Bất thường' : 'Cảnh báo'}
                              </span>
                            )}
                          </div>
                        </div>

                        {status.reasons.length > 0 && (
                          <div style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.25)',
                            borderLeft: `3px solid ${status.badgeColor}`,
                            marginBottom: 12,
                            fontSize: 11,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            color: status.badgeColor,
                            fontWeight: 500
                          }}>
                            {status.reasons.map((r, idx) => (
                              <span key={idx}>⚠️ {r}</span>
                            ))}
                          </div>
                        )}

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {item.devices.length === 0 ? (
                            <div className="muted small text-center" style={{ padding: '20px 0', fontStyle: 'italic' }}>Chưa đăng ký thiết bị nào</div>
                          ) : (
                            item.devices.map((device) => {
                              const isOnline = device.status === 'online'
                              const isS3 = device.externalId && device.externalId.startsWith('esp32s3-')
                              
                              const temp = device.latestData?.temperature
                              const hum = device.latestData?.humidity
                              const soil = device.latestData?.soilMoisture
                              const lux = device.latestData?.lux
                              const pH = device.latestData?.pH
                              
                              const tempUnit = localStorage.getItem('pref_temp_unit') || 'C'
                              const formattedTemp = temp !== undefined
                                ? (tempUnit === 'F' ? `${(temp * 1.8 + 32).toFixed(1)}°F` : `${temp.toFixed(1)}°C`)
                                : '—'

                              return (
                                <div key={device._id} style={{
                                  background: 'rgba(0,0,0,0.15)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: 10,
                                  padding: 12,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 10
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                                      {isS3 ? '🎮 ' : '🔌 '}{device.name}
                                    </span>
                                    <span className={`badge ${isOnline ? 'ok' : 'err'}`} style={{ fontSize: 9, textTransform: 'uppercase' }}>
                                      {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  </div>

                                  {isS3 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                        <span className="muted">Chế độ vận hành:</span>
                                        <span className="badge warning" style={{ textTransform: 'uppercase', fontSize: 9, background: 'rgba(243, 156, 18, 0.15)', border: '1px solid rgba(243, 156, 18, 0.3)', color: '#f39c12' }}>
                                          {device.opMode === 'auto' ? 'Tự động' : device.opMode === 'manual' ? 'Thủ công' : 'Lịch trình'}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                        <div style={{
                                          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
                                          background: device.lastFanState === 'ON' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                                          border: device.lastFanState === 'ON' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)',
                                          fontSize: 10, color: device.lastFanState === 'ON' ? '#81c784' : 'var(--text-muted)'
                                        }}>
                                          🌬️ Quạt: {device.lastFanState || 'OFF'}
                                        </div>
                                        <div style={{
                                          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
                                          background: device.lastPumpState === 'ON' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                                          border: device.lastPumpState === 'ON' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)',
                                          fontSize: 10, color: device.lastPumpState === 'ON' ? '#81c784' : 'var(--text-muted)'
                                        }}>
                                          💧 Bơm: {device.lastPumpState || 'OFF'}
                                        </div>
                                        <div style={{
                                          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
                                          background: device.lastLightState === 'ON' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                                          border: device.lastLightState === 'ON' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)',
                                          fontSize: 10, color: device.lastLightState === 'ON' ? '#81c784' : 'var(--text-muted)'
                                        }}>
                                          💡 Đèn: {device.lastLightState || 'OFF'}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {device.latestData ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>🌡️ Nhiệt độ:</span>
                                            <span style={{ fontWeight: 600, color: temp > 35 || temp < 12 ? '#ff8a80' : 'var(--text)' }}>
                                              {formattedTemp}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>🌫️ Đ.ẩm khí:</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{hum !== undefined ? `${hum.toFixed(0)}%` : '—'}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>💧 Đ.ẩm đất:</span>
                                            <span style={{ fontWeight: 600, color: soil < 40 ? '#ff8a80' : 'var(--text)' }}>
                                              {soil !== undefined ? `${soil.toFixed(0)}%` : '—'}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span>☀️ Ánh sáng:</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{lux !== undefined ? `${lux.toFixed(0)} lx` : '—'}</span>
                                          </div>
                                          {pH !== undefined && pH !== null && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, gridColumn: '1 / -1' }}>
                                              <span>🧪 Độ pH đất:</span>
                                              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{pH.toFixed(1)}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="muted small" style={{ fontSize: 11, fontStyle: 'italic' }}>Chưa nhận dữ liệu cảm biến</div>
                                      )}
                                    </>
                                  )}

                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                    <a href={`/devices/${device._id}`} className="btn btn-outline" style={{
                                      padding: '3px 8px', fontSize: 11, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none'
                                    }}>
                                      Chi tiết ↗
                                    </a>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {overview.length === 0 && (
                    <div className="muted text-center" style={{ width: '100%', gridColumn: '1 / -1', padding: 40 }}>
                      Chưa có người dùng Farmer nào đăng ký trong hệ thống.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 1. SMTP CONFIG TAB */}
          {activeSubTab === 'smtp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {smtp && smtp.user && smtp.user.trim() !== '' ? (
                /* SMTP Configured State */
                <>
                  <div className="card" style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(10, 25, 20, 0.95) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '20px 24px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 15
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 24 }}>✅</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Hệ thống đã cấu hình SMTP</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
                          Tài khoản gửi: <strong style={{ color: 'var(--text)' }}>{smtp.user}</strong> (máy chủ: {smtp.host}:{smtp.port}). Dịch vụ gửi email cảnh báo tự động: <span className={`badge ${smtp.enabled ? 'ok' : 'err'}`} style={{ fontSize: 9 }}>{smtp.enabled ? 'Đang bật' : 'Đang tắt'}</span>
                        </p>
                      </div>
                    </div>
                    <a href="/settings" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, padding: '8px 16px' }}>
                      ⚙️ Đi đến Cài đặt để chỉnh sửa
                    </a>
                  </div>

                  {/* Email Logs Card */}
                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📧 Nhật ký Email cảnh báo (Sent Email Logs)</h4>
                        <div className="small muted" style={{ marginTop: 2 }}>Xem danh sách các email cảnh báo đã gửi hoặc thất bại từ hệ thống</div>
                      </div>
                      <button className="btn btn-outline" type="button" onClick={loadEmailLogs} disabled={emailLogsLoading} style={{ padding: '6px 12px', fontSize: 12 }}>
                        🔄 {emailLogsLoading ? 'Đang tải...' : 'Làm mới'}
                      </button>
                    </div>
                    <div className="card-body">
                      {emailLogsLoading ? (
                        <div className="muted text-center">Đang tải nhật ký email...</div>
                      ) : (
                        <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#090d16', zIndex: 1 }}>
                              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13 }}>
                                <th style={{ padding: '12px 10px' }}>Thời gian</th>
                                <th style={{ padding: '12px 10px' }}>Người nhận</th>
                                <th style={{ padding: '12px 10px' }}>Tiêu đề</th>
                                <th style={{ padding: '12px 10px' }}>Loại</th>
                                <th style={{ padding: '12px 10px' }}>Trạng thái</th>
                                <th style={{ padding: '12px 10px' }}>Chi tiết / Lỗi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {emailLogs.map((log) => (
                                <tr key={log._id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: 12 }} className="table-row">
                                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                                    {new Date(log.timestamp || log.createdAt).toLocaleString('vi-VN')}
                                  </td>
                                  <td style={{ padding: '10px 10px', fontWeight: 600 }}>{log.to}</td>
                                  <td style={{ padding: '10px 10px' }}>{log.subject}</td>
                                  <td style={{ padding: '10px 10px' }}>
                                    <span className={`badge ${log.type === 'test' ? 'info' : 'warning'}`} style={{ fontSize: 9 }}>
                                      {log.type === 'test' ? 'Test' : 'Cảnh báo'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 10px' }}>
                                    <span className={`badge ${log.status === 'success' ? 'ok' : 'err'}`} style={{ fontSize: 9 }}>
                                      {log.status === 'success' ? 'Thành công' : 'Thất bại'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                                    {log.status === 'failed' ? (
                                      <span style={{ color: '#ef5350' }}>{log.error || 'Lỗi không xác định'}</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {emailLogs.length === 0 && (
                                <tr>
                                  <td colSpan="6" className="muted text-center" style={{ padding: 24 }}>Không có lịch sử gửi email nào.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* SMTP Unconfigured State */
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>⚙️ Thiết lập máy chủ gửi Email (SMTP)</h4>
                      <div className="small muted" style={{ marginTop: 2 }}>Cấu hình tài khoản gửi email cảnh báo tự động cho toàn bộ hệ thống (Chưa thiết lập)</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleSaveSmtp} style={{ display: 'grid', gap: 20, maxWidth: 600 }}>
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
          )}

          {/* 2. USERS MANAGEMENT TAB */}
          {activeSubTab === 'users' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>👥 Quản lý Người dùng</h4>
                  <div className="small muted" style={{ marginTop: 2 }}>Xem danh sách, phân quyền và thêm bớt người dùng trong hệ thống</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
                  ➕ Thêm User mới
                </button>
              </div>
              <div className="card-body">
                {usersLoading ? (
                  <div className="muted text-center">Đang tải danh sách người dùng...</div>
                ) : (
                  <div className="table-responsive" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13 }}>
                          <th style={{ padding: '12px 8px' }}>Tên hiển thị</th>
                          <th style={{ padding: '12px 8px' }}>Email</th>
                          <th style={{ padding: '12px 8px' }}>Vai trò</th>
                          <th style={{ padding: '12px 8px' }}>Ngày tạo</th>
                          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u._id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: 13 }} className="table-row">
                            <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.name}</td>
                            <td style={{ padding: '12px 8px' }}>{u.email}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span
                                className={`badge ${u.role === 'Admin' ? 'warning' : 'ok'}`}
                                style={{ fontSize: 10, cursor: 'pointer', textTransform: 'uppercase' }}
                                onClick={() => handleUpdateUserRole(u._id, u.role)}
                                title="Click để thay đổi vai trò"
                              >
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px' }}>{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {u._id !== user.id ? (
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: 11, borderColor: '#ef5350', color: '#ef5350' }}
                                  onClick={() => handleDeleteUser(u._id)}
                                >
                                  Xóa
                                </button>
                              ) : (
                                <span className="muted" style={{ fontSize: 11 }}>Đang đăng nhập</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Inline User Modal/Form overlay */}
              {showUserModal && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                  <div className="card" style={{ width: '100%', maxWidth: 450, margin: 20 }}>
                    <div className="card-header">
                      <h4 style={{ margin: 0 }}>Tạo tài khoản mới</h4>
                    </div>
                    <div className="card-body">
                      <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 12 }}>
                        <label>
                          Họ và tên
                          <input
                            type="text"
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          Địa chỉ Email
                          <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          Mật khẩu
                          <input
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required
                          />
                        </label>
                        <label>
                          Vai trò
                          <select
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                          >
                            <option value="Farmer">Farmer (Nông dân)</option>
                            <option value="Admin">Admin (Quản trị)</option>
                          </select>
                        </label>

                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                          <button className="btn btn-primary" type="submit" disabled={userFormBusy}>
                            {userFormBusy ? 'Đang tạo...' : 'Tạo tài khoản'}
                          </button>
                          <button className="btn btn-outline" type="button" onClick={() => setShowUserModal(false)}>
                            Hủy
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. DEVICES MANAGEMENT TAB */}
          {activeSubTab === 'devices' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🔌 Quản lý Thiết bị</h4>
                  <div className="small muted" style={{ marginTop: 2 }}>Quản lý đội ngũ thiết bị IoT và thiết lập chủ sở hữu cho từng phần cứng</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowDeviceModal(true)}>
                  ➕ Thêm thiết bị mới
                </button>
              </div>
              <div className="card-body">
                {devicesLoading ? (
                  <div className="muted text-center">Đang tải danh sách thiết bị...</div>
                ) : (
                  <div className="table-responsive" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13 }}>
                          <th style={{ padding: '12px 8px' }}>Tên thiết bị</th>
                          <th style={{ padding: '12px 8px' }}>External ID</th>
                          <th style={{ padding: '12px 8px' }}>Chủ sở hữu (Email)</th>
                          <th style={{ padding: '12px 8px' }}>Vị trí</th>
                          <th style={{ padding: '12px 8px' }}>Ngày thêm</th>
                          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.map((d) => {
                          const ownerIdStr = d.ownerId && typeof d.ownerId === 'object' ? d.ownerId._id : d.ownerId
                          const owner = users.find(u => u._id === ownerIdStr) || (d.ownerId && typeof d.ownerId === 'object' ? d.ownerId : null)
                          return (
                            <tr key={d._id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: 13 }} className="table-row">
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>{d.name}</td>
                              <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{d.externalId || '—'}</td>
                              <td style={{ padding: '12px 8px' }}>{owner ? owner.email : <span className="muted">Chưa rõ ({ownerIdStr || '—'})</span>}</td>
                              <td style={{ padding: '12px 8px' }}>{d.location || '—'}</td>
                              <td style={{ padding: '12px 8px' }}>{new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: 11, borderColor: '#ef5350', color: '#ef5350' }}
                                  onClick={() => handleDeleteDevice(d._id)}
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Inline Device Modal/Form overlay */}
              {showDeviceModal && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                  <div className="card" style={{ width: '100%', maxWidth: 450, margin: 20 }}>
                    <div className="card-header">
                      <h4 style={{ margin: 0 }}>Thêm Thiết bị mới</h4>
                    </div>
                    <div className="card-body">
                      <form onSubmit={handleCreateDevice} style={{ display: 'grid', gap: 12 }}>
                        <label>
                          Tên thiết bị
                          <input
                            type="text"
                            value={deviceForm.name}
                            onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                            required
                            placeholder="Nhà kính A"
                          />
                        </label>
                        <label>
                          External ID (trùng với chip ESP)
                          <input
                            type="text"
                            value={deviceForm.externalId}
                            onChange={(e) => setDeviceForm({ ...deviceForm, externalId: e.target.value })}
                            placeholder="esp32-XXXX"
                          />
                        </label>
                        <label>
                          Vị trí thiết bị
                          <input
                            type="text"
                            value={deviceForm.location}
                            onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                            placeholder="Khu A"
                          />
                        </label>
                        <label>
                          Chủ sở hữu (Owner)
                          <select
                            value={deviceForm.ownerId}
                            onChange={(e) => setDeviceForm({ ...deviceForm, ownerId: e.target.value })}
                            required
                          >
                            <option value="">-- Chọn User nông dân --</option>
                            {users.map(u => (
                              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                            ))}
                          </select>
                        </label>

                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                          <button className="btn btn-primary" type="submit" disabled={deviceFormBusy}>
                            {deviceFormBusy ? 'Đang tạo...' : 'Tạo thiết bị'}
                          </button>
                          <button className="btn btn-outline" type="button" onClick={() => setShowDeviceModal(false)}>
                            Hủy
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. LOGS VIEW TAB */}
          {activeSubTab === 'logs' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📜 Nhật ký hệ thống (System Logs)</h4>
                  <div className="small muted" style={{ marginTop: 2 }}>Xem logs hành động của User, Admin và thiết bị IoT</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }} className="muted">Lọc theo:</span>
                  <select
                    value={logsFilter}
                    onChange={(e) => setLogsFilter(e.target.value)}
                    style={{ width: 'auto', padding: '4px 10px', fontSize: 12, borderRadius: 8, background: 'var(--bg-sidebar)' }}
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                    <option value="Device">Device</option>
                  </select>
                </div>
              </div>
              <div className="card-body">
                {logsLoading ? (
                  <div className="muted text-center">Đang tải nhật ký...</div>
                ) : (
                  <div style={{ maxHeight: 500, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#090d16', zIndex: 1 }}>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 13 }}>
                          <th style={{ padding: '12px 10px' }}>Thời gian</th>
                          <th style={{ padding: '12px 10px' }}>Đối tượng</th>
                          <th style={{ padding: '12px 10px' }}>Hoạt động</th>
                          <th style={{ padding: '12px 10px' }}>Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map((l) => (
                          <tr key={l._id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: 12 }} className="table-row">
                            <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                              {new Date(l.timestamp || l.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              <span className={`badge ${l.actor === 'Admin' ? 'warning' : l.actor === 'User' ? 'ok' : 'info'}`} style={{ fontSize: 9 }}>
                                {l.actor}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', fontWeight: 600 }}>{l.action}</td>
                            <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{l.details || '—'}</td>
                          </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                          <tr>
                            <td colSpan="4" className="muted text-center" style={{ padding: 24 }}>Không có log nào tương ứng.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
