import { useEffect, useState } from 'react';
import { FileText, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { API_BASE_URL } from '../config';
import { useToast } from '../components/ui/ToastProvider';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import QualityFlags from '../components/analytics/QualityFlags';
import RubricEditor from '../components/analytics/RubricEditor';
import AppealsPanel from '../components/analytics/AppealsPanel';
import AnnouncementsPanel from '../components/analytics/AnnouncementsPanel';

/**
 * Instructor analytics: cohort stats, quality flags, peer review flags.
 * Fetches GET /instructor/unified-dashboard, /instructor/quality-flags, /instructor/peer-review-quality-flags.
 * @returns {JSX.Element}
 */
export default function InstructorAnalyticsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [qualityFlags, setQualityFlags] = useState([]);
  const [peerQualityFlags, setPeerQualityFlags] = useState([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [anonymizedExport, setAnonymizedExport] = useState(false);
  const [rubricType, setRubricType] = useState('file_review');
  const [rubricCourseId, setRubricCourseId] = useState('');
  const [rubricSessionId, setRubricSessionId] = useState('');
  const [rubricLevels, setRubricLevels] = useState([]);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [rubricMsg, setRubricMsg] = useState('');
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementCourse, setAnnouncementCourse] = useState('');
  const [announcementGroup, setAnnouncementGroup] = useState('');
  const [announcementLink, setAnnouncementLink] = useState('');
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [policyCourseId, setPolicyCourseId] = useState('');
  const [allowAfterReview, setAllowAfterReview] = useState(false);
  const [policyMsg, setPolicyMsg] = useState('');
  const [replyDialog, setReplyDialog] = useState(null);
  const [replyText, setReplyText] = useState('');

  const rubricDefaults = {
    file_review: [
      { score: 5, label: 'Excellent', desc: 'Exceptional quality. Well-structured, thorough, and demonstrates deep understanding.' },
      { score: 4, label: 'Good', desc: 'Above average quality with minor issues.' },
      { score: 3, label: 'Satisfactory', desc: 'Meets basic expectations with room for improvement.' },
      { score: 2, label: 'Below Average', desc: 'Significant gaps in quality and completeness.' },
      { score: 1, label: 'Poor', desc: 'Does not meet minimum standards.' },
    ],
    peer_technical: [
      { score: 5, label: 'Outstanding', desc: 'Consistently high-quality technical contributions.' },
      { score: 4, label: 'Strong', desc: 'Reliable technical contributor with good initiative.' },
      { score: 3, label: 'Adequate', desc: 'Completes assigned technical tasks satisfactorily.' },
      { score: 2, label: 'Developing', desc: 'Needs assistance with technical tasks.' },
      { score: 1, label: 'Insufficient', desc: 'Rarely contributes technically.' },
    ],
    peer_interactions: [
      { score: 5, label: 'Outstanding', desc: 'Excellent communicator and collaborator.' },
      { score: 4, label: 'Strong', desc: 'Communicates and collaborates effectively.' },
      { score: 3, label: 'Adequate', desc: 'Participates in team communication when needed.' },
      { score: 2, label: 'Developing', desc: 'Limited participation or responsiveness.' },
      { score: 1, label: 'Insufficient', desc: 'Poor collaboration and communication.' },
    ],
    peer_management: [
      { score: 5, label: 'Outstanding', desc: 'Excellent planning, ownership, and deadline management.' },
      { score: 4, label: 'Strong', desc: 'Reliable and organized with good deadline performance.' },
      { score: 3, label: 'Adequate', desc: 'Generally meets deadlines and responsibilities.' },
      { score: 2, label: 'Developing', desc: 'Occasional deadline misses and weak planning.' },
      { score: 1, label: 'Insufficient', desc: 'Frequent deadline misses and poor task management.' },
    ],
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get('/instructor/unified-dashboard', {
          params: {
            course: courseFilter || undefined,
            group: groupFilter || undefined,
          },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError('Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [courseFilter, groupFilter]);

  useEffect(() => {
    const cid = (policyCourseId || courseFilter || '').trim();
    if (!cid) return;
    API.get('/instructor/submission-policy', { params: { course_id: cid } })
      .then((res) => setAllowAfterReview(Boolean(res.data?.allow_edit_withdraw_after_reviews)))
      .catch(() => {});
  }, [policyCourseId, courseFilter]);

  useEffect(() => {
    setAppealsLoading(true);
    API.get('/peer-review/appeals')
      .then((res) => setAppeals(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAppeals([]))
      .finally(() => setAppealsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRubricLoading(true);
    setRubricMsg('');
    API.get('/rubrics', {
      params: {
        rubric_type: rubricType,
        course_id: rubricCourseId || undefined,
        session_id: rubricSessionId || undefined,
      },
    })
      .then((res) => {
        if (cancelled) return;
        const lv = Array.isArray(res.data?.levels) ? res.data.levels : [];
        if (lv.length === 5) setRubricLevels(lv);
        else setRubricLevels(rubricDefaults[rubricType] || []);
      })
      .catch(() => {
        if (!cancelled) setRubricLevels(rubricDefaults[rubricType] || []);
      })
      .finally(() => { if (!cancelled) setRubricLoading(false); });
    return () => { cancelled = true; };
  }, [rubricType, rubricCourseId, rubricSessionId]);

  const updateRubricLevel = (score, field, value) => {
    setRubricLevels((prev) => prev.map((l) => (l.score === score ? { ...l, [field]: value } : l)));
  };

  const saveRubric = async () => {
    setRubricSaving(true);
    setRubricMsg('');
    try {
      await API.post('/rubrics', {
        rubric_type: rubricType,
        course_id: rubricCourseId || null,
        session_id: rubricSessionId || null,
        levels: rubricLevels,
      });
      setRubricMsg('Rubric saved successfully.');
    } catch (err) {
      setRubricMsg(err.response?.data?.message || 'Failed to save rubric.');
    } finally {
      setRubricSaving(false);
    }
  };

  const updateAppeal = (appealId, status) => {
    setReplyText('');
    setReplyDialog({ appealId, status });
  };

  const confirmAppealUpdate = async () => {
    const { appealId, status } = replyDialog;
    setReplyDialog(null);
    try {
      await API.patch(`/peer-review/appeals/${appealId}`, {
        status,
        instructor_reply: replyText,
      });
      const res = await API.get('/peer-review/appeals');
      setAppeals(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.message || 'Failed to update request' });
    }
  };

  const sendAnnouncement = async () => {
    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    if (!title || !body) {
      setAnnouncementMsg('Title and body are required.');
      return;
    }
    setAnnouncementSending(true);
    setAnnouncementMsg('');
    try {
      const res = await API.post('/instructor/announcements', {
        title,
        body,
        link: announcementLink.trim() || '',
        course_id: announcementCourse.trim() || null,
        group_id: announcementGroup.trim() || null,
      });
      setAnnouncementMsg(`Announcement sent to ${res.data?.recipients ?? 0} student(s).`);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementLink('');
    } catch (err) {
      setAnnouncementMsg(err.response?.data?.message || 'Failed to send announcement.');
    } finally {
      setAnnouncementSending(false);
    }
  };

  // Load quality flags from backend
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      API.get('/instructor/quality-flags', {
        params: {
          course: courseFilter || undefined,
          group: groupFilter || undefined,
        },
      }).then((r) => r.data).catch(() => []),
      API.get('/instructor/peer-review-quality-flags').then((r) => r.data).catch(() => []),
    ]).then(([fileFlags, peerFlags]) => {
      if (!cancelled) {
        setQualityFlags(Array.isArray(fileFlags) ? fileFlags : []);
        setPeerQualityFlags(Array.isArray(peerFlags) ? peerFlags : []);
      }
    }).finally(() => { if (!cancelled) setFlagsLoading(false); });
    return () => { cancelled = true; };
  }, [courseFilter, groupFilter]);

  const fr = data?.file_reviews || {};
  const pr = data?.peer_reviews || {};
  const students = data?.student_participation || [];

  /* Compute score distribution buckets from avg_peer_score_received */
  const buckets = [0, 0, 0, 0, 0]; // 1-5
  students.forEach((s) => {
    const avg = Number(s.avg_peer_score_received || s.avg_file_score_received || 0);
    if (avg > 0) {
      const idx = Math.min(Math.max(Math.round(avg) - 1, 0), 4);
      buckets[idx]++;
    }
  });
  const maxBucket = Math.max(...buckets, 1);

  /* Anomaly detection: students with 0 reviews given */
  const flagged = students.filter(
    (s) => Number(s.file_reviews_given || 0) + Number(s.peer_reviews_given || 0) === 0
  );

  const exportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Name', 'Course', 'Group', 'File Reviews Given', 'File Reviews Received', 'Avg File Score', 'Peer Reviews Given', 'Peer Reviews Received', 'Avg Peer Score'];
    const rows = students.map((s) =>
      [s.name, s.course_id, s.group_id, s.file_reviews_given, s.file_reviews_received, s.avg_file_score_received, s.peer_reviews_given, s.peer_reviews_received, s.avg_peer_score_received].join(',')
    );
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics-roster.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Server-side file review CSV export (includes per-submission breakdown)
  const exportFileReviewCsv = () => {
    const params = new URLSearchParams();
    if (courseFilter) params.set('course', courseFilter);
    if (groupFilter) params.set('group', groupFilter);
    if (startDateFilter) params.set('start_date', new Date(`${startDateFilter}T00:00:00`).toISOString());
    if (endDateFilter) params.set('end_date', new Date(`${endDateFilter}T23:59:59`).toISOString());
    if (anonymizedExport) params.set('anonymized', 'true');
    const query = params.toString();
    window.open(`${API_BASE_URL}/instructor/export-csv${query ? `?${query}` : ''}`, '_blank');
  };

  const saveSubmissionPolicy = async () => {
    const cid = (policyCourseId || courseFilter || '').trim();
    if (!cid) {
      setPolicyMsg('Please set a course id first.');
      return;
    }
    try {
      await API.put('/instructor/submission-policy', {
        course_id: cid,
        allow_edit_withdraw_after_reviews: allowAfterReview,
      });
      setPolicyMsg('Submission policy saved.');
    } catch (err) {
      setPolicyMsg(err.response?.data?.message || 'Failed to save submission policy.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Analytics &amp; Reports</h1>
          <p className="text-slate-500 mt-1">Class-wide performance and anomaly detection.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={FileText} onClick={exportCsv}>
            Roster CSV
          </Button>
          <Button variant="secondary" icon={FileText} onClick={exportFileReviewCsv}>
            File Review CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Course</label>
            <input
              type="text"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. CSE2100"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Group</label>
            <input
              type="text"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. G1"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start date</label>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End date</label>
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCourseFilter('');
              setGroupFilter('');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
          >
            Clear Filters
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={anonymizedExport}
              onChange={(e) => setAnonymizedExport(e.target.checked)}
            />
            Anonymized export
          </label>
        </div>
      </Card>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-[#000E2F]" /> Score Distribution
          </h3>
          <div className="h-40 flex items-end justify-between gap-2 border-b border-slate-200 pb-2">
            {buckets.map((count, i) => (
              <div
                key={i}
                className="w-1/5 bg-[#000E2F]/50 rounded-t-sm transition-all"
                style={{ height: `${(count / maxBucket) * 100}%`, minHeight: count > 0 ? '8px' : '0' }}
                title={`${count} student(s)`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
            <span>1 Star</span><span>2 Stars</span><span>3 Stars</span><span>4 Stars</span><span>5 Stars</span>
          </div>
        </Card>

        {/* Detected Anomalies */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-amber-500" /> Detected Anomalies
          </h3>
          <div className="space-y-3">
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-500">No anomalies detected. All students appear on track.</p>
            ) : (
              flagged.slice(0, 5).map((s, i) => (
                <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                  <span className="font-bold">{s.name}</span> has given 0 reviews (file + peer).
                </div>
              ))
            )}
            {flagged.length > 5 && (
              <p className="text-xs text-slate-500">+{flagged.length - 5} more flagged student(s)</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Quality Flags ── */}
      <QualityFlags
        flagsLoading={flagsLoading}
        qualityFlags={qualityFlags}
        peerQualityFlags={peerQualityFlags}
      />

      {/* ── Student Performance Roster ── */}
      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Student Performance Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-4 font-medium">Student Name</th>
                <th className="p-4 font-medium">Reviews Given</th>
                <th className="p-4 font-medium">Avg Score Given</th>
                <th className="p-4 font-medium">Avg Score Received</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No student data available</td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const given = Number(s.file_reviews_given || 0) + Number(s.peer_reviews_given || 0);
                  const avgGiven = Number(s.avg_file_score_received || 0).toFixed(1);
                  const avgReceived = Number(s.avg_peer_score_received || 0).toFixed(1);
                  const isFlagged = given === 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-900">{s.name}</td>
                      <td className="p-4 text-slate-600">{given}</td>
                      <td className="p-4 text-slate-600">{avgGiven}</td>
                      <td className="p-4 text-slate-600">{avgReceived}</td>
                      <td className="p-4">
                        {isFlagged
                          ? <Badge type="error">Missing Reviews</Badge>
                          : <Badge type="success">On Track</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Rubric Configuration ── */}
      <RubricEditor
        rubricType={rubricType}
        setRubricType={setRubricType}
        rubricCourseId={rubricCourseId}
        setRubricCourseId={setRubricCourseId}
        rubricSessionId={rubricSessionId}
        setRubricSessionId={setRubricSessionId}
        rubricLoading={rubricLoading}
        rubricLevels={rubricLevels}
        updateRubricLevel={updateRubricLevel}
        saveRubric={saveRubric}
        rubricSaving={rubricSaving}
        rubricMsg={rubricMsg}
      />

      {/* ── Submission Policy ── */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Submission Edit/Withdraw Policy</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Course</label>
            <input
              type="text"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. CSE2100"
              value={policyCourseId}
              onChange={(e) => setPolicyCourseId(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allowAfterReview}
              onChange={(e) => setAllowAfterReview(e.target.checked)}
            />
            Allow students to edit/withdraw even after reviews exist
          </label>
          <Button onClick={saveSubmissionPolicy}>Save Policy</Button>
          {policyMsg ? <span className="text-sm text-slate-600">{policyMsg}</span> : null}
        </div>
      </Card>

      {/* ── Announcements ── */}
      <AnnouncementsPanel
        announcementTitle={announcementTitle}
        setAnnouncementTitle={setAnnouncementTitle}
        announcementBody={announcementBody}
        setAnnouncementBody={setAnnouncementBody}
        announcementCourse={announcementCourse}
        setAnnouncementCourse={setAnnouncementCourse}
        announcementGroup={announcementGroup}
        setAnnouncementGroup={setAnnouncementGroup}
        announcementLink={announcementLink}
        setAnnouncementLink={setAnnouncementLink}
        announcementSending={announcementSending}
        announcementMsg={announcementMsg}
        sendAnnouncement={sendAnnouncement}
      />

      {/* ── Appeals ── */}
      <AppealsPanel
        appealsLoading={appealsLoading}
        appeals={appeals}
        updateAppeal={updateAppeal}
      />

      {/* Reply dialog for appeal updates */}
      <ConfirmDialog
        open={!!replyDialog}
        title="Instructor Reply"
        message="Provide an optional reply before updating this appeal."
        confirmLabel="Submit"
        variant="primary"
        onConfirm={confirmAppealUpdate}
        onCancel={() => setReplyDialog(null)}
      >
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
          rows={3}
          placeholder="Instructor reply (optional)"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
