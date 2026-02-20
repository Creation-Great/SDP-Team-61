import { useEffect, useState } from 'react';
import { CheckSquare, Loader2, AlertCircle } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';

export default function ClassCheckinsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [studRes, insRes] = await Promise.all([
          API.get('/instructor/checkins/students'),
          API.get('/instructor/checkins/insights').catch(() => ({ data: { insights: [] } })),
        ]);
        if (!cancelled) {
          setStudents(Array.isArray(studRes.data) ? studRes.data : []);
          setInsights(Array.isArray(insRes.data?.insights) ? insRes.data.insights : []);
        }
      } catch {
        if (!cancelled) setError('Failed to load class check-ins');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const submissionRate = students.length > 0
    ? Math.round((insights.length / students.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-500">Loading class check-ins...</span>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Check-ins Overview</h1>
          <p className="text-slate-500 mt-1">Aggregated insights from weekly student reports.</p>
        </div>
      </div>

      <Card className="p-8 text-center border-dashed border-2 border-slate-300">
        <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Detailed Check-ins Dashboard</h3>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          This aggregates data from all HandedOutTables, InsightsTables, and RollingAverages across the class.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl">
            <div className="text-2xl font-bold text-emerald-700">{submissionRate}%</div>
            <div className="text-sm text-emerald-600">Submission Rate</div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-xl">
            <div className="text-2xl font-bold text-indigo-700">{students.length}</div>
            <div className="text-sm text-indigo-600">Total Students</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
