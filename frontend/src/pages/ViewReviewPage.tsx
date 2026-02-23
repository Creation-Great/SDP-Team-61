import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../services/api';
import type { ReceivedReview } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';

interface SubmissionInfo {
  title: string;
  file_url?: string;
}

export default function ViewReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get<{ submission: SubmissionInfo; reviews: ReceivedReview[] }>(
          `/reviews/by-submission/${submissionId}`
        );
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
    return (
      <div className="empty-state">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>Loading reviews...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card empty-state">
        <h3>Error</h3>
        <p className="error-text">{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Review Feedback" />
        </h1>
        <div className="page-title-accent" />
        {submission && (
          <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
            Reviews for: <strong style={{ color: 'var(--text-primary)' }}>{submission.title}</strong>
          </p>
        )}
      </div>

      {submission?.file_url && (
        <div style={{ marginBottom: '24px' }}>
          <a href={submission.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Download Submission
          </a>
        </div>
      )}

      {reviews.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>💬</div>
          <h3>No reviews yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Your submission has not been reviewed yet. Check back later.</p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviews.map((review, idx) => (
            <motion.div
              key={review.review_id}
              className="card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: '4px' }}>
                    Review by{' '}
                    <span style={{ color: 'var(--tech-blue)' }}>{review.reviewer_name}</span>
                  </h3>
                  <p className="card-muted" style={{ fontSize: '0.78rem' }}>
                    {new Date(review.created_at).toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: 'var(--uconn-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.3rem', color: '#fff',
                  boxShadow: '0 0 16px rgba(232,119,34,0.35)',
                  flexShrink: 0,
                }}>
                  {review.score}
                </div>
              </div>

              {review.comments && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Feedback</label>
                  <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>{review.comments}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '28px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
