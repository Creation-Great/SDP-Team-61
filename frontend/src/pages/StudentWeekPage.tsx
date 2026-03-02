import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Clock, ChevronRight } from 'lucide-react';

function getToken() { return localStorage.getItem('token') || ''; }

interface WeekAssignment {
  assignment_id: string;
  status: 'PENDING' | 'SUBMITTED';
  reviewee_name: string;
  team_key: string;
  week_id: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function StudentWeekPage() {
  const { weekId } = useParams<{ weekId: string }>();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<WeekAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!weekId) return;
    apiFetch<WeekAssignment[]>(`/me/weeks/${weekId}/assignments`)
      .then(setAssignments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [weekId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/student/reviews"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tech-blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft width={14} height={14} />
          My Reviews
        </Link>
      </div>

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '28px' }}>
        Week Assignments
      </h1>

      {error && (
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius)' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            No assignments for this week.
          </p>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {assignments.map((a, i) => (
              <motion.div
                key={a.assignment_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--surface-input)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '999px',
                    fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                    background: a.status === 'SUBMITTED' ? 'rgba(61,187,121,0.12)' : 'rgba(232,119,34,0.10)',
                    color: a.status === 'SUBMITTED' ? 'var(--success)' : 'var(--uconn-orange)',
                    border: `1px solid ${a.status === 'SUBMITTED' ? 'rgba(61,187,121,0.25)' : 'rgba(232,119,34,0.2)'}`,
                  }}>
                    {a.status === 'SUBMITTED' ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                    {a.status}
                  </span>
                  <div>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
                      {a.reviewee_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', marginLeft: '8px' }}>
                      Team {a.team_key}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/student/assignments/${a.assignment_id}`)}
                  style={{ padding: '7px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {a.status === 'SUBMITTED' ? 'View' : 'Review'}
                  <ChevronRight width={13} height={13} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
