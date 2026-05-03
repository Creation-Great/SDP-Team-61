import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

/**
 * Clarification / Appeal Requests management panel.
 *
 * Props:
 *  - appealsLoading {boolean}
 *  - appeals        {Array}
 *  - updateAppeal   {function(appealId, status)}
 */
export default function AppealsPanel({ appealsLoading, appeals, updateAppeal }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Clarification / Appeal Requests</h2>
      {appealsLoading ? (
        <p className="text-sm text-slate-500">Loading requests...</p>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-slate-500">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {appeals.map((a) => (
            <div key={a.appeal_id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{a.student_name} · {a.session_title}</p>
                  <p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <Badge type={a.status === 'resolved' ? 'success' : a.status === 'rejected' ? 'error' : 'warning'}>
                  {a.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-700 mt-2">{a.message}</p>
              {a.instructor_reply ? <p className="text-xs text-slate-500 mt-1">Reply: {a.instructor_reply}</p> : null}
              {a.status === 'open' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => updateAppeal(a.appeal_id, 'resolved')}>Mark Resolved</Button>
                  <Button size="sm" variant="danger" onClick={() => updateAppeal(a.appeal_id, 'rejected')}>Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
