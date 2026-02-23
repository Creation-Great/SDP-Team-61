import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import type { Submission } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';

export default function StudentDashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get<Submission[]>('/submissions/mine')
      .then(res => setSubmissions(res.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>
            Loading submissions...
          </p>
        </motion.div>
      </div>
    );
  }

  const reviewed = submissions.filter(s => s.status === 'reviewed').length;
  const pending = submissions.length - reviewed;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Your Submissions" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Track your uploaded assignments and review status.
        </p>
      </div>

      {/* Stats strip */}
      {submissions.length > 0 && (
        <motion.div
          className="stats-strip"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{submissions.length}</div>
            <div className="stat-sub">assignments</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reviewed</div>
            <div className="stat-value" style={{ color: 'var(--success)', textShadow: '0 0 16px rgba(61,187,121,0.4)' }}>
              {reviewed}
            </div>
            <div className="stat-sub">completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: 'var(--uconn-orange)', textShadow: '0 0 16px rgba(232,119,34,0.4)' }}>
              {pending}
            </div>
            <div className="stat-sub">awaiting review</div>
          </div>
        </motion.div>
      )}

      {submissions.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>📄</div>
          <h3 style={{ marginBottom: '8px' }}>No submissions yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Upload your first assignment to get started.
          </p>
          <button className="btn btn-cta" onClick={() => navigate('/upload')}>
            Upload Assignment
          </button>
        </motion.div>
      ) : (
        <div className="card-grid">
          {submissions.map((s, idx) => {
            const hasCompletedReview =
              s.reviews != null &&
              Array.isArray(s.reviews) &&
              s.reviews.some(r => r.review_id !== null);

            return (
              <motion.div
                key={s.submission_id}
                className="card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.015, y: -2 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 className="card-title" style={{ marginBottom: 0 }}>{s.title}</h3>
                  <span className={`chip chip-${s.status}`}>
                    {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                  </span>
                </div>

                {s.description && <p className="card-meta">{s.description}</p>}

                <p className="card-muted" style={{ marginTop: '6px' }}>
                  {new Date(s.created_at).toLocaleString()}
                </p>

                {s.reviews != null && s.reviews.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <span className="card-meta">
                      Reviews: {s.reviews.filter(r => r.review_id).length} / {s.reviews.length} completed
                    </span>
                  </div>
                )}

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  {s.file_url && (
                    <a href={s.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      Download
                    </a>
                  )}
                  {hasCompletedReview && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/view-review/${s.submission_id}`)}
                    >
                      View Reviews
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
