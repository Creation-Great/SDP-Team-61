import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [review, setReview] = useState(null);
  const [score, setScore] = useState(3);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState("");

  // ===========================
  // LOAD THE REVIEW + FILE
  // ===========================
  useEffect(() => {
    API.get(`/reviews/${id}`)   // ❌ removed headers
      .then((res) => setReview(res.data))
      .catch((err) => {
        console.error("Failed to load review", err);
        setError("Failed to load review");
      });
  }, [id]);

  // ===========================
  // SUBMIT REVIEW
  // ===========================
  const submitReview = async () => {
    console.log("TOKEN AT SUBMIT =", localStorage.getItem("token"));

    try {
      const response = await API.post(`/reviews/${id}/submit`, {
        score,
        reviewText,
      }); // ❌ removed headers

      console.log("SUBMIT RESPONSE =", response.data);

      navigate("/reviews");  // redirect to Assigned Reviews
    } catch (err) {
      console.log("BACKEND ERROR RESPONSE =", err.response?.data);
      console.log("STATUS =", err.response?.status);

      setError("Failed to submit review.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingTop: "120px",
        paddingBottom: "50px",
        display: "flex",
        gap: "30px",
        width: "100%",
        paddingLeft: "40px",
        paddingRight: "40px",
      }}
    >
      {/* PDF */}
      <div
        style={{
          flex: 2,
          backdropFilter: "blur(14px)",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "18px",
          padding: "20px",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          minHeight: "80vh",
        }}
      >
        {review?.assignment?.filename ? (
          <iframe
            src={`http://localhost:8000/uploads/${review.assignment.filename}`}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "12px",
              border: "none",
            }}
          />
        ) : (
          <p style={{ color: "white", textAlign: "center", marginTop: "20px" }}>
            Loading PDF…
          </p>
        )}
      </div>

      {/* FORM */}
      <div
        style={{
          flex: 1,
          backdropFilter: "blur(18px)",
          background: "rgba(255,255,255,0.12)",
          borderRadius: "18px",
          padding: "35px",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          color: "white",
          maxHeight: "80vh",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: "30px",
            fontSize: "32px",
            fontWeight: "700",
          }}
        >
          Review Submission
        </h1>

        {/* Score Input */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ marginRight: "10px", fontSize: "18px" }}>
            Score (1–5)
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "10px",
              padding: "8px 14px",
              color: "white",
              width: "80px",
              fontSize: "16px",
            }}
          />
        </div>

        {/* Review Comments */}
        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontSize: "18px" }}>Review Comments</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write constructive feedback..."
            style={{
              marginTop: "8px",
              width: "100%",
              height: "200px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "12px",
              padding: "15px",
              color: "white",
              fontSize: "16px",
              resize: "none",
            }}
          />
        </div>

        <button
          onClick={submitReview}
          style={{
            marginTop: "20px",
            width: "100%",
            background: "rgba(255,255,255,0.25)",
            padding: "12px",
            borderRadius: "10px",
            color: "white",
            border: "1px solid rgba(255,255,255,0.35)",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "18px",
          }}
        >
          Submit Review
        </button>

        {error && (
          <p style={{ marginTop: "20px", color: "#ffb3b3", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
