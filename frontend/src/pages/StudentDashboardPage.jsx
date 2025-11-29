import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import API from "../services/api";

export default function StudentDashboardPage() {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    API.get("/assignments/mine")
      .then((res) => setSubmissions(res.data))
      .catch(() => setSubmissions([]));
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
            marginBottom: "30px",
          }}
        >
          Your Submissions
        </h1>

        {submissions.length === 0 ? (
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
            <h3>No submissions yet</h3>
            <p style={{ opacity: 0.8, marginTop: "10px" }}>
              Upload your first assignment to get started.
            </p>

            <a
              href="/upload"
              style={{
                marginTop: "20px",
                display: "inline-block",
                background: "rgba(255,255,255,0.2)",
                padding: "12px 24px",
                borderRadius: "10px",
                color: "white",
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.3)",
                fontWeight: "600",
              }}
            >
              Upload Assignment
            </a>
          </motion.div>
        ) : (
          submissions.map((s, idx) => (
            <motion.div
              key={idx}
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
              <h2>{s.title}</h2>
              <p style={{ opacity: 0.85 }}>
                <strong>Status:</strong> {s.status}
              </p>
              <p style={{ opacity: 0.6 }}>
                Submitted: {new Date(s.createdAt).toLocaleString()}
              </p>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}
