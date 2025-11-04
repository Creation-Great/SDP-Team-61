import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config.js";

export default function SubmitDocumentPage({ onLogout }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title || !file) {
      setError("Please provide a title and a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/submit-document`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to submit document");
      }

      // backend currently redirects; we just go back to student dashboard
      navigate("/student");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Submit Document</h1>
      <p className="page-subtitle">
        Upload your project PDF and we’ll assign a reviewer automatically.
      </p>

      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="title">
              Document title
            </label>
            <input
              id="title"
              className="form-input"
              type="text"
              placeholder="e.g., Milestone 2 System Design"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="file">
              PDF file
            </label>
            <input
              id="file"
              className="form-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              Only PDF is supported in this prototype.
            </span>
          </div>

          {error && (
            <div style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit document"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate("/student")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
