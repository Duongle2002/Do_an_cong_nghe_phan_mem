import React from 'react'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function OverviewTab({
  tinymlText,
  activeDevice,
  deviceStatuses,
  latest,
  chartsData,
  sseStatus,
  cmdPump,
  cmdLight,
  cmdFan,
  toggleRelay,
  s3Controller,
  opMode,
  handleModeChange,
  modeChanging,
  overrideNotice,
  setDevices,
}) {
  const isOnline = activeDevice && (deviceStatuses[activeDevice.externalId] || activeDevice.status) === 'online'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* TinyML Banner & Status Label Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tinyml-banner" style={{ marginBottom: 0 }}>
          {tinymlText}
        </div>

        {activeDevice && (
          <span className={`live-indicator ${isOnline ? 'connected' : 'disconnected'}`} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}>
            <span className="live-dot" />
            Thiết bị: <strong style={{ marginLeft: 4 }}>{isOnline ? 'Online' : 'Offline'}</strong>
          </span>
        )}
      </div>

      {/* Metric cards grid */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="metric-card-new">
          <div className="metric-card-header">
            <span className="metric-card-title">Nhiệt độ</span>
            <span className="metric-card-icon" style={{ color: '#ff7043' }}>🌡️</span>
          </div>
          <div className="metric-card-value">
            {latest ? (typeof latest.temperature === 'number' ? latest.temperature.toFixed(2) : latest.temperature) : '26.50'}
            <span className="metric-card-unit">°C</span>
          </div>
        </div>

        <div className="metric-card-new">
          <div className="metric-card-header">
            <span className="metric-card-title">Độ ẩm không khí</span>
            <span className="metric-card-icon" style={{ color: '#29b6f6' }}>💧</span>
          </div>
          <div className="metric-card-value">
            {latest ? (typeof latest.humidity === 'number' ? latest.humidity.toFixed(2) : latest.humidity) : '64.00'}
            <span className="metric-card-unit">%</span>
          </div>
        </div>

        {/* Độ ẩm đất highlighted card with left border */}
        <div className="metric-card-new highlighted">
          <div className="metric-card-header">
            <span className="metric-card-title">Độ ẩm đất</span>
            <span className="metric-card-icon" style={{ color: '#10b981' }}>🪴</span>
          </div>
          <div className="metric-card-value">
            {latest ? latest.soilMoisture : '50'}
            <span className="metric-card-unit">%</span>
          </div>
        </div>

        <div className="metric-card-new">
          <div className="metric-card-header">
            <span className="metric-card-title">Ánh sáng</span>
            <span className="metric-card-icon" style={{ color: '#ffa726' }}>☀️</span>
          </div>
          <div className="metric-card-value">
            {latest ? latest.lux : '6264'}
            <span className="metric-card-unit">lux</span>
          </div>
        </div>
      </div>

      {/* Split grid for Telemetry Chart and Device Matrix */}
      <div className="dashboard-grid">
        {/* Left Column: Area Chart card */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Lịch sử telemetry (Theo thời gian thực)
              </h3>
              <span className="badge ok" style={{ fontSize: 9 }}>LIVE DATA</span>
            </div>
            <span className={`live-indicator ${sseStatus}`} style={{ fontSize: 11 }}>
              <span className="live-dot" />
              {sseStatus === 'connected' ? 'Live Streaming' : 'Reconnecting...'}
            </span>
          </div>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7043" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff7043" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorSoil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  name="Nhiệt độ (°C)"
                  stroke="#ff7043"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTemp)"
                />
                <Area
                  type="monotone"
                  dataKey="soilMoisture"
                  name="Độ ẩm đất (%)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSoil)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Device Matrix Switches */}
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
            }}>
              ⚠️ {overrideNotice}
            </div>
          )}

          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Device Matrix
              </h3>
            </div>

            {/* Toggles list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="switch-control">
                <div className="switch-control-left">
                  <div className="switch-control-icon">💦</div>
                  <div className="switch-control-info">
                    <span className="switch-control-name">Máy bơm</span>
                    <span className="switch-control-status">{(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                  </div>
                </div>
                {opMode === 'manual' ? (
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      checked={cmdPump === 'ON'}
                      onChange={() => toggleRelay('pump', cmdPump, s3Controller?._id)}
                      disabled={!s3Controller}
                    />
                    <span className="ios-slider"></span>
                  </label>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: (s3Controller?.lastPumpState || 'OFF') === 'ON' ? '#10b981' : 'var(--text-muted)',
                    background: (s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                    padding: '3px 8px', borderRadius: 6,
                    border: `1px solid ${(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`
                  }}>
                    {(s3Controller?.lastPumpState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                  </span>
                )}
              </div>

              <div className="switch-control">
                <div className="switch-control-left">
                  <div className="switch-control-icon">💡</div>
                  <div className="switch-control-info">
                    <span className="switch-control-name">Hệ thống đèn</span>
                    <span className="switch-control-status">{(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                  </div>
                </div>
                {opMode === 'manual' ? (
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      checked={cmdLight === 'ON'}
                      onChange={() => toggleRelay('light', cmdLight, s3Controller?._id)}
                      disabled={!s3Controller}
                    />
                    <span className="ios-slider"></span>
                  </label>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: (s3Controller?.lastLightState || 'OFF') === 'ON' ? '#ffa726' : 'var(--text-muted)',
                    background: (s3Controller?.lastLightState || 'OFF') === 'ON' ? 'rgba(255,167,38,0.1)' : 'rgba(255,255,255,0.02)',
                    padding: '3px 8px', borderRadius: 6,
                    border: `1px solid ${(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'rgba(255,167,38,0.2)' : 'var(--border)'}`
                  }}>
                    {(s3Controller?.lastLightState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                  </span>
                )}
              </div>

              <div className="switch-control">
                <div className="switch-control-left">
                  <div className="switch-control-icon">🌀</div>
                  <div className="switch-control-info">
                    <span className="switch-control-name">Quạt thông gió</span>
                    <span className="switch-control-status">{(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}</span>
                  </div>
                </div>
                {opMode === 'manual' ? (
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      checked={cmdFan === 'ON'}
                      onChange={() => toggleRelay('fan', cmdFan, s3Controller?._id)}
                      disabled={!s3Controller}
                    />
                    <span className="ios-slider"></span>
                  </label>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: (s3Controller?.lastFanState || 'OFF') === 'ON' ? '#29b6f6' : 'var(--text-muted)',
                    background: (s3Controller?.lastFanState || 'OFF') === 'ON' ? 'rgba(41,182,246,0.1)' : 'rgba(255,255,255,0.02)',
                    padding: '3px 8px', borderRadius: 6,
                    border: `1px solid ${(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'rgba(41,182,246,0.2)' : 'var(--border)'}`
                  }}>
                    {(s3Controller?.lastFanState || 'OFF') === 'ON' ? 'RUNNING' : 'STANDBY'}
                  </span>
                )}
              </div>
            </div>

            {/* Operational mode buttons */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px' }}>
                ⚙️ Operational Mode
              </div>
              <div className="mode-selector">
                <button
                  className={`mode-btn ${opMode === 'manual' ? 'active' : ''}`}
                  onClick={() => handleModeChange('manual', s3Controller?._id)}
                  disabled={modeChanging || !s3Controller}
                >
                  Manual
                </button>
                <button
                  className={`mode-btn ${opMode === 'auto' ? 'active' : ''}`}
                  onClick={() => handleModeChange('auto', s3Controller?._id)}
                  disabled={modeChanging || !s3Controller}
                >
                  Auto
                </button>
                <button
                  className={`mode-btn ${opMode === 'scheduled' ? 'active' : ''}`}
                  onClick={() => handleModeChange('scheduled', s3Controller?._id)}
                  disabled={modeChanging || !s3Controller}
                >
                  Scheduled
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
