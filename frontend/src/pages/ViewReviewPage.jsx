import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../services/api';

export default function ViewReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get(`/reviews/by-submission/${submissionId}`);
        setSubmission(res.data.submission);
        setReviews(res.data.reviews);
      } catch (err) {
        console.error('Error loading reviews:', err);
        setError('Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [submissionId]);

  if (loading) {
    return <div className="empty-state"><p>Loading reviews...</p></div>;
  }

  if (error) {
    return (
      <div className="card empty-state">
        <h3>Error</h3>
        <p className="error-text" role="alert" aria-live="assertive">{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Review Feedback</h1>
      {submission && (
        <p className="page-subtitle">
          Reviews for: <strong>{submission.title}</strong>
        </p>
      )}

      {submission?.file_url && (
        <div className="text-center mb-24">
          <a
            href={submission.file_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            Download Your Submission
          </a>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="card empty-state">
          <h3>No reviews yet</h3>
          <p>Your submission has not been reviewed yet. Check back later.</p>
        </div>
      ) : (
        reviews.map((review, idx) => (
          <motion.div
            key={review.review_id}
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <div className="flex-between">
              <div>
                <h3 className="card-title">
                  Review by {review.reviewer_name}
                </h3>
                <p className="card-muted">
                  {new Date(review.created_at).toLocaleString()}
                </p>
              </div>
              <div className="score-badge">{review.score}</div>
            </div>

            {review.comments && (
              <div className="mt-16">
                <label className="form-label">Feedback</label>
                <p className="line-height-relaxed">{review.comments}</p>
              </div>
            )}
          </motion.div>
        ))
      )}

      <div className="text-center mt-24">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
