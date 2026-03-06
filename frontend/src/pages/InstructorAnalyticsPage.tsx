import { useState, useEffect } from 'react';
import { BarChart2, X } from 'lucide-react';
import type { Course, CourseTeamAnalytics, TeamAnalyticsRow } from '../types';
import { apiFetch } from '../utils/api';

// ─── Team Analytics Component ─────────────────────────────────────────────────

interface TeamAnalyticsTabProps {
  data: CourseTeamAnalytics | null;
  loading: boolean;
  error: string | null;
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  onRetry: () => void;
}

function TeamAnalyticsTab({ data, loading, error, selectedTeam, onTeamChange, onRetry }: TeamAnalyticsTabProps) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry} style={{ fontSize: '0.78rem' }}>Retry</button>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <BarChart2 width={36} height={36} strokeWidth={1.2} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '8px' }}>
          No analytics data yet.
        </p>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
          Make sure the course has a CSV roster uploaded and weeks with teams assigned.
        </p>
      </div>
    );
  }

  const filteredRows: TeamAnalyticsRow[] = selectedTeam === 'ALL'
    ? data.rows
    : data.rows.filter(r => r.team_key === selectedTeam);

  const filteredTeams = selectedTeam === 'ALL' ? data.teams : [selectedTeam];

  const validOveralls = filteredRows.filter(r => r.avg_overall !== null).map(r => Number(r.avg_overall));
  const grandAvg = validOveralls.length > 0
    ? validOveralls.reduce((s, v) => s + v, 0) / validOveralls.length
    : null;
  const totalReviews = filteredRows.reduce((s, r) => s + (r.n_reviews || 0), 0);

  const summaryCards = [
    {
      label: 'Teams Tracked',
      value: filteredTeams.length.toString(),
      sub: selectedTeam === 'ALL' ? 'across all teams' : selectedTeam,
    },
    {
      label: 'Avg Overall Score',
      value: grandAvg !== null ? Number(grandAvg).toFixed(2) : '—',
      sub: 'across filtered rows',
    },
    {
      label: 'Total Reviews',
      value: totalReviews.toString(),
      sub: 'collected',
    },
  ];

  const teamSummaries = filteredTeams.map(teamKey => {
    const teamRows = filteredRows.filter(r => r.team_key === teamKey);
    const weekScores = teamRows.map(r => ({ week: r.week_number, avg: r.avg_overall }));

    const catTotals: Record<string, { sum: number; count: number }> = {};
    for (const row of teamRows) {
      for (const [cat, val] of Object.entries(row.per_category_json || {})) {
        if (!catTotals[cat]) catTotals[cat] = { sum: 0, count: 0 };
        catTotals[cat].sum += Number(val);
        catTotals[cat].count += 1;
      }
    }
    const catAvgs: Record<string, number> = {};
    for (const [cat, { sum, count }] of Object.entries(catTotals)) {
      catAvgs[cat] = sum / count;
    }

    return { teamKey, weekScores, catAvgs };
  });

  const tdStyle = {
    padding: '9px 12px',
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--glass-border)',
  } as const;

  const thStyle = {
    padding: '9px 12px',
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: '#f8f9fb',
    borderBottom: '2px solid var(--glass-border)',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Filter by Team:
        </span>
        <select
          value={selectedTeam}
          onChange={e => onTeamChange(e.target.value)}
          style={{
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '0.78rem',
            color: 'var(--text-primary)',
            background: 'var(--surface-card)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--border-radius-xs)',
            padding: '6px 12px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="ALL">All Teams</option>
          {data.teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {selectedTeam !== 'ALL' && (
          <button
            type="button"
            onClick={() => onTeamChange('ALL')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X width={12} height={12} />
            Clear
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {summaryCards.map(card => (
          <div key={card.label} className="card" style={{ padding: '20px 22px' }}>
            <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              {card.label}
            </p>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 4px 0' }}>
              {card.value}
            </p>
            <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Per-Week Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: '#f8f9fb', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 width={16} height={16} strokeWidth={1.6} style={{ color: 'var(--tech-blue)' }} />
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Week-by-Week Breakdown
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Week</th>
                <th style={thStyle}>Team</th>
                <th style={{ ...thStyle, color: 'var(--tech-blue)' }}>Overall Avg</th>
                {data.categories.map(cat => (
                  <th key={cat} style={thStyle}>{cat}</th>
                ))}
                <th style={thStyle}>Reviews</th>
                <th style={thStyle}>Completion</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const completion = row.total_students > 0
                  ? Math.round((row.submitted_students / row.total_students) * 100)
                  : 0;
                return (
                  <tr
                    key={`${row.week_id}-${row.team_key}`}
                    style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,0,0,0.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'; }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Wk {row.week_number}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: 'rgba(75,159,225,0.08)', color: 'var(--tech-blue)', border: '1px solid rgba(75,159,225,0.15)', borderRadius: '4px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 600 }}>
                        {row.team_key}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: row.avg_overall !== null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {row.avg_overall !== null ? Number(row.avg_overall).toFixed(2) : '—'}
                    </td>
                    {data.categories.map(cat => (
                      <td key={cat} style={tdStyle}>
                        {row.per_category_json && row.per_category_json[cat] !== undefined
                          ? Number(row.per_category_json[cat]).toFixed(2)
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                    ))}
                    <td style={tdStyle}>{row.n_reviews}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', minWidth: '60px' }}>
                          <div style={{
                            height: '100%',
                            width: `${completion}%`,
                            background: completion === 100 ? 'var(--success)' : completion >= 50 ? 'var(--uconn-orange)' : 'var(--tech-blue)',
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', minWidth: '36px' }}>
                          {row.submitted_students}/{row.total_students}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Summary Cards */}
      <div>
        <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Team Summaries
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {teamSummaries.map(({ teamKey, weekScores, catAvgs }) => {
            const overallVals = weekScores.filter(w => w.avg !== null).map(w => Number(w.avg));
            const teamGrandAvg = overallVals.length > 0
              ? overallVals.reduce((s, v) => s + v, 0) / overallVals.length
              : null;

            return (
              <div key={teamKey} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {teamKey}
                  </span>
                  {teamGrandAvg !== null && (
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--uconn-orange)', background: 'rgba(255,188,14,0.1)', border: '1px solid rgba(255,188,14,0.2)', borderRadius: '4px', padding: '2px 8px' }}>
                      {Number(teamGrandAvg).toFixed(2)} avg
                    </span>
                  )}
                </div>

                {weekScores.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Weekly Scores
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {weekScores.sort((a, b) => a.week - b.week).map(ws => (
                        <div key={ws.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{
                            fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 700,
                            color: ws.avg !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                            background: ws.avg !== null ? 'rgba(59,125,216,0.08)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${ws.avg !== null ? 'rgba(59,125,216,0.15)' : 'rgba(0,0,0,0.08)'}`,
                            borderRadius: '4px',
                            padding: '3px 7px',
                          }}>
                            {ws.avg !== null ? Number(ws.avg).toFixed(1) : '—'}
                          </span>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                            W{ws.week}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(catAvgs).length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Category Averages
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {Object.entries(catAvgs).map(([cat, avg]) => (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {cat}
                          </span>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {Number(avg).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(catAvgs).length === 0 && weekScores.every(w => w.avg === null) && (
                  <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    No review data yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function InstructorAnalyticsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<CourseTeamAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');

  useEffect(() => {
    apiFetch<Course[]>('/courses')
      .then(data => {
        setCourses(data);
        if (data.length > 0) setSelectedCourseId(data[0].course_id);
      })
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
  }, []);

  function loadAnalytics(courseId: string) {
    if (!courseId) return;
    setLoading(true);
    setAnalyticsData(null);
    setError(null);
    setSelectedTeam('ALL');
    apiFetch<CourseTeamAnalytics>(`/courses/${courseId}/team-analytics`)
      .then(setAnalyticsData)
      .catch((e: any) => setError(e.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (selectedCourseId) loadAnalytics(selectedCourseId);
  }, [selectedCourseId]);

  const selectedCourse = courses.find(c => c.course_id === selectedCourseId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Page Header */}
      <div className="page-hero-band">
        <div>
          <h1>Team Analytics</h1>
          <p>Aggregate performance data across all weeks</p>
        </div>
        {!coursesLoading && courses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Course:
            </span>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--surface-card)',
                border: '1.5px solid var(--glass-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '8px 14px',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '220px',
              }}
            >
              {courses.map(c => (
                <option key={c.course_id} value={c.course_id}>
                  {c.name}{c.term ? ` · ${c.term}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Course meta strip */}
      {selectedCourse && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedCourse.term && (
            <span style={{
              background: 'rgba(255,188,14,0.12)',
              color: 'var(--uconn-orange)',
              border: '1px solid rgba(255,188,14,0.25)',
              borderRadius: 'var(--border-radius-xs)',
              padding: '3px 10px',
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}>
              {selectedCourse.term}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
            Created {new Date(selectedCourse.created_at).toLocaleDateString()}
          </span>
        </div>
      )}

      {coursesLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <BarChart2 width={36} height={36} strokeWidth={1.2} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
            No courses found. Create a course first.
          </p>
        </div>
      ) : (
        <TeamAnalyticsTab
          data={analyticsData}
          loading={loading}
          error={error}
          selectedTeam={selectedTeam}
          onTeamChange={setSelectedTeam}
          onRetry={() => loadAnalytics(selectedCourseId)}
        />
      )}
    </div>
  );
}
