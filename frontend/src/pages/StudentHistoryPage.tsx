import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useToast } from '../components/ToastProvider';
import { Skeleton } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import type { ReceivedReview } from '../types';

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score < 2.0) return '#ef4444';
  if (score <= 3.5) return '#f59e0b';
  return '#22c55e';
}

function barWidth(score: number): string {
  return `${Math.min(100, (score / 5) * 100)}%`;
}

export default function StudentHistoryPage() {
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    apiFetch<ReceivedReview[]>('/me/received-reviews')
      .then(setReviews)
      .catch((err) => {
        addToast({ type: 'error', title: 'Failed to load scores', message: err.message });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Home', to: '/student/reviews' },
        { label: 'My Scores' },
      ]} />

      <div className="page-hero-band">
        <div>
          <h1>My Scores</h1>
          <p>Your received peer review scores by week</p>
        </div>
        <BarChart3 size={24} color="var(--uconn-orange)" strokeWidth={1.6} />
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton variant="card" height="180px" />
          <Skeleton variant="card" height="180px" />
          <Skeleton variant="card" height="180px" />
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
        }}>
          <BookOpen size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
          <p style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}>
            No completed review cycles yet
          </p>
          <p style={{
            fontFamily: 'Roboto Mono, monospace',
            fontSize: '0.8rem',
          }}>
            Your scores will appear here after a review week closes.
          </p>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reviews.map((review, i) => {
            const categories = review.per_category_json || {};
            const catEntries = Object.entries(categories);

            return (
              <motion.div
                key={review.week_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="card"
                style={{ borderRadius: '4px', padding: '20px 24px' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}>
                      {review.course_name}
                    </h3>
                    <span style={{
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      display: 'block',
                    }}>
                      Week {review.week_number}
                    </span>
                  </div>

                  {/* Overall average */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '2rem',
                      fontWeight: 800,
                      color: scoreColor(review.avg_overall),
                      lineHeight: 1,
                    }}>
                      {review.avg_overall !== null ? review.avg_overall.toFixed(1) : '—'}
                    </div>
                    <div style={{
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      Overall
                    </div>
                  </div>
                </div>

                {/* Per-category bars */}
                {catEntries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                    {catEntries.map(([label, score]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontFamily: 'Roboto Mono, monospace',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          width: '120px',
                          flexShrink: 0,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </span>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          background: 'var(--surface-elevated)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: barWidth(score),
                            height: '100%',
                            background: scoreColor(score),
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{
                          fontFamily: 'Roboto Mono, monospace',
                          fontSize: '0.75rem',
                          color: scoreColor(score),
                          fontWeight: 600,
                          width: '32px',
                          textAlign: 'right',
                          flexShrink: 0,
                        }}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                }}>
                  {(review.n_reviews ?? 0) === 0
                    ? 'No reviews received for this cycle'
                    : `Based on ${review.n_reviews} review${review.n_reviews !== 1 ? 's' : ''}`}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
