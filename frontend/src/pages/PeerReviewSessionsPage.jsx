import { useCallback, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import useFilteredList from '../hooks/useFilteredList';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';

/** Format a countdown string from a deadline Date, updating every minute. */
function useCountdown(deadline) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return useMemo(() => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return 'Expired';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, [deadline, now]);
}

/** Thin wrapper so each card can have its own countdown timer. */
function DeadlineChip({ deadline }) {
  const text = useCountdown(deadline);
  if (!text) return null;
  const isUrgent = text === 'Expired' || (new Date(deadline).getTime() - Date.now() < 3600000);
  return (
    <span className={`chip ${isUrgent ? 'chip-danger' : 'chip-pending'}`} title={new Date(deadline).toLocaleString()}>
      ⏰ {text}
    </span>
  );
}

export default function PeerReviewSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { user, isInstructor } = useAuth();

  const searchKeys = useCallback((s) => [s.title, s.created_by_name], []);
  const sessList = useFilteredList(sessions, { searchKeys, pageSize: 10 });

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
      const payload = {
        title: newTitle.trim(),
        course_id: user?.course_id || undefined,
        deadline: newDeadline ? new Date(newDeadline).toISOString() : undefined,
      };
      await API.post('/peer-review/sessions', payload);
      setNewTitle('');
      setNewDeadline('');
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
        <div className="text-right mb-20">
          {!showCreate ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create New Session
            </button>
          ) : (
            <motion.form
              className="card text-left"
              onSubmit={handleCreate}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="card-title mb-16">New Peer Review Session</h3>
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
              <div className="form-group">
                <label className="form-label">Deadline (optional)</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="card-muted text-sm mt-4">
                  Session will automatically close when the deadline passes.
                </p>
              </div>
              {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}
              <div className="flex-row gap-10">
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
        <>
          <div className="list-toolbar">
            <SearchInput
              value={sessList.query}
              onChange={sessList.setQuery}
              placeholder="Search sessions…"
            />
          </div>
          {sessList.pageItems.map((s, idx) => (
          <motion.div
            key={s.session_id}
            className="card cursor-pointer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.06, 0.3) }}
            whileHover={{ scale: 1.01 }}
            onClick={() => {
              if (isInstructor) {
                navigate(`/peer-review/${s.session_id}/results`);
              } else if (s.is_open) {
                navigate(`/peer-review/${s.session_id}`);
              }
            }}
          >
            <div className="flex-between-start">
              <div>
                <h3 className="card-title">{s.title}</h3>
                <p className="card-meta">
                  Created by {s.created_by_name} · {new Date(s.created_at).toLocaleDateString()}
                </p>
                {s.deadline && (
                  <p className="card-meta mt-4">
                    Deadline: {new Date(s.deadline).toLocaleString()}
                  </p>
                )}
                <p className="card-meta mt-4">
                  {isInstructor
                    ? `${s.submitted_count || 0} student${s.submitted_count !== 1 ? 's' : ''} submitted`
                    : `Your team: ${s.submitted_count || 0}/${s.team_size || '?'} submitted`}
                </p>
              </div>
              <div className="flex-col-end gap-8">
                <span className={`chip ${s.is_open ? 'chip-submitted' : 'chip-completed'}`}>
                  {s.is_open ? 'Open' : 'Closed'}
                </span>
                {s.is_open && s.deadline && (
                  <DeadlineChip deadline={s.deadline} />
                )}
                {!isInstructor && s.my_submitted && (
                  <span className="chip chip-completed">Submitted ✓</span>
                )}
              </div>
            </div>

            {isInstructor && (
              <div className="mt-12 flex-row gap-10"
                   onClick={(e) => e.stopPropagation()}>
                <button
                  className={`btn btn-sm ${s.is_open ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => handleToggle(s.session_id, s.is_open)}
                >
                  {s.is_open ? 'Close Session' : 'Reopen Session'}
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => navigate(`/peer-review/${s.session_id}/results`)}
                >
                  View Results
                </button>
              </div>
            )}

            {!isInstructor && !s.is_open && !s.my_submitted && (
              <p className="card-muted mt-8">
                This session is closed. You can no longer submit reviews.
              </p>
            )}
          </motion.div>
        ))}
          <Pagination
            page={sessList.page}
            totalPages={sessList.totalPages}
            onPageChange={sessList.setPage}
            filtered={sessList.filtered.length}
            total={sessList.total}
            noun="sessions"
          />
        </>
      )}
    </div>
  );
}
