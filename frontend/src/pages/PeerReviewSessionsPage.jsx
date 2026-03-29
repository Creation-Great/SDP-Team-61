import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Users, Loader2, AlertCircle, ChevronRight, Edit, Eye, EyeOff } from 'lucide-react';
import API from '../services/api';
import { strings } from '../i18n/strings';
import { useAuth } from '../contexts/AuthContext';
import useFilteredList from '../hooks/useFilteredList';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastProvider';

function useCountdown(deadline) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return useMemo(() => {
    if (!deadline) return { text: null, now: 0 };
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return { text: 'Expired', now };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const text = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
    return { text, now };
  }, [deadline, now]);
}

function DeadlineChip({ deadline }) {
  const { text, now } = useCountdown(deadline);
  if (!text) return null;
  const isUrgent = text === 'Expired' || (new Date(deadline).getTime() - now < 3600000);
  return (
    <Badge type={isUrgent ? 'error' : 'warning'} title={new Date(deadline).toLocaleString()}>
      <Clock className="w-3 h-3 mr-1 inline" />
      {text}
    </Badge>
  );
}

/**
 * Peer review sessions list and create (instructor). GET /peer-review/sessions, POST /peer-review/sessions.
 * Rendered at /peer-review. Uses useFilteredList for search/pagination.
 * @returns {JSX.Element}
 */
export default function PeerReviewSessionsPage() {
  const { addToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newAnonymity, setNewAnonymity] = useState('none');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [editDialog, setEditDialog] = useState(null);
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
        anonymity_level: newAnonymity,
      };
      await API.post('/peer-review/sessions', payload);
      setNewTitle('');
      setNewDeadline('');
      setNewAnonymity('none');
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
      addToast({ type: 'error', message: err.response?.data?.message || 'Failed to update session' });
    }
  };

  const handleReleaseScores = async (sessionId, currentReleased) => {
    try {
      await API.patch(`/peer-review/sessions/${sessionId}/release-scores`, { scores_released: !currentReleased });
      fetchSessions();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.message || 'Failed to update score release' });
    }
  };

  const handleEditSession = (session) => {
    const currentDeadline = session.deadline
      ? new Date(new Date(session.deadline).getTime() - new Date(session.deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
    setEditDialog({
      sessionId: session.session_id,
      title: session.title || '',
      deadline: currentDeadline,
    });
  };

  const confirmEditSession = async () => {
    const { sessionId, title, deadline } = editDialog;
    setEditDialog(null);
    try {
      await API.patch(`/peer-review/sessions/${sessionId}`, {
        title: title.trim(),
        deadline: deadline.trim() ? new Date(deadline).toISOString() : null,
      });
      fetchSessions();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.message || 'Failed to edit session' });
    }
  };

  const handleDuplicateSession = async (sessionId) => {
    try {
      await API.post(`/peer-review/sessions/${sessionId}/duplicate`);
      fetchSessions();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.message || 'Failed to duplicate session' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading peer review sessions...</span>
      </div>
    );
  }

  const thClass = 'p-4 font-medium text-slate-500 text-sm whitespace-nowrap text-left';
  const tdClass = 'p-4 text-sm text-slate-700';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peer Review Sessions</h1>
          <p className="text-slate-500 mt-1">
            {isInstructor
              ? 'Create and manage evaluation cycles for your class.'
              : 'Submit peer reviews for your teammates.'}
          </p>
        </div>
      </div>

      {/* Create Form — indigo-tinted card with 3-col grid */}
      {isInstructor && (
        <Card className="p-6 bg-[#000E2F]/5 border-[#000E2F]/10">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-[#000E2F]" />
            Create New Session
          </h3>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleCreate}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Session Name</label>
              <input
                type="text"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-[#000E2F] focus:ring-2 focus:ring-[#000E2F]/10 bg-white text-sm"
                placeholder="e.g. Sprint 3 Peer Review"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Deadline</label>
              <input
                type="datetime-local"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-[#000E2F] focus:ring-2 focus:ring-[#000E2F]/10 bg-white text-sm"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Anonymity Level</label>
              <select
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-[#000E2F] focus:ring-2 focus:ring-[#000E2F]/10 bg-white text-sm"
                value={newAnonymity}
                onChange={(e) => setNewAnonymity(e.target.value)}
              >
                <option value="none">None</option>
                <option value="single_blind">Single Blind</option>
                <option value="double_blind">Double Blind</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" loading={creating} className="w-full">
                {creating ? 'Creating...' : 'Deploy Session'}
              </Button>
            </div>
          </form>
          {error && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </Card>
      )}

      {/* Sessions Table */}
      {sessions.length === 0 ? (
        <Card className="text-center px-6 py-12">
          <div className="w-16 h-16 bg-[#000E2F]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#000E2F]" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{strings.dashboard.noSessions}</h3>
          <p className="text-slate-500">
            {isInstructor ? 'Create a session above to get started.' : 'Your instructor has not created any sessions yet.'}
          </p>
        </Card>
      ) : (
        <>
          <SearchInput
            value={sessList.query}
            onChange={sessList.setQuery}
            placeholder="Search sessions…"
          />

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                    <th className={thClass}>Session Name</th>
                    <th className={thClass}>Deadline</th>
                    <th className={thClass}>Completion Rate</th>
                    <th className={thClass}>Anonymity</th>
                    <th className={thClass}>Status</th>
                    {isInstructor && <th className={thClass}>Scores</th>}
                    <th className={thClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessList.pageItems.map((s) => {
                    const submitted = s.submitted_count || 0;
                    const total = s.team_size || s.submitted_count || 1;
                    const pct = Math.round((submitted / total) * 100);
                    return (
                      <tr key={s.session_id} className="hover:bg-slate-50/50">
                        <td className={tdClass + ' font-medium text-slate-900'}>{s.title}</td>
                        <td className={tdClass + ' text-slate-500'}>
                          {s.deadline ? (
                            <div className="flex items-center gap-2">
                              <span>{new Date(s.deadline).toLocaleDateString()}</span>
                              {s.is_open && <DeadlineChip deadline={s.deadline} />}
                            </div>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                              <div
                                className={`h-2 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#000E2F]'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">{pct}%</span>
                          </div>
                        </td>
                        <td className={tdClass}>
                          {s.anonymity_level === 'double_blind'
                            ? <Badge type="info">Double Blind</Badge>
                            : s.anonymity_level === 'single_blind'
                            ? <Badge type="warning">Single Blind</Badge>
                            : <Badge type="default">None</Badge>}
                        </td>
                        <td className={tdClass}>
                          {s.is_open ? <Badge type="success">Active</Badge> : <Badge type="default">Closed</Badge>}
                        </td>
                        {isInstructor && (
                          <td className={tdClass}>
                            {s.scores_released
                              ? <Badge type="info">Released</Badge>
                              : <Badge type="warning">Hidden</Badge>}
                          </td>
                        )}
                        <td className={tdClass}>
                          <div className="flex gap-2 flex-wrap">
                            {isInstructor ? (
                              <>
                                <Button
                                  variant={s.is_open ? 'danger' : 'success'}
                                  size="sm"
                                  onClick={() => handleToggle(s.session_id, s.is_open)}
                                >
                                  {s.is_open ? 'Close' : 'Reopen'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleEditSession(s)}
                                >
                                  <Edit className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDuplicateSession(s.session_id)}
                                >
                                  Duplicate
                                </Button>
                                <Button
                                  variant={s.scores_released ? 'secondary' : 'primary'}
                                  size="sm"
                                  onClick={() => handleReleaseScores(s.session_id, s.scores_released)}
                                  title={s.scores_released ? 'Hide scores from students' : 'Release scores to students'}
                                >
                                  {s.scores_released ? <><EyeOff className="w-3.5 h-3.5 mr-1" />Hide Scores</> : <><Eye className="w-3.5 h-3.5 mr-1" />Release Scores</>}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => navigate(`/peer-review/${s.session_id}/results`)}
                                >
                                  Results
                                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  disabled={!s.is_open || s.my_submitted}
                                  onClick={() => navigate(`/peer-review/${s.session_id}`)}
                                >
                                  {s.my_submitted ? 'Submitted ✓' : 'Evaluate'}
                                  {!s.my_submitted && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
                                </Button>
                                {s.scores_released && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate(`/peer-review/${s.session_id}/my-scores`)}
                                  >
                                    View Scores
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

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

      {/* Edit session dialog */}
      <ConfirmDialog
        open={!!editDialog}
        title="Edit Session"
        message="Update the session title and deadline."
        confirmLabel="Save"
        variant="primary"
        onConfirm={confirmEditSession}
        onCancel={() => setEditDialog(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Session Title</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
              value={editDialog?.title ?? ''}
              onChange={(e) => setEditDialog((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deadline (leave blank to clear)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
              value={editDialog?.deadline ?? ''}
              onChange={(e) => setEditDialog((prev) => ({ ...prev, deadline: e.target.value }))}
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
