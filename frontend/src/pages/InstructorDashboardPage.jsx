import { useEffect, useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";

export default function InstructorDashboardPage() {
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    API.get("/assignments/all")
      .then((res) => setAssignments(res.data))
      .catch((err) => console.error("Error loading assignments:", err));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: "850px", margin: "40px auto", padding: "20px" }}
    >
      <h2>All Student Submissions</h2>

      {assignments.length === 0 && (
        <p style={{ opacity: 0.6 }}>No submissions yet.</p>
      )}

      {assignments.map((a, idx) => (
        <motion.div
          key={a._id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          style={{
            background: "#fff",
            padding: "18px",
            marginTop: "12px",
            borderRadius: "10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ margin: 0 }}>{a.title}</h3>

          <p style={{ margin: "4px 0", fontSize: "14px" }}>
            <strong>Student:</strong>{" "}
            {a.user?.name ? a.user.name : "Unknown"} (
            {a.user?.email || "no email"})
          </p>

          <p style={{ margin: "4px 0", fontSize: "14px" }}>
            <strong>Status:</strong> {a.status}
          </p>

          <p style={{ margin: 0, opacity: 0.6, fontSize: "13px" }}>
            Submitted: {new Date(a.createdAt).toLocaleString()}
          </p>

          <a
            href={`http://localhost:8000/uploads/${a.filename}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginTop: "10px",
              fontSize: "14px",
              color: "#1e90ff",
            }}
          >
            ⬇ Download File
          </a>
        </motion.div>
      ))}
    </motion.div>
  );
}
