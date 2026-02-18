import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function PeerReviewSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const isInstructor = user.role === 'instructor' || user.role === 'admin';

  const fetchSessions = () => {
    API.get('/peer-review/sessions')
      .then((res) => setSessions(res.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      await API.post('/peer-review/sessions', { title: newTitle.trim() });
      setNewTitle('');
      setShowCreate(false);
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (sessionId, currentOpen) => {
    try {
      await API.patch(`/peer-review/sessions/${sessionId}`, { is_open: !currentOpen });
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update session');
    }
  };

  if (loading) {
    return <div className="empty-state"><p>Loading peer review sessions...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">Peer Review</h1>
      <p className="page-subtitle">
        {isInstructor
          ? 'Manage peer review sessions and view aggregated results.'
          : 'Submit peer reviews for your teammates.'}
      </p>

      {isInstructor && (
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          {!showCreate ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create New Session
            </button>
          ) : (
            <motion.form
              className="card"
              onSubmit={handleCreate}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'left' }}
            >
              <h3 className="card-title" style={{ marginBottom: '16px' }}>New Peer Review Session</h3>
              <div className="form-group">
                <input
                  className="form-input"
                  type="text"
                  placeholder="Session title (e.g., Sprint 3 Peer Review)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreate(false); setError(''); }}>
                  Cancel
                </button>
              </div>
            </motion.form>
          )}
        </div>
      )}

      {sessions.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h3>No peer review sessions yet</h3>
          <p>{isInstructor ? 'Create a session to get started.' : 'Your instructor has not created any sessions yet.'}</p>
        </motion.div>
      ) : (
        sessions.map((s, idx) => (
          <motion.div
            key={s.session_id}
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            whileHover={{ scale: 1.01 }}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (isInstructor) {
                navigate(`/peer-review/${s.session_id}/results`);
              } else if (s.is_open) {
                navigate(`/peer-review/${s.session_id}`);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="card-title">{s.title}</h3>
                <p className="card-meta">
                  Created by {s.created_by_name} · {new Date(s.created_at).toLocaleDateString()}
                </p>
                <p className="card-meta" style={{ marginTop: '4px' }}>
                  {isInstructor
                    ? `${s.submitted_count || 0} student${s.submitted_count !== 1 ? 's' : ''} submitted`
                    : `Your team: ${s.submitted_count || 0}/${s.team_size || '?'} submitted`}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span className={`chip ${s.is_open ? 'chip-submitted' : 'chip-completed'}`}>
                  {s.is_open ? 'Open' : 'Closed'}
                </span>
                {!isInstructor && s.my_submitted && (
                  <span className="chip chip-completed">Submitted ✓</span>
                )}
              </div>
            </div>

            {isInstructor && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}
                   onClick={(e) => e.stopPropagation()}>
                <button
                  className={`btn ${s.is_open ? 'btn-danger' : 'btn-success'}`}
                  style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                  onClick={() => handleToggle(s.session_id, s.is_open)}
                >
                  {s.is_open ? 'Close Session' : 'Reopen Session'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                  onClick={() => navigate(`/peer-review/${s.session_id}/results`)}
                >
                  View Results
                </button>
              </div>
            )}

            {!isInstructor && !s.is_open && !s.my_submitted && (
              <p className="card-muted" style={{ marginTop: '8px' }}>
                This session is closed. You can no longer submit reviews.
              </p>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
}
