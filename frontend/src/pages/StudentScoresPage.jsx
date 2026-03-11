import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Lock, BarChart3 } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function StudentScoresPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/student-scores`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load scores'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading scores...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-20 text-center px-6 py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-slate-500 mb-6">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/peer-review')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
        </Button>
      </Card>
    );
  }

  if (!data?.released) {
    return (
      <Card className="max-w-lg mx-auto mt-20 text-center px-6 py-12">
        <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Scores Not Yet Released</h3>
        <p className="text-slate-500 mb-6">
          Your instructor has not released scores for this session yet. Check back later.
        </p>
        <Button variant="secondary" onClick={() => navigate('/peer-review')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sessions
        </Button>
      </Card>
    );
  }

  const scores = data.scores;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button variant="ghost" onClick={() => navigate('/peer-review')} className="pl-0">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Sessions
      </Button>

      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#000E2F]/5 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#000E2F]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Peer Review Scores</h2>
            <p className="text-sm text-slate-500">{data.session?.title}</p>
          </div>
        </div>

        {scores ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Technical', value: scores.avg_technical },
                { label: 'Interactions', value: scores.avg_interactions },
                { label: 'Management', value: scores.avg_management },
                { label: 'Chemistry', value: scores.avg_team_chemistry },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-2xl font-bold text-[#000E2F]">{value ?? '—'}</p>
                  <p className="text-xs text-slate-400">/5.0</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#000E2F]/5 border border-[#000E2F]/10">
              <span className="text-sm font-medium text-slate-700">Reviews received</span>
              <Badge type="info">{scores.review_count} reviews</Badge>
            </div>

            {scores.self_review_count > 0 && (
              <p className="text-xs text-slate-400 text-center">
                Includes {scores.self_review_count} self-review(s)
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No review scores available for you in this session.</p>
        )}
      </Card>
    </div>
  );
}
