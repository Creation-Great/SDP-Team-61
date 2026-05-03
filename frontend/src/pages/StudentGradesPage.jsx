import { useEffect, useState } from 'react';
import { Loader2, GraduationCap } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function StudentGradesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ file_reviews: [], peer_reviews: [] });

  useEffect(() => {
    API.get('/submissions/my-grades')
      .then((res) => setData(res.data || { file_reviews: [], peer_reviews: [] }))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load grades summary'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading grades summary...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  const thClass = 'p-3 text-left text-xs font-medium text-slate-500';
  const tdClass = 'p-3 text-sm text-slate-700';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#000E2F]" />
          My Grades
        </h1>
        <p className="text-slate-500 mt-1">Released peer-review scores and file-review averages.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <h2 className="font-semibold text-slate-900">File Review Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className={thClass}>Submission</th>
                <th className={thClass}>Course</th>
                <th className={thClass}>Avg Score</th>
                <th className={thClass}>Reviews</th>
                <th className={thClass}>Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.file_reviews.length === 0 ? (
                <tr><td className={tdClass} colSpan={5}>No file-review data yet.</td></tr>
              ) : data.file_reviews.map((r) => (
                <tr key={r.submission_id}>
                  <td className={tdClass}>{r.submission_title}</td>
                  <td className={tdClass}>{r.course_id || '—'}</td>
                  <td className={tdClass}>{r.avg_score ?? '—'}</td>
                  <td className={tdClass}>{r.review_count ?? 0}</td>
                  <td className={tdClass}>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <h2 className="font-semibold text-slate-900">Peer Review Sessions (Released)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className={thClass}>Session</th>
                <th className={thClass}>Course</th>
                <th className={thClass}>Technical</th>
                <th className={thClass}>Interactions</th>
                <th className={thClass}>Management</th>
                <th className={thClass}>Chemistry</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.peer_reviews.length === 0 ? (
                <tr><td className={tdClass} colSpan={7}>No released peer-review data yet.</td></tr>
              ) : data.peer_reviews.map((r) => (
                <tr key={r.session_id}>
                  <td className={tdClass}>{r.session_title}</td>
                  <td className={tdClass}>{r.course_id || '—'}</td>
                  <td className={tdClass}>{r.avg_technical ?? '—'}</td>
                  <td className={tdClass}>{r.avg_interactions ?? '—'}</td>
                  <td className={tdClass}>{r.avg_management ?? '—'}</td>
                  <td className={tdClass}>{r.avg_team_chemistry ?? '—'}</td>
                  <td className={tdClass}><Badge type="info">Released</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
