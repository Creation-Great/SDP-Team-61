import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { Skeleton } from '../components/Skeleton';

interface WeekAssignment {
  assignment_id: string;
  status: 'PENDING' | 'SUBMITTED';
  reviewee_name: string;
  team_key: string;
  week_id: string;
  week_number?: number;
  closes_at?: string;
  course_name?: string;
  week_is_open?: boolean;
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

  // Derive header info from first assignment (all share same week metadata)
  const first = assignments[0];
  const weekNumber = first?.week_number;
  const closesAt = first?.closes_at;
  const courseName = first?.course_name;
  const teamKey = first?.team_key;
  const weekIsOpen = first?.week_is_open;
  const submittedCount = assignments.filter(a => a.status === 'SUBMITTED').length;
  const totalCount = assignments.length;
  const pct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <Skeleton variant="text" width="100px" height="14px" />
        </div>
        <Skeleton variant="card" height="120px" />
        <div style={{ marginTop: '16px' }}>
          <Skeleton variant="card" height="220px" />
        </div>
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

      {/* Header card */}
      {first && (
        <div
          className="card"
          style={{ marginBottom: '20px', padding: '20px 24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, marginBottom: '6px' }}>
                {weekNumber != null ? `Week ${weekNumber}` : 'Week Assignments'}
                {courseName && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem', marginLeft: '12px' }}>
                    {courseName}
                  </span>
                )}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {teamKey && (
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'var(--tech-blue)', fontWeight: 600 }}>
                    Team {teamKey}
                  </span>
                )}
                {closesAt && (
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: weekIsOpen ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {weekIsOpen ? 'Due' : 'Closed'} {new Date(closesAt).toLocaleDateString()} at {new Date(closesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            {weekIsOpen != null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '4px',
                fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                background: weekIsOpen ? 'rgba(61,187,121,0.12)' : 'rgba(100,100,120,0.12)',
                color: weekIsOpen ? 'var(--success)' : 'var(--text-muted)',
                border: `1px solid ${weekIsOpen ? 'rgba(61,187,121,0.25)' : 'rgba(100,100,120,0.2)'}`,
              }}>
                {weekIsOpen ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                {weekIsOpen ? 'Open' : 'Closed'}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '6px', background: 'rgba(75,159,225,0.12)', borderRadius: '4px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--uconn-orange)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {submittedCount}/{totalCount} submitted
            </span>
          </div>
        </div>
      )}

      {!first && !error && (
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '28px' }}>
          Week Assignments
        </h1>
      )}

      {error && (
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '4px', padding: '12px 16px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {assignments.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
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
                  borderRadius: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(() => {
                    const missed = a.status === 'PENDING' && !weekIsOpen;
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '4px',
                        fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                        background: a.status === 'SUBMITTED' ? 'rgba(61,187,121,0.12)' : missed ? 'rgba(224,92,92,0.10)' : 'rgba(232,119,34,0.10)',
                        color: a.status === 'SUBMITTED' ? 'var(--success)' : missed ? 'var(--danger)' : 'var(--uconn-orange)',
                        border: `1px solid ${a.status === 'SUBMITTED' ? 'rgba(61,187,121,0.25)' : missed ? 'rgba(224,92,92,0.2)' : 'rgba(232,119,34,0.2)'}`,
                      }}>
                        {a.status === 'SUBMITTED' ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                        {a.status === 'SUBMITTED' ? 'SUBMITTED' : missed ? 'MISSED' : 'PENDING'}
                      </span>
                    );
                  })()}
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
