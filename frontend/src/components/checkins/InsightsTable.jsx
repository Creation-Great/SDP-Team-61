/**
 * Student submission aggregates (self / peer / instructor averages).
 */
export default function InsightsTable({ insights, selectedRaterMemberId, onSelectRater }) {
  if (insights.length === 0) return null;

  return (
    <div className="card mb-16 overflow-x-auto">
      <h3 className="card-title">Student Submission Aggregates</h3>
      <p className="card-meta">
        Self is one aggregated score from student self-ratings. Click a student to see scores they
        handed out for the selected week.
      </p>
      <table className="table-full">
        <caption className="sr-only">Student submission aggregates — self, peer, and instructor scores</caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Name</th>
            <th scope="col">Self (Agg)</th>
            <th scope="col">Peer (Agg)</th>
            <th scope="col">Instructor (Agg)</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {insights.map((row) => (
            <tr key={`insight-${row.member_id}`}>
              <td>{row.team}</td>
              <td>{row.name}</td>
              <td>{row.self_average ?? 'N/A'}</td>
              <td>{row.peer_average ?? 'N/A'}</td>
              <td>{row.instructor_average ?? 'N/A'}</td>
              <td>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedRaterMemberId === row.member_id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => onSelectRater(row.member_id)}
                >
                  View Week Scores
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
