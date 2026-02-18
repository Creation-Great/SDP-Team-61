import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { API_BASE_URL } from '../config';

export default function PeerReviewResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/results`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load results'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleExportCsv = () => {
    const token = localStorage.getItem('token');
    // Open CSV download in a new tab with auth
    const url = `${API_BASE_URL}/peer-review/sessions/${sessionId}/export-csv`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
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
        <button className="btn btn-primary" onClick={() => navigate('/peer-review')}>
          Back to Sessions
        </button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <h1 className="page-title" style={{ textAlign: 'left', marginBottom: 0 }}>
          {session.title}
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/peer-review')}>
            Back
          </button>
        </div>
      </div>
      <p className="page-subtitle" style={{ textAlign: 'left' }}>
        <span className={`chip ${session.is_open ? 'chip-submitted' : 'chip-completed'}`} style={{ marginRight: '8px' }}>
          {session.is_open ? 'Open' : 'Closed'}
        </span>
        Created {new Date(session.created_at).toLocaleDateString()}
      </p>

      {/* Completion Progress */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h3 className="card-title">Completion Progress</h3>
        <p className="card-meta" style={{ marginBottom: '12px' }}>
          {completedTeams}/{totalTeams} teams done · {submittedStudents}/{totalStudents} students submitted
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <div style={{
            width: totalStudents > 0 ? `${(submittedStudents / totalStudents * 100)}%` : '0%',
            height: '100%',
            borderRadius: '4px',
            background: submittedStudents === totalStudents ? 'var(--success)' : 'var(--primary)',
            transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '20px', overflowX: 'auto' }}
      >
        <h3 className="card-title" style={{ marginBottom: '16px' }}>Averages per Student</h3>
        {averages.length === 0 ? (
          <p className="card-muted">No reviews submitted yet.</p>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.95rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Technical</th>
                <th style={thStyle}>Interactions</th>
                <th style={thStyle}>Management</th>
                <th style={thStyle}>Chemistry</th>
                <th style={thStyle}>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {averages.map((r, idx) => (
                <motion.tr
                  key={r.reviewee_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <td style={tdStyle}>{r.team || '—'}</td>
                  <td style={tdStyle}>{r.student_name}</td>
                  <td style={tdStyleNum}>{r.avg_technical ?? '—'}</td>
                  <td style={tdStyleNum}>{r.avg_interactions ?? '—'}</td>
                  <td style={tdStyleNum}>{r.avg_management ?? '—'}</td>
                  <td style={tdStyleNum}>{r.avg_team_chemistry ?? '—'}</td>
                  <td style={tdStyleNum}>{r.review_count}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
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
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowDetails(!showDetails)}
        >
          <h3 className="card-title" style={{ marginBottom: 0 }}>Raw Review Details</h3>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            {showDetails ? '▲' : '▼'}
          </span>
        </div>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: '16px', overflowX: 'auto' }}
          >
            {details.length === 0 ? (
              <p className="card-muted">No raw data available.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Reviewer</th>
                    <th style={thStyle}>Reviewee</th>
                    <th style={thStyle}>Self?</th>
                    <th style={thStyle}>Technical</th>
                    <th style={thStyle}>Interactions</th>
                    <th style={thStyle}>Management</th>
                    <th style={thStyle}>Chemistry</th>
                    <th style={thStyle}>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={tdStyle}>{d.team || '—'}</td>
                      <td style={tdStyle}>{d.reviewer_name}</td>
                      <td style={tdStyle}>{d.reviewee_name}</td>
                      <td style={tdStyleNum}>{d.is_self ? 'Y' : 'N'}</td>
                      <td style={tdStyleNum}>{d.technical_contributions}</td>
                      <td style={tdStyleNum}>{d.team_interactions}</td>
                      <td style={tdStyleNum}>{d.project_management}</td>
                      <td style={tdStyleNum}>{d.team_chemistry ?? '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.individual_comments || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px',
  color: 'var(--text-primary)',
};

const tdStyleNum = {
  padding: '10px 12px',
  color: 'var(--text-primary)',
  textAlign: 'center',
};
