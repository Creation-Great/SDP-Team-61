import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckSquare, CheckCircle2, Clock, ChevronRight, Star,
  AlertCircle, MessageSquare, Loader2, Edit, Trash2, RefreshCw,
} from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/**
 * Student dashboard: pending review tasks, weekly check-in entry, average score, and quick actions.
 * Fetches GET /submissions/reviews/my-tasks and GET /submissions/mine on mount.
 * @returns {JSX.Element}
 */
export default function StudentDashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [fileInputTarget, setFileInputTarget] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      API.get('/submissions/reviews/my-tasks').then((r) => r.data).catch(() => []),
      API.get('/submissions/mine').then((r) => r.data).catch(() => []),
    ])
      .then(([t, s]) => { setTasks(t); setSubmissions(s); })
      .finally(() => setLoading(false));
  }, []);

  /* Compute average score received across all reviews */
  const avgScore = useMemo(() => {
    let sum = 0, count = 0;
    submissions.forEach((s) => {
      (s.reviews || []).forEach((r) => {
        if (r.score != null) { sum += Number(r.score); count += 1; }
      });
    });
    return count > 0 ? (sum / count).toFixed(1) : null;
  }, [submissions]);

  const refreshData = async () => {
    const [t, s] = await Promise.all([
      API.get('/submissions/reviews/my-tasks').then((r) => r.data).catch(() => []),
      API.get('/submissions/mine').then((r) => r.data).catch(() => []),
    ]);
    setTasks(t);
    setSubmissions(s);
  };

  const handleEditSubmission = async (sub) => {
    const nextTitle = window.prompt('Edit title', sub.title || '');
    if (nextTitle === null) return;
    const nextDesc = window.prompt('Edit description', sub.description || '');
    if (nextDesc === null) return;
    setActionLoadingId(sub.submission_id);
    try {
      await API.patch(`/submissions/${sub.submission_id}`, {
        title: nextTitle.trim(),
        description: nextDesc,
      });
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update submission');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleWithdrawSubmission = async (sub) => {
    if (!window.confirm(`Withdraw "${sub.title}"? This action cannot be undone.`)) return;
    setActionLoadingId(sub.submission_id);
    try {
      await API.delete(`/submissions/${sub.submission_id}`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to withdraw submission');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleReplaceFile = async (sub, file) => {
    if (!file) return;
    setActionLoadingId(sub.submission_id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await API.patch(`/submissions/${sub.submission_id}/replace-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to replace submission file');
    } finally {
      setActionLoadingId('');
      setFileInputTarget('');
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading dashboard"
      >
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" aria-hidden />
        <span className="ml-3 text-slate-500">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back. Here is your overview for this week.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={CheckSquare} onClick={() => navigate('/student/checkins')}>Weekly Check-in</Button>
          <Button icon={Upload} onClick={() => navigate('/upload')}>Submit Assignment</Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending Reviews (gradient) */}
        <Card
          className="p-6 bg-gradient-to-br from-[#000E2F] to-[#1a3a6b] text-white border-0 shadow-md cursor-pointer"
          onClick={() => navigate('/reviews')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/reviews'); } }}
          aria-label={`Pending reviews: ${tasks.length} task${tasks.length !== 1 ? 's' : ''} need attention. Go to reviews.`}
        >
          <h3 className="text-white/80 font-medium mb-1">Pending Reviews</h3>
          <div className="text-4xl font-bold">{tasks.length}</div>
          <div className="mt-4 flex items-center text-sm text-white/80 bg-white/10 px-3 py-1.5 rounded-lg w-fit">
            <Clock className="w-4 h-4 mr-2" /> Needs Attention <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </Card>

        {/* Check-in Status */}
        <Card
          className="p-6 cursor-pointer"
          onClick={() => navigate('/student/checkins')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/student/checkins'); } }}
          aria-label="Weekly check-in: active. Go to check-in page."
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-500 font-medium mb-1">Weekly Check-in</h3>
              <div className="text-2xl font-bold text-emerald-600 flex items-center mt-2">
                <CheckCircle2 className="w-6 h-6 mr-2" /> Active
              </div>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Avg Score */}
        <Card
          className={`p-6 ${submissions[0] ? 'cursor-pointer' : ''}`}
          onClick={() => submissions[0] ? navigate(`/view-review/${submissions[0].submission_id}`) : undefined}
          role={submissions[0] ? 'button' : undefined}
          tabIndex={submissions[0] ? 0 : undefined}
          onKeyDown={submissions[0] ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/view-review/${submissions[0].submission_id}`); } } : undefined}
          aria-label={avgScore != null ? `Average score received: ${avgScore} out of 5. View details.` : 'Average score received: no reviews yet.'}
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-500 font-medium mb-1">Avg Score Received</h3>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {avgScore ?? '—'}<span className="text-lg text-slate-400 font-normal">/5.0</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-sm text-[#000E2F] font-medium flex items-center">
            View Details <ChevronRight className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Assigned Peer Reviews Table Card */}
      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-[#000E2F]" />
            Assigned Peer Reviews
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/reviews')}>View All</Button>
        </div>

        {tasks.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No pending review tasks — you're all caught up!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.assignment_id}
                className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-semibold text-slate-900 text-lg">{task.title}</h4>
                  <div className="flex items-center text-sm text-red-500 mt-1.5 font-medium">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Assigned: {new Date(task.assigned_at).toLocaleDateString()}
                  </div>
                </div>
                <Button onClick={() => navigate(`/review/${task.assignment_id}`)}>
                  Start Review <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">My Submissions</h2>
        </div>
        {submissions.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No submissions yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {submissions.slice(0, 6).map((s) => (
              <div key={s.submission_id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-slate-900">{s.title}</h4>
                  <p className="text-sm text-slate-500 mt-1">{s.description || 'No description'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(s.created_at).toLocaleDateString()} · {s.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    id={`replace-file-${s.submission_id}`}
                    onChange={(e) => handleReplaceFile(s, e.target.files?.[0])}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionLoadingId === s.submission_id}
                    onClick={() => handleEditSubmission(s)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionLoadingId === s.submission_id}
                    onClick={() => {
                      setFileInputTarget(s.submission_id);
                      const el = document.getElementById(`replace-file-${s.submission_id}`);
                      if (el) el.click();
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    {actionLoadingId === s.submission_id && fileInputTarget === s.submission_id ? 'Replacing...' : 'Replace File'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={actionLoadingId === s.submission_id}
                    onClick={() => handleWithdrawSubmission(s)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Withdraw
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
