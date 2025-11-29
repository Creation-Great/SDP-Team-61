import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import SubmitReviewPage from "./pages/SubmitReviewPage";
import InstructorDashboardPage from "./pages/InstructorDashboardPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import UploadAssignment from "./pages/UploadAssignment";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Student Dashboard */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Navbar />
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Submit Review */}
        <Route
          path="/submit-review"
          element={
            <ProtectedRoute>
              <Navbar />
              <SubmitReviewPage />
            </ProtectedRoute>
          }
        />

        {/* Upload Assignment */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Navbar />
              <UploadAssignment />
            </ProtectedRoute>
          }
        />

        {/* Instructor Dashboard */}
        <Route
          path="/instructor"
          element={
            <ProtectedRoute>
              <Navbar />
              <InstructorDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Default route: ALWAYS send the user to login first */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
