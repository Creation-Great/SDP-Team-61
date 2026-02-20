import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { API_BASE_URL } from '../config';
import useFilteredList from '../hooks/useFilteredList';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import './PeerReviewResultsPage.css';

export default function PeerReviewResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  /* ── Averages: search by student name / team ── */
  const avgSearchKeys = useCallback((r) => [r.student_name, r.team], []);
  const avgList = useFilteredList(data?.averages ?? [], {
    searchKeys: avgSearchKeys,
    pageSize: 15,
  });

  /* ── Details: search + team filter + pagination ── */
  const detSearchKeys = useCallback(
    (d) => [d.reviewer_name, d.reviewee_name, d.team, d.individual_comments],
    [],
  );
  const detFilterFn = useCallback(
    (d, f) => (!f.team || String(d.team) === f.team) && (!f.selfOnly || d.is_self),
    [],
  );
  const detList = useFilteredList(data?.details ?? [], {
    searchKeys: detSearchKeys,
    filterFn: detFilterFn,
    pageSize: 20,
  });

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/results`)
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || 'Failed to load results';
        if (status === 403) {
          setError('Insufficient permissions. Your session may have changed — please log out and log back in as an instructor.');
        } else if (status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleExportCsv = () => {
    // Use credentials: 'include' to send the httpOnly cookie automatically
    const url = `${API_BASE_URL}/peer-review/sessions/${sessionId}/export-csv`;
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `peer-review-results-${sessionId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('Failed to download CSV'));
  };

  if (loading) {
    return <div className="empty-state"><p>Loading results...</p></div>;
  }

  if (error) {
    return (
      <div className="empty-state">
        <h3>Error</h3>
        <p>{error}</p>
        <div className="flex-row gap-10 mt-12" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Re-login
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/peer-review')}>
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const { session, averages, details, completion } = data;
  const totalTeams = completion.length;
  const completedTeams = completion.filter((c) => parseInt(c.submitted_count) >= parseInt(c.team_size)).length;
  const totalStudents = completion.reduce((sum, c) => sum + parseInt(c.team_size), 0);
  const submittedStudents = completion.reduce((sum, c) => sum + parseInt(c.submitted_count), 0);

  return (
    <div>
      <div className="flex-between flex-wrap gap-12 mb-8">
        <h1 className="page-title text-left mb-0">
          {session.title}
        </h1>
        <div className="flex-row gap-10">
          <button className="btn btn-primary" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/peer-review')}>
            Back
          </button>
        </div>
      </div>
      <p className="page-subtitle text-left">
        <span className={`chip ${session.is_open ? 'chip-submitted' : 'chip-completed'} mr-8`}>
          {session.is_open ? 'Open' : 'Closed'}
        </span>
        Created {new Date(session.created_at).toLocaleDateString()}
      </p>

      {/* Completion Progress */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="card-title">Completion Progress</h3>
        <p className="card-meta mb-12">
          {completedTeams}/{totalTeams} teams done · {submittedStudents}/{totalStudents} students submitted
        </p>

        {/* Progress bar */}
        <div className="progress-track">
          <div
            className={`progress-fill ${submittedStudents === totalStudents ? 'progress-fill--complete' : 'progress-fill--partial'}`}
            style={{ width: totalStudents > 0 ? `${(submittedStudents / totalStudents * 100)}%` : '0%' }}
          />
        </div>

        <div className="flex-wrap gap-8">
          {completion.map((c) => {
            const done = parseInt(c.submitted_count) >= parseInt(c.team_size);
            return (
              <span
                key={c.team}
                className={`chip ${done ? 'chip-completed' : 'chip-pending'}`}
              >
                Team {c.team}: {c.submitted_count}/{c.team_size} {done ? '✅' : '⚠️'}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Averages Table */}
      <motion.div
        className="card mb-20 overflow-x-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="card-title mb-16">Averages per Student</h3>
        {averages.length === 0 ? (
          <p className="card-muted">No reviews submitted yet.</p>
        ) : (
          <>
            <div className="list-toolbar">
              <SearchInput
                value={avgList.query}
                onChange={avgList.setQuery}
                placeholder="Search by name, team…"
              />
            </div>
            <table className="table-full" style={{ fontSize: '0.95rem' }}>
              <caption className="sr-only">Peer review score averages by student</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="results-th">Team</th>
                  <th scope="col" className="results-th">Name</th>
                  <th scope="col" className="results-th">Technical</th>
                  <th scope="col" className="results-th">Interactions</th>
                  <th scope="col" className="results-th">Management</th>
                  <th scope="col" className="results-th">Chemistry</th>
                  <th scope="col" className="results-th">Reviews</th>
                </tr>
              </thead>
              <tbody>
                {avgList.pageItems.map((r, idx) => (
                  <motion.tr
                    key={r.reviewee_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b-subtle"
                  >
                    <td className="results-td">{r.team || '—'}</td>
                    <td className="results-td">{r.student_name}</td>
                    <td className="results-td results-td--center">{r.avg_technical ?? '—'}</td>
                    <td className="results-td results-td--center">{r.avg_interactions ?? '—'}</td>
                    <td className="results-td results-td--center">{r.avg_management ?? '—'}</td>
                    <td className="results-td results-td--center">{r.avg_team_chemistry ?? '—'}</td>
                    <td className="results-td results-td--center">{r.review_count}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={avgList.page}
              totalPages={avgList.totalPages}
              onPageChange={avgList.setPage}
              filtered={avgList.filtered.length}
              total={avgList.total}
              noun="students"
            />
          </>
        )}
      </motion.div>

      {/* Raw Details Toggle */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          <h3 className="card-title mb-0">Raw Review Details</h3>
          <span className="details-toggle__arrow">
            {showDetails ? '▲' : '▼'}
          </span>
        </div>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-16 overflow-x-auto"
          >
            {details.length === 0 ? (
              <p className="card-muted">No raw data available.</p>
            ) : (
              <>
                <div className="list-toolbar">
                  <SearchInput
                    value={detList.query}
                    onChange={detList.setQuery}
                    placeholder="Search reviews…"
                  />
                  <select
                    className="select-sm"
                    value={detList.filters.team || ''}
                    onChange={(e) => detList.setFilters((f) => ({ ...f, team: e.target.value }))}
                  >
                    <option value="">All teams</option>
                    {[...new Set(details.map((d) => d.team).filter(Boolean))].sort().map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className="flex-center gap-4 text-sm">
                    <input
                      type="checkbox"
                      checked={!!detList.filters.selfOnly}
                      onChange={(e) => detList.setFilters((f) => ({ ...f, selfOnly: e.target.checked }))}
                    />
                    Self-reviews only
                  </label>
                </div>
                <table className="table-full text-sm">
                  <caption className="sr-only">Individual peer review detail records</caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="results-th">Team</th>
                      <th scope="col" className="results-th">Reviewer</th>
                      <th scope="col" className="results-th">Reviewee</th>
                      <th scope="col" className="results-th">Self?</th>
                      <th scope="col" className="results-th">Technical</th>
                      <th scope="col" className="results-th">Interactions</th>
                      <th scope="col" className="results-th">Management</th>
                      <th scope="col" className="results-th">Chemistry</th>
                      <th scope="col" className="results-th">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detList.pageItems.map((d, idx) => (
                      <tr key={idx} className="border-b-subtle">
                        <td className="results-td">{d.team || '—'}</td>
                        <td className="results-td">{d.reviewer_name}</td>
                        <td className="results-td">{d.reviewee_name}</td>
                        <td className="results-td results-td--center">{d.is_self ? 'Y' : 'N'}</td>
                        <td className="results-td results-td--center">{d.technical_contributions}</td>
                        <td className="results-td results-td--center">{d.team_interactions}</td>
                        <td className="results-td results-td--center">{d.project_management}</td>
                        <td className="results-td results-td--center">{d.team_chemistry ?? '—'}</td>
                        <td className="results-td results-td--ellipsis">
                          {d.individual_comments || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={detList.page}
                  totalPages={detList.totalPages}
                  onPageChange={detList.setPage}
                  filtered={detList.filtered.length}
                  total={detList.total}
                  noun="reviews"
                />
              </>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
