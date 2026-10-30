import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// See the note in RevenueChart.jsx - kept separate so the charting library is
// not part of what the owner waits for when he signs in.
export default function OccupancyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4} strokeWidth={0}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} rooms`, name]}
          contentStyle={{ background: '#1A1D36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8125rem' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
