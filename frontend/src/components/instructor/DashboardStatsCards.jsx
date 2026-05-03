import { useNavigate } from 'react-router-dom';
import { ChevronRight, BarChart3, Radio } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import AiLogsPanel from './AiLogsPanel';

/**
 * Overview tab content: stat cards, active sessions, AI activity logs,
 * live events feed, and weekly trends table.
 */
export default function DashboardStatsCards({
  dashboard,
  weeklyTrends,
  checkinRate,
  fr,
  pr,
  aiLogs,
  aiLogsLoading,
  liveEvents,
  setLiveEvents,
  connected,
}) {
  const navigate = useNavigate();

  const thClass = 'text-left py-3 px-4 font-medium text-slate-500 text-sm whitespace-nowrap';
  const tdClass = 'py-3 px-4 text-sm text-slate-700';

  if (!dashboard) {
    return (
      <Card className="text-center px-6 py-12">
        <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Unified dashboard data unavailable.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Stat Cards with border-l-4 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 border-l-4 border-l-[#000E2F]">
          <h3 className="text-slate-500 font-medium text-sm">Total Submissions</h3>
          <div className="text-3xl font-bold text-slate-900 mt-2">{fr.total_submissions || 0}</div>
        </Card>
        <Card className="p-6 border-l-4 border-l-emerald-500">
          <h3 className="text-slate-500 font-medium text-sm">Active Review Sessions</h3>
          <div className="text-3xl font-bold text-slate-900 mt-2">{pr.open_sessions || 0}</div>
        </Card>
        <Card className="p-6 border-l-4 border-l-amber-500 cursor-pointer hover:bg-slate-50" onClick={() => navigate('/instructor/analytics')}>
          <h3 className="text-slate-500 font-medium text-sm flex items-center justify-between">Flags / Anomalies <ChevronRight className="w-4 h-4" /></h3>
          <div className="text-3xl font-bold text-amber-600 mt-2">{fr.total_assigned - fr.total_completed || 0}</div>
        </Card>
        <Card className="p-6 border-l-4 border-l-teal-500 cursor-pointer hover:bg-slate-50" onClick={() => navigate('/instructor/class-checkins')}>
          <h3 className="text-slate-500 font-medium text-sm flex items-center justify-between">Check-in Compliance <ChevronRight className="w-4 h-4" /></h3>
          <div className="text-3xl font-bold text-slate-900 mt-2">{checkinRate}%</div>
        </Card>
      </div>

      {/* Two-column: Active Sessions + AI Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions Overview */}
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Active Sessions Overview</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/peer-review')}>Manage</Button>
          </div>
          <div className="p-6 space-y-4">
            {pr.open_sessions > 0 ? (
              weeklyTrends.slice(0, 4).map((row, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-900">{row.course_id || 'Course'} — {row.group_id || 'All'}</h4>
                    <Badge type="success">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500 mb-3">
                    <span>Week: {row.wk ? new Date(row.wk).toLocaleDateString() : '—'}</span>
                    <span>{row.reviews_completed || 0} / {row.assignments || 0} Completed</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${row.reviews_completed >= row.assignments ? 'bg-emerald-500' : 'bg-[#000E2F]'}`}
                      style={{ width: `${row.assignments ? Math.round((row.reviews_completed / row.assignments) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No active sessions.</p>
            )}
          </div>
        </Card>

        {/* AI Activity Logs */}
        <AiLogsPanel aiLogs={aiLogs} aiLogsLoading={aiLogsLoading} />
      </div>

      {/* Live Events Feed */}
      {liveEvents.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-500" /> Live Events
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setLiveEvents([])}>Clear</Button>
          </div>
          <div className="p-6 space-y-3 max-h-64 overflow-y-auto">
            {liveEvents.map((evt, i) => {
              const labels = {
                submission_created: 'New Submission',
                review_submitted: 'Review Submitted',
                peer_review_submitted: 'Peer Review Submitted',
              };
              const colors = {
                submission_created: 'info',
                review_submitted: 'success',
                peer_review_submitted: 'warning',
              };
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Badge type={colors[evt.type] || 'info'}>{labels[evt.type] || evt.type}</Badge>
                  <span className="text-slate-700">
                    {evt.data?.student_name || evt.data?.reviewer_name || 'Unknown'}
                    {evt.data?.title ? ` — "${evt.data.title}"` : ''}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
                    {new Date(evt.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Weekly Trends table */}
      {weeklyTrends.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900">Weekly Trends</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Weekly submission trends by course and group</caption>
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th scope="col" className={thClass}>Week</th>
                  <th scope="col" className={thClass}>Course</th>
                  <th scope="col" className={thClass}>Group</th>
                  <th scope="col" className={thClass}>Submissions</th>
                  <th scope="col" className={thClass}>Assignments</th>
                  <th scope="col" className={thClass}>Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklyTrends.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className={tdClass}>{row.wk ? new Date(row.wk).toLocaleDateString() : '—'}</td>
                    <td className={tdClass}>{row.course_id || '—'}</td>
                    <td className={tdClass}>{row.group_id || '—'}</td>
                    <td className={tdClass}>{row.submissions}</td>
                    <td className={tdClass}>{row.assignments}</td>
                    <td className={tdClass}>{row.reviews_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

