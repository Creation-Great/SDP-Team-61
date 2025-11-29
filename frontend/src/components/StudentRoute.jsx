import { Navigate } from "react-router-dom";

export default function StudentRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token || !user) return <Navigate to="/login" replace />;

  // Block instructor from student-only pages
  if (user.role !== "student") {
    return <Navigate to="/instructor" replace />;
  }

  return children;
}
