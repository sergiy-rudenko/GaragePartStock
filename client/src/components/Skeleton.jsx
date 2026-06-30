// Lightweight shimmer placeholders shown while data loads.

export function CarListSkeleton({ rows = 4 }) {
  return (
    <div className="car-list" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="car-card skeleton-card">
          <div className="skeleton skeleton-thumb" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton skeleton-line" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PartsTableSkeleton({ rows = 5 }) {
  return (
    <div className="table-wrap" aria-hidden>
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton skeleton-thumb sm" />
            <div className="skeleton skeleton-line" style={{ width: '30%' }} />
            <div className="skeleton skeleton-line" style={{ width: '15%' }} />
            <div className="skeleton skeleton-line" style={{ width: '20%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
