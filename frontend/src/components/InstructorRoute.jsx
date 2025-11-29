import { Navigate } from "react-router-dom";

export default function InstructorRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Not logged in → go to login
  if (!token || !user) return <Navigate to="/login" replace />;

  // Logged in but NOT instructor
  if (user.role !== "instructor") {
    return <Navigate to="/home" replace />;
  }

  return children;
}
