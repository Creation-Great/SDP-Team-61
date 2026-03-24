import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

/**
 * List of peer review tasks assigned to the current student (GET /submissions/reviews/my-tasks).
 * Each task links to the review form. Shown when navigating to /reviews.
 * @returns {JSX.Element}
 */
export default function AssignedReviewsPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/submissions/reviews/my-tasks')
      .then((res) => setTasks(res.data))
      .catch((err) => {
        console.error('Failed to load review tasks:', err);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading review tasks"
      >
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" aria-hidden />
        <span className="ml-3 text-slate-500">Loading your review tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned Peer Reviews</h1>
        <p className="text-slate-500 mt-1">Please complete these reviews before the deadlines.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="text-center px-6 py-12">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No pending reviews</h3>
          <p className="text-slate-500">You're all caught up! Check back later for new review assignments.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto" role="region" aria-label="Assigned review tasks">
            <table className="w-full text-left">
              <caption className="sr-only">Your assigned peer review tasks</caption>
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="p-4 font-medium">Target / Artifact</th>
                  <th className="p-4 font-medium">Student</th>
                  <th className="p-4 font-medium">Assigned</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.assignment_id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-medium text-slate-900">{task.title}</td>
                    <td className="p-4 text-slate-500 text-sm">{task.student_name}</td>
                    <td className="p-4 text-red-500 text-sm font-medium">
                      {new Date(task.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="p-4"><Badge type="warning">Pending</Badge></td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/review/${task.assignment_id}`)}
                        aria-label={`Evaluate review for ${task.title || 'submission'}`}
                      >
                        Evaluate
                      </Button>
                    </td>
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
