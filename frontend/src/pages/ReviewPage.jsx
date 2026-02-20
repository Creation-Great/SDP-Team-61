import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, ArrowLeft, FileText, Download } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ScoreSelector from '../components/ScoreSelector';

export default function ReviewPage() {
  const { id } = useParams(); // assignment_id
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [score, setScore] = useState(3);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get(`/reviews/${id}`)
      .then((res) => setReview(res.data))
      .catch((err) => {
        console.error('Failed to load review:', err);
        setError('Failed to load review details');
      })
      .finally(() => setLoading(false));
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
      navigate('/reviews');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
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
              <FileText className="w-4 h-4 text-indigo-500" />
              Document
            </h3>
            {review?.file_url ? (
              review.file_url.endsWith('.pdf') ? (
                <iframe
                  src={review.file_url}
                  title="Document Preview"
                  className="w-full h-[450px] border-0 rounded-lg bg-white"
                />
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
                  <span className="text-sm text-slate-500">Score: </span>
                  <Badge type="info" className="ml-1">{review.score}</Badge>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Comments:</span>
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="comments">Comments</label>
                  <textarea
                    id="comments"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-y"
                    placeholder="Provide detailed feedback on this submission..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={6}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600" role="alert" aria-live="assertive">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={submitting} loading={submitting}>
                    Submit Review
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
    </div>
  );
}
