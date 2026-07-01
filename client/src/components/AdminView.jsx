import { useEffect, useState } from 'react';
import { adminApi } from '../api.js';
import { PartsTableSkeleton } from './Skeleton.jsx';
import { useToast } from './ToastProvider.jsx';

// Admin-only user list. The data is served only if the backend confirms the
// caller's role is admin — this view is a convenience, never the security gate.
export default function AdminView() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    adminApi.users()
      .then((data) => { if (active) setUsers(data); })
      .catch((err) => { if (active) { setError(err.message); toast.error(`Couldn't load users: ${err.message}`); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="parts-panel">
      <div className="panel-header">
        <div>
          <h2>Admin · Users</h2>
          <p className="muted small">
            {loading ? 'Loading…' : `${users.length} user${users.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <PartsTableSkeleton />
      ) : (
        <div className="table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Cars</th>
                <th>Parts</th>
                <th>Tools</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="ID">{u.id}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Role">
                    <span className={`badge ${u.role === 'admin' ? 'badge-low' : 'badge-ok'}`}>{u.role}</span>
                  </td>
                  <td data-label="Joined">{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                  <td data-label="Cars">{u.car_count}</td>
                  <td data-label="Parts">{u.part_count}</td>
                  <td data-label="Tools">{u.tool_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
