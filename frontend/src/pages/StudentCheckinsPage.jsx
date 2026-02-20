import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle, Users, Link as LinkIcon, Activity } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

function normalizeWeeks(instructorWeeks, selfWeeks, topics, members) {
  const existingById = new Map((selfWeeks || []).map((w) => [w.id, w]));

  return (instructorWeeks || []).map((w, idx) => {
    const id = w?.id || `week-${idx + 1}`;
    const existing = existingById.get(id) || {};

    const peerScores = { ...(existing.peer_scores || {}) };
    (members || []).forEach((member) => {
      peerScores[member.id] = { ...(peerScores[member.id] || {}) };
      (topics || []).forEach((topic) => {
        if (peerScores[member.id][topic] === undefined) {
          peerScores[member.id][topic] = '';
        }
      });
    });

    return {
      id,
      label: w?.label || `Week ${idx + 1}`,
      self_score: existing.self_score || '',
      peer_scores: peerScores,
    };
  });
}

export default function StudentCheckinsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [topics, setTopics] = useState([]);
  const [members, setMembers] = useState([]);
  const [selfWeeks, setSelfWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const selectedWeek = useMemo(
    () => selfWeeks.find((w) => w.id === selectedWeekId) || null,
    [selfWeeks, selectedWeekId]
  );

  const linkedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const teamPeers = useMemo(() => {
    if (!linkedMember) return [];
    return members.filter((m) => m.team === linkedMember.team && m.id !== linkedMember.id);
  }, [members, linkedMember]);

  /* ── Computed insights from real data ── */
  const insights = useMemo(() => {
    const filled = selfWeeks.filter((w) => w.self_score);
    const avg =
      filled.length > 0
        ? (filled.reduce((s, w) => s + Number(w.self_score || 0), 0) / filled.length).toFixed(1)
        : '—';
    return { completedWeeks: filled.length, totalWeeks: selfWeeks.length, avgSelfScore: avg, teamSize: teamPeers.length };
  }, [selfWeeks, teamPeers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get('/checkins/context');
        if (cancelled) return;

        const instructor = res.data?.instructor;
        const self = res.data?.self;
        if (!instructor) {
          setError('No instructor check-ins found for your course/group yet.');
          return;
        }

        const loadedTopics = Array.isArray(instructor.topics) ? instructor.topics : [];
        const loadedMembers = Array.isArray(instructor.members) ? instructor.members : [];
        const instructorWeeks = Array.isArray(instructor.weeks) ? instructor.weeks : [];
        const selectedId = self?.selected_member_id || '';

        setTopics(loadedTopics);
        setMembers(loadedMembers);
        setSelectedMemberId(selectedId);

        const normalized = normalizeWeeks(instructorWeeks, self?.weeks || [], loadedTopics, loadedMembers);
        setSelfWeeks(normalized);
        setSelectedWeekId(normalized[0]?.id || '');
      } catch {
        setError('Failed to load student check-ins');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const setSelfScore = (weekId, value) => {
    setSelfWeeks((prev) =>
      prev.map((week) => (week.id === weekId ? { ...week, self_score: value } : week))
    );
  };

  const setPeerScore = (weekId, memberId, topic, value) => {
    setSelfWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          peer_scores: {
            ...(week.peer_scores || {}),
            [memberId]: {
              ...((week.peer_scores || {})[memberId] || {}),
              [topic]: value,
            },
          },
        };
      })
    );
  };

  const saveSelfCheckins = async () => {
    setError('');
    setStatus('');
    if (!selectedMemberId) {
      setError('Your account is not linked to a template row yet.');
      return;
    }
    setSaving(true);
    try {
      await API.post('/checkins/self', { selected_member_id: selectedMemberId, weeks: selfWeeks });
      setStatus('Weekly ratings saved');
    } catch {
      setError('Failed to save weekly ratings');
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-500">Loading check-ins...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Weekly Check-ins</h1>
          <p className="text-slate-500 mt-1">Track your progress, hours, and team contributions.</p>
        </div>
        <Button onClick={saveSelfCheckins} loading={saving} icon={Save}>
          {saving ? 'Saving...' : 'Save Scores'}
        </Button>
      </div>

      {/* ── Error / Success banners ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert" aria-live="assertive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {status && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {status}
        </div>
      )}

      {/* ── 3-column grid (prototype layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Main content (2 cols) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Week tabs */}
          {selfWeeks.length > 0 && (
            <Card className="p-4">
              <div className="flex flex-wrap gap-2">
                {selfWeeks.map((week) => (
                  <button
                    key={week.id}
                    type="button"
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedWeekId === week.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    onClick={() => setSelectedWeekId(week.id)}
                  >
                    {week.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Ratings table (p-0 overflow-hidden prototype pattern) */}
          {selectedWeek && (
            <Card className="p-0 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900">{selectedWeek.label} — Ratings</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Self score */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Self Score</label>
                  <select
                    className={selectClass + ' w-32'}
                    value={selectedWeek.self_score || ''}
                    onChange={(e) => setSelfScore(selectedWeek.id, e.target.value)}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Teammate ratings */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Teammate Ratings</h4>
                  </div>

                  {teamPeers.length === 0 ? (
                    <p className="text-sm text-slate-500">No teammates found in your linked team.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Teammate ratings by topic for the selected week</caption>
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <th className="p-4 font-medium">Name</th>
                            {topics.map((topic) => (
                              <th key={topic} className="p-4 font-medium whitespace-nowrap">{topic}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {teamPeers.map((peer) => (
                            <tr key={peer.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-medium text-slate-800 whitespace-nowrap">{peer.name}</td>
                              {topics.map((topic) => (
                                <td key={`${peer.id}-${topic}`} className="p-4">
                                  <select
                                    className={selectClass + ' min-w-[80px]'}
                                    value={selectedWeek.peer_scores?.[peer.id]?.[topic] || ''}
                                    onChange={(e) => setPeerScore(selectedWeek.id, peer.id, topic, e.target.value)}
                                  >
                                    <option value="">—</option>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-6">
          {/* Linked Member */}
          <Card className="p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center">
              <LinkIcon className="w-5 h-5 mr-2 text-indigo-600" /> Linked Member
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="font-bold text-slate-900">{linkedMember?.name || 'Not linked'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500">Team</span>
                <span className="font-bold text-slate-900">{linkedMember ? `Team ${linkedMember.team}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status</span>
                <Badge type={linkedMember ? 'success' : 'warning'}>{linkedMember ? 'Linked' : 'Pending'}</Badge>
              </div>
            </div>
          </Card>

          {/* Quick Insights */}
          <Card className="p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-indigo-600" /> Quick Insights
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500">Completed Weeks</span>
                <span className="font-bold text-slate-900">{insights.completedWeeks}/{insights.totalWeeks}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500">Avg Self Score</span>
                <span className="font-bold text-slate-900">{insights.avgSelfScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Teammates</span>
                <span className="font-bold text-emerald-600">{insights.teamSize}</span>
              </div>
            </div>
          </Card>

          {/* Tip card (prototype: Weekly Comments style) */}
          <Card className="p-6 bg-indigo-50 border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-2">Tip</h3>
            <p className="text-sm text-indigo-700 italic">
              "Rate each teammate honestly across all topics every week. Your feedback helps improve team dynamics and collaboration."
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
