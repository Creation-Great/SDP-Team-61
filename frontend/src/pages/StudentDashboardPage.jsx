import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function StudentDashboardPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/submissions/mine')
      .then((res) => setSubmissions(res.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading your submissions...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Your Submissions</h1>
      <p className="page-subtitle">Track your uploaded assignments and review status.</p>

      {submissions.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h3>No submissions yet</h3>
          <p>Upload your first assignment to get started.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/upload')}
          >
            Upload Assignment
          </button>
        </motion.div>
      ) : (
        submissions.map((s, idx) => {
          const hasCompletedReview = s.reviews && Array.isArray(s.reviews) &&
            s.reviews.some((r) => r.review_id !== null);

          return (
            <motion.div
              key={s.submission_id}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              whileHover={{ scale: 1.01 }}
            >
              <h3 className="card-title">{s.title}</h3>
              {s.description && (
                <p className="card-meta">{s.description}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <span className={`chip chip-${s.status}`}>
                  {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                </span>
                <span className="card-muted">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </div>

              {s.reviews && s.reviews.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span className="card-meta">
                    Reviews: {s.reviews.filter(r => r.review_id).length} / {s.reviews.length} completed
                  </span>
                </div>
              )}

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                {s.file_url && (
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.9rem', padding: '8px 16px' }}
                  >
                    Download File
                  </a>
                )}
                {hasCompletedReview && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.9rem', padding: '8px 16px' }}
                    onClick={() => navigate(`/view-review/${s.submission_id}`)}
                  >
                    View Reviews
                  </button>
                )}
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
