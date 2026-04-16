import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, AlertCircle, CheckCircle, ArrowLeft, FileText, Download,
  Sparkles, ShieldAlert, RefreshCw, Check, Copy,
} from 'lucide-react';
import API from '../services/api';
import { strings } from '../i18n/strings';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ScoreSelector from '../components/ScoreSelector';
import { FileReviewRubric } from '../components/RubricPanel';
import ScoreSuggestionPanel from '../components/ai/ScoreSuggestionPanel';
import CalibrationAlert from '../components/ai/CalibrationAlert';
import AiChatWidget from '../components/ai/AiChatWidget';
import useAutoSave from '../hooks/useAutoSave';
import RichTextEditor from '../components/editor/RichTextEditor';
import PdfViewer from '../components/editor/PdfViewer';

/**
 * Single review form: load assignment (GET /reviews/:id), submit (POST /reviews/:id/submit).
 * Optional AI feedback/rewrite via /api/ai. Rendered at /review/:id.
 * @returns {JSX.Element}
 */
export default function ReviewPage() {
  const { id } = useParams(); // assignment_id
  const navigate = useNavigate();
  const draftKey = `review-draft:${id}`;
  const [review, setReview] = useState(null);
  const [score, setScore] = useState(3);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /* AI Feedback state */
  const [aiFeedback, setAiFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  /* AI Rewrite state */
  const [aiRewrite, setAiRewrite] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [rewriteAdopted, setRewriteAdopted] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');

  /* Calibration deviation data */
  const [deviationData, setDeviationData] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    API.get(`/reviews/${id}`, { signal: controller.signal })
      .then((res) => setReview(res.data))
      .catch((err) => {
        if (err?.name !== 'CanceledError') setError('Failed to load review details');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  // Restore local draft (score/comments) on first load.
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.score === 'number') setScore(parsed.score);
      if (typeof parsed.comments === 'string') setComments(parsed.comments);
    } catch {
      // Ignore broken local draft content.
    }
  }, [id, draftKey]);

  // Load backend draft (wins over local draft if exists)
  useEffect(() => {
    if (!id) return;
    API.get(`/reviews/${id}/draft`)
      .then((res) => {
        const d = res.data || {};
        if (typeof d.score === 'number') setScore(d.score);
        if (typeof d.comments === 'string') setComments(d.comments);
      })
      .catch(() => {});
  }, [id]);

  // Persist draft while editing; skip when a review is already submitted.
  useEffect(() => {
    if (!id || review?.review_id) return;
    const timer = setTimeout(() => {
      API.patch(`/reviews/${id}/draft`, { score, comments }).then(() => {
        setDraftStatus('Draft saved');
      }).catch(() => {});
    }, 700);
    try {
      localStorage.setItem(draftKey, JSON.stringify({ score, comments, updatedAt: Date.now() }));
    } catch {
      // Ignore storage quota / privacy mode errors.
    }
    return () => clearTimeout(timer);
  }, [id, score, comments, review?.review_id, draftKey]);

  /** Preload cached AI feedback and rewrite from backend (GET /api/ai/feedback/:reviewId, GET /api/ai/rewrite/:reviewId) */
  useEffect(() => {
    if (!id || !review) return;
    const loadCachedAi = async () => {
      try {
        const [feedbackRes, rewriteRes] = await Promise.allSettled([
          API.get(`/api/ai/feedback/${id}`),
          API.get(`/api/ai/rewrite/${id}`),
        ]);
        if (feedbackRes.status === 'fulfilled' && feedbackRes.value?.data) setAiFeedback(feedbackRes.value.data);
        if (rewriteRes.status === 'fulfilled' && rewriteRes.value?.data) setAiRewrite(rewriteRes.value.data);
      } catch {
        // Ignore when no cache or endpoint not implemented
      }
    };
    loadCachedAi();
  }, [id, review]);

  /* useAutoSave: periodically saves draft to backend */
  const autoSaveFn = useCallback(async (data) => {
    await API.patch(`/reviews/${id}/draft`, data);
  }, [id]);
  const { saving: autoSaving, lastSaved: autoSavedAt } = useAutoSave({
    data: { score, comments },
    saveFn: autoSaveFn,
    intervalMs: 30000,
    enabled: !!id && !review?.review_id,
  });

  /* Fetch calibration deviation data */
  useEffect(() => {
    if (!id) return;
    API.get(`/api/ai/calibration/${id}`)
      .then((res) => setDeviationData(res.data))
      .catch(() => {});
  }, [id]);

  const handleSubmit = async () => {
    if (!comments.trim()) {
      setError('Please provide comments for your review.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await API.post(`/reviews/${id}/submit`, { score, comments });
      localStorage.removeItem(draftKey);
      navigate('/reviews');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  /** Request AI Feedback analysis for the current comments */
  const handleAiFeedback = async () => {
    if (!comments.trim()) {
      setFeedbackError('Write some comments first before analyzing.');
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const res = await API.post('/api/ai/feedback', { review_id: id, text: comments });
      setAiFeedback(res.data);
    } catch (err) {
      setFeedbackError(err.response?.data?.message || 'AI feedback analysis failed');
    } finally {
      setFeedbackLoading(false);
    }
  };

  /** Request AI Rewrite suggestion for the current comments */
  const handleAiRewrite = async () => {
    if (!comments.trim()) {
      setRewriteError('Write some comments first before getting suggestions.');
      return;
    }
    setRewriteLoading(true);
    setRewriteError('');
    try {
      const res = await API.post('/api/ai/rewrite', {
        review_id: id,
        text: comments,
        context: review?.title || '',
      });
      setAiRewrite(res.data);
      setRewriteAdopted(false);
    } catch (err) {
      setRewriteError(err.response?.data?.message || 'AI rewrite suggestion failed');
    } finally {
      setRewriteLoading(false);
    }
  };

  /** Adopt the AI rewrite suggestion */
  const handleAdoptRewrite = async () => {
    if (aiRewrite?.revised_text) {
      setComments(aiRewrite.revised_text);
      try {
        await API.patch(`/api/ai/rewrite/${id}/adopt`);
      } catch { /* best-effort */ }
      setRewriteAdopted(true);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-2 text-slate-500">Loading review...</span>
      </div>
    );
  }

  if (error && !review) {
    return (
      <Card className="max-w-md mx-auto text-center px-6 py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Error</h3>
        <p className="text-sm text-red-600 mb-4" role="alert" aria-live="assertive">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/reviews')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reviews
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Assignment</h1>
        <p className="text-sm text-slate-500 mt-1">
          Reviewing: <strong className="text-slate-700">{review?.title}</strong> by {review?.student_name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Document viewer */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="p-6 min-h-[500px]">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#000E2F]" />
              Document
            </h3>
            {review?.file_url ? (
              review.file_url.endsWith('.pdf') ? (
                <PdfViewer url={review.file_url} className="w-full h-[450px] rounded-lg" />
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-slate-500">This file type cannot be previewed inline.</p>
                  <Button variant="secondary" size="sm" className="mt-3" asChild>
                    <a href={review.file_url} target="_blank" rel="noreferrer">
                      <Download className="w-4 h-4 mr-1" />
                      Download File
                    </a>
                  </Button>
                </div>
              )
            ) : (
              <p className="text-sm text-slate-400">No file available</p>
            )}
          </Card>
        </motion.div>

        {/* Right: Review form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Your Review</h3>

            {review?.review_id ? (
              // Already reviewed
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  This review has already been submitted.
                </div>
                <div>
                  <span className="text-sm text-slate-500">{strings.reviews.score}: </span>
                  <Badge type="info" className="ml-1">{review.score}</Badge>
                </div>
                <div>
                  <span className="text-sm text-slate-500">{strings.reviews.comments}:</span>
                  <p className="mt-1 text-sm text-slate-700">{review.comments}</p>
                </div>
              </div>
            ) : (
              // Review form
              <div className="space-y-5">
                <div>
                  <ScoreSelector
                    label="Score (1-5)"
                    value={score}
                    onChange={setScore}
                  />
                  <div className="mt-3">
                    <FileReviewRubric currentScore={score} courseId={review?.course_id} />
                  </div>
                  <ScoreSuggestionPanel reviewId={id} currentScore={score} onAccept={(s) => setScore(s)} />
                  {deviationData && <CalibrationAlert deviation={deviationData} />}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="comments">Comments</label>
                  <RichTextEditor
                    value={comments}
                    onChange={setComments}
                    placeholder="Write your review..."
                  />
                  {(draftStatus || autoSaving || autoSavedAt) && (
                    <p className="text-xs text-slate-400 mt-1">
                      {autoSaving ? 'Auto-saving...' : autoSavedAt ? `Auto-saved at ${autoSavedAt.toLocaleTimeString()}` : draftStatus}
                    </p>
                  )}
                </div>

                {/* AI Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ai" size="sm" icon={ShieldAlert} onClick={handleAiFeedback} loading={feedbackLoading}
                    disabled={feedbackLoading || !comments.trim()}>
                    Analyze Tone
                  </Button>
                  <Button variant="ai" size="sm" icon={RefreshCw} onClick={handleAiRewrite} loading={rewriteLoading}
                    disabled={rewriteLoading || !comments.trim()}>
                    {strings.reviews.aiRewrite}
                  </Button>
                </div>

                {/* AI Feedback Panel */}
                <AnimatePresence>
                  {feedbackError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {feedbackError}
                    </motion.div>
                  )}
                  {aiFeedback && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-teal-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" /> AI Tone Analysis
                      </h4>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-slate-500">Toxicity</p>
                          <p className={`text-lg font-bold ${(aiFeedback.toxicity ?? 0) > 0.5 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {((aiFeedback.toxicity ?? 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Politeness</p>
                          <p className={`text-lg font-bold ${(aiFeedback.politeness ?? 0) > 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {((aiFeedback.politeness ?? 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Sentiment</p>
                          <p className="text-lg font-bold text-slate-700 capitalize">{aiFeedback.sentiment || 'neutral'}</p>
                        </div>
                      </div>
                      {aiFeedback.cached && <p className="text-xs text-slate-400">Cached result</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* AI Rewrite Panel */}
                <AnimatePresence>
                  {rewriteError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {rewriteError}
                    </motion.div>
                  )}
                  {aiRewrite && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4" /> AI Rewrite Suggestion
                      </h4>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-indigo-100">
                        {aiRewrite.revised_text}
                      </p>
                      {aiRewrite.edits?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-500">Changes made:</p>
                          {aiRewrite.edits.map((e, i) => (
                            <div key={i} className="text-xs text-slate-600 bg-white rounded p-2 border border-indigo-100">
                              <span className="line-through text-red-400">{e.original}</span>
                              {' → '}
                              <span className="text-emerald-600 font-medium">{e.replacement}</span>
                              {e.reason && <span className="text-slate-400 ml-1">({e.reason})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {!rewriteAdopted ? (
                          <Button variant="success" size="sm" icon={Check} onClick={handleAdoptRewrite}>
                            Adopt Suggestion
                          </Button>
                        ) : (
                          <span className="text-sm text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> {strings.reviews.adopted}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(aiRewrite.revised_text)}>
                          Copy
                        </Button>
                      </div>
                      {aiRewrite.cached && <p className="text-xs text-slate-400">Cached result</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600" role="alert" aria-live="assertive">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={submitting} loading={submitting}>
                    {strings.reviews.submitReview}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/reviews')}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <AiChatWidget contextType="writing_review" contextId={id} />
    </div>
  );
}
