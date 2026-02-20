import Card from '../ui/Card';

const thCls = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
const tdCls = 'py-3 px-3 text-sm text-slate-700';

/**
 * Detail table showing scores a specific rater handed out for the selected week.
 */
export default function HandedOutTable({
  raterLabel,
  weekLabel,
  weekData,
  topics,
  memberLabelById,
}) {
  if (!weekData) return null;

  return (
    <Card className="p-6 mb-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        {raterLabel} - Scores Handed Out ({weekLabel})
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Self score submitted this week: {weekData.self_score || 'N/A'}
      </p>
      <table className="w-full">
        <caption className="sr-only">Scores handed out by the selected rater for the selected week</caption>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <th scope="col" className={thCls}>Rated Student</th>
            {topics.map((topic) => (
              <th scope="col" key={`handed-topic-${topic}`} className={thCls}>
                {topic}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Object.entries(weekData.peer_scores || {}).map(([targetId, topicScores]) => (
            <tr key={`handed-row-${targetId}`} className="hover:bg-slate-50/50">
              <td className={tdCls + ' font-medium'}>
                {memberLabelById.get(targetId) || targetId}
              </td>
              {topics.map((topic) => (
                <td key={`handed-cell-${targetId}-${topic}`} className={tdCls}>
                  {topicScores?.[topic] || 'N/A'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
