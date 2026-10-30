import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1A1D36', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ color: '#EEEEF5', fontSize: '0.8125rem', fontWeight: 600 }}>₹{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
}

// Kept in its own file so the charting library is downloaded only when the
// dashboard is actually on screen, instead of being part of what the owner
// waits for before he can see his numbers.
export default function RevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B6B80', fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B6B80', fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="revenue" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#revenueGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
