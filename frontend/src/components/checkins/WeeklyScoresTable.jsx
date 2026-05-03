import Card from '../ui/Card';
import Button from '../ui/Button';

const thCls = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
const tdCls = 'py-3 px-3 text-sm text-slate-700';

/**
 * Per-week score entry grid.
 */
export default function WeeklyScoresTable({
  week,
  topics,
  filteredMembers,
  onSetScore,
  onSubmit,
  submitting,
}) {
  if (!week) return null;

  return (
    <Card className="p-6 mb-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">{week.label} Scores</h3>
      <table className="w-full">
        <caption className="sr-only">Weekly score entry grid for team members</caption>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <th scope="col" className={thCls}>Team</th>
            <th scope="col" className={thCls}>Name</th>
            {topics.map((topic) => (
              <th scope="col" key={topic} className={thCls}>{topic}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredMembers.map((member) => (
            <tr key={member.id} className="hover:bg-slate-50/50">
              <td className={tdCls}>{member.team}</td>
              <td className={tdCls + ' font-medium'}>{member.name}</td>
              {topics.map((topic) => (
                <td key={`${member.id}-${topic}`} className={tdCls}>
                  <select
                    className="min-w-[90px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20"
                    value={week.scores?.[member.id]?.[topic] || ''}
                    onChange={(e) => onSetScore(week.id, member.id, topic, e.target.value)}
                  >
                    <option value="">-</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <Button onClick={onSubmit} disabled={submitting} loading={submitting}>
          {submitting ? 'Submitting...' : 'Submit Weekly Scores'}
        </Button>
      </div>
    </Card>
  );
}
