import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Radio, CheckCircle, Clock, Users, Calendar } from 'lucide-react';
import type { WeekStatusRow, StudentAggregate, TeamAggregate, Week } from '../types';

function getToken() { return localStorage.getItem('token') || ''; }

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `HTTP ${res.status}`);
  }
  return res.json();
}

// CRITICAL: PostgreSQL NUMERIC columns return as strings from pg.
// Never call .toFixed() directly on a DB value — always wrap in Number() first.
const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : Number(n).toFixed(2);

interface LiveEvent {
  id: string;
  time: Date;
  reviewee_name: string;
  assignment_id: string;
}

export default function InstructorWeekDetailPage() {
  const { courseId, weekId } = useParams<{ courseId: string; weekId: string }>();

  const [week, setWeek] = useState<Week | null>(null);
  const [statusRows, setStatusRows] = useState<WeekStatusRow[]>([]);
  const [students, setStudents] = useState<StudentAggregate[]>([]);
  const [teams, setTeams] = useState<TeamAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  async function fetchAnalytics() {
    try {
      const [status, analytics] = await Promise.all([
        apiFetch<WeekStatusRow[]>(`/courses/${courseId}/weeks/${weekId}/status`),
        apiFetch<{ students: StudentAggregate[]; teams: TeamAggregate[] }>(`/courses/${courseId}/weeks/${weekId}/analytics`),
      ]);
      setStatusRows(status);
      setStudents(analytics.students);
      setTeams(analytics.teams);

      if (analytics.students.length > 0) {
        setCategories(Object.keys(analytics.students[0].per_category_json || {}));
      } else if (analytics.teams.length > 0) {
        setCategories(Object.keys(analytics.teams[0].per_category_json || {}));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!courseId || !weekId) return;
    setLoading(true);

    Promise.all([
      apiFetch<Week>(`/courses/${courseId}/weeks/${weekId}`),
      fetchAnalytics(),
    ]).then(([weekData]) => {
      setWeek(weekData);
    }).catch((e: any) => {
      setError(e.message);
    }).finally(() => setLoading(false));

    const poll = setInterval(fetchAnalytics, 10000);

    const token = getToken();
    const sse = new EventSource(
      `/courses/${courseId}/weeks/${weekId}/events?token=${encodeURIComponent(token)}`
    );
    sseRef.current = sse;

    sse.addEventListener('submission_received', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setLiveEvents(prev => [
          { id: data.assignment_id, time: new Date(), reviewee_name: data.reviewee_name, assignment_id: data.assignment_id },
          ...prev,
        ].slice(0, 20));
        fetchAnalytics();
      } catch { /* ignore */ }
    });

    return () => {
      clearInterval(poll);
      sse.close();
    };
  }, [courseId, weekId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
        Loading...
      </div>
    );
  }

  const totalStudents = statusRows.length;
  const completedStudents = statusRows.filter(r => {
    const total = Number(r.total_assignments);
    const submitted = Number(r.submitted_assignments);
    return total > 0 && submitted >= total;
  }).length;

  // Determine scope display string
  function getScopeLabel(w: Week): string {
    if (w.scope_type === 'ALL') return 'All Teams';
    const keys = w.team_keys && w.team_keys.length > 0 ? w.team_keys : (w.scope_team_key ? [w.scope_team_key] : []);
    if (keys.length === 0) return 'Team scope';
    return `Team${keys.length > 1 ? 's' : ''}: ${keys.join(', ')}`;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          to={`/instructor/courses/${courseId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tech-blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft width={14} height={14} />
          Back to Course
        </Link>
      </div>

      {/* Week header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
            Week {week?.week_number ?? '—'}
          </h1>
          {week && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '999px', fontSize: '0.7rem',
              fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
              background: week.is_open ? 'rgba(61,187,121,0.12)' : 'rgba(100,100,120,0.12)',
              color: week.is_open ? 'var(--success)' : 'var(--text-muted)',
              border: `1px solid ${week.is_open ? 'rgba(61,187,121,0.25)' : 'rgba(100,100,120,0.2)'}`,
            }}>
              {week.is_open ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
              {week.is_open ? 'Open' : 'Closed'}
            </span>
          )}
        </div>
        {week && (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar width={12} height={12} />
              Due {new Date(week.closes_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Users width={12} height={12} />
              {getScopeLabel(week)}
            </span>
            {/* Team badges for TEAM scope */}
            {week.scope_type === 'TEAM' && week.team_keys && week.team_keys.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {week.team_keys.map(tk => (
                  <span key={tk} style={{
                    background: 'rgba(75,159,225,0.1)', color: 'var(--tech-blue)',
                    border: '1px solid rgba(75,159,225,0.2)', borderRadius: '4px',
                    padding: '2px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', fontWeight: 600,
                  }}>
                    {tk}
                  </span>
                ))}
              </div>
            )}
            <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle width={12} height={12} />
              {completedStudents}/{totalStudents} students complete
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--danger)', marginBottom: '24px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Live Events Feed */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Radio width={16} height={16} style={{ color: 'var(--success)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Live Feed</h2>
          <span style={{ marginLeft: 'auto', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Last 20 events
          </span>
        </div>
        {liveEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Waiting for submissions...
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {liveEvents.map(evt => (
              <motion.div
                key={evt.id + evt.time.toISOString()}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', background: 'rgba(61,187,121,0.05)',
                  border: '1px solid rgba(61,187,121,0.15)', borderRadius: '6px',
                }}
              >
                <CheckCircle width={14} height={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  Review submitted for <strong>{evt.reviewee_name}</strong>
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', flexShrink: 0 }}>
                  {evt.time.toLocaleTimeString()}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Completion Status Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Completion Status</h2>
        {statusRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>No students found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Full Name', 'Team', 'Progress', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statusRows.map(row => {
                  const total = Number(row.total_assignments);
                  const submitted = Number(row.submitted_assignments);
                  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                  const done = total > 0 && submitted >= total;
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(75,159,225,0.06)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{row.full_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--tech-blue)' }}>{row.team_key}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(75,159,225,0.12)', borderRadius: '2px', minWidth: '80px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--success)' : 'var(--tech-blue)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                            {submitted}/{total}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600,
                          background: done ? 'rgba(61,187,121,0.12)' : 'rgba(232,119,34,0.10)',
                          color: done ? 'var(--success)' : 'var(--uconn-orange)',
                          border: `1px solid ${done ? 'rgba(61,187,121,0.25)' : 'rgba(232,119,34,0.2)'}`,
                        }}>
                          {done ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                          {done ? 'Complete' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Analytics */}
      {students.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Student Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginBottom: '16px' }}>
            Average scores received per student across all reviewer submissions.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Name', 'Team', 'Overall Avg', ...categories, 'Reviews'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.reviewee_week_student_id} style={{ borderBottom: '1px solid rgba(75,159,225,0.06)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{s.full_name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--tech-blue)' }}>{s.team_key}</td>
                    <td style={{ padding: '10px 12px', fontWeight: s.avg_overall != null ? 600 : 400, color: s.avg_overall != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {fmt(s.avg_overall)}
                    </td>
                    {categories.map(cat => (
                      <td key={cat} style={{ padding: '10px 12px', color: s.per_category_json[cat] != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s.per_category_json[cat] != null ? Number(s.per_category_json[cat]).toFixed(2) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.n_reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Analytics */}
      {teams.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Team Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginBottom: '16px' }}>
            Average of all students' scores per team.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Team', 'Overall Avg', ...categories, 'Reviews'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.team_key} style={{ borderBottom: '1px solid rgba(75,159,225,0.06)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--tech-blue)', fontWeight: 600 }}>{t.team_key}</td>
                    <td style={{ padding: '10px 12px', fontWeight: t.avg_overall != null ? 600 : 400, color: t.avg_overall != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {fmt(t.avg_overall)}
                    </td>
                    {categories.map(cat => (
                      <td key={cat} style={{ padding: '10px 12px', color: t.per_category_json[cat] != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {t.per_category_json[cat] != null ? Number(t.per_category_json[cat]).toFixed(2) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{t.n_reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty analytics state */}
      {students.length === 0 && teams.length === 0 && statusRows.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
            No submissions yet. Analytics will appear here once students submit their reviews.
          </p>
        </div>
      )}
    </div>
  );
}
