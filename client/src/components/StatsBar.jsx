import { formatMoney } from '../format.js';

function StatCard({ label, value, icon, tone, accent, onClick, hint }) {
  const loading = value == null;
  const className = [
    'stat-card',
    accent ? `stat-accent-${accent}` : '',
    tone ? `stat-${tone}` : '',
    onClick ? 'stat-clickable' : '',
  ].filter(Boolean).join(' ');
  const content = (
    <>
      <span className="stat-icon" aria-hidden>{icon}</span>
      <span className="stat-body">
        <span className="stat-label">{label}</span>
        {loading
          ? <span className="skeleton skeleton-line stat-skeleton" />
          : <span className="stat-value">{value}</span>}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} title={hint} aria-label={hint || label}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

// Inventory summary shown above the main layout. The low-stock card becomes a
// button when there are low-stock parts, opening the low-stock view.
export default function StatsBar({ stats, loading, onShowLowStock }) {
  const low = stats?.low_stock_count ?? 0;
  return (
    <div className="stats-bar">
      <StatCard label="Cars" icon="🚗" accent="cars" value={loading ? null : (stats?.total_cars ?? 0)} />
      <StatCard label="Parts" icon="🔩" accent="parts" value={loading ? null : (stats?.total_parts ?? 0)} />
      <StatCard label="Inventory value" icon="💰" accent="value" value={loading ? null : formatMoney(stats?.total_value)} />
      <StatCard
        label="Low stock"
        icon="⚠"
        accent="low"
        value={loading ? null : low}
        tone={low > 0 ? 'warn' : undefined}
        onClick={!loading && low > 0 ? onShowLowStock : undefined}
        hint={low > 0 ? 'View all low-stock parts' : undefined}
      />
    </div>
  );
}
