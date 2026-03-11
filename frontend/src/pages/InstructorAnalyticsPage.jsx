import { useEffect, useState } from 'react';
import { FileText, TrendingUp, AlertCircle, Loader2, Download, Flag, ShieldAlert } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { API_BASE_URL } from '../config';

export default function InstructorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [qualityFlags, setQualityFlags] = useState([]);
  const [peerQualityFlags, setPeerQualityFlags] = useState([]);
  const [flagsLoading, setFlagsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get('/instructor/unified-dashboard');
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError('Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load quality flags from backend
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      API.get('/instructor/quality-flags').then((r) => r.data).catch(() => []),
      API.get('/instructor/peer-review-quality-flags').then((r) => r.data).catch(() => []),
    ]).then(([fileFlags, peerFlags]) => {
      if (!cancelled) {
        setQualityFlags(Array.isArray(fileFlags) ? fileFlags : []);
        setPeerQualityFlags(Array.isArray(peerFlags) ? peerFlags : []);
      }
    }).finally(() => { if (!cancelled) setFlagsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fr = data?.file_reviews || {};
  const pr = data?.peer_reviews || {};
  const students = data?.student_participation || [];

  /* Compute score distribution buckets from avg_peer_score_received */
  const buckets = [0, 0, 0, 0, 0]; // 1-5
  students.forEach((s) => {
    const avg = Number(s.avg_peer_score_received || s.avg_file_score_received || 0);
    if (avg > 0) {
      const idx = Math.min(Math.max(Math.round(avg) - 1, 0), 4);
      buckets[idx]++;
    }
  });
  const maxBucket = Math.max(...buckets, 1);

  /* Anomaly detection: students with 0 reviews given */
  const flagged = students.filter(
    (s) => Number(s.file_reviews_given || 0) + Number(s.peer_reviews_given || 0) === 0
  );

  const exportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Name', 'Course', 'Group', 'File Reviews Given', 'File Reviews Received', 'Avg File Score', 'Peer Reviews Given', 'Peer Reviews Received', 'Avg Peer Score'];
    const rows = students.map((s) =>
      [s.name, s.course_id, s.group_id, s.file_reviews_given, s.file_reviews_received, s.avg_file_score_received, s.peer_reviews_given, s.peer_reviews_received, s.avg_peer_score_received].join(',')
    );
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics-roster.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Server-side file review CSV export (includes per-submission breakdown)
  const exportFileReviewCsv = () => {
    window.open(`${API_BASE_URL}/instructor/export-csv`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Analytics &amp; Reports</h1>
          <p className="text-slate-500 mt-1">Class-wide performance and anomaly detection.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={FileText} onClick={exportCsv}>
            Roster CSV
          </Button>
          <Button variant="secondary" icon={FileText} onClick={exportFileReviewCsv}>
            File Review CSV
          </Button>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-[#000E2F]" /> Score Distribution
          </h3>
          <div className="h-40 flex items-end justify-between gap-2 border-b border-slate-200 pb-2">
            {buckets.map((count, i) => (
              <div
                key={i}
                className="w-1/5 bg-[#000E2F]/50 rounded-t-sm transition-all"
                style={{ height: `${(count / maxBucket) * 100}%`, minHeight: count > 0 ? '8px' : '0' }}
                title={`${count} student(s)`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
            <span>1 Star</span><span>2 Stars</span><span>3 Stars</span><span>4 Stars</span><span>5 Stars</span>
          </div>
        </Card>

        {/* Detected Anomalies */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-amber-500" /> Detected Anomalies
          </h3>
          <div className="space-y-3">
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-500">No anomalies detected. All students appear on track.</p>
            ) : (
              flagged.slice(0, 5).map((s, i) => (
                <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                  <span className="font-bold">{s.name}</span> has given 0 reviews (file + peer).
                </div>
              ))
            )}
            {flagged.length > 5 && (
              <p className="text-xs text-slate-500">+{flagged.length - 5} more flagged student(s)</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Quality Flags ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Review Quality Flags */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Flag className="w-5 h-5 mr-2 text-red-500" /> File Review Quality Flags
          </h3>
          {flagsLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : qualityFlags.length === 0 ? (
            <p className="text-sm text-slate-500">No file review quality issues detected.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {qualityFlags.map((f, i) => (
                <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{f.reviewer_name}</span>
                    <Badge type="error">{f.flag_reason}</Badge>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Reviewed <span className="font-medium">{f.author_name}</span>'s "{f.submission_title}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Peer Review Quality Flags */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2 text-orange-500" /> Peer Review Quality Flags
          </h3>
          {flagsLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : peerQualityFlags.length === 0 ? (
            <p className="text-sm text-slate-500">No peer review quality issues detected.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {peerQualityFlags.map((f, i) => (
                <div key={i} className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{f.reviewer_name}</span>
                    <Badge type="warning">{f.flag_reason}</Badge>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Reviewed <span className="font-medium">{f.reviewee_name}</span> in "{f.session_title}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Student Performance Roster ── */}
      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Student Performance Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-4 font-medium">Student Name</th>
                <th className="p-4 font-medium">Reviews Given</th>
                <th className="p-4 font-medium">Avg Score Given</th>
                <th className="p-4 font-medium">Avg Score Received</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No student data available</td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const given = Number(s.file_reviews_given || 0) + Number(s.peer_reviews_given || 0);
                  const avgGiven = Number(s.avg_file_score_received || 0).toFixed(1);
                  const avgReceived = Number(s.avg_peer_score_received || 0).toFixed(1);
                  const isFlagged = given === 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-900">{s.name}</td>
                      <td className="p-4 text-slate-600">{given}</td>
                      <td className="p-4 text-slate-600">{avgGiven}</td>
                      <td className="p-4 text-slate-600">{avgReceived}</td>
                      <td className="p-4">
                        {isFlagged
                          ? <Badge type="error">Missing Reviews</Badge>
                          : <Badge type="success">On Track</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
