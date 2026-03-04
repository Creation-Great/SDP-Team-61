import Card from '../ui/Card';

const thCls = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
const tdCls = 'py-3 px-3 text-sm text-slate-700';

/**
 * Table for mapping CSV template names to real student accounts.
 */
export default function MappingPanel({ members, studentOptions, onMapMember }) {
  return (
    <Card className="p-6 mb-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Verify Template Name To User Mapping</h3>
      <p className="text-sm text-slate-500 mb-4">
        Map each template row to a real student account so student check-ins auto-link correctly.
      </p>
      <table className="w-full">
        <caption className="sr-only">Mapping of CSV template names to student accounts</caption>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
            <th scope="col" className={thCls}>Team</th>
            <th scope="col" className={thCls}>Template Name</th>
            <th scope="col" className={thCls}>Mapped User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {members.map((member) => (
            <tr key={`${member.id}-map`} className="hover:bg-slate-50/50">
              <td className={tdCls}>{member.team}</td>
              <td className={tdCls + ' font-medium'}>{member.name}</td>
              <td className={tdCls}>
                <select
                  className="min-w-[260px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20"
                  value={member.mapped_user_id || ''}
                  onChange={(e) => onMapMember(member.id, e.target.value)}
                >
                  <option value="">Unmapped</option>
                  {studentOptions.map((student) => (
                    <option key={student.user_id} value={student.user_id}>
                      {student.display_name} ({student.email || 'no-email'})
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
