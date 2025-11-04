import { API_BASE_URL } from "./config.js";

export default function LoginPage() {
  const startCasLogin = () => {
    // Full redirect to backend /login (CAS will take over)
    window.location.href = `${API_BASE_URL}/login`;
  };

  return (
    <div className="page-grid">
      <section className="card">
        <header className="card-header">
          <h1 className="card-title">Welcome to PeerReview</h1>
        </header>
        <p>
          Log in with your UConn NetID to view your teams, submit project summaries, and complete peer reviews.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={startCasLogin}>
            Login with UConn CAS
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={startCasLogin}
          >
            I&apos;m Faculty
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={startCasLogin}
          >
            I&apos;m a Student
          </button>
        </div>
        <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
          You’ll be redirected to UConn&apos;s official login page.
        </p>
      </section>

      
    </div>
  );
}
