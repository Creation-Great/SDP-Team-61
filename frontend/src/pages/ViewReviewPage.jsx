// frontend/src/pages/ViewReviewPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function ViewReviewPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.getReviewsForAssignment(assignmentId);
        setAssignment(res.data.assignment);
        setReviews(res.data.reviews);
      } catch (err) {
        console.error("Error loading reviews:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignmentId]);

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;

  if (!assignment) {
    return (
      <div style={{ color: "white", textAlign: "center", marginTop: "40px" }}>
        <h2>Assignment not found</h2>
        <button onClick={() => navigate("/home")}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "30px auto", color: "white" }}>
      <h1>Review for: {assignment.title}</h1>

      <div style={{ margin: "20px 0" }}>
        <strong>Your submitted file:</strong>
        <br />
        <a
          href={assignment.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#4db8ff" }}
        >
          Download File
        </a>
      </div>

      <hr style={{ opacity: 0.2 }} />

      <h2>Reviewer Feedback</h2>

      {reviews.length === 0 ? (
        <p>No review has been completed yet. Check back later.</p>
      ) : (
        reviews.map((r) => (
          <div
            key={r._id}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              background: "rgba(255,255,255,0.08)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.2)",
            }}
          >
            <p>
              <strong>Reviewer:</strong> {r.reviewer?.name || "Unknown"}
            </p>

            <p>
              <strong>Score:</strong> {r.score ?? "No score"}
            </p>

            <p>
              <strong>Comments:</strong>
            </p>
            <p style={{ marginTop: "5px" }}>
              {r.comments || "No comments provided."}
            </p>

            <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "10px" }}>
              Reviewed on: {new Date(r.createdAt).toLocaleString()}
            </p>
          </div>
        ))
      )}

      <button
        onClick={() => navigate("/home")}
        style={{
          marginTop: "20px",
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          padding: "10px 20px",
          borderRadius: "10px",
          color: "white",
          fontWeight: 600,
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}
