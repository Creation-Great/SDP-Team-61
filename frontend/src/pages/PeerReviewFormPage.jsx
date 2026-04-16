import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Users, Loader2,
  AlertCircle, CheckCircle, ArrowLeft, Send, Sparkles,
} from 'lucide-react';
import API from '../services/api';
import { strings } from '../i18n/strings';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PeerReviewRubric } from '../components/RubricPanel';
import AiChatWidget from '../components/ai/AiChatWidget';

const POLL_INTERVAL = 5000;

/**
 * Visibility-aware polling hook.
 */
function useVisibilityPolling(callback, interval, enabled) {
  const savedCb = useRef(callback);
  const timerRef = useRef(null);

  useEffect(() => { savedCb.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled) { clearInterval(timerRef.current); return; }
    const start = () => {
      clearInterval(timerRef.current);
      savedCb.current();
      timerRef.current = setInterval(() => savedCb.current(), interval);
    };
    const stop = () => clearInterval(timerRef.current);
    const onVisChange = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVisChange);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisChange); };
  }, [interval, enabled]);
}

function ScoreBadge({ value, label }) {
  if (!value && value !== 0) return null;
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-xl bg-[#000E2F]/5 text-[#000E2F] font-bold text-sm flex items-center justify-center">{value}</div>
      <span className="text-xs text-slate-500 mt-1 block">{label}</span>
    </div>
  );
}

function useDeadlineCountdown(deadline) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
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
    return { text, expired: false, urgent: diff < 3600000 };
  }, [deadline, now]);
}

/**
 * Peer review form for a session: load team (GET /peer-review/sessions/:sessionId/my-team),
 * submit ratings and comments (POST /peer-review/sessions/:sessionId/submit).
 * Uses visibility-aware polling for team/submission status. Rendered at /peer-review/session/:sessionId.
 * @returns {JSX.Element}
 */
export default function PeerReviewFormPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const draftKey = `peer-review-draft:${sessionId}`;
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

  const [teamData, setTeamData] = useState(null);
  const [showTeamBoard, setShowTeamBoard] = useState(true);

  /* AI Polish state */
  const [polishingFor, setPolishingFor] = useState(null);
  const [draftStatus, setDraftStatus] = useState('');

  const { user } = useAuth();
  const countdown = useDeadlineCountdown(session?.deadline);

  const fetchTeamReviews = useCallback(() => {
    API.get(`/peer-review/sessions/${sessionId}/team-reviews`)
      .then((res) => setTeamData(res.data))
      .catch(() => {});
  }, [sessionId]);

  useVisibilityPolling(fetchTeamReviews, POLL_INTERVAL, !success);

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/my-team`)
      .then((res) => {
        const { session: sess, teammates: tm, existingReviews, teamChemistry: tc, groupId: gid, authenticatedUserId } = res.data;
        if (authenticatedUserId && user?.id && authenticatedUserId !== user.id) setSessionMismatch(true);
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
        // Restore local draft on top of backend values if available.
        let merged = initial;
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.reviews && typeof parsed.reviews === 'object') {
              merged = { ...initial, ...parsed.reviews };
            }
            if (parsed?.teamChemistry != null) {
              setTeamChemistry(parsed.teamChemistry);
            }
          }
        } catch {
          // Ignore broken local draft content.
        }
        setReviews(merged);

        // Then try backend draft and apply on top (cross-device source)
        API.get(`/peer-review/sessions/${sessionId}/draft`)
          .then((draftRes) => {
            const payload = draftRes.data?.payload || {};
            const backendReviews = payload?.reviews;
            const backendChem = payload?.teamChemistry;
            if (backendReviews && typeof backendReviews === 'object') {
              setReviews((prev) => ({ ...prev, ...backendReviews }));
            }
            if (backendChem !== undefined) setTeamChemistry(backendChem);
          })
          .catch(() => {});
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load team data'))
      .finally(() => setLoading(false));
  }, [sessionId, draftKey]);

  // Persist local draft while editing.
  useEffect(() => {
    if (!sessionId || success) return;
    if (!teammates.length) return;
    const timer = setTimeout(() => {
      API.patch(`/peer-review/sessions/${sessionId}/draft`, {
        reviews,
        teamChemistry,
      }).then(() => setDraftStatus('Draft saved')).catch(() => {});
    }, 900);
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        reviews,
        teamChemistry,
        updatedAt: Date.now(),
      }));
    } catch {
      // Ignore storage quota / privacy mode errors.
    }
    return () => clearTimeout(timer);
  }, [sessionId, teammates.length, reviews, teamChemistry, success, draftKey]);

  const updateReview = (userId, field, value) => {
    setReviews((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
  };

  const isComplete = () => {
    if (!teamChemistry) return false;
    for (const t of teammates) {
      const r = reviews[t.user_id];
      if (!r || !r.technical_contributions || !r.team_interactions || !r.project_management) return false;
    }
    return true;
  };

  /** AI Polish: send comment text to backend, replace with polished version */
  const handlePolish = async (userId) => {
    const text = reviews[userId]?.individual_comments;
    if (!text?.trim()) return;
    setPolishingFor(userId);
    try {
      const res = await API.post('/api/ai/polish', { text });
      updateReview(userId, 'individual_comments', res.data?.polished || text);
    } catch (err) {
      // Keep original text and show inline note so user knows AI was unavailable
      updateReview(userId, 'individual_comments', text + '\n\n(AI polish unavailable — original kept)');
      setError('AI polish is temporarily unavailable. Your original text has been preserved.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setPolishingFor(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sessionMismatch) { setError('Session mismatch: please log out and log back in before submitting.'); return; }
    if (!isComplete()) { setError('Please complete all scores before submitting.'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        reviews: teammates.map((t) => ({ reviewee_id: t.user_id, ...reviews[t.user_id] })),
        teamChemistry,
      };
      await API.post(`/peer-review/sessions/${sessionId}/submit`, payload);
      setSuccess('Peer reviews submitted successfully!');
      localStorage.removeItem(draftKey);
      fetchTeamReviews();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit reviews');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading peer review form...</span>
      </div>
    );
  }

  if (error && !session) {
    return (
      <Card className="max-w-lg mx-auto mt-20 text-center px-6 py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Error</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <Button onClick={() => navigate('/peer-review')}>Back to Sessions</Button>
      </Card>
    );
  }

  const submittedIds = teamData?.submittedReviewerIds || [];
  const allTeammates = teamData?.teammates || teammates;
  const teamReviews = teamData?.reviews || [];
  const teamChemistryList = teamData?.chemistry || [];
  const reviewsByReviewer = {};
  teamReviews.forEach((r) => { if (!reviewsByReviewer[r.reviewer_id]) reviewsByReviewer[r.reviewer_id] = []; reviewsByReviewer[r.reviewer_id].push(r); });
  const chemistryMap = {};
  teamChemistryList.forEach((c) => { chemistryMap[c.reviewer_id] = c.score; });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/peer-review')} className="pl-0">
        <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
        Back to Sessions
      </Button>

      {/* Header */}
      <Card className="p-8">
        <div className="border-b border-slate-100 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900">{session?.title || 'Peer Review'}</h2>
          <p className="text-slate-500 mt-1 text-sm">Team {groupId} · Rate each teammate including yourself</p>
        </div>

        {/* Deadline countdown */}
        {session?.deadline && countdown && (
          <div className={`mb-6 p-4 rounded-xl text-center font-semibold flex items-center justify-center gap-2 ${
            countdown.expired ? 'bg-red-50 border border-red-200 text-red-600'
            : countdown.urgent ? 'bg-amber-50 border border-amber-200 text-amber-600'
            : 'bg-blue-50 border border-blue-200 text-blue-600'
          }`}>
            <Clock className="w-4 h-4" />
            {countdown.expired
              ? 'The deadline has passed. This session is now closed.'
              : `Deadline: ${new Date(session.deadline).toLocaleString()} — ${countdown.text}`}
          </div>
        )}

        {/* Session mismatch */}
        {sessionMismatch && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-600">Session Mismatch Detected</span>
            </div>
            <p className="text-red-600 text-sm">
              Please <strong>log out and log back in</strong> to ensure correct account.
            </p>
          </div>
        )}

        {!session?.is_open && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-red-600 font-medium">This session is closed. You cannot submit reviews.</p>
          </div>
        )}
      </Card>

      {/* Team Board */}
      <Card className="p-6">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowTeamBoard(!showTeamBoard)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#000E2F]/5 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#000E2F]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Team Board — Live</h3>
              <span className="text-sm text-slate-500">{submittedIds.length}/{allTeammates.length} submitted</span>
            </div>
            <span className="pulse-dot" />
          </div>
          {showTeamBoard ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {allTeammates.map((t) => {
            const done = submittedIds.includes(t.user_id);
            const isMe = t.user_id === user.id;
            return (
              <Badge key={t.user_id} type={done ? 'success' : 'warning'} className={isMe ? 'font-bold underline' : ''}>
                {t.name}{isMe ? ' (You)' : ''} {done ? '✅' : '⏳'}
              </Badge>
            );
          })}
        </div>

        <AnimatePresence>
          {showTeamBoard && teamData && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {allTeammates.map((reviewer) => {
                const rReviews = reviewsByReviewer[reviewer.user_id] || [];
                const chem = chemistryMap[reviewer.user_id];
                const isMe = reviewer.user_id === user.id;
                if (!isMe) return null;
                if (rReviews.length === 0 && !chem) return null;
                return (
                  <div key={reviewer.user_id} className="mt-4 p-4 rounded-xl bg-[#000E2F]/5 border border-[#000E2F]/10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-medium text-slate-800">{reviewer.name}</span>
                      {isMe && <Badge type="info">You</Badge>}
                      {chem && <Badge type="default">Chemistry: {chem}/5</Badge>}
                    </div>
                    <div className="space-y-3">
                      {rReviews.map((rv) => (
                        <div key={rv.reviewee_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                          <div>
                            <span className="text-sm font-medium text-slate-700">{rv.reviewee_name}</span>
                            {rv.is_self && <span className="text-xs text-slate-400 ml-2">(Self)</span>}
                          </div>
                          <div className="flex gap-3">
                            <ScoreBadge value={rv.technical_contributions} label="Tech" />
                            <ScoreBadge value={rv.team_interactions} label="Inter" />
                            <ScoreBadge value={rv.project_management} label="Mgmt" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {submittedIds.length === 0 && (
                <p className="text-sm text-slate-400 mt-6 text-center">No reviews submitted yet. Be the first!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Review Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {draftStatus ? (
          <div className="text-xs text-slate-400 text-right">{draftStatus}</div>
        ) : null}
        {/* Team Chemistry */}
        <Card className="p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{strings.peerReview.teamChemistry}</h3>
          <p className="text-sm text-slate-500 mb-4">"Overall, I am satisfied with my team"</p>
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setTeamChemistry(score)}
                className={`w-12 h-12 rounded-xl border-2 font-bold transition-all ${
                  teamChemistry === score
                    ? 'bg-[#000E2F]/5 border-[#000E2F] text-[#000E2F]'
                    : 'border-slate-200 text-slate-600 hover:border-[#000E2F]/20'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </Card>

        {/* Teammates */}
        {teammates.map((t) => {
          const isSelf = t.user_id === user.id;
          const r = reviews[t.user_id] || {};
          return (
            <Card key={t.user_id} className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                  {t.name?.charAt(0)?.toUpperCase()}
                </div>
                <h3 className="text-base font-semibold text-slate-900">{t.name}</h3>
                {isSelf && <Badge type="info">Self</Badge>}
              </div>

              <div className="space-y-8">
                {/* Score selectors with prototype-style buttons */}
                {[
                  { key: 'technical_contributions', label: strings.peerReview.technicalContributions },
                  { key: 'team_interactions', label: strings.peerReview.teamInteractions },
                  { key: 'project_management', label: strings.peerReview.projectManagement },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">{label} (1-5)</label>
                    <div className="flex gap-4">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => updateReview(t.user_id, key, score)}
                          className={`w-12 h-12 rounded-xl border-2 font-bold transition-all ${
                            r[key] === score
                              ? 'bg-[#000E2F]/5 border-[#000E2F] text-[#000E2F]'
                              : 'border-slate-200 text-slate-600 hover:border-[#000E2F]/20'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    <PeerReviewRubric
                      category={key}
                      currentScore={r[key]}
                      courseId={session?.course_id}
                      sessionId={sessionId}
                    />
                  </div>
                ))}

                {/* Feedback textarea with AI Polish button */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Constructive Feedback</label>
                  <div className="relative">
                    <textarea
                      value={r.individual_comments || ''}
                      onChange={(e) => updateReview(t.user_id, 'individual_comments', e.target.value)}
                      className="w-full p-4 pb-14 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#000E2F] focus:border-[#000E2F] outline-none transition-all resize-none h-40 bg-slate-50 focus:bg-white"
                      placeholder={`Write your thoughts about ${isSelf ? 'your own' : t.name + "'s"} contributions, then ask AI to polish it...`}
                      rows={4}
                    />
                    <div className="absolute bottom-3 right-3">
                      <Button
                        variant="ai"
                        size="sm"
                        icon={Sparkles}
                        type="button"
                        loading={polishingFor === t.user_id}
                        onClick={() => handlePolish(t.user_id)}
                        disabled={!r.individual_comments?.trim()}
                      >
                        {strings.reviews.aiPolish}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Error / Success */}
        {error && (
          <div className="flex items-center justify-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert" aria-live="assertive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="pt-4 flex justify-between border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={() => navigate('/peer-review')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {session?.is_open && (
            <Button type="submit" loading={submitting} disabled={!isComplete() || sessionMismatch}>
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit All Reviews'}
            </Button>
          )}
        </div>
      </form>

      <AiChatWidget contextType="writing_review" contextId={sessionId} />
    </div>
  );
}
