import { useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import { RESERVED_HEADERS, parseCsv, toScore, csvEscape, buildDefaultWeek } from '../utils/csvHelpers';
import MappingPanel from '../components/checkins/MappingPanel';
import WeeklyScoresTable from '../components/checkins/WeeklyScoresTable';
import WeeklyCommentsPanel from '../components/checkins/WeeklyCommentsPanel';
import InsightsTable from '../components/checkins/InsightsTable';
import HandedOutTable from '../components/checkins/HandedOutTable';
import RollingAveragesTable from '../components/checkins/RollingAveragesTable';

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
          return {
            id: `${team}::${name}::${idx}`,
            team,
            name,
            self: selfIdx >= 0 ? (row[selfIdx] || '').trim() : '',
            base_comment: commentsIdx >= 0 ? (row[commentsIdx] || '').trim() : '',
            mapped_user_id: matched?.user_id || null,
          };
        })
        .filter(Boolean);

      const week1 = buildDefaultWeek('week-1', 'Week 1', mappedMembers, topicCols);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setTopics(topicCols);
      setMembers(mappedMembers);
      setWeeks([week1]);
      setSelectedWeekId('week-1');
      setTeamFilter('ALL');
      setShowComments(false);
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
    <div>
      <h1 className="page-title">Student Check-ins</h1>
      <p className="page-subtitle">
        Upload one template CSV, score weekly, submit weekly scores, and keep rolling per-student averages.
      </p>

      <div className="card mb-16">
        <div className="flex-center flex-wrap gap-8 mb-12">
          <button
            type="button"
            className={`btn btn-md ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('existing')}
            disabled={members.length === 0}
          >
            Update Existing
          </button>
          <button
            type="button"
            className={`btn btn-md ${mode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('upload')}
          >
            Upload New CSV
          </button>
        </div>
        {mode === 'upload' && (
          <div className="form-group">
            <label className="form-label" htmlFor="template-csv-upload">Template CSV</label>
            <input id="template-csv-upload" type="file" accept=".csv,text/csv" onChange={loadTemplate} />
          </div>
        )}
        {mode === 'existing' && members.length > 0 && (
          <p className="card-meta">Editing stored check-ins. Use "Submit Weekly Scores" to persist updates.</p>
        )}
        {loadingSaved && <p className="card-meta">Loading saved data...</p>}
        {fileName && <p className="card-meta">Loaded: {fileName}</p>}
        {status && <p className="success-text">{status}</p>}
        {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}
      </div>

      {members.length > 0 && showMappingPanel && (
        <MappingPanel
          members={members}
          studentOptions={studentOptions}
          onMapMember={setMemberMapping}
        />
      )}

      {members.length > 0 && (
        <div className="card mb-16">
          <div className="flex-center flex-wrap gap-8">
            {weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`btn btn-md ${selectedWeekId === week.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedWeekId(week.id)}
              >
                {week.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-md btn-secondary"
              onClick={addWeek}
            >
              + Add Week
            </button>
            <button
              type="button"
              className="btn btn-md btn-secondary"
              onClick={() => setShowComments((v) => !v)}
            >
              {showComments ? 'Hide Comments' : 'Show Comments'}
            </button>
            <button
              type="button"
              className="btn btn-md btn-secondary"
              onClick={exportRollingCsv}
            >
              Export Rolling CSV
            </button>
          </div>
        </div>
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
