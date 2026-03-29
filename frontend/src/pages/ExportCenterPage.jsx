import { useState } from 'react';
import { Download, Database } from 'lucide-react';
import { API_BASE_URL } from '../config';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { strings } from '../i18n/strings';

export default function ExportCenterPage() {
  const [course, setCourse] = useState('');
  const [group, setGroup] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [anonymized, setAnonymized] = useState(false);
  const [peerSessionId, setPeerSessionId] = useState('');
  const [msg, setMsg] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);

  const buildCommonParams = () => {
    const params = new URLSearchParams();
    if (course) params.set('course', course);
    if (group) params.set('group', group);
    if (startDate) params.set('start_date', new Date(`${startDate}T00:00:00`).toISOString());
    if (endDate) params.set('end_date', new Date(`${endDate}T23:59:59`).toISOString());
    if (anonymized) params.set('anonymized', 'true');
    return params;
  };

  const exportFileReviewCsv = () => {
    const params = buildCommonParams();
    const query = params.toString();
    window.open(`${API_BASE_URL}/instructor/export-csv${query ? `?${query}` : ''}`, '_blank');
  };

  const exportPeerReviewCsv = async () => {
    const sessionId = peerSessionId.trim();
    if (!sessionId) {
      setMsg('Please provide Peer Review Session ID.');
      return;
    }
    setMsg('');
    const params = new URLSearchParams();
    if (group) params.set('group', group);
    if (startDate) params.set('start_date', new Date(`${startDate}T00:00:00`).toISOString());
    if (endDate) params.set('end_date', new Date(`${endDate}T23:59:59`).toISOString());
    if (anonymized) params.set('anonymized', 'true');
    const url = `${API_BASE_URL}/peer-review/sessions/${sessionId}/export-csv${params.toString() ? `?${params.toString()}` : ''}`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `peer-review-results-${sessionId}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setMsg('Failed to export peer review CSV. Please verify session ID and permissions.');
    }
  };

  const exportRosterCsv = async () => {
    setLoadingRoster(true);
    setMsg('');
    try {
      const res = await API.get('/instructor/unified-dashboard', {
        params: {
          course: course || undefined,
          group: group || undefined,
        },
      });
      const students = Array.isArray(res.data?.student_participation) ? res.data.student_participation : [];
      const headers = ['Name', 'Course', 'Group', 'File Reviews Given', 'File Reviews Received', 'Avg File Score', 'Peer Reviews Given', 'Peer Reviews Received', 'Avg Peer Score'];
      const rows = students.map((s) =>
        [s.name, s.course_id, s.group_id, s.file_reviews_given, s.file_reviews_received, s.avg_file_score_received, s.peer_reviews_given, s.peer_reviews_received, s.avg_peer_score_received].join(',')
      );
      const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'analytics-roster.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setMsg('Failed to export roster CSV.');
    } finally {
      setLoadingRoster(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-[#000E2F]" />
          Export Center
        </h1>
        <p className="text-slate-500 mt-1">Unified export entry for instructor reports.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Course (optional)" value={course} onChange={(e) => setCourse(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Group (optional)" value={group} onChange={(e) => setGroup(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Peer session UUID (for peer export)" value={peerSessionId} onChange={(e) => setPeerSessionId(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={anonymized} onChange={(e) => setAnonymized(e.target.checked)} />
            Anonymized output
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{strings.export.fileReviewAnalytics} CSV</h2>
          <p className="text-sm text-slate-500">Exports submission-level file review report.</p>
          <Button icon={Download} onClick={exportFileReviewCsv}>Export File Review CSV</Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{strings.export.peerReviewSession} CSV</h2>
          <p className="text-sm text-slate-500">Exports one peer review session by session ID.</p>
          <Button icon={Download} onClick={exportPeerReviewCsv}>Export Peer Review CSV</Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{strings.export.roster} CSV</h2>
          <p className="text-sm text-slate-500">Exports participation roster from unified dashboard data.</p>
          <Button icon={Download} onClick={exportRosterCsv} loading={loadingRoster}>Export Roster CSV</Button>
        </Card>
      </div>

      {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
    </div>
  );
}
