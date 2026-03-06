import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import type { AssignedReview } from '../types';
import { apiFetch } from '../utils/api';

interface WeekGroup {
  week_id: string;
  week_number: number;
  course_id: string;
  course_name: string;
  closes_at: string;
  week_is_open: boolean;
  assignments: AssignedReview[];
}

interface CourseGroup {
  course_id: string;
  course_name: string;
  weeks: WeekGroup[];
}

export default function StudentReviewsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);

  useEffect(() => {
    apiFetch<AssignedReview[]>('/me/assigned-reviews')
      .then(data => {
        // Group by course, then by week
        const courseMap = new Map<string, CourseGroup>();
        for (const a of data) {
          if (!courseMap.has(a.course_id)) {
            courseMap.set(a.course_id, { course_id: a.course_id, course_name: a.course_name, weeks: [] });
          }
          const cg = courseMap.get(a.course_id)!;
          let wg = cg.weeks.find(w => w.week_id === a.week_id);
          if (!wg) {
            wg = { week_id: a.week_id, week_number: a.week_number, course_id: a.course_id, course_name: a.course_name, closes_at: a.closes_at, week_is_open: a.week_is_open, assignments: [] };
            cg.weeks.push(wg);
          }
          wg.assignments.push(a);
        }
        // Sort weeks by week_number desc within each course
        for (const cg of courseMap.values()) {
          cg.weeks.sort((a, b) => b.week_number - a.week_number);
        }
        setCourseGroups(Array.from(courseMap.values()));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-hero-band">
        <div>
          <h1>My Reviews</h1>
          <p>Peer reviews assigned to you</p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          Loading reviews...
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '4px', padding: '16px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && (courseGroups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'var(--surface-card)',
            border: '1px solid var(--glass-border)',
            borderRadius: '4px',
          }}
        >
          <ClipboardList width={40} height={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>No peer reviews due.</p>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Check back after your instructor opens a review week.
          </p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {courseGroups.map((cg, ci) => (
            <motion.div
              key={cg.course_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.08 }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                {cg.course_name}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {cg.weeks.map(wg => {
                  const submitted = wg.assignments.filter(a => a.status === 'SUBMITTED').length;
                  const total = wg.assignments.length;
                  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                  const hoursLeft = (new Date(wg.closes_at).getTime() - Date.now()) / 3600000;

                  // Urgency class and label
                  let urgencyClass = '';
                  let urgencyLabel = '';
                  let urgencyColor = '';
                  if (hoursLeft < 0) {
                    urgencyClass = '';
                    urgencyLabel = `Closed ${new Date(wg.closes_at).toLocaleDateString()}`;
                    urgencyColor = 'var(--text-muted)';
                  } else if (hoursLeft < 24) {
                    urgencyClass = 'urgency-critical';
                    urgencyLabel = `Due in ${Math.max(1, Math.round(hoursLeft))} hour${Math.round(hoursLeft) === 1 ? '' : 's'}`;
                    urgencyColor = 'var(--danger)';
                  } else if (hoursLeft < 72) {
                    urgencyClass = 'urgency-warning';
                    const daysLeft = Math.round(hoursLeft / 24);
                    urgencyLabel = `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
                    urgencyColor = 'var(--uconn-orange)';
                  } else {
                    urgencyLabel = `Due ${new Date(wg.closes_at).toLocaleDateString()}`;
                    urgencyColor = 'var(--text-muted)';
                  }

                  return (
                    <div
                      key={wg.week_id}
                      className={`card ${urgencyClass}`}
                      style={hoursLeft < 0 ? { opacity: 0.6 } : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Week {wg.week_number}</h3>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '4px',
                              fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                              background: wg.week_is_open ? 'rgba(61,187,121,0.12)' : 'rgba(100,100,120,0.12)',
                              color: wg.week_is_open ? 'var(--success)' : 'var(--text-muted)',
                              border: `1px solid ${wg.week_is_open ? 'rgba(61,187,121,0.25)' : 'rgba(100,100,120,0.2)'}`,
                            }}>
                              {wg.week_is_open ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                              {wg.week_is_open ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          <p style={{ color: urgencyColor, fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', margin: 0, fontWeight: hoursLeft < 24 && hoursLeft >= 0 ? 600 : 400 }}>
                            {urgencyLabel} · {submitted}/{total} submitted
                          </p>
                        </div>
                        {/* Progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '100px', height: '6px', background: 'rgba(75,159,225,0.12)', borderRadius: '4px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--uconn-orange)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>

                      {/* Assignment list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {wg.assignments.map(a => (
                          <div
                            key={a.assignment_id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 14px',
                              background: 'var(--surface-input)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {(() => {
                                const missed = a.status === 'PENDING' && !wg.week_is_open;
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
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 500 }}>
                                  {a.reviewee_name}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', marginLeft: '8px' }}>
                                  Team {a.team_key}
                                </span>
                              </div>
                            </div>
                            {(wg.week_is_open || a.status === 'SUBMITTED') && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => navigate(`/student/assignments/${a.assignment_id}`)}
                                style={{ padding: '7px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                {a.status === 'SUBMITTED' ? 'View' : 'Review'}
                                <ChevronRight width={13} height={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}
