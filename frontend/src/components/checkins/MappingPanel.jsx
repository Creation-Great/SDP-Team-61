import './checkins.css';

/**
 * Table for mapping CSV template names to real student accounts.
 */
export default function MappingPanel({ members, studentOptions, onMapMember }) {
  return (
    <div className="card mb-16 overflow-x-auto">
      <h3 className="card-title">Verify Template Name To User Mapping</h3>
      <p className="card-meta">
        Map each template row to a real student account so student check-ins auto-link correctly.
      </p>
      <table className="table-full">
        <caption className="sr-only">Mapping of CSV template names to student accounts</caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Template Name</th>
            <th scope="col">Mapped User</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={`${member.id}-map`}>
              <td>{member.team}</td>
              <td>{member.name}</td>
              <td>
                <select
                  className="form-select checkin-mapping-select"
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
    </div>
  );
}
