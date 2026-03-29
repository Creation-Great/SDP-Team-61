import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';

export default function SimilarityDashboardPage() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course_id') || '';
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { showToast } = useToast();

  const fetchData = () => {
    setLoading(true);
    API.get(`/similarity/dashboard?course_id=${courseId}`)
      .then(r => setPairs(r.data))
      .catch(() => showToast('Failed to load similarity data', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const runCheck = () => {
    setChecking(true);
    API.post('/api/ai/similarity', { course_id: courseId })
      .then(() => { showToast('Similarity check complete', 'success'); fetchData(); })
      .catch(() => showToast('Similarity check failed', 'error'))
      .finally(() => setChecking(false));
  };

  const scoreColor = (score) => {
    if (score >= 0.5) return 'bg-red-100 text-red-800';
    if (score >= 0.3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-emerald-100 text-emerald-800';
  };

  const scoreBadge = (score) => {
    if (score >= 0.5) return 'error';
    if (score >= 0.3) return 'warning';
    return 'success';
  };

  if (loading) return <div className="max-w-7xl mx-auto p-6"><div className="animate-pulse h-64 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#000E2F]">Similarity Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{pairs.length} pair{pairs.length !== 1 ? 's' : ''} found</p>
        </div>
        <Button onClick={runCheck} disabled={checking}>
          <RefreshCw size={16} className={`mr-2 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Run Similarity Check'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Student A</th>
              <th className="text-left p-3 font-medium">Student B</th>
              <th className="text-left p-3 font-medium">Submission</th>
              <th className="text-center p-3 font-medium">Score</th>
              <th className="text-center p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pairs.map((pair, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">{pair.student_a}</td>
                <td className="p-3 font-medium text-slate-900">{pair.student_b}</td>
                <td className="p-3 text-slate-600">{pair.submission_title}</td>
                <td className="p-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${scoreColor(pair.score)}`}>
                    {(pair.score * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="p-3 text-center">
                  <Badge type={scoreBadge(pair.score)}>
                    {pair.score >= 0.5 ? 'High' : pair.score >= 0.3 ? 'Medium' : 'Low'}
                  </Badge>
                </td>
              </tr>
            ))}
            {pairs.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">No similarity pairs found</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
