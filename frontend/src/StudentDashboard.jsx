import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "./config.js";

export default function StudentDashboard({ onLogout }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // get current user
        const meRes = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: "include",
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (!meData.authenticated) {
            // not logged in
            setMe(null);
          } else {
            setMe(meData);
          }
        }

        // load docs for student (you'll implement this endpoint)
        const res = await fetch(`${API_BASE_URL}/api/documents`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setDocs(data);
        }
      } catch (err) {
        console.error("Failed to load student dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">Student Dashboard</h1>
      <p className="page-subtitle">
        View your submissions and track who&apos;s reviewing your work.
      </p>

      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
          {me?.netid && (
            <>
              Logged in as <strong>{me.netid}</strong>{" "}
              <span className="chip gray">{me.role || "student"}</span>
            </>
          )}
        </div>
        <button className="btn btn-secondary" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Your submissions</div>
          <div className="card-subtitle">
            Upload a new document and we’ll assign a reviewer automatically.
          </div>
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <Link to="/submit" className="btn">
            Submit new document
          </Link>
        </div>

        {loading ? (
          <p>Loading your documents…</p>
        ) : docs.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            You haven&apos;t submitted anything yet. Click &quot;Submit new document&quot; to get started.
          </p>
        ) : (
          <div className="table-card">
            <div className="table-header">
              <span>Title</span>
              <span>Status</span>
            </div>
            <ul className="doc-list">
              {docs.map((doc) => (
                <li key={doc.id} className="doc-row">
                  <div>
                    <div className="doc-title">{doc.title}</div>
                    <div className="doc-meta">
                      Submitted {new Date(doc.submissionDate).toLocaleString()} •{" "}
                      {doc.fileOriginalName}
                    </div>
                  </div>
                  <div>
                    {doc.reviewStatus === "assigned" ? (
                      <span className="chip yellow">
                        Assigned to {doc.reviewer || "Reviewer"}
                      </span>
                    ) : doc.reviewStatus === "completed" ? (
                      <span className="chip green">Reviewed</span>
                    ) : (
                      <span className="chip gray">Pending assignment</span>
                    )}
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
