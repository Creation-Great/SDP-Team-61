import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

export default function AssignedReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/assignments/reviews/my-tasks")
      .then((res) => setReviews(res.data))
      .catch((err) => {
        console.error("Failed to load assigned tasks:", err);
        setReviews([]);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingTop: "120px",
        paddingBottom: "50px",
        width: "100%",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: "900px", margin: "0 auto" }}
      >
        <h1
          style={{
            color: "white",
            fontSize: "42px",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Assigned Reviews
        </h1>

        {reviews.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              backdropFilter: "blur(20px)",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "18px",
              padding: "40px",
              margin: "40px auto",
              maxWidth: "600px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              color: "white",
            }}
          >
            <h3>No review tasks assigned yet</h3>
            <p style={{ opacity: 0.8, marginTop: "10px" }}>
              When assignments are uploaded, you will receive peer review tasks here.
            </p>
          </motion.div>
        ) : (
          reviews.map((r, idx) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              whileHover={{ scale: 1.02 }}
              style={{
                backdropFilter: "blur(14px)",
                background: "rgba(255,255,255,0.12)",
                borderRadius: "16px",
                padding: "22px",
                marginBottom: "20px",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}
            >
              <h2>{r.assignment?.title || "Untitled Assignment"}</h2>

              <p style={{ opacity: 0.85 }}>
                <strong>Student:</strong>{" "}
                {r.assignment?.user?.name || "Unknown"}
              </p>

              <p style={{ opacity: 0.6 }}>
                Assigned: {new Date(r.createdAt).toLocaleString()}
              </p>

              <button
                onClick={() => navigate(`/review/${r._id}`)}
                style={{
                  marginTop: "15px",
                  background: "rgba(255,255,255,0.25)",
                  padding: "12px 20px",
                  borderRadius: "10px",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Start Review
              </button>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}
