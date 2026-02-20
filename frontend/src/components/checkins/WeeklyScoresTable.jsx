import './checkins.css';

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
    <div className="card mb-16 overflow-x-auto">
      <h3 className="card-title">{week.label} Scores</h3>
      <table className="table-full">
        <caption className="sr-only">Weekly score entry grid for team members</caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Name</th>
            {topics.map((topic) => (
              <th scope="col" key={topic}>{topic}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member) => (
            <tr key={member.id}>
              <td>{member.team}</td>
              <td>{member.name}</td>
              {topics.map((topic) => (
                <td key={`${member.id}-${topic}`}>
                  <select
                    className="form-select checkin-score-select"
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
      <div className="mt-12 flex-end">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Weekly Scores'}
        </button>
      </div>
    </div>
  );
}
