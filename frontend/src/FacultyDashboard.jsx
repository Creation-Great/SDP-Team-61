import { useEffect, useState } from "react";
import { API_BASE_URL } from "./config.js";

export default function FacultyDashboard({ onLogout }) {
  const [me, setMe] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: "include",
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setMe(meData);
        }

        const res = await fetch(`${API_BASE_URL}/api/faculty/assigned`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setAssigned(data);
        }
      } catch (err) {
        console.error("Failed to load faculty dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">Faculty Dashboard</h1>
      <p className="page-subtitle">
        See student submissions assigned to you and monitor review progress.
      </p>

      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
          {me?.netid && (
            <>
              Logged in as <strong>{me.netid}</strong>{" "}
              <span className="chip gray">{me.role || "faculty"}</span>
            </>
          )}
        </div>
        <button className="btn btn-secondary" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Assigned submissions</div>
          <div className="card-subtitle">
            Submissions that require your review will appear here.
          </div>
        </div>

        {loading ? (
          <p>Loading assigned submissions…</p>
        ) : assigned.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            Nothing assigned yet. Once the assignment logic is wired for faculty, you&apos;ll see 
            team documents here.
          </p>
        ) : (
          <div className="table-card">
            <div className="table-header">
              <span>Submission</span>
              <span>Team / Status</span>
            </div>
            <ul className="doc-list">
              {assigned.map((item) => (
                <li key={item.id} className="doc-row">
                  <div>
                    <div className="doc-title">{item.title}</div>
                    <div className="doc-meta">
                      Submitted {new Date(item.submissionDate).toLocaleString()} by{" "}
                      {item.owner}
                    </div>
                  </div>
                  <div>
                    <span className="chip yellow">Awaiting review</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
