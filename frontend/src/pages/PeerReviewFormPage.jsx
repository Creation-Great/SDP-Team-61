import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ScoreSelector from '../components/ScoreSelector';
import './PeerReviewFormPage.css';

const POLL_INTERVAL = 5000; // 5s real-time poll

/**
 * Visibility-aware polling hook.
 * Pauses when the tab is hidden; resumes (with an immediate fetch) when visible again.
 * Stops entirely once `enabled` becomes false (e.g. after successful submit).
 */
function useVisibilityPolling(callback, interval, enabled) {
  const savedCb = useRef(callback);
  const timerRef = useRef(null);

  useEffect(() => { savedCb.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled) {
      clearInterval(timerRef.current);
      return;
    }

    const start = () => {
      clearInterval(timerRef.current);
      savedCb.current();                       // immediate fetch
      timerRef.current = setInterval(() => savedCb.current(), interval);
    };

    const stop = () => clearInterval(timerRef.current);

    const onVisChange = () => {
      if (document.hidden) { stop(); } else { start(); }
    };

    start();
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [interval, enabled]);
}

/* ── Mini score badge (read-only) ── */
function ScoreBadge({ value, label }) {
  if (!value && value !== 0) return null;
  return (
    <div className="text-center">
      <div className="score-badge-mini">{value}</div>
      <span className="text-xs text-secondary">{label}</span>
    </div>
  );
}

/** Live countdown hook for deadlines. */
function useDeadlineCountdown(deadline) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return useMemo(() => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return { text: 'Deadline passed', expired: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    let text;
    if (d > 0) text = `${d}d ${h}h ${m}m remaining`;
    else if (h > 0) text = `${h}h ${m}m ${s}s remaining`;
    else text = `${m}m ${s}s remaining`;
    const urgent = diff < 3600000; // less than 1 hour
    return { text, expired: false, urgent };
  }, [deadline, now]);
}

export default function PeerReviewFormPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [session, setSession] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [reviews, setReviews] = useState({});
  const [teamChemistry, setTeamChemistry] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [sessionMismatch, setSessionMismatch] = useState(false);

  // Team-wide live data
  const [teamData, setTeamData] = useState(null);
  const [showTeamBoard, setShowTeamBoard] = useState(true);

  const { user } = useAuth();
  const countdown = useDeadlineCountdown(session?.deadline);

  // ── Fetch team-wide reviews (visibility-aware polling) ──
  const fetchTeamReviews = useCallback(() => {
    API.get(`/peer-review/sessions/${sessionId}/team-reviews`)
      .then((res) => setTeamData(res.data))
      .catch(() => {/* silent */});
  }, [sessionId]);

  // Pause polling when tab is hidden; stop after successful submit
  useVisibilityPolling(fetchTeamReviews, POLL_INTERVAL, !success);

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/my-team`)
      .then((res) => {
        const { session: sess, teammates: tm, existingReviews, teamChemistry: tc, groupId: gid, authenticatedUserId } = res.data;
        
        // Detect session mismatch: the server-side user differs from client-side user
        // This happens when testing multiple accounts in the same browser
        if (authenticatedUserId && user?.id && authenticatedUserId !== user.id) {
          setSessionMismatch(true);
        }
        
        setSession(sess);
        setTeammates(tm);
        setGroupId(gid);
        setTeamChemistry(tc);

        const initial = {};
        tm.forEach((t) => {
          const existing = existingReviews.find((r) => r.reviewee_id === t.user_id);
          initial[t.user_id] = {
            technical_contributions: existing?.technical_contributions || null,
            team_interactions: existing?.team_interactions || null,
            project_management: existing?.project_management || null,
            individual_comments: existing?.individual_comments || '',
          };
        });
        setReviews(initial);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load team data');
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const updateReview = (userId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const isComplete = () => {
    if (!teamChemistry) return false;
    for (const t of teammates) {
      const r = reviews[t.user_id];
      if (!r) return false;
      if (!r.technical_contributions || !r.team_interactions || !r.project_management) return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sessionMismatch) {
      setError('Session mismatch: please log out and log back in before submitting.');
      return;
    }
    if (!isComplete()) {
      setError('Please complete all scores before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        reviews: teammates.map((t) => ({
          reviewee_id: t.user_id,
          ...reviews[t.user_id],
        })),
        teamChemistry,
      };
      await API.post(`/peer-review/sessions/${sessionId}/submit`, payload);
      setSuccess('Peer reviews submitted successfully!');
      fetchTeamReviews(); // refresh team board immediately
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit reviews');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><p>Loading peer review form...</p></div>;
  }

  if (error && !session) {
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

  // ── Helpers for team board ──
  const submittedIds = teamData?.submittedReviewerIds || [];
  const allTeammates = teamData?.teammates || teammates;
  const teamReviews = teamData?.reviews || [];
  const teamChemistryList = teamData?.chemistry || [];

  // Group reviews by reviewer
  const reviewsByReviewer = {};
  teamReviews.forEach((r) => {
    if (!reviewsByReviewer[r.reviewer_id]) reviewsByReviewer[r.reviewer_id] = [];
    reviewsByReviewer[r.reviewer_id].push(r);
  });
  const chemistryMap = {};
  teamChemistryList.forEach((c) => { chemistryMap[c.reviewer_id] = c.score; });

  return (
    <div>
      <h1 className="page-title">{session?.title || 'Peer Review'}</h1>
      <p className="page-subtitle">
        Team {groupId} · Rate each teammate including yourself
      </p>

      {/* Deadline countdown banner */}
      {session?.deadline && countdown && (
        <motion.div
          className={`card mb-16 text-center ${countdown.expired ? 'session-closed-banner' : ''}`}
          style={countdown.urgent && !countdown.expired ? { borderColor: '#e67e22', backgroundColor: '#fff8f0' } : {}}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p style={{ margin: 0, fontWeight: 'bold', color: countdown.expired ? '#dc3545' : countdown.urgent ? '#e67e22' : '#2d8cf0' }}>
            ⏰ {countdown.expired
              ? 'The deadline has passed. This session is now closed.'
              : `Deadline: ${new Date(session.deadline).toLocaleString()} — ${countdown.text}`}
          </p>
        </motion.div>
      )}

      {sessionMismatch && (
        <motion.div
          className="card mb-20 text-center"
          style={{ borderColor: '#dc3545', backgroundColor: '#fff3f3' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-danger" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            ⚠️ Session Mismatch Detected
          </p>
          <p className="text-danger">
            Your login session has changed (possibly due to logging in with a different account in another tab).
            Please <strong>log out and log back in</strong> to ensure your reviews are submitted under the correct account.
          </p>
          <button className="btn btn-primary mt-12" onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </motion.div>
      )}

      {!session?.is_open && (
        <motion.div
          className="card session-closed-banner mb-20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-danger">This session is closed. You cannot submit reviews.</p>
        </motion.div>
      )}

      {/* ════════ TEAM LIVE BOARD ════════ */}
      <motion.div
        className="card team-board-card mb-24"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div
          className="flex-between cursor-pointer"
          onClick={() => setShowTeamBoard(!showTeamBoard)}
        >
          <div className="flex-center gap-10">
            <h3 className="card-title mb-0">
              Team Board — Live
            </h3>
            <span className="pulse-dot" />
            <span className="card-muted text-sm">
              {submittedIds.length}/{allTeammates.length} submitted
            </span>
          </div>
          <span className="text-secondary" style={{ fontSize: '1.2rem' }}>
            {showTeamBoard ? '▲' : '▼'}
          </span>
        </div>

        {/* Completion chips */}
        <div className="flex-row flex-wrap gap-8 mt-12">
          {allTeammates.map((t) => {
            const done = submittedIds.includes(t.user_id);
            const isMe = t.user_id === user.id;
            return (
              <span
                key={t.user_id}
                className={`chip ${done ? 'chip-completed' : 'chip-pending'}${isMe ? ' font-bold' : ''}`}
                style={isMe ? { textDecoration: 'underline' } : {}}
              >
                {t.name}{isMe ? ' (You)' : ''} {done ? '✅' : '⏳'}
              </span>
            );
          })}
        </div>

        <AnimatePresence>
          {showTeamBoard && teamData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Per-reviewer cards — only show current user's own reviews */}
              {allTeammates.map((reviewer) => {
                const rReviews = reviewsByReviewer[reviewer.user_id] || [];
                const chem = chemistryMap[reviewer.user_id];
                const isMe = reviewer.user_id === user.id;

                // Privacy: only show detailed scores for the current user
                if (!isMe) return null;
                if (rReviews.length === 0 && !chem) return null;

                return (
                  <div
                    key={reviewer.user_id}
                    className={`reviewer-block${isMe ? ' reviewer-block--self' : ''}`}
                  >
                    <div className="flex-center gap-8 mb-8">
                      <strong style={{ fontSize: '0.95rem' }}>{reviewer.name}</strong>
                      {isMe && <span className="chip chip-submitted text-xs">You</span>}
                      {chem && (
                        <span className="chip chip-chemistry">
                          Chemistry: {chem}/5
                        </span>
                      )}
                    </div>

                    {/* Review rows */}
                    {rReviews.map((rv) => (
                      <div key={rv.reviewee_id} className="review-row">
                        <div className="review-row__name">
                          <span style={{ fontSize: '0.9rem' }}>{rv.reviewee_name}</span>
                          {rv.is_self && <span className="text-xs text-secondary">(Self)</span>}
                        </div>
                        <div className="flex-row gap-14">
                          <ScoreBadge value={rv.technical_contributions} label="Tech" />
                          <ScoreBadge value={rv.team_interactions} label="Inter" />
                          <ScoreBadge value={rv.project_management} label="Mgmt" />
                        </div>
                        {rv.individual_comments && (
                          <div className="review-row__comment">
                            "{rv.individual_comments}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              {submittedIds.length === 0 && (
                <p className="card-muted mt-16 text-center">
                  No reviews submitted yet. Be the first!
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ════════ MY REVIEW FORM ════════ */}
      <form onSubmit={handleSubmit}>
        {/* Team Chemistry */}
        <motion.div
          className="card mb-20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="card-title mb-4">Team Chemistry</h3>
          <p className="card-muted mb-16">
            "Overall, I am satisfied with my team"
          </p>
          <ScoreSelector
            label="Rating"
            value={teamChemistry}
            onChange={(v) => setTeamChemistry(v)}
          />
        </motion.div>

        {/* Teammate Reviews */}
        {teammates.map((t, idx) => {
          const isSelf = t.user_id === user.id;
          const r = reviews[t.user_id] || {};

          return (
            <motion.div
              key={t.user_id}
              className="card mb-16"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx + 1) * 0.08 }}
            >
              <div className="flex-center gap-12 mb-16">
                <h3 className="card-title mb-0">{t.name}</h3>
                {isSelf && <span className="chip chip-submitted">Self</span>}
              </div>

              <ScoreSelector
                label="Technical Contributions"
                value={r.technical_contributions}
                onChange={(v) => updateReview(t.user_id, 'technical_contributions', v)}
              />
              <ScoreSelector
                label="Team Interactions"
                value={r.team_interactions}
                onChange={(v) => updateReview(t.user_id, 'team_interactions', v)}
              />
              <ScoreSelector
                label="Project Management"
                value={r.project_management}
                onChange={(v) => updateReview(t.user_id, 'project_management', v)}
              />

              <div className="form-group mt-8">
                <label className="form-label">Comments (optional)</label>
                <textarea
                  className="form-textarea review-comment-textarea"
                  placeholder={`Comments about ${isSelf ? 'your own' : t.name + "'s"} contributions...`}
                  value={r.individual_comments || ''}
                  onChange={(e) => updateReview(t.user_id, 'individual_comments', e.target.value)}
                  rows={3}
                />
              </div>
            </motion.div>
          );
        })}

        {error && <p className="error-text text-center mb-16" role="alert" aria-live="assertive">{error}</p>}
        {success && <p className="success-text text-center mb-16">{success}</p>}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/peer-review')}
          >
            Back
          </button>
          {session?.is_open && (
            <button
              type="submit"
              className="btn btn-primary btn-wide"
              disabled={submitting || !isComplete() || sessionMismatch}
            >
              {submitting ? 'Submitting...' : 'Submit All Reviews'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
