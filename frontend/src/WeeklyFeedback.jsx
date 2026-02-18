import { useMemo, useState } from "react";

const LIKERT_OPTIONS = [
  { value: "extremely_disagree", label: "Extremely disagree" },
  { value: "somewhat_disagree", label: "Somewhat disagree" },
  { value: "neutral", label: "Neutral" },
  { value: "somewhat_agree", label: "Somewhat agree" },
  { value: "extremely_agree", label: "Extremely agree" },
];

export default function WeeklyFeedback({ onLogout }) {
  const weeks = useMemo(
    () => [
      { label: "Week 5", value: "week5", due: "Feb 21", status: "Open" },
      { label: "Week 6", value: "week6", due: "Feb 28", status: "Opens soon" },
      { label: "Retro", value: "retro", due: "Mar 7", status: "Drafting" },
    ],
    []
  );

  const peerStatements = useMemo(
    () => [
      "The team member regularly attends and arrives on time for group meetings.",
      "The team member meaningfully contributes to group discussions.",
      "The team member completes group assignments on time.",
      "The team member demonstrates a cooperative and supportive attitude.",
      "The team member submits work of high quality.",
    ],
    []
  );

  const [form, setForm] = useState(() => ({
    week: "week5",
    morale: "steady",
    blockers: "",
    wins: "",
    helpNeeded: "",
    peerRatings: peerStatements.reduce((acc, statement) => {
      acc[statement] = "neutral";
      return acc;
    }, {}),
  }));

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLikertChange = (statement, value) => {
    setForm((prev) => ({
      ...prev,
      peerRatings: {
        ...prev.peerRatings,
        [statement]: value,
      },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted({
        timestamp: new Date().toISOString(),
        ...form,
      });
    }, 600);
  };

  return (
    <div>
      <h1 className="page-title">Weekly Feedback</h1>
      <p className="page-subtitle">
        Share blockers, team health, and quick wins. Think of this as a mini
        survey sent to instructors each week.
      </p>

      <div
        style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}
      >
        <button className="btn btn-secondary" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <div className="card-title">Upcoming check-ins</div>
          <div className="card-subtitle">
            Pick the week you’re submitting feedback for.
          </div>
        </div>
        <div className="table-card">
          <div className="table-header">
            <span>Week</span>
            <span>Due / Status</span>
          </div>
          <ul className="doc-list">
            {weeks.map((week) => (
              <li key={week.label} className="doc-row">
                <div>
                  <div className="doc-title">{week.label}</div>
                  <div className="doc-meta">Due {week.due}</div>
                </div>
                <div>
                  <span className="chip gray">{week.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Submit feedback</div>
          <div className="card-subtitle">
            Fill out this Google-Form-esque survey directly in the app. Responses
            are saved locally in this prototype.
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Peer pulse check</label>
            <div className="likert-table">
              <div className="likert-header">
                <div></div>
                {LIKERT_OPTIONS.map((option) => (
                  <div key={option.value}>{option.label}</div>
                ))}
              </div>
              {peerStatements.map((statement, idx) => (
                <div className="likert-row" key={statement}>
                  <div className="statement">{statement}</div>
                  {LIKERT_OPTIONS.map((option) => (
                    <label className="likert-cell" key={option.value}>
                      <input
                        type="radio"
                        name={`likert-${idx}`}
                        value={option.value}
                        checked={form.peerRatings[statement] === option.value}
                        onChange={() => handleLikertChange(statement, option.value)}
                      />
                      <span className="dot" />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="week">
              Which week is this for?
            </label>
            <select
              id="week"
              name="week"
              className="form-input"
              value={form.week}
              onChange={handleChange}
            >
              {weeks.map((week) => (
                <option key={week.value} value={week.value}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="morale">
              Team morale
            </label>
            <select
              id="morale"
              name="morale"
              className="form-input"
              value={form.morale}
              onChange={handleChange}
            >
              <option value="crushing-it">Crushing it 💪</option>
              <option value="steady">Steady 👍</option>
              <option value="wobbly">A little wobbly 😅</option>
              <option value="blocked">Blocked 🚧</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="wins">
              Biggest wins
            </label>
            <textarea
              id="wins"
              name="wins"
              className="form-input"
              rows={3}
              placeholder="Feature shipped, teammate helped, etc."
              value={form.wins}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="blockers">
              Current blockers
            </label>
            <textarea
              id="blockers"
              name="blockers"
              className="form-input"
              rows={3}
              placeholder="Any risks, dependencies, or teammate needs?"
              value={form.blockers}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="helpNeeded">
              What support would help?
            </label>
            <textarea
              id="helpNeeded"
              name="helpNeeded"
              className="form-input"
              rows={3}
              placeholder="Office hours, technical review, conflict mediation..."
              value={form.helpNeeded}
              onChange={handleChange}
            />
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </form>

        {submitted && (
          <div className="card" style={{ marginTop: "1rem", background: "#f0fdf4" }}>
            <div className="card-header">
              <div className="card-title">Thanks! (Mock submission)</div>
              <div className="card-subtitle">
                We captured your answers locally so you can review before sharing
                with faculty.
              </div>
            </div>
            <pre
              style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0 }}
            >
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
