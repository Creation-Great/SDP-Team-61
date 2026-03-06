import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Radio, CheckCircle, Clock, Users, Calendar,
  Download, AlertTriangle, X, ChevronDown, ChevronUp,
  Shield, ArrowUpDown,
} from 'lucide-react';
import type { WeekStatusRow, StudentAggregate, TeamAggregate, Week, QualityFlag, StudentReviewDetail } from '../types';
import { apiFetch, apiFetchRaw, getToken } from '../utils/api';
import { useToast } from '../components/ToastProvider';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

type SortDir = 'asc' | 'desc';
interface SortState {
  column: string;
  direction: SortDir;
}

export default function InstructorWeekDetailPage() {
  const { courseId, weekId } = useParams<{ courseId: string; weekId: string }>();
  const { addToast } = useToast();

  const [week, setWeek] = useState<Week | null>(null);
  const [statusRows, setStatusRows] = useState<WeekStatusRow[]>([]);
  const [students, setStudents] = useState<StudentAggregate[]>([]);
  const [teams, setTeams] = useState<TeamAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  // Phase 4a: Close/Extend state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [patchingWeek, setPatchingWeek] = useState(false);

  // Phase 4c: Quality flags
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);

  // Phase 4d: Student drilldown
  const [drilldownStudent, setDrilldownStudent] = useState<StudentAggregate | null>(null);
  const [drilldownReviews, setDrilldownReviews] = useState<StudentReviewDetail[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Phase 4e: Sort state for tables
  const [statusSort, setStatusSort] = useState<SortState>({ column: '', direction: 'asc' });
  const [analyticsSort, setAnalyticsSort] = useState<SortState>({ column: '', direction: 'asc' });

  // Phase 4e: Team filter
  const [teamFilter, setTeamFilter] = useState('');

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

  async function fetchQualityFlags() {
    try {
      const flags = await apiFetch<QualityFlag[]>(`/courses/${courseId}/weeks/${weekId}/quality-flags`);
      setQualityFlags(flags);
    } catch { /* ignore — endpoint may not exist yet */ }
  }

  useEffect(() => {
    if (!courseId || !weekId) return;
    setLoading(true);

    Promise.all([
      apiFetch<Week>(`/courses/${courseId}/weeks/${weekId}`),
      fetchAnalytics(),
      fetchQualityFlags(),
    ]).then(([weekData]) => {
      setWeek(weekData);
    }).catch((e: any) => {
      setError(e.message);
    }).finally(() => setLoading(false));

    const poll = setInterval(() => { fetchAnalytics(); fetchQualityFlags(); }, 10000);

    const token = getToken();
    let sse: EventSource | null = null;
    try {
      sse = new EventSource(
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
          fetchQualityFlags();
        } catch { /* ignore */ }
      });

      // Prevent infinite retry on auth/connection errors
      sse.onerror = () => {
        if (sse && sse.readyState === EventSource.CLOSED) {
          sse.close();
          sseRef.current = null;
        }
      };
    } catch {
      // EventSource not supported or failed to construct
    }

    return () => {
      clearInterval(poll);
      sse?.close();
    };
  }, [courseId, weekId]);

  // Phase 4a: Close Now
  async function handleCloseNow() {
    setPatchingWeek(true);
    try {
      const updated = await apiFetch<Week>(`/courses/${courseId}/weeks/${weekId}`, {
        method: 'PATCH',
        body: JSON.stringify({ closes_at: new Date().toISOString() }),
      });
      setWeek(updated);
      addToast({ type: 'success', title: 'Week closed', message: `Week ${updated.week_number} has been closed.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to close week', message: err.message });
    } finally {
      setPatchingWeek(false);
      setShowCloseConfirm(false);
    }
  }

  // Phase 4a: Extend Deadline
  async function handleExtendDeadline() {
    if (!extendDate) return;
    setPatchingWeek(true);
    try {
      const updated = await apiFetch<Week>(`/courses/${courseId}/weeks/${weekId}`, {
        method: 'PATCH',
        body: JSON.stringify({ closes_at: new Date(extendDate).toISOString() }),
      });
      setWeek(updated);
      addToast({ type: 'success', title: 'Deadline extended', message: `New deadline: ${new Date(updated.closes_at).toLocaleString()}` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to extend deadline', message: err.message });
    } finally {
      setPatchingWeek(false);
      setShowExtendDialog(false);
    }
  }

  // Phase 4b: Export CSV
  async function handleExportCsv() {
    try {
      const res = await apiFetchRaw(`/courses/${courseId}/weeks/${weekId}/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `week-${week?.week_number}-analytics.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Export started', message: 'CSV download initiated.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Export failed', message: err.message });
    }
  }

  // Phase 4d: Student drilldown
  async function handleStudentClick(student: StudentAggregate) {
    setDrilldownStudent(student);
    setDrilldownLoading(true);
    setDrilldownReviews([]);
    try {
      const reviews = await apiFetch<StudentReviewDetail[]>(
        `/courses/${courseId}/weeks/${weekId}/students/${student.reviewee_week_student_id}/reviews`
      );
      setDrilldownReviews(reviews);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load reviews', message: err.message });
    } finally {
      setDrilldownLoading(false);
    }
  }

  function closeDrilldown() {
    setDrilldownStudent(null);
    setDrilldownReviews([]);
  }

  // Phase 4e: Sorting helpers
  function toggleSort(current: SortState, column: string): SortState {
    if (current.column === column) {
      return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { column, direction: 'asc' };
  }

  function sortIndicator(sort: SortState, column: string) {
    if (sort.column !== column) return null;
    return sort.direction === 'asc' ? <ChevronUp width={10} height={10} style={{ marginLeft: '2px' }} /> : <ChevronDown width={10} height={10} style={{ marginLeft: '2px' }} />;
  }

  // Phase 4e: Filtered data
  const filteredStatusRows = useMemo(() => {
    if (!teamFilter) return statusRows;
    return statusRows.filter(r => r.team_key === teamFilter);
  }, [statusRows, teamFilter]);

  const filteredStudents = useMemo(() => {
    if (!teamFilter) return students;
    return students.filter(s => s.team_key === teamFilter);
  }, [students, teamFilter]);

  // Phase 4e: Sorted status rows
  const sortedStatusRows = useMemo(() => {
    const rows = [...filteredStatusRows];
    if (!statusSort.column) return rows;
    const dir = statusSort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (statusSort.column) {
        case 'full_name': return dir * a.full_name.localeCompare(b.full_name);
        case 'team_key': return dir * a.team_key.localeCompare(b.team_key);
        case 'progress': {
          const pctA = Number(a.total_assignments) > 0 ? Number(a.submitted_assignments) / Number(a.total_assignments) : 0;
          const pctB = Number(b.total_assignments) > 0 ? Number(b.submitted_assignments) / Number(b.total_assignments) : 0;
          return dir * (pctA - pctB);
        }
        case 'status': {
          const doneA = a.user_id != null && Number(a.total_assignments) > 0 && Number(a.submitted_assignments) >= Number(a.total_assignments) ? 1 : 0;
          const doneB = b.user_id != null && Number(b.total_assignments) > 0 && Number(b.submitted_assignments) >= Number(b.total_assignments) ? 1 : 0;
          return dir * (doneA - doneB);
        }
        default: return 0;
      }
    });
    return rows;
  }, [filteredStatusRows, statusSort]);

  // Phase 4e: Sorted student analytics
  const sortedStudents = useMemo(() => {
    const rows = [...filteredStudents];
    if (!analyticsSort.column) return rows;
    const dir = analyticsSort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (analyticsSort.column) {
        case 'full_name': return dir * a.full_name.localeCompare(b.full_name);
        case 'team_key': return dir * a.team_key.localeCompare(b.team_key);
        case 'avg_overall': return dir * ((Number(a.avg_overall) || 0) - (Number(b.avg_overall) || 0));
        case 'n_reviews': return dir * (a.n_reviews - b.n_reviews);
        default: {
          // Category columns
          const valA = a.per_category_json[analyticsSort.column] != null ? Number(a.per_category_json[analyticsSort.column]) : 0;
          const valB = b.per_category_json[analyticsSort.column] != null ? Number(b.per_category_json[analyticsSort.column]) : 0;
          return dir * (valA - valB);
        }
      }
    });
    return rows;
  }, [filteredStudents, analyticsSort]);

  // Unique team keys for filter
  const allTeamKeys = useMemo(() => {
    const keys = new Set<string>();
    statusRows.forEach(r => keys.add(r.team_key));
    students.forEach(s => keys.add(s.team_key));
    return Array.from(keys).sort();
  }, [statusRows, students]);

  // Phase 4e: Average score — must be before any early return (Rules of Hooks)
  const avgScore = useMemo(() => {
    const withScores = students.filter(s => s.avg_overall != null);
    if (withScores.length === 0) return null;
    return withScores.reduce((sum, s) => sum + Number(s.avg_overall), 0) / withScores.length;
  }, [students]);

  // Phase 4e: Time remaining — must be before any early return (Rules of Hooks)
  const timeRemaining = useMemo(() => {
    if (!week) return '';
    const now = new Date();
    const closes = new Date(week.closes_at);
    if (closes <= now) return 'Closed';
    const diffMs = closes.getTime() - now.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, [week]);

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
    // A student is only "complete" if they are linked (have a user_id) and submitted all assignments.
    // Unlinked students (user_id = null) can never be complete.
    return r.user_id != null && total > 0 && submitted >= total;
  }).length;
  const completionPct = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;

  // Determine scope display string
  function getScopeLabel(w: Week): string {
    if (w.scope_type === 'ALL') return 'All Teams';
    const keys = w.team_keys && w.team_keys.length > 0 ? w.team_keys : (w.scope_team_key ? [w.scope_team_key] : []);
    if (keys.length === 0) return 'Team scope';
    return `Team${keys.length > 1 ? 's' : ''}: ${keys.join(', ')}`;
  }

  // Sortable header style helper
  const thStyle = (clickable: boolean): React.CSSProperties => ({
    padding: '8px 12px', textAlign: 'left' as const, color: 'var(--text-secondary)',
    fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    whiteSpace: 'nowrap' as const,
    cursor: clickable ? 'pointer' : 'default',
    userSelect: 'none' as const,
  });

  // Format datetime-local value from ISO string
  function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
            Week {week?.week_number ?? '—'}
          </h1>
          {week && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '0', fontSize: '0.7rem',
              fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
              background: week.is_open ? 'rgba(61,187,121,0.12)' : 'rgba(100,100,120,0.12)',
              color: week.is_open ? 'var(--success)' : 'var(--text-muted)',
              border: `1px solid ${week.is_open ? 'rgba(61,187,121,0.25)' : 'rgba(100,100,120,0.2)'}`,
            }}>
              {week.is_open ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
              {week.is_open ? 'Open' : 'Closed'}
            </span>
          )}
          {/* Phase 4a: Close Now / Extend Deadline buttons */}
          {week && week.is_open && (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowCloseConfirm(true)}
                disabled={patchingWeek}
                style={{ fontSize: '0.72rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Clock width={12} height={12} />
                Close Now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setExtendDate(toDatetimeLocal(week.closes_at)); setShowExtendDialog(true); }}
                disabled={patchingWeek}
                style={{ fontSize: '0.72rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Calendar width={12} height={12} />
                Extend Deadline
              </button>
            </>
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
                    border: '1px solid rgba(75,159,225,0.2)', borderRadius: '0',
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
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '0', padding: '12px 16px', color: 'var(--danger)', marginBottom: '24px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Phase 4e: Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Total Submissions
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--tech-blue)', letterSpacing: '-0.03em' }}>
            {statusRows.reduce((sum, r) => sum + Number(r.submitted_assignments), 0)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', marginTop: '2px' }}>
            of {statusRows.reduce((sum, r) => sum + Number(r.total_assignments), 0)} total
          </div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Completion
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: completionPct === 100 ? 'var(--success)' : 'var(--uconn-orange)', letterSpacing: '-0.03em' }}>
            {completionPct}%
          </div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', marginTop: '2px' }}>
            {completedStudents}/{totalStudents} students
          </div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Average Score
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {avgScore != null ? avgScore.toFixed(2) : '—'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', marginTop: '2px' }}>
            mean of student averages
          </div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Time Remaining
          </div>
          <div style={{
            fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em',
            color: timeRemaining === 'Closed' ? 'var(--text-muted)' : 'var(--success)',
          }}>
            {timeRemaining || '—'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', marginTop: '2px' }}>
            {timeRemaining === 'Closed' ? 'week has ended' : 'until deadline'}
          </div>
        </div>
      </div>

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
                  border: '1px solid rgba(61,187,121,0.15)', borderRadius: '0',
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

      {/* Phase 4e: Team filter */}
      {allTeamKeys.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ArrowUpDown width={14} height={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600 }}>
            Filter by Team:
          </span>
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{
              background: 'var(--surface-input)', color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)', borderRadius: '0',
              padding: '4px 10px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <option value="">All Teams</option>
            {allTeamKeys.map(tk => (
              <option key={tk} value={tk}>Team {tk}</option>
            ))}
          </select>
        </div>
      )}

      {/* Completion Status Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Completion Status</h2>
        {sortedStatusRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>No students found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={thStyle(true)} onClick={() => setStatusSort(s => toggleSort(s, 'full_name'))}>
                    Full Name {sortIndicator(statusSort, 'full_name')}
                  </th>
                  <th style={thStyle(true)} onClick={() => setStatusSort(s => toggleSort(s, 'team_key'))}>
                    Team {sortIndicator(statusSort, 'team_key')}
                  </th>
                  <th style={thStyle(true)} onClick={() => setStatusSort(s => toggleSort(s, 'progress'))}>
                    Progress {sortIndicator(statusSort, 'progress')}
                  </th>
                  <th style={thStyle(true)} onClick={() => setStatusSort(s => toggleSort(s, 'status'))}>
                    Status {sortIndicator(statusSort, 'status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStatusRows.map(row => {
                  const total = Number(row.total_assignments);
                  const submitted = Number(row.submitted_assignments);
                  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                  const isLinked = row.user_id != null;
                  const done = isLinked && total > 0 && submitted >= total;
                  const weekClosed = week && !week.is_open;
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(75,159,225,0.06)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{row.full_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--tech-blue)' }}>{row.team_key}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(75,159,225,0.12)', borderRadius: '0', minWidth: '80px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--success)' : 'var(--tech-blue)', borderRadius: '0', transition: 'width 0.4s ease' }} />
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                            {isLinked ? `${submitted}/${total}` : '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {(() => {
                          // Unlinked student: never had assignments generated.
                          // When the week is closed, they are "not completed"; when open, show as "unlinked".
                          if (!isLinked) {
                            if (weekClosed) {
                              return (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '0', fontSize: '0.68rem', fontWeight: 600,
                                  background: 'rgba(224,92,92,0.10)',
                                  color: 'var(--danger)',
                                  border: '1px solid rgba(224,92,92,0.2)',
                                }}>
                                  <Clock width={10} height={10} />
                                  Not Completed
                                </span>
                              );
                            }
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '0', fontSize: '0.68rem', fontWeight: 600,
                                background: 'rgba(100,100,120,0.10)',
                                color: 'var(--text-muted)',
                                border: '1px solid rgba(100,100,120,0.2)',
                              }}>
                                <Clock width={10} height={10} />
                                Unlinked
                              </span>
                            );
                          }
                          // Linked student: done, missed (closed + not done), or pending (open + not done)
                          const missed = !done && weekClosed;
                          return (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '0', fontSize: '0.68rem', fontWeight: 600,
                              background: done ? 'rgba(61,187,121,0.12)' : missed ? 'rgba(224,92,92,0.10)' : 'rgba(232,119,34,0.10)',
                              color: done ? 'var(--success)' : missed ? 'var(--danger)' : 'var(--uconn-orange)',
                              border: `1px solid ${done ? 'rgba(61,187,121,0.25)' : missed ? 'rgba(224,92,92,0.2)' : 'rgba(232,119,34,0.2)'}`,
                            }}>
                              {done ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                              {done ? 'Complete' : missed ? 'Missed' : 'Pending'}
                            </span>
                          );
                        })()}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Student Analytics</h2>
            {/* Phase 4b: Export CSV */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportCsv}
              style={{ fontSize: '0.72rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Download width={12} height={12} />
              Export CSV
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginBottom: '16px' }}>
            Average scores received per student across all reviewer submissions. Click a student name to see details.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={thStyle(true)} onClick={() => setAnalyticsSort(s => toggleSort(s, 'full_name'))}>
                    Name {sortIndicator(analyticsSort, 'full_name')}
                  </th>
                  <th style={thStyle(true)} onClick={() => setAnalyticsSort(s => toggleSort(s, 'team_key'))}>
                    Team {sortIndicator(analyticsSort, 'team_key')}
                  </th>
                  <th style={thStyle(true)} onClick={() => setAnalyticsSort(s => toggleSort(s, 'avg_overall'))}>
                    Overall Avg {sortIndicator(analyticsSort, 'avg_overall')}
                  </th>
                  {categories.map(cat => (
                    <th key={cat} style={thStyle(true)} onClick={() => setAnalyticsSort(s => toggleSort(s, cat))}>
                      {cat} {sortIndicator(analyticsSort, cat)}
                    </th>
                  ))}
                  <th style={thStyle(true)} onClick={() => setAnalyticsSort(s => toggleSort(s, 'n_reviews'))}>
                    Reviews {sortIndicator(analyticsSort, 'n_reviews')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map(s => (
                  <tr key={s.reviewee_week_student_id} style={{ borderBottom: '1px solid rgba(75,159,225,0.06)' }}>
                    <td
                      style={{ padding: '10px 12px', color: 'var(--tech-blue)', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handleStudentClick(s)}
                      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {s.full_name}
                    </td>
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
        <div className="card" style={{ marginBottom: '24px' }}>
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

      {/* Phase 4c: Quality Flags */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Shield width={16} height={16} style={{ color: 'var(--uconn-orange)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Quality Flags</h2>
          {qualityFlags.length > 0 && (
            <span style={{
              background: 'rgba(232,119,34,0.12)', color: 'var(--uconn-orange)',
              border: '1px solid rgba(232,119,34,0.25)', borderRadius: '0',
              padding: '2px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', fontWeight: 700,
            }}>
              {qualityFlags.length}
            </span>
          )}
        </div>
        {qualityFlags.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
            <CheckCircle width={18} height={18} style={{ color: 'var(--success)' }} />
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', margin: 0 }}>
              No quality concerns detected.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {qualityFlags.map((flag, i) => {
              const isIdentical = flag.flag_reason.toLowerCase().includes('identical');
              const isShort = flag.flag_reason.toLowerCase().includes('short');
              return (
                <div
                  key={`${flag.reviewer_name}-${flag.reviewee_name}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px',
                    background: isShort ? 'rgba(224,92,92,0.05)' : 'rgba(232,119,34,0.05)',
                    border: `1px solid ${isShort ? 'rgba(224,92,92,0.15)' : 'rgba(232,119,34,0.15)'}`,
                    borderRadius: '0',
                  }}
                >
                  <AlertTriangle width={14} height={14} style={{ color: isShort ? 'var(--danger)' : 'var(--uconn-orange)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', flex: 1 }}>
                    <strong>{flag.reviewer_name}</strong>
                    <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>&rarr;</span>
                    <strong>{flag.reviewee_name}</strong>
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '0', fontSize: '0.68rem', fontWeight: 600,
                    fontFamily: 'Roboto Mono, monospace',
                    background: isShort ? 'rgba(224,92,92,0.12)' : 'rgba(232,119,34,0.12)',
                    color: isShort ? 'var(--danger)' : 'var(--uconn-orange)',
                    border: `1px solid ${isShort ? 'rgba(224,92,92,0.25)' : 'rgba(232,119,34,0.25)'}`,
                  }}>
                    {flag.flag_reason}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', flexShrink: 0 }}>
                    {new Date(flag.submitted_at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty analytics state */}
      {students.length === 0 && teams.length === 0 && statusRows.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
            No submissions yet. Analytics will appear here once students submit their reviews.
          </p>
        </div>
      )}

      {/* Phase 4a: Close Now Confirm Dialog */}
      <ConfirmDialog
        open={showCloseConfirm}
        title="Close Week Now"
        message="This will immediately close the week. Students with pending reviews will no longer be able to submit."
        confirmLabel={patchingWeek ? 'Closing...' : 'Close Now'}
        onConfirm={handleCloseNow}
        onCancel={() => setShowCloseConfirm(false)}
        variant="danger"
      />

      {/* Phase 4a: Extend Deadline Dialog */}
      <AnimatePresence>
        {showExtendDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,7,26,0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9998,
            }}
            onClick={() => setShowExtendDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid rgba(75, 159, 225, 0.15)',
                borderTop: '2px solid',
                borderImage: 'linear-gradient(90deg, var(--tech-blue), var(--uconn-orange)) 1',
                padding: '24px',
                minWidth: '400px', maxWidth: '500px',
                borderRadius: '4px',
              }}
            >
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Extend Deadline
              </h3>
              <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Set a new deadline for this week.
              </p>
              <input
                type="datetime-local"
                value={extendDate}
                onChange={e => setExtendDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--surface-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)', borderRadius: '0',
                  fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn" onClick={() => setShowExtendDialog(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleExtendDeadline}
                  disabled={!extendDate || patchingWeek}
                >
                  {patchingWeek ? 'Saving...' : 'Update Deadline'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4d: Student Drilldown Panel */}
      <AnimatePresence>
        {drilldownStudent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrilldown}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,7,26,0.6)',
                zIndex: 999,
              }}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{
                position: 'fixed', right: 0, top: 0, bottom: 0,
                width: '420px', zIndex: 1000,
                background: 'var(--surface-card)',
                borderLeft: '1px solid rgba(75,159,225,0.15)',
                boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Panel header */}
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0', fontFamily: 'Montserrat, sans-serif' }}>
                    {drilldownStudent.full_name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: 'rgba(75,159,225,0.1)', color: 'var(--tech-blue)',
                      border: '1px solid rgba(75,159,225,0.2)', borderRadius: '0',
                      padding: '2px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', fontWeight: 600,
                    }}>
                      Team {drilldownStudent.team_key}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                      Avg: {fmt(drilldownStudent.avg_overall)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDrilldown}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', padding: '4px',
                  }}
                >
                  <X width={20} height={20} />
                </button>
              </div>

              {/* Panel body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {drilldownLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
                    Loading reviews...
                  </div>
                ) : drilldownReviews.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
                    No reviews received yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {drilldownReviews.map((review, i) => (
                      <div
                        key={`${review.reviewer_name}-${i}`}
                        style={{
                          border: '1px solid var(--glass-border)', borderRadius: '0',
                          padding: '14px 16px', background: 'var(--surface-input)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                            {review.reviewer_name}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem' }}>
                            {new Date(review.submitted_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Score badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {Object.entries(review.scores).map(([cat, score]) => {
                            const numScore = Number(score);
                            let badgeColor = 'var(--success)';
                            let badgeBg = 'rgba(61,187,121,0.12)';
                            let badgeBorder = 'rgba(61,187,121,0.25)';
                            if (numScore <= 2) {
                              badgeColor = 'var(--danger)';
                              badgeBg = 'rgba(224,92,92,0.12)';
                              badgeBorder = 'rgba(224,92,92,0.25)';
                            } else if (numScore === 3) {
                              badgeColor = 'var(--uconn-orange)';
                              badgeBg = 'rgba(232,119,34,0.12)';
                              badgeBorder = 'rgba(232,119,34,0.25)';
                            }
                            return (
                              <span
                                key={cat}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '0',
                                  fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                                  background: badgeBg, color: badgeColor,
                                  border: `1px solid ${badgeBorder}`,
                                }}
                              >
                                {cat}: {numScore}
                              </span>
                            );
                          })}
                        </div>

                        {/* Comment */}
                        {review.comment && (
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(75,159,225,0.03)',
                            border: '1px solid rgba(75,159,225,0.08)',
                            borderRadius: '0',
                          }}>
                            <p style={{
                              color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace',
                              fontSize: '0.75rem', lineHeight: '1.6', margin: 0,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {review.comment}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
