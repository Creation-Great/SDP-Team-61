import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import API from '../services/api';

const FILE_REVIEW_RUBRIC = [
  { score: 5, label: 'Excellent', desc: 'Exceptional quality. Well-structured, thorough, and demonstrates deep understanding. No significant issues.' },
  { score: 4, label: 'Good', desc: 'Above average quality. Mostly well-written with minor issues that do not affect overall understanding.' },
  { score: 3, label: 'Satisfactory', desc: 'Meets basic expectations. Some areas need improvement but core requirements are addressed.' },
  { score: 2, label: 'Below Average', desc: 'Significant gaps in quality. Multiple areas need improvement, missing key elements.' },
  { score: 1, label: 'Poor', desc: 'Does not meet minimum standards. Major revisions required across all areas.' },
];

const PEER_REVIEW_RUBRIC = {
  technical_contributions: [
    { score: 5, label: 'Outstanding', desc: 'Consistently delivers high-quality technical work. Proactively solves complex problems and mentors others.' },
    { score: 4, label: 'Strong', desc: 'Reliably contributes quality technical work. Takes initiative on challenging tasks.' },
    { score: 3, label: 'Adequate', desc: 'Completes assigned technical tasks satisfactorily. Occasionally needs guidance.' },
    { score: 2, label: 'Developing', desc: 'Struggles with some technical tasks. Requires frequent assistance from teammates.' },
    { score: 1, label: 'Insufficient', desc: 'Rarely contributes technically. Does not complete assigned coding/design tasks.' },
  ],
  team_interactions: [
    { score: 5, label: 'Outstanding', desc: 'Excellent communicator. Actively facilitates discussions, resolves conflicts, and supports all team members.' },
    { score: 4, label: 'Strong', desc: 'Communicates well and participates actively. Respectful and collaborative.' },
    { score: 3, label: 'Adequate', desc: 'Participates in team activities when asked. Communication is satisfactory.' },
    { score: 2, label: 'Developing', desc: 'Minimal participation in team discussions. Sometimes unresponsive or difficult to reach.' },
    { score: 1, label: 'Insufficient', desc: 'Does not engage with the team. Absent from meetings or uncooperative.' },
  ],
  project_management: [
    { score: 5, label: 'Outstanding', desc: 'Exceptional at planning and tracking. Consistently meets deadlines and helps keep the team on track.' },
    { score: 4, label: 'Strong', desc: 'Well-organized and reliable. Meets most deadlines and contributes to project planning.' },
    { score: 3, label: 'Adequate', desc: 'Generally meets deadlines. Follows the project plan but does not take initiative in organizing.' },
    { score: 2, label: 'Developing', desc: 'Occasionally misses deadlines. Needs reminders about tasks and responsibilities.' },
    { score: 1, label: 'Insufficient', desc: 'Frequently misses deadlines. Does not track or manage assigned work.' },
  ],
};

function ScoreRow({ score, label, desc, highlighted }) {
  return (
    <div className={`flex gap-3 py-2 px-3 rounded-lg transition-colors ${highlighted ? 'bg-[#000E2F]/10 border border-[#000E2F]/20' : ''}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        highlighted ? 'bg-[#000E2F] text-white' : 'bg-slate-100 text-slate-600'
      }`}>
        {score}
      </div>
      <div>
        <span className={`text-sm font-semibold ${highlighted ? 'text-[#000E2F]' : 'text-slate-700'}`}>{label}</span>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function FileReviewRubric({ currentScore, courseId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(FILE_REVIEW_RUBRIC);

  useEffect(() => {
    API.get('/rubrics', {
      params: {
        rubric_type: 'file_review',
        course_id: courseId || undefined,
      },
    })
      .then((res) => {
        if (Array.isArray(res.data?.levels) && res.data.levels.length === 5) {
          setItems(res.data.levels);
        }
      })
      .catch(() => {});
  }, [courseId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#000E2F]" />
          Grading Rubric
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1">
          {items.map((r) => (
            <ScoreRow key={r.score} {...r} highlighted={currentScore === r.score} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PeerReviewRubric({ category, currentScore, courseId, sessionId }) {
  const [open, setOpen] = useState(false);
  const [rubric, setRubric] = useState(PEER_REVIEW_RUBRIC[category]);
  useEffect(() => {
    const typeMap = {
      technical_contributions: 'peer_technical',
      team_interactions: 'peer_interactions',
      project_management: 'peer_management',
    };
    const rubricType = typeMap[category];
    if (!rubricType) return;
    setRubric(PEER_REVIEW_RUBRIC[category]);
    API.get('/rubrics', {
      params: {
        rubric_type: rubricType,
        course_id: courseId || undefined,
        session_id: sessionId || undefined,
      },
    })
      .then((res) => {
        if (Array.isArray(res.data?.levels) && res.data.levels.length === 5) {
          setRubric(res.data.levels);
        }
      })
      .catch(() => {});
  }, [category, courseId, sessionId]);

  if (!rubric) return null;

  const titles = {
    technical_contributions: 'Technical Contributions Rubric',
    team_interactions: 'Team Interactions Rubric',
    project_management: 'Project Management Rubric',
  };

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/30 overflow-hidden mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          {titles[category] || 'Rubric'}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {rubric.map((r) => (
            <ScoreRow key={r.score} {...r} highlighted={currentScore === r.score} />
          ))}
        </div>
      )}
    </div>
  );
}
