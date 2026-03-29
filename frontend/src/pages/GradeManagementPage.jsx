import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { Settings, Download, Save } from 'lucide-react';

export default function GradeManagementPage() {
  const { courseId } = useParams();
  const { showToast } = useToast();
  const [weights, setWeights] = useState({ file_review_weight: 40, peer_review_weight: 40, checkin_weight: 20 });
  const [drops, setDrops] = useState({ drop_highest: 0, drop_lowest: 0 });
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      API.get(`/grades/weights/${courseId}`),
      API.get(`/grades/final/${courseId}`),
    ])
      .then(([wRes, gRes]) => {
        if (wRes.data) { setWeights(wRes.data.weights || wRes.data); setDrops(wRes.data.drops || drops); }
        setGrades(gRes.data || []);
      })
      .catch(() => showToast('Failed to load grade data', 'error'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const saveWeights = () => {
    setSaving(true);
    API.post(`/grades/weights/${courseId}`, { ...weights, ...drops })
      .then(() => showToast('Weights saved', 'success'))
      .catch(() => showToast('Failed to save weights', 'error'))
      .finally(() => setSaving(false));
  };

  const exportCsv = () => {
    const header = 'Student,File Avg,Peer Avg,Checkin Avg,Weighted Total\n';
    const rows = grades.map(g => `${g.student_name},${g.file_avg},${g.peer_avg},${g.checkin_avg},${g.weighted_total}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'grades.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="max-w-7xl mx-auto p-6"><div className="animate-pulse h-64 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#000E2F] flex items-center gap-2"><Settings size={24} /> Grade Management</h1>
        <Button variant="outline" onClick={exportCsv}><Download size={16} className="mr-2" /> Export CSV</Button>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Weight Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { key: 'file_review_weight', label: 'File Review' },
            { key: 'peer_review_weight', label: 'Peer Review' },
            { key: 'checkin_weight', label: 'Check-in' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}: {weights[key]}%</label>
              <input type="range" min={0} max={100} value={weights[key]}
                onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full accent-[#000E2F]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Drop Highest</label>
            <input type="number" min={0} max={5} value={drops.drop_highest}
              onChange={e => setDrops(prev => ({ ...prev, drop_highest: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Drop Lowest</label>
            <input type="number" min={0} max={5} value={drops.drop_lowest}
              onChange={e => setDrops(prev => ({ ...prev, drop_lowest: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveWeights} disabled={saving}><Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Weights'}</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-900 p-4 border-b border-slate-100">Final Grades</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Student</th>
              <th className="text-center p-3 font-medium">File Avg</th>
              <th className="text-center p-3 font-medium">Peer Avg</th>
              <th className="text-center p-3 font-medium">Checkin Avg</th>
              <th className="text-center p-3 font-medium">Weighted Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grades.map((g, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">{g.student_name}</td>
                <td className="p-3 text-center">{g.file_avg?.toFixed(1)}</td>
                <td className="p-3 text-center">{g.peer_avg?.toFixed(1)}</td>
                <td className="p-3 text-center">{g.checkin_avg?.toFixed(1)}</td>
                <td className="p-3 text-center font-semibold text-[#000E2F]">{g.weighted_total?.toFixed(1)}</td>
              </tr>
            ))}
            {grades.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">No grade data available</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
