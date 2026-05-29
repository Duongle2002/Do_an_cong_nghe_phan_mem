import React from 'react'
import { getTempUnit } from '../utils/preferences'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

function CustomTooltip({ active, payload, label, color }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(10,26,14,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '8px 12px',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(232,245,233,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: color || '#34d399' }}>
        {payload[0]?.value ?? '—'}
      </div>
    </div>
  )
}

export default function MetricChart({ data, dataKey, title, color }) {
  const stroke = color || '#10b981'

  const displayData = React.useMemo(() => {
    const unit = getTempUnit();
    if (dataKey === 'temperature' && unit === 'F') {
      return data?.map(item => ({
        ...item,
        temperature: item.temperature !== undefined && item.temperature !== null
          ? Number((item.temperature * 1.8 + 32).toFixed(1))
          : item.temperature
      }));
    }
    return data;
  }, [data, dataKey]);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {displayData?.length > 0 && (
          <div style={{
            fontSize: 11,
            fontFamily: 'DM Mono, monospace',
            color: stroke,
            background: `${stroke}18`,
            border: `1px solid ${stroke}30`,
            padding: '2px 8px',
            borderRadius: 999,
          }}>
            {displayData[displayData.length - 1]?.[dataKey] ?? '—'}
          </div>
        )}
      </div>
      <div style={{ height: 200, padding: '4px 8px 12px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey={(d) => new Date(d.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 10, fill: 'rgba(232,245,233,0.35)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgba(232,245,233,0.35)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip color={stroke} />}
              cursor={{ stroke: stroke, strokeWidth: 1, strokeOpacity: 0.4 }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              dot={false}
              activeDot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: 'rgba(0,0,0,0.5)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
