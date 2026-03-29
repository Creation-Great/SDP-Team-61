import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Upload, AlertCircle, Download, Plus, Radio,
} from 'lucide-react';
import API from '../services/api';
import { strings } from '../i18n/strings';
import useFilteredList from '../hooks/useFilteredList';
import useSSE from '../hooks/useSSE';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import DashboardStatsCards from '../components/instructor/DashboardStatsCards';
import SubmissionsTable from '../components/instructor/SubmissionsTable';

const TABS = ['overview', 'submissions', 'participation', 'csv aggregate'];

/**
 * Instructor dashboard: overview, submissions, participation, CSV aggregate. SSE /instructor/events.
 * GET /instructor/unified-dashboard, /submissions/all (paginated), POST /instructor/assign, checkins.
 * Rendered at /instructor.
 * @returns {JSX.Element}
 */
export default function InstructorDashboardPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const SUBMISSIONS_PAGE_SIZE = 20;
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignReviewerId, setAssignReviewerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState({ type: '', text: '' });
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const [bulkReviewerCount, setBulkReviewerCount] = useState(1);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMsg, setBulkMsg] = useState({ type: '', text: '' });

  const buildFilterParams = useCallback(() => ({
    course: filterCourse || undefined,
    group: filterGroup || undefined,
    start_date: filterStartDate ? new Date(`${filterStartDate}T00:00:00`).toISOString() : undefined,
    end_date: filterEndDate ? new Date(`${filterEndDate}T23:59:59`).toISOString() : undefined,
  }), [filterCourse, filterGroup, filterStartDate, filterEndDate]);

  const csvInputRef = useRef(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState('');

  // AI Activity Logs state
  const [aiLogs, setAiLogs] = useState([]);
  const [aiLogsLoading, setAiLogsLoading] = useState(false);

  // SSE live events
  const [liveEvents, setLiveEvents] = useState([]);
  const { connected } = useSSE('/instructor/events', {
    onEvent: useCallback((eventName, data) => {
      setLiveEvents((prev) => [
        { type: eventName, data: data || {}, timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 20));
      if (eventName === 'submission_created') {
        API.get('/submissions/all', { params: { page: 1, pageSize: SUBMISSIONS_PAGE_SIZE, ...buildFilterParams() } })
          .then((r) => {
            const d = r.data;
            const list = d.submissions ?? (Array.isArray(d) ? d : []);
            setSubmissions(list);
            setTotalSubmissions(d.total ?? list.length);
            setSubmissionsPage(1);
          })
          .catch(() => {});
      }
    }, [buildFilterParams]),
  });

  const subSearchKeys = useCallback((s) => [s.title, s.student_name, s.student_email], []);
  const subFilterFn = useCallback((s, f) => !f.status || s.status === f.status, []);
  const subs = useFilteredList(submissions, {
    searchKeys: subSearchKeys,
    filterFn: subFilterFn,
    pageSize: SUBMISSIONS_PAGE_SIZE,
  });

  const partSearchKeys = useCallback((s) => [s.name, s.group_id], []);
  const participation = useFilteredList(dashboard?.student_participation ?? [], {
    searchKeys: partSearchKeys,
    pageSize: 15,
  });

  useEffect(() => {
    const filterParams = buildFilterParams();
    Promise.all([
      API.get('/instructor/unified-dashboard', { params: filterParams }).then((r) => r.data).catch(() => null),
      API.get('/instructor/overview', { params: filterParams }).then((r) => r.data).catch(() => []),
      API.get('/instructor/checkins/students').then((r) => (Array.isArray(r.data) ? r.data : (r.data?.students ?? []))).catch(() => []),
      API.get('/submissions/all', { params: { page: 1, pageSize: SUBMISSIONS_PAGE_SIZE, ...filterParams } }).then((r) => {
        const d = r.data;
        const list = d.submissions ?? (Array.isArray(d) ? d : []);
        const total = d.total ?? list.length;
        return { list, total };
      }),
    ])
      .then(([dash, trends, studs, subs]) => {
        setDashboard(dash);
        setWeeklyTrends(Array.isArray(trends) ? trends : []);
        setStudents(Array.isArray(studs) ? studs : []);
        if (subs?.list) {
          setSubmissions(subs.list);
          setTotalSubmissions(subs.total);
        }
      })
      .catch(() => { /* error handled by loading state */ })
      .finally(() => setLoading(false));
  }, [buildFilterParams]);

  const submissionsPageFetchedRef = useRef(false);
  // Server-side pagination: refetch when page changes (skip first run; initial load already did page 1)
  useEffect(() => {
    if (!submissionsPageFetchedRef.current) {
      submissionsPageFetchedRef.current = true;
      return;
    }
    API.get('/submissions/all', { params: { page: submissionsPage, pageSize: SUBMISSIONS_PAGE_SIZE, ...buildFilterParams() } })
      .then((r) => {
        const d = r.data;
        const list = d.submissions ?? (Array.isArray(d) ? d : []);
        const total = d.total ?? list.length;
        setSubmissions(Array.isArray(list) ? list : []);
        setTotalSubmissions(total);
      })
      .catch(() => {});
  }, [submissionsPage, buildFilterParams]);

  // Fetch AI activity logs
  useEffect(() => {
    setAiLogsLoading(true);
    API.get('/api/ai/logs', { params: { limit: 10 } })
      .then((res) => setAiLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAiLogs([]))
      .finally(() => setAiLogsLoading(false));
  }, []);

  const handleAssign = async () => {
    if (!assignTarget || !assignReviewerId) return;
    setAssigning(true);
    setAssignMsg({ type: '', text: '' });
    try {
      const res = await API.post('/instructor/assign', {
        submission_id: assignTarget,
        reviewer_id: assignReviewerId,
      });
      if (res.data.note === 'already_assigned') {
        setAssignMsg({ type: 'warn', text: `Already assigned (${res.data.status}).` });
      } else {
        setAssignMsg({ type: 'ok', text: 'Reviewer assigned successfully.' });
        API.get('/submissions/all', { params: { page: submissionsPage, pageSize: SUBMISSIONS_PAGE_SIZE, ...buildFilterParams() } })
          .then((r) => {
            const d = r.data;
            setSubmissions(d.submissions ?? (Array.isArray(d) ? d : []));
            if (d.total != null) setTotalSubmissions(d.total);
          })
          .catch(() => {});
      }
    } catch (err) {
      setAssignMsg({ type: 'err', text: err.response?.data?.message || 'Assignment failed.' });
    } finally {
      setAssigning(false);
    }
  };

  const handleToggleSubmissionSelect = (submissionId) => {
    setSelectedSubmissionIds((prev) => (
      prev.includes(submissionId)
        ? prev.filter((id) => id !== submissionId)
        : [...prev, submissionId]
    ));
  };

  const handleToggleAllCurrentPage = () => {
    const currentIds = subs.pageItems.map((s) => s.submission_id);
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedSubmissionIds.includes(id));
    setSelectedSubmissionIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !currentIds.includes(id));
      }
      return Array.from(new Set([...prev, ...currentIds]));
    });
  };

  const handleBulkAssign = async () => {
    if (selectedSubmissionIds.length === 0) return;
    setBulkAssigning(true);
    setBulkMsg({ type: '', text: '' });
    try {
      const res = await API.post('/instructor/assign/bulk', {
        submission_ids: selectedSubmissionIds,
        reviewer_count: bulkReviewerCount,
      });
      const assignedTotal = res.data?.summary?.assigned_total ?? 0;
      setBulkMsg({
        type: 'ok',
        text: `Bulk assignment completed. Assigned ${assignedTotal} reviewer(s).`,
      });
      setSelectedSubmissionIds([]);
      API.get('/submissions/all', { params: { page: submissionsPage, pageSize: SUBMISSIONS_PAGE_SIZE, ...buildFilterParams() } })
        .then((r) => {
          const d = r.data;
          setSubmissions(d.submissions ?? (Array.isArray(d) ? d : []));
          if (d.total != null) setTotalSubmissions(d.total);
        })
        .catch(() => {});
    } catch (err) {
      setBulkMsg({ type: 'err', text: err.response?.data?.message || 'Bulk assignment failed.' });
    } finally {
      setBulkAssigning(false);
    }
  };

  const filterCourses = useMemo(() => {
    const set = new Set();
    (weeklyTrends || []).forEach((r) => { if (r.course_id) set.add(r.course_id); });
    (dashboard?.student_participation || []).forEach((s) => { if (s.course_id) set.add(s.course_id); });
    return Array.from(set).sort();
  }, [weeklyTrends, dashboard?.student_participation]);

  const filterGroups = useMemo(() => {
    const set = new Set();
    (weeklyTrends || []).forEach((r) => { if (r.group_id) set.add(r.group_id); });
    (dashboard?.student_participation || []).forEach((s) => { if (s.group_id) set.add(s.group_id); });
    return Array.from(set).sort();
  }, [weeklyTrends, dashboard?.student_participation]);

  const exportAggregateCsv = () => {
    if (!csvResult?.students?.length) return;
    const cats = csvResult.categories || [];
    const hdr = ['Team', 'Student', ...cats.map((c) => c.label), 'Overall', 'Individual Comments'];
    const rows = csvResult.students.map((s) => {
      const catVals = cats.map((c) => {
        const avg = s.per_category?.[c.key]?.average;
        return avg !== null && avg !== undefined ? avg.toFixed(2) : '';
      });
      return [
        s.team || '',
        s.student_name || '',
        ...catVals,
        s.overall_average !== null && s.overall_average !== undefined ? s.overall_average.toFixed(2) : '',
        (s.comments || []).join('; '),
      ];
    });
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [hdr.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aggregate-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCsvUploading(true);
    setCsvError('');
    setCsvResult(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await API.post('/instructor/peer-review/aggregate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvResult(res.data);
    } catch (err) {
      setCsvError(err.response?.data?.message || 'CSV aggregation failed.');
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Skeleton variant="text" width="280px" height="32px" />
          <div className="flex gap-3">
            <Skeleton variant="text" width="120px" height="40px" className="rounded-lg" />
            <Skeleton variant="text" width="100px" height="40px" className="rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" width="100px" height="40px" className="rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton variant="text" width="60%" height="14px" className="mb-2" />
              <Skeleton variant="text" width="80px" height="32px" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton variant="text" width="40%" height="20px" className="mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="row" height="48px" className="mb-3 rounded-lg" />
          ))}
        </Card>
        <div className="flex items-center justify-center py-4 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  const thClass = 'text-left py-3 px-4 font-medium text-slate-500 text-sm whitespace-nowrap';
  const tdClass = 'py-3 px-4 text-sm text-slate-700';

  /* Derive some stats */
  const fr = dashboard?.file_reviews || {};
  const pr = dashboard?.peer_reviews || {};
  const checkinRate = dashboard?.student_participation?.length
    ? Math.round((dashboard.student_participation.filter((s) => (s.peer_reviews_given || 0) > 0).length / dashboard.student_participation.length) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Instructor Dashboard
            {connected && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Radio className="w-3 h-3 animate-pulse" /> Live
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Monitor course progress, submissions, and review quality.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={Upload} onClick={() => setActiveTab('csv aggregate')}>Import CSV</Button>
          <Button icon={Plus} onClick={() => navigate('/peer-review')}>New Session</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-[#000E2F] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Global Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px]">
            <label className="block text-xs text-slate-500 mb-1">Course</label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              value={filterCourse}
              onChange={(e) => { setFilterCourse(e.target.value); setSubmissionsPage(1); }}
            >
              <option value="">All courses</option>
              {filterCourses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs text-slate-500 mb-1">Group</label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              value={filterGroup}
              onChange={(e) => { setFilterGroup(e.target.value); setSubmissionsPage(1); }}
            >
              <option value="">All groups</option>
              {filterGroups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start date</label>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              value={filterStartDate}
              onChange={(e) => { setFilterStartDate(e.target.value); setSubmissionsPage(1); }}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End date</label>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              value={filterEndDate}
              onChange={(e) => { setFilterEndDate(e.target.value); setSubmissionsPage(1); }}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterCourse('');
              setFilterGroup('');
              setFilterStartDate('');
              setFilterEndDate('');
              setSubmissionsPage(1);
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* ═══════ Overview Tab ═══════ */}
      {activeTab === 'overview' && (
        <DashboardStatsCards
          dashboard={dashboard}
          weeklyTrends={weeklyTrends}
          checkinRate={checkinRate}
          fr={fr}
          pr={pr}
          aiLogs={aiLogs}
          aiLogsLoading={aiLogsLoading}
          liveEvents={liveEvents}
          setLiveEvents={setLiveEvents}
          connected={connected}
        />
      )}

      {/* ═══════ Submissions Tab ═══════ */}
      {activeTab === 'submissions' && (
        <SubmissionsTable
          submissions={submissions}
          totalSubmissions={totalSubmissions}
          submissionsPage={submissionsPage}
          setSubmissionsPage={setSubmissionsPage}
          SUBMISSIONS_PAGE_SIZE={SUBMISSIONS_PAGE_SIZE}
          subs={subs}
          students={students}
          selectedSubmissionIds={selectedSubmissionIds}
          handleToggleSubmissionSelect={handleToggleSubmissionSelect}
          handleToggleAllCurrentPage={handleToggleAllCurrentPage}
          bulkReviewerCount={bulkReviewerCount}
          setBulkReviewerCount={setBulkReviewerCount}
          bulkAssigning={bulkAssigning}
          handleBulkAssign={handleBulkAssign}
          bulkMsg={bulkMsg}
          assignTarget={assignTarget}
          setAssignTarget={setAssignTarget}
          assignReviewerId={assignReviewerId}
          setAssignReviewerId={setAssignReviewerId}
          assigning={assigning}
          handleAssign={handleAssign}
          assignMsg={assignMsg}
          setAssignMsg={setAssignMsg}
        />
      )}

      {/* ═══════ Participation Tab ═══════ */}
      {activeTab === 'participation' && dashboard?.student_participation && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Student Participation</h3>
            <SearchInput
              value={participation.query}
              onChange={participation.setQuery}
              placeholder="Search by name, group…"
              className="max-w-xs"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Student participation overview for file and peer reviews</caption>
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th scope="col" className={thClass}>Student</th>
                  <th scope="col" className={thClass}>Group</th>
                  <th scope="col" className={thClass}>File Given</th>
                  <th scope="col" className={thClass}>File Recv</th>
                  <th scope="col" className={thClass}>Avg File Score</th>
                  <th scope="col" className={thClass}>Peer Given</th>
                  <th scope="col" className={thClass}>Peer Recv</th>
                  <th scope="col" className={thClass}>Avg Peer Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participation.pageItems.map((s) => (
                  <tr key={s.user_id} className="hover:bg-slate-50/50">
                    <td className={tdClass + ' font-medium'}>{s.name}</td>
                    <td className={tdClass}>{s.group_id || '—'}</td>
                    <td className={tdClass}>{s.file_reviews_given}</td>
                    <td className={tdClass}>{s.file_reviews_received}</td>
                    <td className={tdClass}>{s.avg_file_score_received ?? '—'}</td>
                    <td className={tdClass}>{s.peer_reviews_given}</td>
                    <td className={tdClass}>{s.peer_reviews_received}</td>
                    <td className={tdClass}>{s.avg_peer_score_received ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dashboard.student_participation.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No student data available.</p>
          )}

          <div className="p-4 border-t border-slate-100">
            <Pagination
              page={participation.page}
              totalPages={participation.totalPages}
              onPageChange={participation.setPage}
              filtered={participation.filtered.length}
              total={participation.total}
              noun="students"
            />
          </div>
        </Card>
      )}

      {/* ═══════ CSV Aggregate Tab ═══════ */}
      {activeTab === 'csv aggregate' && (
        <div className="space-y-4">
          <Card className="p-6 bg-[#000E2F]/5 border-[#000E2F]/10">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Peer Review CSV Aggregation</h3>
            <p className="text-sm text-slate-500 mb-4">
              Upload one or more peer-review CSV files to compute aggregated averages per student.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="csv-agg-upload">CSV Files (up to 30)</label>
              <input
                id="csv-agg-upload"
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={handleCsvUpload}
                disabled={csvUploading}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#000E2F]/5 file:text-[#000E2F] hover:file:bg-[#000E2F]/10"
              />
            </div>

            {csvUploading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading & processing…
              </div>
            )}
            {csvError && (
              <div className="flex items-center gap-2 text-sm text-red-600" role="alert" aria-live="assertive">
                <AlertCircle className="w-4 h-4" />
                {csvError}
              </div>
            )}
          </Card>

          {csvResult && (
            <Card className="p-0 overflow-hidden">
              {/* Summary stats */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#000E2F]">{csvResult.summary.files_processed}</div>
                    <div className="text-xs text-slate-500 mt-1">Files Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#000E2F]">{csvResult.summary.evaluations_count}</div>
                    <div className="text-xs text-slate-500 mt-1">Evaluations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{csvResult.summary.skipped_rows}</div>
                    <div className="text-xs text-slate-500 mt-1">Rows Skipped</div>
                  </div>
                </div>
                {csvResult.students?.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="secondary" icon={Download} onClick={exportAggregateCsv}>
                      Download Aggregate CSV
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6 overflow-x-auto">
                {/* Category averages */}
                {csvResult.categories?.length > 0 && (
                  <>
                    <h4 className="text-base font-semibold text-slate-900">Category Averages</h4>
                    <table className="w-full">
                      <caption className="sr-only">Category averages from CSV upload results</caption>
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                          <th scope="col" className={thClass}>Category</th>
                          <th scope="col" className={thClass}>Average</th>
                          <th scope="col" className={thClass}>Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvResult.categories.map((c) => (
                          <tr key={c.key}>
                            <td className={tdClass}>{c.label}</td>
                            <td className={tdClass}>{c.average !== null ? c.average.toFixed(2) : '—'}</td>
                            <td className={tdClass}>{c.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Per-student results */}
                {csvResult.students?.length > 0 && (
                  <>
                    <h4 className="text-base font-semibold text-slate-900">Per-Student Results</h4>
                    <table className="w-full">
                      <caption className="sr-only">Per-student scores by category from CSV upload</caption>
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                          <th scope="col" className={thClass}>Team</th>
                          <th scope="col" className={thClass}>Student</th>
                          {csvResult.categories?.map((c) => (
                            <th scope="col" key={c.key} className={thClass}>{c.label}</th>
                          ))}
                          <th scope="col" className={thClass}>Overall</th>
                          <th scope="col" className={thClass}>Individual Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvResult.students.map((s, i) => (
                          <tr key={i}>
                            <td className={tdClass}>{s.team || '—'}</td>
                            <td className={tdClass + ' font-medium'}>{s.student_name}</td>
                            {csvResult.categories?.map((c) => (
                              <td key={c.key} className={tdClass}>
                                {s.per_category?.[c.key]?.average !== null
                                  ? s.per_category[c.key].average.toFixed(2)
                                  : '—'}
                              </td>
                            ))}
                            <td className={tdClass + ' font-semibold'}>
                              {s.overall_average !== null ? s.overall_average.toFixed(2) : '—'}
                            </td>
                            <td className={tdClass + ' max-w-xs'}>
                              {s.comments?.length > 0
                                ? s.comments.map((c, ci) => <p key={ci} className="text-xs text-slate-600 mb-1 last:mb-0">{c}</p>)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* File reports */}
                {csvResult.file_reports?.length > 0 && (
                  <>
                    <h4 className="text-base font-semibold text-slate-900">File Reports</h4>
                    <table className="w-full">
                      <caption className="sr-only">CSV file processing reports</caption>
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                          <th scope="col" className={thClass}>File</th>
                          <th scope="col" className={thClass}>Rows Processed</th>
                          <th scope="col" className={thClass}>Rows Skipped</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvResult.file_reports.map((f, i) => (
                          <tr key={i}>
                            <td className={tdClass}>{f.file_name}</td>
                            <td className={tdClass}>{f.rows_processed}</td>
                            <td className={tdClass}>{f.rows_skipped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
