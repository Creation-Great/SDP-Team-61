import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Users,
  Calendar,
  TrendingUp,
  ChevronRight,
  PlusCircle,
  Upload,
  PlayCircle,
  BarChart3,
  AlertTriangle,
  ClipboardCheck,
  Flag,
  UserX,
  Zap,
} from 'lucide-react';
import type { CourseWithStats } from '../types';
import { apiFetch } from '../utils/api';
import { Skeleton } from '../components/Skeleton';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function completionColor(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--uconn-orange)';
  return 'var(--tech-blue)';
}

function completionGradient(pct: number): string {
  if (pct >= 80) return 'linear-gradient(90deg, var(--success), rgba(61,187,121,0.7))';
  if (pct >= 50) return 'linear-gradient(90deg, var(--uconn-orange), rgba(232,119,34,0.7))';
  return 'linear-gradient(90deg, var(--tech-blue), rgba(75,159,225,0.7))';
}

export default function InstructorOverviewPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const user: { name?: string; email?: string } = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();

  useEffect(() => {
    apiFetch<CourseWithStats[]>('/courses')
      .then(setCourses)
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.student_count) || 0), 0),
    [courses],
  );
  const totalActiveWeeks = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.active_week_count) || 0), 0),
    [courses],
  );
  // Raw assignment counts — used only for the "Reviews Submitted" snapshot widget
  const totalSubmitted = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.submitted_assignments) || 0), 0),
    [courses],
  );
  const totalAssignments = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.total_assignments) || 0), 0),
    [courses],
  );

  // Roster-based completion: students who fully submitted in closed weeks / total closed-week slots
  const totalCompletedStudents = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.completed_students_in_closed_weeks) || 0), 0),
    [courses],
  );
  const totalRosterSlots = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.total_students_in_closed_weeks) || 0), 0),
    [courses],
  );
  const overallPct = useMemo(
    () => totalRosterSlots > 0 ? Math.round((totalCompletedStudents / totalRosterSlots) * 100) : 0,
    [totalCompletedStudents, totalRosterSlots],
  );

  // Per-course roster-based completion percentage
  function coursePct(c: CourseWithStats): number {
    const total = Number(c.total_students_in_closed_weeks) || 0;
    if (total === 0) return 0;
    return Math.round((Number(c.completed_students_in_closed_weeks) / total) * 100);
  }

  const flaggedCourses = useMemo(
    () => courses.filter(c => {
      const total = Number(c.total_students_in_closed_weeks) || 0;
      const pct = total > 0
        ? Number(c.completed_students_in_closed_weeks) / total : 1;
      return pct < 0.4 && total > 0;
    }),
    [courses],
  );

  const atRiskCount = useMemo(
    () => Math.max(0, Math.round(
      flaggedCourses.reduce((s, c) => s + (Number(c.student_count) || 0), 0) * 0.15
    )),
    [flaggedCourses],
  );

  // Completion distribution histogram buckets: 0-20, 20-40, 40-60, 60-80, 80-100
  const histogram = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    courses.forEach(c => {
      const pct = coursePct(c);
      const idx = Math.min(4, Math.floor(pct / 20));
      buckets[idx]++;
    });
    return buckets;
  }, [courses]);

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => Number(b.active_week_count) - Number(a.active_week_count)),
    [courses],
  );

  // Most urgent course: active week + lowest roster-based completion
  const urgentCourse = useMemo(
    () => courses
      .filter(c => Number(c.active_week_count) > 0)
      .sort((a, b) => {
        const aPct = Number(a.total_students_in_closed_weeks) > 0
          ? Number(a.completed_students_in_closed_weeks) / Number(a.total_students_in_closed_weeks) : 1;
        const bPct = Number(b.total_students_in_closed_weeks) > 0
          ? Number(b.completed_students_in_closed_weeks) / Number(b.total_students_in_closed_weeks) : 1;
        return aPct - bPct;
      })[0] ?? null,
    [courses],
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const firstName = user.name?.split(' ')[0] ?? 'Instructor';

  const stats = [
    { label: 'Courses', value: courses.length, icon: <BookOpen width={20} height={20} />, color: 'var(--tech-blue)', sub: 'total' },
    { label: 'Students', value: totalStudents, icon: <Users width={20} height={20} />, color: 'var(--uconn-orange)', sub: 'enrolled' },
    { label: 'Active Weeks', value: totalActiveWeeks, icon: <Calendar width={20} height={20} />, color: 'var(--success)', sub: 'open now' },
    { label: 'Completion', value: `${overallPct}%`, icon: <TrendingUp width={20} height={20} />, color: completionColor(overallPct), sub: 'overall' },
  ];

  const quickActions = [
    { label: 'Create Course', icon: <PlusCircle width={15} height={15} />, color: 'var(--uconn-orange)', onClick: () => navigate('/instructor/courses') },
    { label: 'Upload CSV', icon: <Upload width={15} height={15} />, color: 'var(--tech-blue)', onClick: () => navigate('/instructor/courses') },
    { label: 'Start New Week', icon: <PlayCircle width={15} height={15} />, color: 'var(--success)', onClick: () => navigate('/instructor/courses') },
    { label: 'View Analytics', icon: <BarChart3 width={15} height={15} />, color: 'var(--text-secondary)', onClick: () => navigate('/instructor/analytics') },
  ];

  const statusSnapshot = [
    {
      label: 'Reviews Submitted',
      value: `${totalSubmitted} / ${totalAssignments}`,
      icon: <ClipboardCheck width={18} height={18} />,
      color: completionColor(overallPct),
      sub: `${overallPct}% completion rate`,
    },
    {
      label: 'Low-Completion Courses',
      value: flaggedCourses.length,
      icon: <Flag width={18} height={18} />,
      color: flaggedCourses.length > 0 ? 'var(--danger)' : 'var(--success)',
      sub: flaggedCourses.length > 0 ? 'below 40% — need attention' : 'all on track',
    },
    {
      label: 'At-Risk Students',
      value: atRiskCount,
      icon: <UserX width={18} height={18} />,
      color: atRiskCount > 0 ? 'var(--uconn-orange)' : 'var(--success)',
      sub: atRiskCount > 0 ? 'est. from low-completion courses' : 'none identified',
    },
  ];

  const histBucketColors = ['var(--danger)', 'var(--uconn-orange)', 'var(--uconn-orange)', 'var(--tech-blue)', 'var(--success)'];
  const histBucketLabels = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-hero-band">
        <div>
          <h1>
            {greeting()}, <span style={{ color: 'var(--uconn-orange)' }}>{firstName}</span>
          </h1>
          <p>Your program at a glance · {dateStr}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              type="button"
              onClick={action.onClick}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              whileTap={{ scale: 0.97 }}
              className="wooting-pill"
              style={{ border: '1.5px solid var(--glass-border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = action.color; (e.currentTarget as HTMLButtonElement).style.color = action.color; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--glass-border)'; (e.currentTarget as HTMLButtonElement).style.color = '#444'; }}
            >
              <span>{action.icon}</span>
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" height="82px" />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[...Array(3)].map((_, i) => <Skeleton key={i} variant="row" height="80px" />)}
          </div>
          <Skeleton variant="card" height="260px" />
          <Skeleton variant="card" height="220px" />
        </div>
      ) : (
        <>
          {/* ── Stat cards ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '22px 28px',
                  borderLeft: `3px solid ${stat.color}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
                whileHover={{ y: -2, boxShadow: '0 6px 28px rgba(0,0,0,0.10)' } as any}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ color: stat.color, opacity: 0.85 }}>{stat.icon}</span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {stat.label}
                  </span>
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '2.4rem', fontWeight: 700, color: stat.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {stat.sub}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Week Status Snapshot ──────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3 }}
            style={{ marginBottom: '16px' }}
          >
            <div style={{
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '10px',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <Zap width={13} height={13} style={{ color: 'var(--uconn-orange)' }} />
              Week Status Snapshot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {statusSnapshot.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--glass-border)',
                    borderTop: `3px solid ${item.color}`,
                    borderRadius: '12px',
                    padding: '20px 24px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '2rem', fontWeight: 700, color: item.color, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                    {item.value}
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    {item.sub}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {courses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
            >
              <BookOpen width={36} height={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>No courses yet</p>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', marginBottom: '20px' }}>
                Create your first course to get started.
              </p>
              <button type="button" className="btn btn-cta" onClick={() => navigate('/instructor/courses')} style={{ borderRadius: '12px' }}>
                Get Started
              </button>
            </motion.div>
          ) : (
            <>
              {/* ── Distribution Histogram + Alert Card (2-col) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

                {/* Score Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px 24px' }}
                >
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--uconn-orange)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                      Score Distribution
                    </div>
                    <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Completion by Range
                    </h2>
                  </div>

                  {/* Histogram */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '110px' }}>
                    {histBucketLabels.map((label, i) => {
                      const count = histogram[i];
                      const maxCount = Math.max(...histogram, 1);
                      const heightPct = (count / maxCount) * 100;
                      return (
                        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.60rem', fontWeight: 700, color: count > 0 ? histBucketColors[i] : 'var(--text-muted)' }}>
                            {count}
                          </span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(heightPct, count > 0 ? 8 : 0)}%` }}
                            transition={{ delay: 0.42 + i * 0.05, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                            style={{
                              width: '100%',
                              background: count > 0 ? histBucketColors[i] : 'rgba(75,159,225,0.1)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '12px',
                              minHeight: count > 0 ? '4px' : '2px',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {histBucketLabels.map(label => (
                      <span key={label} style={{ flex: 1, fontFamily: 'Roboto Mono, monospace', fontSize: '0.54rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Team comparison bars */}
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                      Course Comparison
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sortedCourses.slice(0, 4).map(course => {
                        const pct = coursePct(course);
                        return (
                          <div key={course.course_id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 44px', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {course.name.length > 15 ? course.name.slice(0, 15) + '…' : course.name}
                            </span>
                            <div style={{ height: '10px', background: 'rgba(75,159,225,0.08)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.5, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                                style={{ height: '100%', background: completionGradient(pct) }}
                              />
                            </div>
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.66rem', fontWeight: 700, color: completionColor(pct), textAlign: 'right' }}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>

                {/* Alert / Action Items */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.44, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle width={14} height={14} />
                      Needs Attention
                    </div>
                    <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Action Items
                    </h2>
                  </div>

                  {urgentCourse ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Most urgent course */}
                      <div style={{ padding: '16px 20px', background: 'rgba(232,119,34,0.07)', border: '1px solid rgba(232,119,34,0.25)', borderLeft: '3px solid var(--uconn-orange)', borderRadius: '12px' }}>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--uconn-orange)', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle width={13} height={13} />
                          Active week · low completion
                        </div>
                        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {urgentCourse.name}
                        </div>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {coursePct(urgentCourse)}% submitted · {Number(urgentCourse.active_week_count)} active week{Number(urgentCourse.active_week_count) !== 1 ? 's' : ''}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/instructor/courses/${urgentCourse.course_id}`)}
                          style={{ marginTop: '12px', padding: '6px 16px', background: 'var(--uconn-orange)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', fontWeight: 600, color: '#111', letterSpacing: '0.04em' }}
                        >
                          Review Course →
                        </button>
                      </div>

                      {/* Flagged courses */}
                      {flaggedCourses.length > 0 && (
                        <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderLeft: '3px solid var(--danger)', borderRadius: '12px' }}>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '3px' }}>
                            {flaggedCourses.length} course{flaggedCourses.length !== 1 ? 's' : ''} below 40% completion
                          </div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                            {flaggedCourses.map(c => c.name).join(', ')}
                          </div>
                        </div>
                      )}

                      {/* Summary numbers */}
                      <div style={{ padding: '12px 16px', background: '#f8f9fb', border: '1px solid var(--glass-border)', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Missing Reviews</div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>{totalAssignments - totalSubmitted}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Active Weeks</div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--uconn-orange)' }}>{totalActiveWeeks}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '32px 0', textAlign: 'center' }}>
                      <div style={{ width: '40px', height: '40px', background: 'rgba(61,187,121,0.1)', border: '1px solid rgba(61,187,121,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <TrendingUp width={20} height={20} style={{ color: 'var(--success)' }} />
                      </div>
                      <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.9rem' }}>All clear</p>
                      <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>No urgent issues detected.</p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* ── Course completion bar chart ──────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px 28px', marginBottom: '16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--uconn-orange)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                      Completion Rate
                    </div>
                    <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Course Progress
                    </h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {[
                      { color: 'var(--tech-blue)', label: 'Submitted' },
                      { color: 'rgba(75,159,225,0.15)', label: 'Remaining', border: '1px solid var(--glass-border)' },
                    ].map(l => (
                      <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                        <span style={{ width: '10px', height: '10px', background: l.color, border: (l as any).border, display: 'inline-block', borderRadius: '12px', flexShrink: 0 }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {sortedCourses.slice(0, 7).map((course, i) => {
                    const pct = coursePct(course);
                    return (
                      <div key={course.course_id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 52px', alignItems: 'center', gap: '14px' }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/instructor/courses/${course.course_id}`)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Montserrat, sans-serif', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s ease' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--tech-blue)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}
                        >
                          {course.name}
                        </button>
                        <div style={{ position: 'relative', height: '26px', background: 'rgba(75,159,225,0.07)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: completionGradient(pct), borderRadius: '12px' }}
                          />
                        </div>
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.80rem', fontWeight: 700, color: completionColor(pct), textAlign: 'right' }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* ── Courses table ──────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.56, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', background: '#f8f9fb', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    All Courses
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/instructor/courses')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tech-blue)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'opacity 0.15s ease' }}
                  >
                    Manage →
                  </button>
                </div>

                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Term</th>
                      <th style={{ textAlign: 'center' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Active Weeks</th>
                      <th style={{ textAlign: 'center' }}>Completion</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCourses.map((course) => {
                      const pct = coursePct(course);
                      return (
                        <tr key={course.course_id} onClick={() => navigate(`/instructor/courses/${course.course_id}`)} style={{ cursor: 'pointer' }}>
                          <td>
                            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '0.90rem' }}>{course.name}</span>
                          </td>
                          <td>
                            {course.term
                              ? <span className="chip gray">{course.term}</span>
                              : <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.74rem' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'Roboto Mono, monospace', fontSize: '0.86rem' }}>
                            {Number(course.student_count) || 0}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {Number(course.active_week_count) > 0
                              ? <span className="chip chip-submitted">{Number(course.active_week_count)}</span>
                              : <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.74rem' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.86rem', fontWeight: 700, color: completionColor(pct) }}>
                              {pct}%
                            </span>
                          </td>
                          <td>
                            <ChevronRight width={18} height={18} style={{ color: 'var(--text-muted)' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  );
}
