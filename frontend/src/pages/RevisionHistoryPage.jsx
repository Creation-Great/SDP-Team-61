import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { FileText, GitBranch, ArrowLeft, Clock } from 'lucide-react';

export default function RevisionHistoryPage() {
  const { id } = useParams();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    API.get(`/revisions/${id}/history`)
      .then(r => setRevisions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const loadDiff = (subId) => {
    setDiffLoading(true);
    API.get(`/revisions/${subId}/diff`)
      .then(r => setDiff(r.data))
      .catch(() => {})
      .finally(() => setDiffLoading(false));
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6"><div className="animate-pulse h-64 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-slate-400 hover:text-slate-600"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-[#000E2F]">Revision History</h1>
        <Badge type="info">{revisions.length} revision{revisions.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="space-y-4">
        {revisions.map((rev, i) => (
          <Card key={rev.submission_id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-[#000E2F] text-white' : 'bg-slate-100 text-slate-600'}`}>
                  v{rev.revision_number}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{rev.title}</h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock size={14} />
                    {new Date(rev.created_at).toLocaleString()}
                  </p>
                  {rev.description && <p className="text-sm text-slate-600 mt-1">{rev.description}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge type={rev.status === 'reviewed' ? 'success' : 'default'}>{rev.status}</Badge>
                {rev.revision_number > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => loadDiff(rev.submission_id)}>
                    <GitBranch size={14} className="mr-1" /> Diff
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {diff && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Changes</h3>
          <div className="space-y-1 font-mono text-sm">
            {diff.changes?.map((line, i) => (
              <div key={i} className={`px-3 py-0.5 rounded ${
                line.type === 'add' ? 'bg-emerald-50 text-emerald-800' :
                line.type === 'remove' ? 'bg-red-50 text-red-800' :
                'text-slate-600'
              }`}>
                <span className="select-none mr-2">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
                {line.content}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
