import React from 'react'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function AnalyticsTab({
  chartsData,
  aiReportText,
  generateReport,
  generatingReport,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI Strategic Report */}
      <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            AI Strategic Report
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Phân tích dữ liệu lịch sử và đưa ra chiến lược tưới lâu dài
          </p>
          {aiReportText && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 8,
              fontSize: 13,
              color: '#81c784',
              lineHeight: 1.5,
              maxWidth: 700,
              animation: 'dropdownFadeIn 0.3s ease both'
            }}>
              🤖 {aiReportText}
            </div>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={generateReport}
          disabled={generatingReport}
          style={{ borderRadius: 20, padding: '10px 24px', fontSize: 12 }}
        >
          {generatingReport ? 'GENERATING...' : 'GENERATE AI SUMMARY'}
        </button>
      </div>

      {/* Grid: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Temperature */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
            TEMPERATURE (°C)
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTempAnalytic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7043" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff7043" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="temperature" stroke="#ff7043" strokeWidth={2} fillOpacity={1} fill="url(#colorTempAnalytic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Humidity */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
            RELATIVE HUMIDITY (%)
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHumAnalytic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#29b6f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#29b6f6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="humidity" stroke="#29b6f6" strokeWidth={2} fillOpacity={1} fill="url(#colorHumAnalytic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Soil Moisture */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
            SOIL MOISTURE MATRIX (%)
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSoilAnalytic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="soilMoisture" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSoilAnalytic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lux */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
            LUMINOUS INTENSITY (LUX)
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLuxAnalytic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffa726" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ffa726" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f121a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                <Area type="stepAfter" dataKey="lux" stroke="#ffa726" strokeWidth={2} fillOpacity={1} fill="url(#colorLuxAnalytic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raw Telemetry Table */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.5px' }}>
          RAW TELEMETRY TABLE
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>TIMELINE</th>
                <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>TEMP</th>
                <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>HUM</th>
                <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>SOIL</th>
                <th style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '10px 16px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>LUM</th>
              </tr>
            </thead>
            <tbody>
              {chartsData.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Không có dữ liệu telemetry
                  </td>
                </tr>
              ) : (
                [...chartsData].reverse().slice(0, 10).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text-dim)' }}>
                      {row.timestamp ? new Date(row.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#ff7043' }}>
                      {row.temperature !== undefined ? `${row.temperature} °C` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#29b6f6' }}>
                      {row.humidity !== undefined ? `${row.humidity} %` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
                      {row.soilMoisture !== undefined ? `${row.soilMoisture} %` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'DM Mono, monospace', color: '#ffa726' }}>
                      {row.lux !== undefined ? `${row.lux} lx` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
