import React from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function MetricChart({ data, dataKey, title, color = '#1976d2' }) {
  return (
    <div style={{ height: 260 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>{title}</div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
          <XAxis dataKey={(d) => new Date(d.timestamp).toLocaleTimeString()} height={40} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} />
          <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
