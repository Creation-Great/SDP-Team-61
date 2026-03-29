import { Upload, Download, UserPlus } from 'lucide-react';
import SearchInput from '../SearchInput';
import Pagination from '../Pagination';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

/**
 * Submissions tab: search/filter bar, bulk assign controls, submissions table,
 * per-row assign reviewer, and server-side pagination.
 */
export default function SubmissionsTable({
  submissions,
  totalSubmissions,
  submissionsPage,
  setSubmissionsPage,
  SUBMISSIONS_PAGE_SIZE,
  subs,
  students,
  selectedSubmissionIds,
  handleToggleSubmissionSelect,
  handleToggleAllCurrentPage,
  bulkReviewerCount,
  setBulkReviewerCount,
  bulkAssigning,
  handleBulkAssign,
  bulkMsg,
  assignTarget,
  setAssignTarget,
  assignReviewerId,
  setAssignReviewerId,
  assigning,
  handleAssign,
  assignMsg,
  setAssignMsg,
}) {
  const thClass = 'text-left py-3 px-4 font-medium text-slate-500 text-sm whitespace-nowrap';
  const tdClass = 'py-3 px-4 text-sm text-slate-700';

  if (submissions.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="text-center px-6 py-12">
          <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No submissions yet</h3>
          <p className="text-sm text-slate-500">Student submissions will appear here once uploaded.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={subs.query}
          onChange={subs.setQuery}
          placeholder="Search by title, student…"
          className="flex-1 min-w-[200px]"
        />
        <select
          className="max-w-[160px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20"
          value={subs.filters.status || ''}
          onChange={(e) => subs.setFilters({ ...subs.filters, status: e.target.value || undefined })}
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <select
          className="max-w-[150px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20"
          value={bulkReviewerCount}
          onChange={(e) => setBulkReviewerCount(Number(e.target.value))}
        >
          <option value={1}>Assign 1 each</option>
          <option value={2}>Assign 2 each</option>
          <option value={3}>Assign 3 each</option>
        </select>
        <Button
          size="sm"
          disabled={selectedSubmissionIds.length === 0 || bulkAssigning}
          onClick={handleBulkAssign}
        >
          {bulkAssigning ? 'Assigning...' : `Bulk Assign (${selectedSubmissionIds.length})`}
        </Button>
        {bulkMsg.text && (
          <span className={`text-xs ${bulkMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {bulkMsg.text}
          </span>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className={thClass}>
                  <input
                    type="checkbox"
                    checked={subs.pageItems.length > 0 && subs.pageItems.every((s) => selectedSubmissionIds.includes(s.submission_id))}
                    onChange={handleToggleAllCurrentPage}
                    aria-label="Select all submissions on current page"
                  />
                </th>
                <th className={thClass}>Title</th>
                <th className={thClass}>Student</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Assigned</th>
                <th className={thClass}>Completed</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.pageItems.map((s) => (
                <tr key={s.submission_id} className="hover:bg-slate-50/50">
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      checked={selectedSubmissionIds.includes(s.submission_id)}
                      onChange={() => handleToggleSubmissionSelect(s.submission_id)}
                      aria-label={`Select submission ${s.title}`}
                    />
                  </td>
                  <td className={tdClass + ' font-medium text-slate-900'}>{s.title}</td>
                  <td className={tdClass}>{s.student_name}</td>
                  <td className={tdClass}>
                    <Badge type={s.status === 'submitted' ? 'info' : 'success'}>
                      {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                    </Badge>
                  </td>
                  <td className={tdClass}>{s.assigned_count || 0}</td>
                  <td className={tdClass}>{s.completed_count || 0}</td>
                  <td className={tdClass + ' text-slate-400 text-xs'}>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      {s.file_url && (
                        <a href={s.file_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button>
                        </a>
                      )}
                      {assignTarget === s.submission_id ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="max-w-[180px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10"
                            value={assignReviewerId}
                            onChange={(e) => setAssignReviewerId(e.target.value)}
                          >
                            <option value="">Select…</option>
                            {students.filter((st) => st.user_id !== s.user_id).map((st) => (
                              <option key={st.user_id} value={st.user_id}>{st.display_name}</option>
                            ))}
                          </select>
                          <Button size="sm" disabled={!assignReviewerId || assigning} onClick={handleAssign}>
                            {assigning ? '…' : 'OK'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAssignTarget(null); setAssignMsg({ type: '', text: '' }); }}>✕</Button>
                          {assignMsg.text && assignTarget === s.submission_id && (
                            <span className="inline-flex items-center gap-2" role={assignMsg.type === 'err' ? 'alert' : 'status'} aria-live={assignMsg.type === 'err' ? 'assertive' : 'polite'}>
                              <span className={`text-xs ${assignMsg.type === 'ok' ? 'text-emerald-600' : assignMsg.type === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>{assignMsg.text}</span>
                              {assignMsg.type === 'err' && (
                                <Button size="sm" variant="ghost" onClick={handleAssign} disabled={assigning} aria-label="Retry assignment">Retry</Button>
                              )}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => { setAssignTarget(s.submission_id); setAssignReviewerId(''); setAssignMsg({ type: '', text: '' }); }}>
                          <UserPlus className="w-3.5 h-3.5 mr-1" />Assign
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={submissionsPage}
        totalPages={Math.max(1, Math.ceil(totalSubmissions / SUBMISSIONS_PAGE_SIZE))}
        onPageChange={setSubmissionsPage}
        filtered={submissions.length}
        total={totalSubmissions}
        noun="submissions"
      />
    </div>
  );
}
