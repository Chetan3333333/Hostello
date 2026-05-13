export default function StatCard({ icon: Icon, label, value, trend, trendLabel, color = 'primary', delay = 0 }) {
  const colors = {
    primary: { bg: 'rgba(108,92,231,0.12)', color: '#A29BFE', glow: 'rgba(108,92,231,0.2)' },
    accent: { bg: 'rgba(0,210,255,0.12)', color: '#74E8FF', glow: 'rgba(0,210,255,0.2)' },
    success: { bg: 'rgba(0,196,140,0.12)', color: '#00C48C', glow: 'rgba(0,196,140,0.2)' },
    warning: { bg: 'rgba(255,181,71,0.12)', color: '#FFB547', glow: 'rgba(255,181,71,0.2)' },
    danger: { bg: 'rgba(255,107,107,0.12)', color: '#FF6B6B', glow: 'rgba(255,107,107,0.2)' },
  };
  const c = colors[color] || colors.primary;

  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-card-icon" style={{ background: c.bg, boxShadow: `0 0 20px ${c.glow}` }}>
        <Icon size={22} style={{ color: c.color }} />
      </div>
      <div className="stat-card-content">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-value">{value}</span>
        {trend !== undefined && (
          <span className={`stat-card-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}
