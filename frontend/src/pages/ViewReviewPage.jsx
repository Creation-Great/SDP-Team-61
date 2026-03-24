import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, Download, MessageSquare, Star, Sparkles, ShieldAlert } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/**
 * View submission and its reviews. GET /reviews/by-submission/:submissionId. Optional AI summary/feedback.
 * Rendered at /view-review/:submissionId.
 * @returns {JSX.Element}
 */
export default function ViewReviewPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* AI Summary state */
  const [aiSummary, setAiSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  /* AI Feedback state per review (keyed by review_id) */
  const [feedbackMap, setFeedbackMap] = useState({});
  const [feedbackLoadingMap, setFeedbackLoadingMap] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get(`/reviews/by-submission/${submissionId}`);
        setSubmission(res.data.submission);
        setReviews(res.data.reviews);
      } catch (err) {
        console.error('Error loading reviews:', err);
        setError('Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [submissionId]);

  /** Preload cached AI feedback per review (GET /api/ai/feedback/:reviewId) */
  useEffect(() => {
    if (reviews.length === 0) return;
    const loadCachedFeedback = async () => {
      const next = {};
      await Promise.all(
        reviews.map(async (r) => {
          const reviewId = r.review_id ?? r.assignment_id ?? r.id;
          if (!reviewId) return;
          try {
            const res = await API.get(`/api/ai/feedback/${reviewId}`);
            if (res?.data) next[reviewId] = res.data;
          } catch {
            // Ignore when no cache
          }
        })
      );
      setFeedbackMap((m) => ({ ...m, ...next }));
    };
    loadCachedFeedback();
  }, [submissionId, reviews.length]);

  /** Analyze a single review's tone via AI Feedback */
  const handleAnalyzeReview = async (reviewId, text) => {
    setFeedbackLoadingMap((m) => ({ ...m, [reviewId]: true }));
    try {
      const res = await API.post('/api/ai/feedback', { review_id: reviewId, text });
      setFeedbackMap((m) => ({ ...m, [reviewId]: res.data }));
    } catch {
      setFeedbackMap((m) => ({ ...m, [reviewId]: { error: true } }));
    } finally {
      setFeedbackLoadingMap((m) => ({ ...m, [reviewId]: false }));
    }
  };

  const handleSummarize = async () => {
    if (reviews.length === 0) return;
    setIsSummarizing(true);
    try {
      const res = await API.post('/api/ai/summarize', { reviews });
      setAiSummary(res.data?.summary || 'Summary generated successfully.');
    } catch {
      /* Fallback: build a client-side summary */
      const scores = reviews.filter(r => r.score != null).map(r => Number(r.score));
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
      setAiSummary(`### Summary\n* **Average Score**: ${avg}/5.0\n* **Total Reviews**: ${reviews.length}\n* Key feedback themes extracted from ${reviews.length} review(s).`);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-2 text-slate-500">Loading reviews...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto text-center px-6 py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Error</h3>
        <p className="text-sm text-red-600 mb-4" role="alert" aria-live="assertive">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Review Results</h1>
          {submission && (
            <p className="text-slate-500 mt-1">{submission.title}</p>
          )}
        </div>
        <div className="flex gap-3">
          {submission?.file_url && (
            <Button variant="secondary" asChild>
              <a href={submission.file_url} target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-1.5" />
                Download
              </a>
            </Button>
          )}
          <Button variant="ai" icon={Sparkles} onClick={handleSummarize} loading={isSummarizing}>
            Generate AI Summary
          </Button>
        </div>
      </div>

      {/* AI Summary Card */}
      {aiSummary && (
        <Card className="p-6 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-teal-500" />
          <div className="flex items-center gap-2 mb-4 text-teal-900 font-bold text-lg">
            <Sparkles className="w-5 h-5 text-teal-600" /> AI Comprehensive Summary
          </div>
          <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap leading-relaxed">
            {aiSummary}
          </div>
        </Card>
      )}

      {/* Reviews Grid */}
      {reviews.length === 0 ? (
        <Card className="text-center px-6 py-12">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No reviews yet</h3>
          <p className="text-sm text-slate-500">Your submission has not been reviewed yet. Check back later.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((review) => {
            const fb = feedbackMap[review.review_id];
            const fbLoading = feedbackLoadingMap[review.review_id];
            return (
              <Card key={review.review_id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {review.reviewer_name || 'Anonymous Peer'}
                  </span>
                  <div className="flex items-center text-amber-500 font-bold">
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    {review.score != null ? Number(review.score).toFixed(1) : '—'}
                  </div>
                </div>
                {review.comments && (
                  <p className="text-slate-700 text-sm leading-relaxed">"{review.comments}"</p>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  {new Date(review.created_at).toLocaleString()}
                </p>

                {/* AI Feedback for this review */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {!fb && (
                    <Button variant="ghost" size="sm" icon={ShieldAlert} onClick={() => handleAnalyzeReview(review.review_id, review.comments)}
                      loading={fbLoading} disabled={fbLoading || !review.comments}>
                      Analyze Tone
                    </Button>
                  )}
                  {fb && !fb.error && (
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div>
                        <p className="text-xs text-slate-400">Toxicity</p>
                        <p className={`text-sm font-bold ${(fb.toxicity ?? 0) > 0.5 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {((fb.toxicity ?? 0) * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Politeness</p>
                        <p className={`text-sm font-bold ${(fb.politeness ?? 0) > 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {((fb.politeness ?? 0) * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Sentiment</p>
                        <p className="text-sm font-bold text-slate-700 capitalize">{fb.sentiment || 'neutral'}</p>
                      </div>
                    </div>
                  )}
                  {fb?.error && (
                    <p className="text-xs text-red-500 mt-1">Analysis failed</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-center pt-2">
        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
