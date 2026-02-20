import './checkins.css';

/**
 * Rolling per-user averages grid with optional team filter.
 */
export default function RollingAveragesTable({
  filteredMembers,
  topics,
  rollingByMember,
  teams,
  teamFilter,
  onTeamFilterChange,
}) {
  if (!filteredMembers.length) return null;

  return (
    <div className="card overflow-x-auto">
      <div className="flex-between mb-8">
        <h3 className="card-title mb-0">
          Rolling Per-User Averages
        </h3>
        <div className="checkin-team-filter">
          <select
            className="form-select"
            value={teamFilter}
            onChange={(e) => onTeamFilterChange(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team} value={team}>
                {team === 'ALL' ? 'All Teams' : `Team ${team}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <table className="table-full">
        <caption className="sr-only">Rolling per-user averages across all check-in weeks</caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Name</th>
            {topics.map((topic) => (
              <th scope="col" key={topic}>
                {topic}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((m) => (
            <tr key={m.id}>
              <td>{m.team}</td>
              <td>{m.name}</td>
              {topics.map((topic) => (
                <td key={`${m.id}-roll-${topic}`}>
                  {rollingByMember?.[m.id]?.[topic] ?? 'N/A'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
