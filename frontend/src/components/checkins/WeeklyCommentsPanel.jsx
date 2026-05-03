import Card from '../ui/Card';

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
    <Card className="p-6 mb-4">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">{week.label} Comments</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Additional Comments (Week-level)</label>
        <textarea
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20 resize-y"
          rows={3}
          placeholder="Overall observations for this week..."
          value={week.additional_comments || ''}
          onChange={(e) => onSetAdditionalComments(week.id, e.target.value)}
        />
      </div>
      {filteredMembers.map((member) => (
        <div key={`${member.id}-comment`} className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {member.team} - {member.name}
          </label>
          <textarea
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20 resize-y"
            rows={2}
            placeholder="Week-specific comment"
            value={week.comments?.[member.id] || ''}
            onChange={(e) => onSetComment(week.id, member.id, e.target.value)}
          />
        </div>
      ))}
    </Card>
  );
}
