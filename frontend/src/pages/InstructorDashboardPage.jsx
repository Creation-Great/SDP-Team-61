import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../services/api';
import useFilteredList from '../hooks/useFilteredList';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';

const TABS = ['overview', 'submissions', 'participation', 'csv aggregate'];

export default function InstructorDashboardPage() {
  const [submissions, setSubmissions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  /* ── M1: Weekly trends from /instructor/overview ── */
  const [weeklyTrends, setWeeklyTrends] = useState([]);

  /* ── M2: Assign reviewer state ── */
  const [students, setStudents] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);   // submission_id being assigned
  const [assignReviewerId, setAssignReviewerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState({ type: '', text: '' });

  /* ── M3: CSV aggregate state ── */
  const csvInputRef = useRef(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState('');

  /* ── Submissions: search + status filter + pagination ── */
  const subSearchKeys = useCallback((s) => [s.title, s.student_name, s.student_email], []);
  const subFilterFn = useCallback((s, f) => !f.status || s.status === f.status, []);
  const subs = useFilteredList(submissions, {
    searchKeys: subSearchKeys,
    filterFn: subFilterFn,
    pageSize: 10,
  });

  /* ── Participation: search + pagination ── */
  const partSearchKeys = useCallback((s) => [s.name, s.group_id], []);
  const participation = useFilteredList(dashboard?.student_participation ?? [], {
    searchKeys: partSearchKeys,
    pageSize: 15,
  });

  useEffect(() => {
    Promise.all([
      API.get('/submissions/all').then((r) => r.data),
      API.get('/instructor/unified-dashboard').then((r) => r.data).catch(() => null),
      API.get('/instructor/overview').then((r) => r.data).catch(() => []),
      API.get('/instructor/checkins/students').then((r) => r.data).catch(() => []),
    ])
      .then(([subs, dash, trends, studs]) => {
        setSubmissions(subs);
        setDashboard(dash);
        setWeeklyTrends(Array.isArray(trends) ? trends : []);
        setStudents(Array.isArray(studs) ? studs : []);
      })
      .catch((err) => console.error('Error loading dashboard:', err))
      .finally(() => setLoading(false));
  }, []);

  /* ── M2: assign reviewer handler ── */
  const handleAssign = async () => {
    if (!assignTarget || !assignReviewerId) return;
    setAssigning(true);
    setAssignMsg({ type: '', text: '' });
    try {
      const res = await API.post('/instructor/assign', {
        submission_id: assignTarget,
        reviewer_id: assignReviewerId,
      });
      if (res.data.note === 'already_assigned') {
        setAssignMsg({ type: 'warn', text: `Already assigned (${res.data.status}).` });
      } else {
        setAssignMsg({ type: 'ok', text: 'Reviewer assigned successfully.' });
        // Refresh submissions to reflect new assignment count
        API.get('/submissions/all').then((r) => setSubmissions(r.data)).catch(() => {});
      }
    } catch (err) {
      setAssignMsg({ type: 'err', text: err.response?.data?.message || 'Assignment failed.' });
    } finally {
      setAssigning(false);
    }
  };

  /* ── M3: CSV aggregate upload handler ── */
  const handleCsvUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCsvUploading(true);
    setCsvError('');
    setCsvResult(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await API.post('/instructor/peer-review/aggregate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvResult(res.data);
    } catch (err) {
      setCsvError(err.response?.data?.message || 'CSV aggregation failed.');
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Instructor Dashboard</h1>
      <p className="page-subtitle">Unified view of all review activity.</p>

      {/* Tabs */}
      <div className="flex-row gap-8 mb-20">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`btn capitalize ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div>
          <div className="stats-grid mb-24">
            <StatCard label="Submissions" value={dashboard.file_reviews.total_submissions} />
            <StatCard label="Reviews Assigned" value={dashboard.file_reviews.total_assigned} />
            <StatCard label="Reviews Completed" value={dashboard.file_reviews.total_completed} />
            <StatCard
              label="File Review Rate"
              value={`${Math.round(dashboard.file_reviews.completion_rate * 100)}%`}
            />
            <StatCard label="Peer Sessions" value={dashboard.peer_reviews.total_sessions} />
            <StatCard label="Open Sessions" value={dashboard.peer_reviews.open_sessions} />
            <StatCard label="Peer Reviews" value={dashboard.peer_reviews.total_reviews} />
          </div>

          {/* M1 — Weekly Trends from /instructor/overview */}
          {weeklyTrends.length > 0 && (
            <motion.div
              className="card overflow-x-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h3 className="card-title mb-12">Weekly Trends</h3>
              <table className="table-full" style={{ fontSize: '0.9rem' }}>
                <caption className="sr-only">Weekly submission trends by course and group</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" style={thStyle}>Week</th>
                    <th scope="col" style={thStyle}>Course</th>
                    <th scope="col" style={thStyle}>Group</th>
                    <th scope="col" style={thStyle}>Submissions</th>
                    <th scope="col" style={thStyle}>Assignments</th>
                    <th scope="col" style={thStyle}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyTrends.map((row, i) => (
                    <tr key={i} className="border-b-subtle">
                      <td style={tdStyle}>
                        {row.wk ? new Date(row.wk).toLocaleDateString() : '—'}
                      </td>
                      <td style={tdStyle}>{row.course_id || '—'}</td>
                      <td style={tdStyle}>{row.group_id || '—'}</td>
                      <td style={tdStyle}>{row.submissions}</td>
                      <td style={tdStyle}>{row.assignments}</td>
                      <td style={tdStyle}>{row.reviews_completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'overview' && !dashboard && (
        <div className="card empty-state">
          <p>Unified dashboard data unavailable.</p>
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        <div>
          {submissions.length === 0 ? (
            <div className="card empty-state">
              <h3>No submissions yet</h3>
              <p>Student submissions will appear here once uploaded.</p>
            </div>
          ) : (
            <div>
              <div className="list-toolbar">
                <SearchInput
                  value={subs.query}
                  onChange={subs.setQuery}
                  placeholder="Search by title, student…"
                />
                <select
                  className="form-select"
                  value={subs.filters.status || ''}
                  onChange={(e) => subs.setFilters({ ...subs.filters, status: e.target.value || undefined })}
                  style={{ maxWidth: '160px' }}
                >
                  <option value="">All statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </div>

              {subs.pageItems.map((s, idx) => (
                <motion.div
                  key={s.submission_id}
                  className="card"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <div className="flex-between-start">
                    <div>
                      <h3 className="card-title">{s.title}</h3>
                      <p className="card-meta">
                        <strong>Student:</strong> {s.student_name} ({s.student_email})
                      </p>
                    </div>
                    <span className={`chip chip-${s.status}`}>
                      {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                    </span>
                  </div>

                  <div className="mt-12 flex-center gap-16">
                    <span className="card-meta">
                      Assigned: {s.assigned_count || 0}
                    </span>
                    <span className="card-meta">
                      Completed: {s.completed_count || 0}
                    </span>
                    <span className="card-muted">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>

                  {s.file_url && (
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm mt-12"
                    >
                      Download File
                    </a>
                  )}

                  {/* M2 — Assign Reviewer */}
                  <div className="mt-12">
                    {assignTarget === s.submission_id ? (
                      <div className="flex-center flex-wrap gap-8">
                        <select
                          className="form-select"
                          value={assignReviewerId}
                          onChange={(e) => setAssignReviewerId(e.target.value)}
                          style={{ maxWidth: '220px' }}
                        >
                          <option value="">Select reviewer…</option>
                          {students
                            .filter((st) => st.user_id !== s.user_id)
                            .map((st) => (
                              <option key={st.user_id} value={st.user_id}>
                                {st.display_name} ({st.email})
                              </option>
                            ))}
                        </select>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!assignReviewerId || assigning}
                          onClick={handleAssign}
                        >
                          {assigning ? 'Assigning…' : 'Confirm'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setAssignTarget(null); setAssignMsg({ type: '', text: '' }); }}
                        >
                          Cancel
                        </button>
                        {assignMsg.text && assignTarget === s.submission_id && (
                          <span className={
                            assignMsg.type === 'ok' ? 'success-text' :
                            assignMsg.type === 'warn' ? 'card-muted' : 'error-text'
                          }>{assignMsg.text}</span>
                        )}
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setAssignTarget(s.submission_id);
                          setAssignReviewerId('');
                          setAssignMsg({ type: '', text: '' });
                        }}
                      >
                        Assign Reviewer
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              <Pagination
                page={subs.page}
                totalPages={subs.totalPages}
                onPageChange={subs.setPage}
                filtered={subs.filtered.length}
                total={subs.total}
                noun="submissions"
              />
            </div>
          )}
        </div>
      )}

      {/* Participation Tab */}
      {activeTab === 'participation' && dashboard?.student_participation && (
        <div className="card overflow-x-auto">
          <h3 className="card-title mb-12">Student Participation</h3>

          <div className="list-toolbar">
            <SearchInput
              value={participation.query}
              onChange={participation.setQuery}
              placeholder="Search by name, group…"
            />
          </div>

          <table className="table-full" style={{ fontSize: '0.9rem' }}>
            <caption className="sr-only">Student participation overview for file and peer reviews</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" style={thStyle}>Student</th>
                <th scope="col" style={thStyle}>Group</th>
                <th scope="col" style={thStyle}>File Given</th>
                <th scope="col" style={thStyle}>File Recv</th>
                <th scope="col" style={thStyle}>Avg File Score</th>
                <th scope="col" style={thStyle}>Peer Given</th>
                <th scope="col" style={thStyle}>Peer Recv</th>
                <th scope="col" style={thStyle}>Avg Peer Score</th>
              </tr>
            </thead>
            <tbody>
              {participation.pageItems.map((s) => (
                <tr key={s.user_id} className="border-b-subtle">
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.group_id || '—'}</td>
                  <td style={tdStyle}>{s.file_reviews_given}</td>
                  <td style={tdStyle}>{s.file_reviews_received}</td>
                  <td style={tdStyle}>{s.avg_file_score_received ?? '—'}</td>
                  <td style={tdStyle}>{s.peer_reviews_given}</td>
                  <td style={tdStyle}>{s.peer_reviews_received}</td>
                  <td style={tdStyle}>{s.avg_peer_score_received ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {dashboard.student_participation.length === 0 && (
            <p className="card-muted text-center mt-12">
              No student data available.
            </p>
          )}

          <Pagination
            page={participation.page}
            totalPages={participation.totalPages}
            onPageChange={participation.setPage}
            filtered={participation.filtered.length}
            total={participation.total}
            noun="students"
          />
        </div>
      )}

      {/* M3 — CSV Aggregate Tab */}
      {activeTab === 'csv aggregate' && (
        <div>
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="card-title mb-12">Peer Review CSV Aggregation</h3>
            <p className="card-meta mb-16">
              Upload one or more peer-review CSV files to compute aggregated averages per student
              across all scoring categories.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="csv-agg-upload">CSV Files (up to 30)</label>
              <input
                id="csv-agg-upload"
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={handleCsvUpload}
                disabled={csvUploading}
              />
            </div>

            {csvUploading && <p className="card-meta">Uploading &amp; processing…</p>}
            {csvError && <p className="error-text" role="alert" aria-live="assertive">{csvError}</p>}
          </motion.div>

          {csvResult && (
            <motion.div
              className="card mt-16 overflow-x-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Summary */}
              <div className="stats-grid mb-16">
                <StatCard label="Files Processed" value={csvResult.summary.files_processed} />
                <StatCard label="Evaluations" value={csvResult.summary.evaluations_count} />
                <StatCard label="Rows Skipped" value={csvResult.summary.skipped_rows} />
              </div>

              {/* Category averages */}
              {csvResult.categories?.length > 0 && (
                <>
                  <h4 className="card-title mb-8">Category Averages</h4>
                  <table className="table-full mb-16" style={{ fontSize: '0.9rem' }}>
                    <caption className="sr-only">Category averages from CSV upload results</caption>
                    <thead>
                      <tr className="border-b text-left">
                        <th scope="col" style={thStyle}>Category</th>
                        <th scope="col" style={thStyle}>Average</th>
                        <th scope="col" style={thStyle}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvResult.categories.map((c) => (
                        <tr key={c.key} className="border-b-subtle">
                          <td style={tdStyle}>{c.label}</td>
                          <td style={tdStyle}>{c.average !== null ? c.average.toFixed(2) : '—'}</td>
                          <td style={tdStyle}>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Per-student results */}
              {csvResult.students?.length > 0 && (
                <>
                  <h4 className="card-title mb-8">Per-Student Results</h4>
                  <table className="table-full mb-16" style={{ fontSize: '0.9rem' }}>
                    <caption className="sr-only">Per-student scores by category from CSV upload</caption>
                    <thead>
                      <tr className="border-b text-left">
                        <th scope="col" style={thStyle}>Team</th>
                        <th scope="col" style={thStyle}>Student</th>
                        {csvResult.categories?.map((c) => (
                          <th scope="col" key={c.key} style={thStyle}>{c.label}</th>
                        ))}
                        <th scope="col" style={thStyle}>Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvResult.students.map((s, i) => (
                        <tr key={i} className="border-b-subtle">
                          <td style={tdStyle}>{s.team || '—'}</td>
                          <td style={tdStyle}>{s.student_name}</td>
                          {csvResult.categories?.map((c) => (
                            <td key={c.key} style={tdStyle}>
                              {s.per_category?.[c.key]?.average !== null
                                ? s.per_category[c.key].average.toFixed(2)
                                : '—'}
                            </td>
                          ))}
                          <td style={tdStyle}>
                            {s.overall_average !== null ? s.overall_average.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* File reports */}
              {csvResult.file_reports?.length > 0 && (
                <>
                  <h4 className="card-title mb-8">File Reports</h4>
                  <table className="table-full" style={{ fontSize: '0.9rem' }}>
                    <caption className="sr-only">CSV file processing reports</caption>
                    <thead>
                      <tr className="border-b text-left">
                        <th scope="col" style={thStyle}>File</th>
                        <th scope="col" style={thStyle}>Rows Processed</th>
                        <th scope="col" style={thStyle}>Rows Skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvResult.file_reports.map((f, i) => (
                        <tr key={i} className="border-b-subtle">
                          <td style={tdStyle}>{f.file_name}</td>
                          <td style={tdStyle}>{f.rows_processed}</td>
                          <td style={tdStyle}>{f.rows_skipped}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <motion.div
      className="card stat-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="stat-value">{value}</div>
      <div className="card-muted mt-4">{label}</div>
    </motion.div>
  );
}

const thStyle = { padding: '8px 12px', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px' };
