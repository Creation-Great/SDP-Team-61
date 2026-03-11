import { useEffect, useMemo, useState } from 'react';
import { Upload, FileText, Plus, MessageSquare, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import API from '../services/api';
import { RESERVED_HEADERS, parseCsv, toScore, csvEscape, buildDefaultWeek } from '../utils/csvHelpers';
import MappingPanel from '../components/checkins/MappingPanel';
import WeeklyScoresTable from '../components/checkins/WeeklyScoresTable';
import WeeklyCommentsPanel from '../components/checkins/WeeklyCommentsPanel';
import InsightsTable from '../components/checkins/InsightsTable';
import HandedOutTable from '../components/checkins/HandedOutTable';
import RollingAveragesTable from '../components/checkins/RollingAveragesTable';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function InstructorPeerReviewPage() {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [topics, setTopics] = useState([]);
  const [members, setMembers] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [mode, setMode] = useState('upload');
  const [studentOptions, setStudentOptions] = useState([]);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [insights, setInsights] = useState([]);
  const [handedOut, setHandedOut] = useState([]);
  const [selectedRaterMemberId, setSelectedRaterMemberId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const studentsRes = await API.get('/instructor/checkins/students');
        if (!cancelled) {
          setStudentOptions(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        }

        const res = await API.get('/instructor/checkins/current');
        if (cancelled) return;
        const data = res.data;
        setFileName(data.file_name || '');
        setHeaders(Array.isArray(data.headers) ? data.headers : []);
        setTopics(Array.isArray(data.topics) ? data.topics : []);
        setMembers(Array.isArray(data.members) ? data.members : []);

        const loadedWeeks = Array.isArray(data.weeks) ? data.weeks : [];
        const normalizedWeeks = loadedWeeks.map((w) => ({
          ...w,
          comments: w.comments || {},
          scores: w.scores || {},
          additional_comments: w.additional_comments || '',
        }));
        setWeeks(normalizedWeeks);
        if (normalizedWeeks.length > 0) {
          setSelectedWeekId(normalizedWeeks[0].id);
          setStatus('Loaded saved check-ins');
          setMode('existing');
          setShowMappingPanel(false);
        }
      } catch (err) {
        if (err?.response?.status !== 404) {
          setError('Failed to load saved check-ins');
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    };
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await API.get('/instructor/checkins/insights');
      setInsights(Array.isArray(res.data?.insights) ? res.data.insights : []);
      setHandedOut(Array.isArray(res.data?.handed_out) ? res.data.handed_out : []);
    } catch {
      setInsights([]);
      setHandedOut([]);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.id === selectedWeekId) || null,
    [weeks, selectedWeekId]
  );

  const memberLabelById = useMemo(() => {
    const map = new Map();
    members.forEach((m) => map.set(m.id, `Team ${m.team} - ${m.name}`));
    return map;
  }, [members]);

  const selectedRaterWeekData = useMemo(() => {
    if (!selectedRaterMemberId || !selectedWeekId) return null;
    const rater = handedOut.find((h) => h.rater_member_id === selectedRaterMemberId);
    if (!rater) return null;
    return (rater.weeks || []).find((w) => w.id === selectedWeekId) || null;
  }, [handedOut, selectedRaterMemberId, selectedWeekId]);

  const teams = useMemo(() => {
    const unique = Array.from(new Set(members.map((m) => m.team).filter(Boolean))).sort();
    return ['ALL', ...unique];
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (teamFilter === 'ALL') return members;
    return members.filter((m) => m.team === teamFilter);
  }, [members, teamFilter]);

  const rollingByMember = useMemo(() => {
    const byMember = {};
    members.forEach((member) => {
      byMember[member.id] = {};
      topics.forEach((topic) => {
        let sum = 0;
        let count = 0;
        weeks.forEach((week) => {
          const raw = week.scores?.[member.id]?.[topic];
          const n = toScore(raw);
          if (n !== null) {
            sum += n;
            count += 1;
          }
        });
        byMember[member.id][topic] = count > 0 ? Number((sum / count).toFixed(2)) : null;
      });
    });
    return byMember;
  }, [members, topics, weeks]);

  const saveCheckins = async (message = 'Saved') => {
    await API.post('/instructor/checkins/current', {
      file_name: fileName,
      headers,
      topics,
      members,
      weeks,
    });
    setStatus(message);
  };

  const submitCurrentWeek = async () => {
    if (!selectedWeek) return;
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      await saveCheckins(`${selectedWeek.label} submitted`);
      setShowMappingPanel(false);
      await fetchInsights();
    } catch {
      setError('Failed to submit weekly scores');
    } finally {
      setSubmitting(false);
    }
  };

  const loadTemplate = async (event) => {
    setError('');
    setStatus('');
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setError('CSV is empty.');
        return;
      }

      const lowerHeaders = parsed.headers.map((h) => h.toLowerCase());
      const teamIdx = lowerHeaders.indexOf('team');
      const nameIdx = lowerHeaders.indexOf('name');
      const selfIdx = lowerHeaders.indexOf('self');
      const commentsIdx = lowerHeaders.indexOf('individual comments');

      if (teamIdx === -1 || nameIdx === -1) {
        setError('CSV must include Team and Name columns.');
        return;
      }

      const topicCols = parsed.headers.filter((h) => !RESERVED_HEADERS.has(h.toLowerCase()));
      if (topicCols.length === 0) {
        setError('No grading topics found.');
        return;
      }

      const mappedMembers = parsed.rows
        .map((row, idx) => {
          const team = (row[teamIdx] || '').trim();
          const name = (row[nameIdx] || '').trim();
          if (!team || !name) return null;
          const matched = studentOptions.find(
            (s) => normalizeName(s.display_name) === normalizeName(name)
          );
          // Collect pre-filled scores from CSV row
          const rowScores = {};
          topicCols.forEach((topic) => {
            const colIdx = parsed.headers.indexOf(topic);
            if (colIdx >= 0) {
              const val = toScore(row[colIdx]);
              rowScores[topic] = val !== null ? String(val) : '';
            }
          });
          // Collect pre-filled comment
          const baseComment = commentsIdx >= 0 ? (row[commentsIdx] || '').trim() : '';
          return {
            id: `${team}::${name}::${idx}`,
            team,
            name,
            self: selfIdx >= 0 ? (row[selfIdx] || '').trim() : '',
            base_comment: baseComment,
            mapped_user_id: matched?.user_id || null,
            _csvScores: rowScores,
            _csvComment: baseComment,
          };
        })
        .filter(Boolean);

      // Build Week 1 with pre-filled scores from CSV instead of empty defaults
      const week1Scores = {};
      const week1Comments = {};
      mappedMembers.forEach((m) => {
        week1Scores[m.id] = m._csvScores || {};
        week1Comments[m.id] = m._csvComment || '';
        // Fill any missing topics with empty string
        topicCols.forEach((t) => {
          if (!(t in week1Scores[m.id])) week1Scores[m.id][t] = '';
        });
      });
      const week1 = { id: 'week-1', label: 'Week 1', scores: week1Scores, comments: week1Comments, additional_comments: '' };
      setFileName(file.name);
      setHeaders(parsed.headers);
      setTopics(topicCols);
      setMembers(mappedMembers);
      setWeeks([week1]);
      setSelectedWeekId('week-1');
      setTeamFilter('ALL');
      // Auto-show comments panel when CSV contains Individual Comments
      const hasComments = mappedMembers.some((m) => m._csvComment);
      setShowComments(hasComments);
      setMode('existing');
      setShowMappingPanel(true);
      setStatus('Template loaded');
    } catch {
      setError('Failed to parse CSV template.');
    }
  };

  const addWeek = () => {
    if (members.length === 0 || topics.length === 0) return;
    const nextNum = weeks.length + 1;
    const id = `week-${nextNum}`;
    const newWeek = buildDefaultWeek(id, `Week ${nextNum}`, members, topics);
    setWeeks((prev) => [...prev, newWeek]);
    setSelectedWeekId(id);
  };

  const setWeeklyScore = (weekId, memberId, topic, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          scores: {
            ...week.scores,
            [memberId]: {
              ...(week.scores[memberId] || {}),
              [topic]: value,
            },
          },
        };
      })
    );
  };

  const setWeeklyComment = (weekId, memberId, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          comments: {
            ...(week.comments || {}),
            [memberId]: value,
          },
        };
      })
    );
  };

  const setWeeklyAdditionalComments = (weekId, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          additional_comments: value,
        };
      })
    );
  };

  const setMemberMapping = (memberId, mappedUserId) => {
    setMembers((prev) =>
      prev.map((member) => {
        if (member.id !== memberId) return member;
        return {
          ...member,
          mapped_user_id: mappedUserId || null,
        };
      })
    );
  };

  const exportRollingCsv = () => {
    if (members.length === 0) return;
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const teamIdx = lowerHeaders.indexOf('team');
    const nameIdx = lowerHeaders.indexOf('name');
    const selfIdx = lowerHeaders.indexOf('self');
    const commentsIdx = lowerHeaders.indexOf('individual comments');

    const lines = [headers.map(csvEscape).join(',')];
    members.forEach((m) => {
      const row = headers.map(() => '');
      if (teamIdx >= 0) row[teamIdx] = m.team;
      if (nameIdx >= 0) row[nameIdx] = m.name;
      if (selfIdx >= 0) row[selfIdx] = m.self;
      if (commentsIdx >= 0) {
        const selectedComment = selectedWeek?.comments?.[m.id] || '';
        row[commentsIdx] = selectedComment || m.base_comment || '';
      }
      topics.forEach((topic) => {
        const idx = headers.indexOf(topic);
        if (idx >= 0) {
          const avg = rollingByMember?.[m.id]?.[topic];
          row[idx] = avg === null || avg === undefined ? '' : String(avg);
        }
      });
      lines.push(row.map(csvEscape).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rolling-averages-${fileName || 'peer-review.csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Check-ins</h1>
          <p className="text-slate-500 mt-1">
            Upload one template CSV, score weekly, submit weekly scores, and keep rolling per-student averages.
          </p>
        </div>
        {members.length > 0 && (
          <Button variant="secondary" icon={Download} onClick={exportRollingCsv}>
            Export Rolling CSV
          </Button>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center flex-wrap gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === 'existing'
                ? 'bg-[#000E2F] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setMode('existing')}
            disabled={members.length === 0}
          >
            <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Update Existing
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-[#000E2F] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setMode('upload')}
          >
            <Upload className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Upload New CSV
          </button>
          {fileName && <span className="ml-auto text-sm text-slate-500">Loaded: {fileName}</span>}
        </div>
        <div className="p-6">
          {mode === 'upload' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="template-csv-upload">Template CSV</label>
              <input
                id="template-csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={loadTemplate}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#000E2F]/5 file:text-[#000E2F] hover:file:bg-[#000E2F]/10"
              />
            </div>
          )}
          {mode === 'existing' && members.length > 0 && (
            <p className="text-sm text-slate-500">Editing stored check-ins. Use &quot;Submit Weekly Scores&quot; to persist updates.</p>
          )}
          {loadingSaved && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading saved data...
            </div>
          )}
          {status && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm mt-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {status}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mt-2" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </Card>

      {members.length > 0 && showMappingPanel && (
        <MappingPanel
          members={members}
          studentOptions={studentOptions}
          onMapMember={setMemberMapping}
        />
      )}

      {members.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center flex-wrap gap-2">
            {weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedWeekId === week.id
                    ? 'bg-[#000E2F] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setSelectedWeekId(week.id)}
              >
                {week.label}
              </button>
            ))}
            <Button variant="secondary" size="sm" onClick={addWeek}>
              <Plus className="w-4 h-4 mr-1" />
              Add Week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowComments((v) => !v)}>
              <MessageSquare className="w-4 h-4 mr-1" />
              {showComments ? 'Hide Comments' : 'Show Comments'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowMappingPanel((v) => !v)} disabled={members.length === 0}>
              Mapping
            </Button>
          </div>
        </Card>
      )}

      {selectedWeek && (
        <WeeklyScoresTable
          week={selectedWeek}
          topics={topics}
          filteredMembers={filteredMembers}
          onSetScore={setWeeklyScore}
          onSubmit={submitCurrentWeek}
          submitting={submitting}
        />
      )}

      {showComments && selectedWeek && (
        <WeeklyCommentsPanel
          week={selectedWeek}
          filteredMembers={filteredMembers}
          onSetComment={setWeeklyComment}
          onSetAdditionalComments={setWeeklyAdditionalComments}
        />
      )}

      {members.length > 0 && (
        <InsightsTable
          insights={insights}
          selectedRaterMemberId={selectedRaterMemberId}
          onSelectRater={setSelectedRaterMemberId}
        />
      )}

      {selectedRaterWeekData && (
        <HandedOutTable
          raterLabel={memberLabelById.get(selectedRaterMemberId) || selectedRaterMemberId}
          weekLabel={selectedWeek?.label || selectedWeekId}
          weekData={selectedRaterWeekData}
          topics={topics}
          memberLabelById={memberLabelById}
        />
      )}

      {members.length > 0 && (
        <RollingAveragesTable
          filteredMembers={filteredMembers}
          topics={topics}
          rollingByMember={rollingByMember}
          teams={teams}
          teamFilter={teamFilter}
          onTeamFilterChange={setTeamFilter}
        />
      )}
    </div>
  );
}
