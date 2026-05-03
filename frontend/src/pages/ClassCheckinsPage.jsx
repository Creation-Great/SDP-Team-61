import { useEffect, useState } from 'react';
import { CheckSquare, Loader2, AlertCircle, Users, TrendingUp, BarChart3 } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';

/**
 * Instructor view of class check-ins: students list, insights, and check-in template.
 * Fetches GET /instructor/checkins/students, /instructor/checkins/insights, /instructor/checkins/current.
 * @returns {JSX.Element}
 */
export default function ClassCheckinsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [insights, setInsights] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState(0);
  const [checkinTemplate, setCheckinTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('insights');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [studRes, insRes, tplRes] = await Promise.all([
          API.get('/instructor/checkins/students'),
          API.get('/instructor/checkins/insights').catch(() => ({ data: { insights: [], student_submissions: 0 } })),
          API.get('/instructor/checkins/current').catch(() => ({ data: null })),
        ]);
        if (!cancelled) {
          const d = studRes.data;
          setStudents(Array.isArray(d) ? d : (d?.students ?? []));
          const insData = insRes.data || {};
          setInsights(Array.isArray(insData.insights) ? insData.insights : []);
          setStudentSubmissions(insData.student_submissions ?? 0);
          setCheckinTemplate(tplRes.data ?? null);
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
    ? Math.round((studentSubmissions / students.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
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

  const tabs = ['insights', 'weekly scores', 'students'];

  // Helpers for score coloring
  const scoreColor = (val) => {
    if (val == null) return 'text-slate-400';
    if (val >= 4) return 'text-emerald-600';
    if (val >= 3) return 'text-amber-600';
    return 'text-red-600';
  };

  const formatScore = (val) => (val != null ? val.toFixed(1) : '—');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Check-ins Overview</h1>
          <p className="text-slate-500 mt-1">Aggregated insights from weekly student reports.</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{submissionRate}%</div>
            <div className="text-sm text-slate-500">Submission Rate</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#000E2F]/5 flex items-center justify-center">
            <Users className="w-6 h-6 text-[#000E2F]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{students.length}</div>
            <div className="text-sm text-slate-500">Total Students</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{studentSubmissions}</div>
            <div className="text-sm text-slate-500">Self-Reports Submitted</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-[#000E2F] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- TAB: Insights --- */}
      {activeTab === 'insights' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900">Score Comparison: Instructor vs Self vs Peer</h2>
            <p className="text-sm text-slate-500 mt-1">Average scores per team member across all topics and weeks.</p>
          </div>
          {insights.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>No insights data available yet. Ensure check-in scores have been saved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="text-left px-6 py-3 font-semibold">Member</th>
                    <th className="text-left px-6 py-3 font-semibold">Team</th>
                    <th className="text-center px-6 py-3 font-semibold">Instructor Avg</th>
                    <th className="text-center px-6 py-3 font-semibold">Self Avg</th>
                    <th className="text-center px-6 py-3 font-semibold">Peer Avg</th>
                    <th className="text-center px-6 py-3 font-semibold">Gap (Self − Instr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {insights.map((row) => {
                    const gap = (row.self_average != null && row.instructor_average != null)
                      ? (row.self_average - row.instructor_average).toFixed(1)
                      : null;
                    const gapColor = gap == null ? 'text-slate-400'
                      : Number(gap) > 0.5 ? 'text-amber-600'
                      : Number(gap) < -0.5 ? 'text-red-600'
                      : 'text-green-600';

                    return (
                      <tr key={row.member_id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 text-sm font-medium text-slate-900">{row.name}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">{row.team || '—'}</td>
                        <td className={`px-6 py-3 text-sm text-center font-semibold ${scoreColor(row.instructor_average)}`}>
                          {formatScore(row.instructor_average)}
                        </td>
                        <td className={`px-6 py-3 text-sm text-center font-semibold ${scoreColor(row.self_average)}`}>
                          {formatScore(row.self_average)}
                        </td>
                        <td className={`px-6 py-3 text-sm text-center font-semibold ${scoreColor(row.peer_average)}`}>
                          {formatScore(row.peer_average)}
                        </td>
                        <td className={`px-6 py-3 text-sm text-center font-semibold ${gapColor}`}>
                          {gap != null ? (Number(gap) > 0 ? `+${gap}` : gap) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* --- TAB: Weekly Scores --- */}
      {activeTab === 'weekly scores' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900">Instructor Weekly Scores</h2>
            <p className="text-sm text-slate-500 mt-1">
              {checkinTemplate
                ? `Topics: ${(checkinTemplate.topics || []).join(', ')}`
                : 'No check-in template configured yet.'}
            </p>
          </div>
          {!checkinTemplate || !(checkinTemplate.weeks?.length > 0) ? (
            <div className="p-8 text-center text-slate-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>No weekly scores recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-50 z-10">Member</th>
                    {checkinTemplate.weeks.map((w, i) => (
                      <th key={i} className="text-center px-4 py-3 font-semibold whitespace-nowrap">
                        {w.label || `Week ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(checkinTemplate.members || []).map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 sticky left-0 bg-white z-10">
                        {m.name}
                        {m.team && <span className="ml-2 text-xs text-slate-400">({m.team})</span>}
                      </td>
                      {checkinTemplate.weeks.map((w, wi) => {
                        const memberScores = w.scores?.[m.id];
                        if (!memberScores) {
                          return <td key={wi} className="px-4 py-3 text-center text-sm text-slate-300">—</td>;
                        }
                        const vals = Object.values(memberScores).map(Number).filter(v => !Number.isNaN(v) && v >= 1 && v <= 5);
                        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                        return (
                          <td key={wi} className={`px-4 py-3 text-center text-sm font-semibold ${scoreColor(avg)}`}>
                            {formatScore(avg)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* --- TAB: Students --- */}
      {activeTab === 'students' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900">Enrolled Students</h2>
            <p className="text-sm text-slate-500 mt-1">{students.length} students in this course/group.</p>
          </div>
          {students.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>No students found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="text-left px-6 py-3 font-semibold">#</th>
                    <th className="text-left px-6 py-3 font-semibold">Name</th>
                    <th className="text-left px-6 py-3 font-semibold">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, i) => (
                    <tr key={s.user_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-sm text-slate-400">{i + 1}</td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{s.display_name}</td>
                      <td className="px-6 py-3 text-sm text-slate-500">{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
