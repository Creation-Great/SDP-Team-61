// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Components
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import UploadAssignment from "./pages/UploadAssignment";
import AssignedReviewsPage from "./pages/AssignedReviewsPage";
import ReviewPage from "./pages/ReviewPage";
import InstructorDashboardPage from "./pages/InstructorDashboardPage";
import ViewReviewPage from "./pages/ViewReviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* STUDENT DASHBOARD */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Navbar />
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* UPLOAD */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Navbar />
              <UploadAssignment />
            </ProtectedRoute>
          }
        />

        {/* ASSIGNED REVIEWS */}
        <Route
          path="/reviews"
          element={
            <ProtectedRoute>
              <Navbar />
              <AssignedReviewsPage />
            </ProtectedRoute>
          }
        />

        {/* REVIEW FORM */}
        <Route
          path="/review/:id"
          element={
            <ProtectedRoute>
              <Navbar />
              <ReviewPage />
            </ProtectedRoute>
          }
        />

        {/* ⭐ VIEW STUDENT REVIEW PAGE */}
        <Route
          path="/view-review/:assignmentId"
          element={
            <ProtectedRoute>
              <Navbar />
              <ViewReviewPage />
            </ProtectedRoute>
          }
        />

        {/* INSTRUCTOR DASHBOARD */}
        <Route
          path="/instructor"
          element={
            <ProtectedRoute>
              <Navbar />
              <InstructorDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT REDIRECT */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
