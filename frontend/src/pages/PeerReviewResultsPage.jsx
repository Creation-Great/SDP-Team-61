import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { TableVirtuoso } from 'react-virtuoso';
import { Download, ArrowLeft, Loader2, AlertCircle, ChevronDown, ChevronUp, LogIn, Eye, EyeOff, TrendingUp, Users } from 'lucide-react';
import API from '../services/api';
import { API_BASE_URL } from '../config';
import useFilteredList from '../hooks/useFilteredList';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import { strings } from '../i18n/strings';
import { useToast } from '../components/ui/ToastProvider';

/**
 * Instructor view of peer-review session results: GET /peer-review/sessions/:sessionId/results,
 * optional bias-analytics, all-students, instructor-review, release-scores, export-csv.
 * Rendered at /peer-review/session/:sessionId/results. Uses TableVirtuoso for Raw Review Details.
 * @returns {JSX.Element}
 */
export default function PeerReviewResultsPage() {
  const { addToast } = useToast();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [biasData, setBiasData] = useState(null);
  const [showBias, setShowBias] = useState(false);
  const [allStudents, setAllStudents] = useState(null);
  const [showInstructorReview, setShowInstructorReview] = useState(false);
  const [instructorReviews, setInstructorReviews] = useState({});
  const [submittingReview, setSubmittingReview] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [submitReviewError, setSubmitReviewError] = useState('');
  const [exportGroup, setExportGroup] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [anonymizedExport, setAnonymizedExport] = useState(false);
  const [anonymizedView, setAnonymizedView] = useState(false);

  /* ── Averages: search by student name / team ── */
  const avgSearchKeys = useCallback((r) => [r.student_name, r.team], []);
  const avgList = useFilteredList(data?.averages ?? [], {
    searchKeys: avgSearchKeys,
    pageSize: 15,
  });

  /* ── Details: search + team filter + pagination ── */
  const detSearchKeys = useCallback(
    (d) => [d.reviewer_name, d.reviewee_name, d.team, d.individual_comments],
    [],
  );
  const detFilterFn = useCallback(
    (d, f) => (!f.team || String(d.team) === f.team) && (!f.selfOnly || d.is_self),
    [],
  );
  const detList = useFilteredList(data?.details ?? [], {
    searchKeys: detSearchKeys,
    filterFn: detFilterFn,
    pageSize: 20,
  });

  useEffect(() => {
    API.get(`/peer-review/sessions/${sessionId}/results`, {
      params: {
        anonymized: anonymizedView || undefined,
      },
    })
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || 'Failed to load results';
        if (status === 403) {
          setError('Insufficient permissions. Your session may have changed — please log out and log back in as an instructor.');
        } else if (status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, anonymizedView]);

  /* ── Load bias analytics on demand ── */
  useEffect(() => {
    if (showBias && !biasData) {
      API.get(`/peer-review/sessions/${sessionId}/bias-analytics`)
        .then((res) => setBiasData(res.data))
        .catch(() => setBiasData([]));
    }
  }, [showBias, biasData, sessionId]);

  /* ── Load all students for instructor review on demand ── */
  useEffect(() => {
    if (showInstructorReview && !allStudents) {
      API.get(`/peer-review/sessions/${sessionId}/all-students`)
        .then((res) => {
          setAllStudents(res.data.students || []);
          const existing = {};
          (res.data.existingReviews || []).forEach((r) => {
            existing[r.reviewee_id] = {
              technical_contributions: r.technical_contributions,
              team_interactions: r.team_interactions,
              project_management: r.project_management,
              individual_comments: r.individual_comments || '',
            };
          });
          setInstructorReviews(existing);
        })
        .catch(() => setAllStudents([]));
    }
  }, [showInstructorReview, allStudents, sessionId]);

  const handleReleaseScores = async () => {
    setReleaseError('');
    const current = data?.session?.scores_released;
    try {
      await API.patch(`/peer-review/sessions/${sessionId}/release-scores`, { scores_released: !current });
      setData((prev) => ({
        ...prev,
        session: { ...prev.session, scores_released: !current },
      }));
    } catch (err) {
      setReleaseError(err.response?.data?.message || 'Failed to toggle score release. Please try again.');
    }
  };

  const handleInstructorReviewChange = (studentId, field, value) => {
    setInstructorReviews((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSubmitInstructorReviews = async () => {
    const reviews = Object.entries(instructorReviews)
      .filter(([, v]) => v.technical_contributions && v.team_interactions && v.project_management)
      .map(([reviewee_id, v]) => ({
        reviewee_id,
        ...v,
        technical_contributions: Number(v.technical_contributions),
        team_interactions: Number(v.team_interactions),
        project_management: Number(v.project_management),
      }));
    if (reviews.length === 0) return addToast({ type: 'warning', message: 'Please fill scores for at least one student.' });
    setSubmitReviewError('');
    setSubmittingReview(true);
    try {
      await API.post(`/peer-review/sessions/${sessionId}/instructor-review`, { reviews });
      addToast({ type: 'success', message: `Submitted reviews for ${reviews.length} student(s).` });
    } catch (err) {
      setSubmitReviewError(err.response?.data?.message || 'Failed to submit reviews. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleExportCsv = () => {
    // Use credentials: 'include' to send the httpOnly cookie automatically
    const params = new URLSearchParams();
    if (exportGroup) params.set('group', exportGroup);
    if (exportStartDate) params.set('start_date', new Date(`${exportStartDate}T00:00:00`).toISOString());
    if (exportEndDate) params.set('end_date', new Date(`${exportEndDate}T23:59:59`).toISOString());
    if (anonymizedExport) params.set('anonymized', 'true');
    const url = `${API_BASE_URL}/peer-review/sessions/${sessionId}/export-csv${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `peer-review-results-${sessionId}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => addToast({ type: 'error', message: 'Failed to download CSV' }));
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite" aria-label="Loading results">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton variant="text" width={280} height={28} className="mb-2" />
            <div className="flex gap-2">
              <Skeleton variant="text" width={64} height={24} />
              <Skeleton variant="text" width={120} height={24} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton variant="text" width={120} height={40} />
            <Skeleton variant="text" width={100} height={40} />
            <Skeleton variant="text" width={72} height={40} />
          </div>
        </div>
        <Card className="p-6">
          <Skeleton variant="text" width={180} height={20} className="mb-2" />
          <Skeleton variant="text" width="100%" height={10} className="mb-4" />
          <Skeleton variant="row" width="100%" height={12} className="mb-2" />
          <div className="flex flex-wrap gap-2 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="text" width={72} height={28} />
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <Skeleton variant="text" width={160} height={20} className="mb-4" />
          <Skeleton variant="row" className="mb-1" />
          <Skeleton variant="row" className="mb-1" />
          <Skeleton variant="row" className="mb-1" />
          <Skeleton variant="row" className="mb-1" />
          <Skeleton variant="row" />
        </Card>
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          {strings.results.loading}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-20 text-center px-6 py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{strings.results.errorTitle}</h3>
        <p className="text-slate-500 mb-6">{error}</p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => navigate('/login')}>
            <LogIn className="w-4 h-4 mr-2" />
            {strings.results.reLogin}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/peer-review')}>
            {strings.results.backToSessions}
          </Button>
        </div>
      </Card>
    );
  }

  const { session, averages, details, completion } = data;
  const totalTeams = completion.length;
  const completedTeams = completion.filter((c) => parseInt(c.submitted_count) >= parseInt(c.team_size)).length;
  const totalStudents = completion.reduce((sum, c) => sum + parseInt(c.team_size), 0);
  const submittedStudents = completion.reduce((sum, c) => sum + parseInt(c.submitted_count), 0);
  const progressPct = totalStudents > 0 ? (submittedStudents / totalStudents * 100) : 0;

  const thClass = 'text-left py-3 px-3 font-medium text-slate-500 text-sm whitespace-nowrap';
  const tdClass = 'py-3 px-3 text-sm text-slate-700';
  const tdCenter = tdClass + ' text-center';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge type={session.is_open ? 'info' : 'success'}>
              {session.is_open ? 'Open' : 'Closed'}
            </Badge>
            <span className="text-sm text-slate-500">
              Created {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Team</label>
              <input
                type="text"
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                placeholder="e.g. G1"
                value={exportGroup}
                onChange={(e) => setExportGroup(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Start</label>
              <input
                type="date"
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">End</label>
              <input
                type="date"
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 pb-1">
              <input
                type="checkbox"
                checked={anonymizedExport}
                onChange={(e) => setAnonymizedExport(e.target.checked)}
              />
              Anonymized
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 pb-1">
              <input
                type="checkbox"
                checked={anonymizedView}
                onChange={(e) => setAnonymizedView(e.target.checked)}
              />
              Anonymous view
            </label>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={handleReleaseScores} variant={session.scores_released ? 'primary' : 'secondary'} aria-label={session.scores_released ? 'Hide scores from students' : 'Release scores to students'}>
              {session.scores_released ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {session.scores_released ? 'Hide Scores' : 'Release Scores'}
            </Button>
            <Button onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => navigate('/peer-review')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
          {releaseError && (
            <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
              <span>{releaseError}</span>
              <Button variant="secondary" size="sm" onClick={handleReleaseScores} aria-label="Retry release scores">
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Completion Progress */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Completion Progress</h3>
          <p className="text-sm text-slate-500 mb-4">
            {completedTeams}/{totalTeams} teams done · {submittedStudents}/{totalStudents} students submitted
          </p>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-[#000E2F]/50'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {completion.map((c) => {
              const done = parseInt(c.submitted_count) >= parseInt(c.team_size);
              return (
                <Badge key={c.team} type={done ? 'success' : 'warning'}>
                  Team {c.team}: {c.submitted_count}/{c.team_size} {done ? '✅' : '⚠️'}
                </Badge>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Averages Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Averages per Student</h3>
          {averages.length === 0 ? (
            <p className="text-sm text-slate-400">No reviews submitted yet.</p>
          ) : (
            <>
              <SearchInput
                value={avgList.query}
                onChange={avgList.setQuery}
                placeholder="Search by name, team…"
              />
              <div className="overflow-x-auto mt-4 -mx-6 px-6">
                <table className="w-full">
                  <caption className="sr-only">Peer review score averages by student</caption>
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                      <th scope="col" className={thClass}>Team</th>
                      <th scope="col" className={thClass}>Name</th>
                      <th scope="col" className={thClass + ' text-center'}>Technical</th>
                      <th scope="col" className={thClass + ' text-center'}>Interactions</th>
                      <th scope="col" className={thClass + ' text-center'}>Management</th>
                      <th scope="col" className={thClass + ' text-center'}>Chemistry</th>
                      <th scope="col" className={thClass + ' text-center'}>Reviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {avgList.pageItems.map((r, idx) => (
                      <motion.tr
                        key={r.reviewee_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="hover:bg-slate-50/50"
                      >
                        <td className={tdClass}>{r.team || '—'}</td>
                        <td className={tdClass + ' font-medium'}>{r.student_name}</td>
                        <td className={tdCenter}>{r.avg_technical ?? '—'}</td>
                        <td className={tdCenter}>{r.avg_interactions ?? '—'}</td>
                        <td className={tdCenter}>{r.avg_management ?? '—'}</td>
                        <td className={tdCenter}>{r.avg_team_chemistry ?? '—'}</td>
                        <td className={tdCenter}>{r.review_count}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={avgList.page}
                totalPages={avgList.totalPages}
                onPageChange={avgList.setPage}
                filtered={avgList.filtered.length}
                total={avgList.total}
                noun="students"
              />
            </>
          )}
        </Card>
      </motion.div>

      {/* Raw Details Toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowDetails(!showDetails)}
          >
            <h3 className="text-lg font-semibold text-slate-900">Raw Review Details</h3>
            {showDetails
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </div>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4"
            >
              {details.length === 0 ? (
                <p className="text-sm text-slate-400">{strings.results.noRawData}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <SearchInput
                      value={detList.query}
                      onChange={detList.setQuery}
                      placeholder="Search reviews…"
                    />
                    <select
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10 focus:border-[#000E2F]/20"
                      value={detList.filters.team || ''}
                      onChange={(e) => detList.setFilters((f) => ({ ...f, team: e.target.value }))}
                    >
                      <option value="">All teams</option>
                      {[...new Set(details.map((d) => d.team).filter(Boolean))].sort().map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#000E2F] focus:ring-[#000E2F]"
                        checked={!!detList.filters.selfOnly}
                        onChange={(e) => detList.setFilters((f) => ({ ...f, selfOnly: e.target.checked }))}
                      />
                      Self-reviews only
                    </label>
                  </div>
                  <div className="overflow-x-auto -mx-6 px-6" role="region" aria-label="Individual peer review detail records">
                    <TableVirtuoso
                      style={{ height: 'min(420px, 60vh)' }}
                      data={detList.filtered}
                      fixedHeaderContent={() => (
                        <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                          <th scope="col" className={thClass}>Team</th>
                          <th scope="col" className={thClass}>Reviewer</th>
                          <th scope="col" className={thClass}>Reviewee</th>
                          <th scope="col" className={thClass + ' text-center'}>Self?</th>
                          <th scope="col" className={thClass + ' text-center'}>Technical</th>
                          <th scope="col" className={thClass + ' text-center'}>Interactions</th>
                          <th scope="col" className={thClass + ' text-center'}>Management</th>
                          <th scope="col" className={thClass + ' text-center'}>Chemistry</th>
                          <th scope="col" className={thClass}>Comments</th>
                        </tr>
                      )}
                      itemContent={(index, d) => (
                        <>
                          <td className={tdClass}>{d.team || '—'}</td>
                          <td className={tdClass}>{d.reviewer_name}</td>
                          <td className={tdClass}>{d.reviewee_name}</td>
                          <td className={tdCenter}>{d.is_self ? 'Y' : 'N'}</td>
                          <td className={tdCenter}>{d.technical_contributions}</td>
                          <td className={tdCenter}>{d.team_interactions}</td>
                          <td className={tdCenter}>{d.project_management}</td>
                          <td className={tdCenter}>{d.team_chemistry ?? '—'}</td>
                          <td className={tdClass + ' max-w-[200px] truncate'}>
                            {d.individual_comments || '—'}
                          </td>
                        </>
                      )}
                      defaultItemHeight={44}
                      className="w-full text-sm border-collapse"
                    />
                  </div>
                  <p className="text-sm text-slate-500 mt-2" aria-live="polite">
                    {strings.results.showingReviews(detList.filtered.length, detList.total)}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </Card>
      </motion.div>

      {/* Bias Analytics Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowBias(!showBias)}
          >
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Self-Score Bias Analytics
            </h3>
            {showBias
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </div>

          {showBias && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4"
            >
              {!biasData ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics...
                </div>
              ) : biasData.length === 0 ? (
                <p className="text-sm text-slate-400">No self-reviews data available.</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Self-score bias analytics by student</caption>
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                        <th scope="col" className={thClass}>Team</th>
                        <th scope="col" className={thClass}>Student</th>
                        <th scope="col" className={thClass + ' text-center'}>Self Avg</th>
                        <th scope="col" className={thClass + ' text-center'}>Peer Avg</th>
                        <th scope="col" className={thClass + ' text-center'}>Bias</th>
                        <th scope="col" className={thClass + ' text-center'}>Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {biasData.map((b, idx) => {
                        const bias = b.bias != null ? Number(b.bias) : null;
                        const flagged = bias != null && Math.abs(bias) >= 1.0;
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/50 ${flagged ? 'bg-amber-50/50' : ''}`}>
                            <td className={tdClass}>{b.team || '—'}</td>
                            <td className={tdClass + ' font-medium'}>{b.student_name}</td>
                            <td className={tdCenter}>{b.self_avg != null ? Number(b.self_avg).toFixed(2) : '—'}</td>
                            <td className={tdCenter}>{b.peer_avg != null ? Number(b.peer_avg).toFixed(2) : '—'}</td>
                            <td className={tdCenter}>
                              {bias != null ? (
                                <span className={bias > 0.5 ? 'text-red-600 font-semibold' : bias < -0.5 ? 'text-blue-600 font-semibold' : ''}>
                                  {bias > 0 ? '+' : ''}{bias.toFixed(2)}
                                </span>
                              ) : '—'}
                            </td>
                            <td className={tdCenter}>
                              {flagged && (
                                <Badge type={bias > 0 ? 'error' : 'info'}>
                                  {bias > 0 ? '⬆ Inflated' : '⬇ Deflated'}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 mt-3">
                    Bias = Self Avg − Peer Avg. Students with |bias| ≥ 1.0 are flagged.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </Card>
      </motion.div>

      {/* Instructor Review All Students Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowInstructorReview(!showInstructorReview)}
          >
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Instructor Review (All Students)
            </h3>
            {showInstructorReview
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </div>

          {showInstructorReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 space-y-4"
            >
              {!allStudents ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading students...
                </div>
              ) : allStudents.length === 0 ? (
                <p className="text-sm text-slate-400">No students enrolled in this course.</p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Review all {allStudents.length} students in one page. Fill scores and comments, then submit.
                  </p>
                  <div className="space-y-3">
                    {allStudents.map((s) => {
                      const rev = instructorReviews[s.user_id] || {};
                      return (
                        <div key={s.user_id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">{s.name}</span>
                            <Badge type="default">Team {s.group_id}</Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {['technical_contributions', 'team_interactions', 'project_management'].map((field) => (
                              <div key={field}>
                                <label className="text-xs text-slate-500 capitalize">{field.replace(/_/g, ' ')}</label>
                                <div className="flex gap-1 mt-1">
                                  {[1, 2, 3, 4, 5].map((v) => (
                                    <button
                                      key={v}
                                      type="button"
                                      className={`w-8 h-8 rounded-lg text-sm font-medium border transition-colors ${
                                        Number(rev[field]) === v
                                          ? 'bg-[#000E2F] text-white border-[#000E2F]'
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-[#000E2F]/30'
                                      }`}
                                      onClick={() => handleInstructorReviewChange(s.user_id, field, v)}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Comments (optional)"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/10"
                            value={rev.individual_comments || ''}
                            onChange={(e) => handleInstructorReviewChange(s.user_id, 'individual_comments', e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col items-end gap-2 pt-2">
                    {submitReviewError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 w-full" role="alert">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        <span>{submitReviewError}</span>
                        <Button variant="secondary" size="sm" onClick={handleSubmitInstructorReviews} disabled={submittingReview} aria-label="Retry submit instructor reviews">
                          Retry
                        </Button>
                      </div>
                    )}
                    <Button onClick={handleSubmitInstructorReviews} disabled={submittingReview}>
                      {submittingReview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Submit Instructor Reviews
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
