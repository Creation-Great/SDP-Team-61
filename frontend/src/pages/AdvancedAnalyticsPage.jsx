import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Card from '../components/ui/Card';
import API from '../services/api';
import ScoreDistribution from '../components/charts/ScoreDistribution';
import ActivityTrend from '../components/charts/ActivityTrend';
import PeerReviewRadar from '../components/charts/PeerReviewRadar';
import CompletionHeatmap from '../components/charts/CompletionHeatmap';

export default function AdvancedAnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/instructor/overview').then((r) => r.data).catch(() => null),
      API.get('/submissions/all').then((r) => r.data).catch(() => []),
    ])
      .then(([ov, subs]) => {
        setOverview(ov);
        setSubmissions(Array.isArray(subs) ? subs : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading analytics...</span>
      </div>
    );
  }

  /* Derive score data from submissions */
  const scores = submissions
    .flatMap((s) => (s.reviews || []).map((r) => r.score))
    .filter((s) => s != null)
    .map(Number);

  const scoreDistData = [1, 2, 3, 4, 5].map((val) => ({
    score: val,
    count: scores.filter((s) => Math.round(s) === val).length,
  }));

  /* Derive activity trend from submissions by date */
  const activityMap = {};
  submissions.forEach((s) => {
    const day = new Date(s.created_at).toLocaleDateString();
    activityMap[day] = (activityMap[day] || 0) + 1;
  });
  const activityData = Object.entries(activityMap)
    .map(([date, count]) => ({ date, submissions: count }))
    .slice(-14);

  /* Radar data from overview — PeerReviewRadar expects technical, interactions, management */
  const radarData = overview
    ? {
        technical: overview.avg_score ? Number(overview.avg_score) : 0,
        interactions: overview.total_reviews || 0,
        management: overview.completion_rate || 0,
      }
    : { technical: 0, interactions: 0, management: 0 };

  /* Heatmap mock data */
  const heatmapData = submissions.slice(0, 20).map((s) => ({
    student: s.uploader_name || s.user_id || 'Unknown',
    assignment: s.title || 'Untitled',
    completed: s.status === 'reviewed' || s.status === 'submitted' ? 1 : 0,
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#000E2F]">Advanced Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Visual overview of course performance and activity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Score Distribution</h2>
          <ScoreDistribution data={scoreDistData} />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Activity Trends</h2>
          <ActivityTrend data={activityData} />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Peer Review Radar</h2>
          <PeerReviewRadar
            technical={radarData.technical || 0}
            interactions={radarData.interactions || 0}
            management={radarData.management || 0}
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Completion Heatmap</h2>
          <CompletionHeatmap data={heatmapData} />
        </Card>
      </div>
    </div>
  );
}
