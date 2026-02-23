import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { AxiosError } from 'axios';
import API from '../services/api';
import type { Review } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [score, setScore] = useState(3);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get<Review>(`/reviews/${id}`)
      .then(res => setReview(res.data))
      .catch(err => { console.error('Failed to load review:', err); setError('Failed to load review details'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!comments.trim()) { setError('Please provide comments for your review.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await API.post(`/reviews/${id}/submit`, { score, comments });
      navigate('/reviews');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>Loading review...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="card empty-state">
        <h3>Error</h3>
        <p className="error-text">{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/reviews')}>Back to Reviews</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Review Assignment" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Reviewing: <strong style={{ color: 'var(--text-primary)' }}>{review?.title}</strong>{' '}
          by <span style={{ color: 'var(--tech-blue)' }}>{review?.student_name}</span>
        </p>
      </div>

      <div className="split-pane">
        {/* Left: Document viewer */}
        <motion.div
          className="card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ minHeight: '500px' }}
        >
          <h3 className="card-title">Document</h3>
          {review?.file_url ? (
            review.file_url.endsWith('.pdf') ? (
              <iframe
                src={review.file_url}
                title="Document Preview"
                style={{ width: '100%', height: '450px', border: 'none', borderRadius: '8px', background: 'white' }}
              />
            ) : (
              <div style={{ marginTop: '12px' }}>
                <p className="card-meta">This file type cannot be previewed inline.</p>
                <a href={review.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ marginTop: '12px' }}>
                  Download File
                </a>
              </div>
            )
          ) : (
            <p className="card-muted">No file available</p>
          )}
        </motion.div>

        {/* Right: Review form */}
        <motion.div
          className="card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h3 className="card-title">Your Review</h3>

          {review?.review_id ? (
            <div>
              <p className="success-text" style={{ marginBottom: '16px' }}>
                ✓ This review has already been submitted.
              </p>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="card-meta">Score:</span>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'var(--uconn-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#fff',
                  boxShadow: '0 0 12px rgba(232,119,34,0.4)',
                }}>
                  {review.score}
                </div>
              </div>
              <div>
                <span className="card-meta">Comments:</span>
                <p style={{ marginTop: '8px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{review.comments}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label className="form-label">Score (1–5)</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`score-btn${score === n ? ' active' : ''}`}
                      onClick={() => setScore(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="comments">Comments</label>
                <textarea
                  id="comments"
                  className="form-textarea"
                  placeholder="Provide detailed feedback on this submission..."
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={6}
                />
              </div>

              {error && <p className="error-text">{error}</p>}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-cta" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/reviews')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
