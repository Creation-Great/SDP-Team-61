import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';

function ScoreSelector({ value, onChange, label }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              border: value === n ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
              background: value === n ? 'var(--primary)' : 'var(--glass-bg)',
              color: value === n ? '#fff' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
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

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/my-team`)
      .then((res) => {
        const { session: sess, teammates: tm, existingReviews, teamChemistry: tc, groupId: gid } = res.data;
        setSession(sess);
        setTeammates(tm);
        setGroupId(gid);
        setTeamChemistry(tc);

        // Initialize reviews state
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
      setTimeout(() => navigate('/peer-review'), 1500);
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
    </div>
  );
}
