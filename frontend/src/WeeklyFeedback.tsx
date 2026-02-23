import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { LikertValue, WeeklyFeedbackForm } from './types';
import { TextReveal } from './components/ui/text-reveal-animation';

const LIKERT_OPTIONS: { value: LikertValue; label: string; short: string }[] = [
  { value: 'extremely_disagree', label: 'Extremely disagree', short: 'E. Disagree' },
  { value: 'somewhat_disagree',  label: 'Somewhat disagree',  short: 'S. Disagree' },
  { value: 'neutral',            label: 'Neutral',            short: 'Neutral' },
  { value: 'somewhat_agree',     label: 'Somewhat agree',     short: 'S. Agree' },
  { value: 'extremely_agree',    label: 'Extremely agree',    short: 'E. Agree' },
];

const LIKERT_COLORS: Record<string, string> = {
  extremely_disagree: '#E05C5C',
  somewhat_disagree:  '#E87722',
  neutral:            '#4B9FE1',
  somewhat_agree:     '#3DBB79',
  extremely_agree:    '#2FA467',
};

interface WeeklyFeedbackProps {
  onLogout?: () => void;
}

export default function WeeklyFeedback({ onLogout }: WeeklyFeedbackProps) {
  const weeks = useMemo(() => [
    { label: 'Week 5', value: 'week5', due: 'Feb 21', status: 'Open' },
    { label: 'Week 6', value: 'week6', due: 'Feb 28', status: 'Opens soon' },
    { label: 'Retro',  value: 'retro', due: 'Mar 7',  status: 'Drafting' },
  ], []);

  const peerStatements = useMemo(() => [
    'The team member regularly attends and arrives on time for group meetings.',
    'The team member meaningfully contributes to group discussions.',
    'The team member completes group assignments on time.',
    'The team member demonstrates a cooperative and supportive attitude.',
    'The team member submits work of high quality.',
  ], []);

  const [form, setForm] = useState<WeeklyFeedbackForm>(() => ({
    week: 'week5',
    morale: 'steady',
    blockers: '',
    wins: '',
    helpNeeded: '',
    peerRatings: peerStatements.reduce<Record<string, LikertValue>>((acc, s) => {
      acc[s] = 'neutral';
      return acc;
    }, {}),
  }));

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<(WeeklyFeedbackForm & { timestamp: string }) | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLikertChange = (statement: string, value: LikertValue) => {
    setForm(prev => ({ ...prev, peerRatings: { ...prev.peerRatings, [statement]: value } }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted({ timestamp: new Date().toISOString(), ...form });
    }, 600);
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Weekly Feedback" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Share blockers, team health, and quick wins for instructors.
        </p>
      </div>

      {onLogout && (
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" type="button" onClick={onLogout}>Logout</button>
        </div>
      )}

      {/* Upcoming weeks */}
      <motion.div
        className="card"
        style={{ marginBottom: '20px' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h3 className="card-title">Upcoming Check-ins</h3>
        <p className="card-meta" style={{ marginBottom: '16px' }}>Pick the week you're submitting feedback for.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {weeks.map(week => (
            <div key={week.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderRadius: '8px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--glass-border)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{week.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace' }}>Due {week.due}</div>
              </div>
              <span className="chip chip-submitted" style={{ fontSize: '0.72rem' }}>{week.status}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feedback form */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h3 className="card-title">Submit Feedback</h3>
        <p className="card-meta" style={{ marginBottom: '20px' }}>
          Fill out this weekly survey. Responses are saved locally in this prototype.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Peer pulse — Likert scale */}
          <div className="form-group">
            <label className="form-label">Peer Pulse Check</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              {peerStatements.map((statement, idx) => (
                <div key={statement} style={{
                  padding: '14px 16px',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                    {idx + 1}. {statement}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {LIKERT_OPTIONS.map(option => {
                      const isSelected = form.peerRatings[statement] === option.value;
                      const color = LIKERT_COLORS[option.value];
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleLikertChange(statement, option.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: `1.5px solid ${isSelected ? color : 'var(--glass-border)'}`,
                            background: isSelected ? `${color}20` : 'transparent',
                            color: isSelected ? color : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: isSelected ? 700 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {option.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Week selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="week">Which week is this for?</label>
            <select id="week" name="week" className="form-select" value={form.week} onChange={handleChange}>
              {weeks.map(week => (
                <option key={week.value} value={week.value}>{week.label}</option>
              ))}
            </select>
          </div>

          {/* Team morale */}
          <div className="form-group">
            <label className="form-label" htmlFor="morale">Team morale</label>
            <select id="morale" name="morale" className="form-select" value={form.morale} onChange={handleChange}>
              <option value="crushing-it">Crushing it 💪</option>
              <option value="steady">Steady 👍</option>
              <option value="wobbly">A little wobbly 😅</option>
              <option value="blocked">Blocked 🚧</option>
            </select>
          </div>

          {/* Wins */}
          <div className="form-group">
            <label className="form-label" htmlFor="wins">Biggest wins</label>
            <textarea
              id="wins" name="wins" className="form-textarea" rows={3}
              placeholder="Feature shipped, teammate helped, etc."
              value={form.wins} onChange={handleChange}
            />
          </div>

          {/* Blockers */}
          <div className="form-group">
            <label className="form-label" htmlFor="blockers">Current blockers</label>
            <textarea
              id="blockers" name="blockers" className="form-textarea" rows={3}
              placeholder="Any risks, dependencies, or teammate needs?"
              value={form.blockers} onChange={handleChange}
            />
          </div>

          {/* Help needed */}
          <div className="form-group">
            <label className="form-label" htmlFor="helpNeeded">What support would help?</label>
            <textarea
              id="helpNeeded" name="helpNeeded" className="form-textarea" rows={3}
              placeholder="Office hours, technical review, conflict mediation..."
              value={form.helpNeeded} onChange={handleChange}
            />
          </div>

          <button className="btn btn-cta btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </form>

        {submitted && (
          <motion.div
            className="card"
            style={{ marginTop: '20px', background: 'rgba(61,187,121,0.06)', borderColor: 'rgba(61,187,121,0.20)' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', flexShrink: 0,
              }}>✓</div>
              <div>
                <h4 style={{ color: 'var(--success)', fontFamily: 'Montserrat, sans-serif', margin: 0 }}>Feedback submitted</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Captured locally for review before sharing with faculty.
                </p>
              </div>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'Roboto Mono, monospace' }}>
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
