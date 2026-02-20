import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../services/api';
import ScoreSelector from '../components/ScoreSelector';

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
        <p className="error-text" role="alert" aria-live="assertive">{error}</p>
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
              <div className="mt-12">
                <p className="card-meta">This file type cannot be previewed inline.</p>
                <a
                  href={review.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary mt-12"
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
              <p className="success-text mb-16">
                This review has already been submitted.
              </p>
              <div className="mb-12">
                <span className="card-meta">Score: </span>
                <span className="score-badge">{review.score}</span>
              </div>
              <div>
                <span className="card-meta">Comments:</span>
                <p className="mt-8">{review.comments}</p>
              </div>
            </div>
          ) : (
            // Review form
            <div>
              <div className="form-group">
                <ScoreSelector
                  label="Score (1-5)"
                  value={score}
                  onChange={setScore}
                />
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

              {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}

              <div className="flex-row gap-12">
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
