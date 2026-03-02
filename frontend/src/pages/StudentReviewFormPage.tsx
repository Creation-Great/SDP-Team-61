import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Send } from 'lucide-react';
import type { AssignmentForm } from '../types';

function getToken() { return localStorage.getItem('token') || ''; }

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function StudentReviewFormPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!assignmentId) return;
    apiFetch<AssignmentForm>(`/assignments/${assignmentId}/form`)
      .then(data => {
        setForm(data);
        // Initialize scores for each category
        const initial: Record<string, number> = {};
        for (const cat of data.categories) {
          initial[cat] = 0;
        }
        setScores(initial);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Validate all categories scored
    for (const cat of (form?.categories || [])) {
      if (!scores[cat] || scores[cat] < 1) {
        setSubmitError(`Please score "${cat}"`);
        return;
      }
    }

    if (!comment.trim()) {
      setSubmitError('Please write a comment');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ scores, comment: comment.trim() }),
      });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>
        <Link to="/student/reviews" className="btn btn-primary">Back to Reviews</Link>
      </div>
    );
  }

  // Already submitted state
  if (form?.status === 'SUBMITTED' || submitted) {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <Link
            to="/student/reviews"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--tech-blue)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <ArrowLeft width={14} height={14} />
            My Reviews
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ textAlign: 'center', padding: '48px 32px', maxWidth: '560px', margin: '0 auto' }}
        >
          <CheckCircle width={48} height={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Review Submitted
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', marginBottom: '24px' }}>
            {submitted
              ? `Your review for ${form?.reviewee_name} has been submitted successfully.`
              : `You already submitted a review for ${form?.reviewee_name}.`
            }
          </p>
          <Link to="/student/reviews" className="btn btn-cta" style={{ textDecoration: 'none' }}>
            Back to Reviews
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/student/reviews"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tech-blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft width={14} height={14} />
          My Reviews
        </Link>
      </div>

      <div style={{ maxWidth: '640px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Peer Review
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Reviewing <strong style={{ color: 'var(--text-primary)' }}>{form?.reviewee_name}</strong>
            {form?.team_key && <span style={{ color: 'var(--tech-blue)' }}> · Team {form.team_key}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Score inputs per category */}
          {form?.categories.map(cat => (
            <div key={cat} className="card" style={{ marginBottom: '16px' }}>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                {cat}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[1, 2, 3, 4, 5].map(val => {
                  const selected = scores[cat] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScores(prev => ({ ...prev, [cat]: val }))}
                      style={{
                        width: '48px', height: '48px',
                        borderRadius: '8px',
                        border: selected ? '2px solid var(--tech-blue)' : '1px solid var(--glass-border)',
                        background: selected ? 'rgba(75,159,225,0.18)' : 'var(--surface-input)',
                        color: selected ? 'var(--tech-blue)' : 'var(--text-secondary)',
                        fontFamily: 'Roboto Mono, monospace',
                        fontWeight: selected ? 700 : 400,
                        fontSize: '1rem',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
                        transform: selected ? 'scale(1.1)' : 'scale(1)',
                      }}
                      onMouseEnter={e => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--glass-border-hover)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!selected) {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--glass-border)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                        }
                      }}
                      aria-pressed={selected}
                      aria-label={`Score ${val} for ${cat}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Comment */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Comment
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={`Write your feedback for ${form?.reviewee_name}...`}
              required
              rows={5}
              style={{
                width: '100%',
                background: 'var(--surface-input)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontFamily: 'Roboto Mono, monospace',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--glass-border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-cta"
            disabled={submitting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px' }}
          >
            <Send width={15} height={15} />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
