/**
 * Per-week comments section (additional + per-member).
 */
export default function WeeklyCommentsPanel({
  week,
  filteredMembers,
  onSetComment,
  onSetAdditionalComments,
}) {
  if (!week) return null;

  return (
    <div className="card mb-16">
      <h3 className="card-title">{week.label} Comments</h3>
      <div className="form-group">
        <label className="form-label">Additional Comments (Week-level)</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Overall observations for this week..."
          value={week.additional_comments || ''}
          onChange={(e) => onSetAdditionalComments(week.id, e.target.value)}
        />
      </div>
      {filteredMembers.map((member) => (
        <div key={`${member.id}-comment`} className="form-group">
          <label className="form-label">
            {member.team} - {member.name}
          </label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Week-specific comment"
            value={week.comments?.[member.id] || ''}
            onChange={(e) => onSetComment(week.id, member.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
