import Card from '../ui/Card';

const thCls = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
const tdCls = 'py-3 px-3 text-sm text-slate-700';

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
    <Card className="p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Rolling Per-User Averages
        </h3>
        <select
          className="min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
      <table className="w-full">
        <caption className="sr-only">Rolling per-user averages across all check-in weeks</caption>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <th scope="col" className={thCls}>Team</th>
            <th scope="col" className={thCls}>Name</th>
            {topics.map((topic) => (
              <th scope="col" key={topic} className={thCls}>
                {topic}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredMembers.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50/50">
              <td className={tdCls}>{m.team}</td>
              <td className={tdCls + ' font-medium'}>{m.name}</td>
              {topics.map((topic) => (
                <td key={`${m.id}-roll-${topic}`} className={tdCls}>
                  {rollingByMember?.[m.id]?.[topic] ?? 'N/A'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
