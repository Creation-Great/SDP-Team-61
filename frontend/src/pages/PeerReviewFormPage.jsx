import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';

const POLL_INTERVAL = 5000; // 5s real-time poll

function ScoreSelector({ value, onChange, label, disabled }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => !disabled && onChange(n)}
            disabled={disabled}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              border: value === n ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
              background: value === n ? 'var(--primary)' : 'var(--glass-bg)',
              color: value === n ? '#fff' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Mini score badge (read-only) ── */
function ScoreBadge({ value, label }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px',
        background: 'var(--primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', fontWeight: 700, margin: '0 auto 4px',
      }}>{value}</div>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
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

  // Team-wide live data
  const [teamData, setTeamData] = useState(null);
  const [showTeamBoard, setShowTeamBoard] = useState(true);
  const pollRef = useRef(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  // ── Fetch team-wide reviews (polling) ──
  const fetchTeamReviews = useCallback(() => {
    API.get(`/peer-review/sessions/${sessionId}/team-reviews`)
      .then((res) => setTeamData(res.data))
      .catch(() => {/* silent */});
  }, [sessionId]);

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/my-team`)
      .then((res) => {
        const { session: sess, teammates: tm, existingReviews, teamChemistry: tc, groupId: gid } = res.data;
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

    // Start polling for team reviews
    fetchTeamReviews();
    pollRef.current = setInterval(fetchTeamReviews, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [sessionId, fetchTeamReviews]);

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

      {!session?.is_open && (
        <motion.div
          className="card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ background: 'rgba(255, 107, 107, 0.15)', borderColor: 'rgba(255, 107, 107, 0.3)', marginBottom: '20px', textAlign: 'center' }}
        >
          <p style={{ color: 'var(--danger)' }}>This session is closed. You cannot submit reviews.</p>
        </motion.div>
      )}

      {/* ════════ TEAM LIVE BOARD ════════ */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '24px', border: '1px solid rgba(78,205,196,0.3)' }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowTeamBoard(!showTeamBoard)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>
              Team Board — Live
            </h3>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#4ecdc4', boxShadow: '0 0 6px #4ecdc4',
              animation: 'pulse 2s infinite',
            }} />
            <span className="card-muted" style={{ fontSize: '0.8rem' }}>
              {submittedIds.length}/{allTeammates.length} submitted
            </span>
          </div>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            {showTeamBoard ? '▲' : '▼'}
          </span>
        </div>

        {/* Completion chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {allTeammates.map((t) => {
            const done = submittedIds.includes(t.user_id);
            const isMe = t.user_id === user.id;
            return (
              <span
                key={t.user_id}
                className={`chip ${done ? 'chip-completed' : 'chip-pending'}`}
                style={isMe ? { fontWeight: 700, textDecoration: 'underline' } : {}}
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
              style={{ overflow: 'hidden' }}
            >
              {/* Per-reviewer cards */}
              {allTeammates.map((reviewer) => {
                const rReviews = reviewsByReviewer[reviewer.user_id] || [];
                const chem = chemistryMap[reviewer.user_id];
                const isMe = reviewer.user_id === user.id;
                if (rReviews.length === 0 && !chem) return null;

                return (
                  <div
                    key={reviewer.user_id}
                    style={{
                      marginTop: '16px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: isMe ? 'rgba(78,205,196,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isMe ? 'rgba(78,205,196,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{reviewer.name}</strong>
                      {isMe && <span className="chip chip-submitted" style={{ fontSize: '0.7rem' }}>You</span>}
                      {chem && (
                        <span className="chip" style={{ fontSize: '0.7rem', background: 'rgba(78,205,196,0.15)', color: '#4ecdc4' }}>
                          Chemistry: {chem}/5
                        </span>
                      )}
                    </div>

                    {/* Review rows */}
                    {rReviews.map((rv) => (
                      <div
                        key={rv.reviewee_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: '110px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.9rem' }}>{rv.reviewee_name}</span>
                          {rv.is_self && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(Self)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '14px' }}>
                          <ScoreBadge value={rv.technical_contributions} label="Tech" />
                          <ScoreBadge value={rv.team_interactions} label="Inter" />
                          <ScoreBadge value={rv.project_management} label="Mgmt" />
                        </div>
                        {rv.individual_comments && (
                          <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                            flex: '1 1 100%',
                            paddingLeft: '4px',
                          }}>
                            "{rv.individual_comments}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              {submittedIds.length === 0 && (
                <p className="card-muted" style={{ marginTop: '16px', textAlign: 'center' }}>
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
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '20px' }}
        >
          <h3 className="card-title" style={{ marginBottom: '4px' }}>Team Chemistry</h3>
          <p className="card-muted" style={{ marginBottom: '16px' }}>
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
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx + 1) * 0.08 }}
              style={{ marginBottom: '16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ marginBottom: 0 }}>{t.name}</h3>
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

              <div className="form-group" style={{ marginTop: '8px' }}>
                <label className="form-label">Comments (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder={`Comments about ${isSelf ? 'your own' : t.name + "'s"} contributions...`}
                  value={r.individual_comments || ''}
                  onChange={(e) => updateReview(t.user_id, 'individual_comments', e.target.value)}
                  rows={3}
                  style={{ minHeight: '80px' }}
                />
              </div>
            </motion.div>
          );
        })}

        {error && <p className="error-text" style={{ textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
        {success && <p className="success-text" style={{ textAlign: 'center', marginBottom: '16px' }}>{success}</p>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
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
              className="btn btn-primary"
              disabled={submitting || !isComplete()}
              style={{ minWidth: '200px' }}
            >
              {submitting ? 'Submitting...' : 'Submit All Reviews'}
            </button>
          )}
        </div>
      </form>

      {/* Pulse animation for live indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
