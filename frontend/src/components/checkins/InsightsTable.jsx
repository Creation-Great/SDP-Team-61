import Card from '../ui/Card';
import Button from '../ui/Button';

const thCls = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
const tdCls = 'py-3 px-3 text-sm text-slate-700';

/**
 * Student submission aggregates (self / peer / instructor averages).
 */
export default function InsightsTable({ insights, selectedRaterMemberId, onSelectRater }) {
  if (insights.length === 0) return null;

  return (
    <Card className="p-6 mb-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Student Submission Aggregates</h3>
      <p className="text-sm text-slate-500 mb-4">
        Self is one aggregated score from student self-ratings. Click a student to see scores they
        handed out for the selected week.
      </p>
      <table className="w-full">
        <caption className="sr-only">Student submission aggregates — self, peer, and instructor scores</caption>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <th scope="col" className={thCls}>Team</th>
            <th scope="col" className={thCls}>Name</th>
            <th scope="col" className={thCls}>Self (Agg)</th>
            <th scope="col" className={thCls}>Peer (Agg)</th>
            <th scope="col" className={thCls}>Instructor (Agg)</th>
            <th scope="col" className={thCls}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {insights.map((row) => (
            <tr key={`insight-${row.member_id}`} className="hover:bg-slate-50/50">
              <td className={tdCls}>{row.team}</td>
              <td className={tdCls + ' font-medium'}>{row.name}</td>
              <td className={tdCls}>{row.self_average ?? 'N/A'}</td>
              <td className={tdCls}>{row.peer_average ?? 'N/A'}</td>
              <td className={tdCls}>{row.instructor_average ?? 'N/A'}</td>
              <td className={tdCls}>
                <Button
                  size="sm"
                  variant={selectedRaterMemberId === row.member_id ? 'primary' : 'secondary'}
                  onClick={() => onSelectRater(row.member_id)}
                >
                  View Week Scores
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
