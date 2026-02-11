import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../services/api';

export default function ReviewPage() {
  const { id } = useParams(); // assignment_id
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [score, setScore] = useState(3);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get(`/reviews/${id}`)
      .then((res) => setReview(res.data))
      .catch((err) => {
        console.error('Failed to load review:', err);
        setError('Failed to load review details');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!comments.trim()) {
      setError('Please provide comments for your review.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await API.post(`/reviews/${id}/submit`, { score, comments });
      navigate('/reviews');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><p>Loading review...</p></div>;
  }

  if (error && !review) {
    return (
      <div className="card empty-state">
        <h3>Error</h3>
        <p className="error-text">{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/reviews')}>
          Back to Reviews
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Review Assignment</h1>
      <p className="page-subtitle">
        Reviewing: <strong>{review?.title}</strong> by {review?.student_name}
      </p>

      <div className="split-pane">
        {/* Left: Document viewer */}
        <motion.div
          className="card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ minHeight: '500px' }}
        >
          <h3 className="card-title">Document</h3>
          {review?.file_url ? (
            review.file_url.endsWith('.pdf') ? (
              <iframe
                src={review.file_url}
                title="Document Preview"
                style={{
                  width: '100%',
                  height: '450px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'white',
                }}
              />
            ) : (
              <div style={{ marginTop: '12px' }}>
                <p className="card-meta">This file type cannot be previewed inline.</p>
                <a
                  href={review.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ marginTop: '12px' }}
                >
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
        >
          <h3 className="card-title">Your Review</h3>

          {review?.review_id ? (
            // Already reviewed
            <div>
              <p className="success-text" style={{ marginBottom: '16px' }}>
                This review has already been submitted.
              </p>
              <div style={{ marginBottom: '12px' }}>
                <span className="card-meta">Score: </span>
                <span className="score-badge">{review.score}</span>
              </div>
              <div>
                <span className="card-meta">Comments:</span>
                <p style={{ marginTop: '8px' }}>{review.comments}</p>
              </div>
            </div>
          ) : (
            // Review form
            <div>
              <div className="form-group">
                <label className="form-label">Score (1-5)</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`btn ${score === n ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '10px 18px', fontSize: '1rem' }}
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
                  onChange={(e) => setComments(e.target.value)}
                  rows={6}
                />
              </div>

              {error && <p className="error-text">{error}</p>}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate('/reviews')}
                >
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
