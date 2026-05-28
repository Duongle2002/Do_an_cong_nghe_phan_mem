import React, { useState, useEffect } from 'react'
import SchedulesPanel from './SchedulesPanel'
import api from '../api/client'

export default function ControlTab({
  s3Controllers,
  deviceStatuses,
  activeDevice,
  setActiveDevice,
  overrideNotice,
  cmdPump,
  cmdLight,
  cmdFan,
  toggleRelay,
  s3Controller,
  opMode,
  handleModeChange,
  modeChanging,
  setDevices,
}) {
  const [schedules, setSchedules] = useState([])
  const [showSafetyForm, setShowSafetyForm] = useState(false)
  const isOnline = activeDevice && (deviceStatuses[activeDevice.externalId] || activeDevice.status) === 'online'

  useEffect(() => {
    if (!activeDevice?._id) return
    async function loadSchedules() {
      try {
        const res = await api.get('/api/schedules', { params: { deviceId: activeDevice._id } })
        setSchedules(res.data || [])
      } catch (e) {
        console.error('Lỗi tải lịch hẹn:', e)
      }
    }
    loadSchedules()
  }, [activeDevice?._id, opMode])

  function renderDeviceScheduleInfo(target) {
    const deviceScheds = schedules.filter(s => s.target === target)
    if (deviceScheds.length === 0) return 'Không có lịch hẹn'

    const activeScheds = deviceScheds.filter(s => s.active)
    if (activeScheds.length === 0) return 'Lịch hẹn đang tắt'

    return activeScheds.map(s => {
      const timeStr = new Date(s.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      const repeatLabel = s.repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'
      return `${timeStr} (${s.action === 'ON' ? 'BẬT' : 'TẮT'})`
    }).join(', ')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Device Status Row */}
      {activeDevice && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤖</span>
            <span>Thiết bị: <strong style={{ color: '#10b981' }}>{activeDevice.name}</strong></span>
          </div>

          <span className={`live-indicator ${isOnline ? 'connected' : 'disconnected'}`} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}>
            <span className="live-dot" />
            Trạng thái: <strong style={{ marginLeft: 4 }}>{isOnline ? 'Online' : 'Offline'}</strong>
          </span>
        </div>
      )}

      {activeDevice ? (
        <>
          {/* Main Control Grid */}
          <div className="control-grid-new">
            {/* Left Column: System Operational Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                    VẬN HÀNH LỐI
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    Chế độ hệ thống
                  </h3>
                </div>

                <div className="system-mode-container">
                  {/* MANUAL (THỦ CÔNG) */}
                  <div
                    className={`mode-card-new manual ${opMode === 'manual' ? 'active' : ''}`}
                    onClick={() => !modeChanging && handleModeChange('manual', s3Controller?._id)}
                  >
                    <div className="mode-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div className="mode-info-block">
                      <div className="mode-title-new">THỦ CÔNG</div>
                      <div className="mode-desc-new">Ghi đè trực tiếp bởi người dùng</div>
                    </div>
                    <div className="mode-active-dot" />
                  </div>

                  {/* AUTO (TỰ ĐỘNG) */}
                  <div
                    className={`mode-card-new auto ${opMode === 'auto' ? 'active' : ''}`}
                    onClick={() => !modeChanging && handleModeChange('auto', s3Controller?._id)}
                  >
                    <div className="mode-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" opacity="0.1" />
                        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                        <path d="M12 5v13" />
                      </svg>
                    </div>
                    <div className="mode-info-block">
                      <div className="mode-title-new">TỰ ĐỘNG (AI)</div>
                      <div className="mode-desc-new">TinyML phân tích logic tại biên</div>
                    </div>
                    <div className="mode-active-dot" />
                  </div>

                  {/* SCHEDULED (LỊCH TRÌNH) */}
                  <div
                    className={`mode-card-new scheduled ${opMode === 'scheduled' ? 'active' : ''}`}
                    onClick={() => !modeChanging && handleModeChange('scheduled', s3Controller?._id)}
                  >
                    <div className="mode-icon-wrapper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="mode-info-block">
                      <div className="mode-title-new">LỊCH TRÌNH</div>
                      <div className="mode-desc-new">Theo mốc thời gian thiết lập</div>
                    </div>
                    <div className="mode-active-dot" />
                  </div>
                </div>
              </div>


            </div>

            {/* Right Column: Device Cards list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {overrideNotice && (
                <div style={{
                  background: 'rgba(255, 167, 38, 0.1)',
                  border: '1px solid rgba(255, 167, 38, 0.2)',
                  color: '#ffa726',
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  animation: 'slideUpFade 0.3s ease-out'
                }}>
                  ⚠️ {overrideNotice}
                </div>
              )}

              {/* Water Pump Card */}
              <div className={`device-card-new ${cmdPump === 'ON' ? 'active-on' : ''}`}>
                <div className="device-icon-wrapper-new">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                </div>
                <div className="device-info-new">
                  <span className="device-name-new">Water Pump</span>
                  {opMode === 'scheduled' ? (
                    <span className="device-schedule-info-new">
                      ⏰ {renderDeviceScheduleInfo('pump')}
                    </span>
                  ) : (
                    <span className="device-status-new">
                      {cmdPump === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                    </span>
                  )}
                </div>
                <div className="device-action-new">
                  {opMode === 'manual' ? (
                    <button
                      className={`pill-btn-new ${cmdPump === 'ON' ? 'active-on' : ''}`}
                      onClick={() => toggleRelay('pump', cmdPump, s3Controller?._id)}
                      disabled={!s3Controller}
                    >
                      {cmdPump === 'ON' ? 'ON' : 'OFF'}
                    </button>
                  ) : (
                    <div className={`status-badge-static ${cmdPump === 'ON' ? 'on' : ''}`}>
                      {cmdPump === 'ON' ? 'ON' : 'OFF'}
                    </div>
                  )}
                </div>
              </div>

              {/* Grow Lights Card */}
              <div className={`device-card-new light ${cmdLight === 'ON' ? 'active-on' : ''}`}>
                <div className="device-icon-wrapper-new">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </div>
                <div className="device-info-new">
                  <span className="device-name-new">Grow Lights</span>
                  {opMode === 'scheduled' ? (
                    <span className="device-schedule-info-new">
                      ⏰ {renderDeviceScheduleInfo('light')}
                    </span>
                  ) : (
                    <span className="device-status-new">
                      {cmdLight === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                    </span>
                  )}
                </div>
                <div className="device-action-new">
                  {opMode === 'manual' ? (
                    <button
                      className={`pill-btn-new ${cmdLight === 'ON' ? 'active-on' : ''}`}
                      onClick={() => toggleRelay('light', cmdLight, s3Controller?._id)}
                      disabled={!s3Controller}
                    >
                      {cmdLight === 'ON' ? 'ON' : 'OFF'}
                    </button>
                  ) : (
                    <div className={`status-badge-static ${cmdLight === 'ON' ? 'on' : ''}`}>
                      {cmdLight === 'ON' ? 'ON' : 'OFF'}
                    </div>
                  )}
                </div>
              </div>

              {/* Exhaust Fan Card */}
              <div className={`device-card-new fan ${cmdFan === 'ON' ? 'active-on' : ''}`}>
                <div className="device-icon-wrapper-new">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="22"
                    height="22"
                    style={{
                      animation: cmdFan === 'ON' ? 'spin 3s linear infinite' : 'none',
                      transformOrigin: 'center'
                    }}
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.1" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 9c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
                    <path d="M12 15c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                    <path d="M15 12c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z" />
                    <path d="M9 12c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
                  </svg>
                </div>
                <div className="device-info-new">
                  <span className="device-name-new">Exhaust Fan</span>
                  {opMode === 'scheduled' ? (
                    <span className="device-schedule-info-new">
                      ⏰ {renderDeviceScheduleInfo('fan')}
                    </span>
                  ) : (
                    <span className="device-status-new">
                      {cmdFan === 'ON' ? 'RUNNING MODE' : 'STANDBY MODE'}
                    </span>
                  )}
                </div>
                <div className="device-action-new">
                  {opMode === 'manual' ? (
                    <button
                      className={`pill-btn-new ${cmdFan === 'ON' ? 'active-on' : ''}`}
                      onClick={() => toggleRelay('fan', cmdFan, s3Controller?._id)}
                      disabled={!s3Controller}
                    >
                      {cmdFan === 'ON' ? 'ON' : 'OFF'}
                    </button>
                  ) : (
                    <div className={`status-badge-static ${cmdFan === 'ON' ? 'on' : ''}`}>
                      {cmdFan === 'ON' ? 'ON' : 'OFF'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Show Safety Windows Configuration Panel ONLY under Auto Mode */}
          {opMode === 'auto' && s3Controller && (
            <div style={{ animation: 'slideUpFade 0.4s ease-out' }}>
              <div className="matrix-card-new">
                <div className="matrix-header-new">
                  <div className="matrix-title-new" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>⏰</span>
                      <span>KHUNG GIỜ AN TOÀN ({(s3Controller.safetyWindows || []).length})</span>
                    </div>
                    <div className="small muted" style={{ fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal', marginTop: 2 }}>
                      Khoảng thời gian AI được phép bật máy bơm
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      className="matrix-row-btn-new"
                      onClick={() => setShowSafetyForm(!showSafetyForm)}
                      style={{ 
                        borderColor: showSafetyForm ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)',
                        color: showSafetyForm ? '#10b981' : 'var(--text-dim)'
                      }}
                    >
                      {showSafetyForm ? '✕ Đóng lại' : '➕ Thêm khung giờ'}
                    </button>
                  </div>
                </div>

                {/* Collapsible Create form */}
                {showSafetyForm && (
                  <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 16,
                    marginBottom: 20,
                    animation: 'slideUpFade 0.3s ease-out'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Thêm khung giờ cho phép
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      const startVal = e.target.start.value
                      const endVal = e.target.end.value
                      if (!startVal || !endVal) return
                      const updatedWindows = [...(s3Controller.safetyWindows || []), { start: startVal, end: endVal }]
                      try {
                        const res = await api.put(`/api/devices/${s3Controller._id}`, { safetyWindows: updatedWindows })
                        setDevices(prev => prev.map(d => d._id === s3Controller._id ? res.data : d))
                        if (activeDevice && activeDevice._id === s3Controller._id) {
                          setActiveDevice(res.data)
                        }
                        e.target.reset()
                        setShowSafetyForm(false)
                      } catch (e) {
                        alert('Không thể thêm khung giờ an toàn')
                      }
                    }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 100 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Bắt đầu</span>
                        <input type="time" name="start" required style={{ padding: '8px 10px', fontSize: 13, background: '#121620', border: '1px solid var(--border)', color: '#fff', borderRadius: 6 }} />
                      </label>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center', paddingBottom: 8 }}>đến</span>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 100 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Kết thúc</span>
                        <input type="time" name="end" required style={{ padding: '8px 10px', fontSize: 13, background: '#121620', border: '1px solid var(--border)', color: '#fff', borderRadius: 6 }} />
                      </label>
                      <button className="btn btn-primary" type="submit" style={{ fontSize: 13, padding: '9px 16px', height: 38 }}>
                        + Thêm
                      </button>
                    </form>
                  </div>
                )}

                {/* List of safety windows */}
                {!s3Controller.safetyWindows || s3Controller.safetyWindows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Chưa thiết lập khung giờ nào (Bơm đang bị khóa hoàn toàn). Chọn "+ Thêm khung giờ" ở trên để bắt đầu.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s3Controller.safetyWindows.map((w, idx) => (
                      <div key={idx} className="matrix-row-new">
                        <div className="matrix-left-new">
                          <div className="matrix-time-new" style={{ fontSize: 24 }}>
                            {w.start} - {w.end}
                          </div>
                          <div className="matrix-details-new">
                            <div className="matrix-cycle-info-new">
                              KHUNG GIỜ CHO PHÉP AI BẬT BƠM
                            </div>
                          </div>
                        </div>

                        <div className="matrix-actions-new">
                          <button
                            className="matrix-row-btn-new delete-btn-new"
                            onClick={async () => {
                              const updatedWindows = s3Controller.safetyWindows.filter((_, i) => i !== idx)
                              try {
                                const res = await api.put(`/api/devices/${s3Controller._id}`, { safetyWindows: updatedWindows })
                                setDevices(prev => prev.map(d => d._id === s3Controller._id ? res.data : d))
                                if (activeDevice && activeDevice._id === s3Controller._id) {
                                  setActiveDevice(res.data)
                                }
                              } catch (e) {
                                alert('Không thể xóa khung giờ an toàn')
                              }
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show Scheduler Matrix ONLY under Schedule Mode */}
          {opMode === 'scheduled' && (
            <div style={{ animation: 'slideUpFade 0.4s ease-out' }}>
              <SchedulesPanel deviceId={activeDevice._id} />
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          Vui lòng thêm hoặc chọn thiết bị S3 để thiết lập tự động hoá và hẹn giờ.
        </div>
      )}
    </div>
  )
}

