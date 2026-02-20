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
    <div className="card mb-16 overflow-x-auto">
      <h3 className="card-title">
        {raterLabel} - Scores Handed Out ({weekLabel})
      </h3>
      <p className="card-meta">
        Self score submitted this week: {weekData.self_score || 'N/A'}
      </p>
      <table className="table-full">
        <caption className="sr-only">Scores handed out by the selected rater for the selected week</caption>
        <thead>
          <tr>
            <th scope="col">Rated Student</th>
            {topics.map((topic) => (
              <th scope="col" key={`handed-topic-${topic}`}>
                {topic}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(weekData.peer_scores || {}).map(([targetId, topicScores]) => (
            <tr key={`handed-row-${targetId}`}>
              <td>
                {memberLabelById.get(targetId) || targetId}
              </td>
              {topics.map((topic) => (
                <td key={`handed-cell-${targetId}-${topic}`}>
                  {topicScores?.[topic] || 'N/A'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
