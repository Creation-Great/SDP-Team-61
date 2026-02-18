import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import InstructorRoute from './components/InstructorRoute';
import StudentRoute from './components/StudentRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import InstructorDashboardPage from './pages/InstructorDashboardPage';
import UploadAssignment from './pages/UploadAssignment';
import AssignedReviewsPage from './pages/AssignedReviewsPage';
import ReviewPage from './pages/ReviewPage';
import ViewReviewPage from './pages/ViewReviewPage';
import PeerReviewSessionsPage from './pages/PeerReviewSessionsPage';
import PeerReviewFormPage from './pages/PeerReviewFormPage';
import PeerReviewResultsPage from './pages/PeerReviewResultsPage';
import './App.css';

function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="page">
        <div className="page-content">{children}</div>
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Student routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><StudentDashboardPage /></AppLayout>
          </StudentRoute>
        </ProtectedRoute>
      } />
      <Route path="/upload" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><UploadAssignment /></AppLayout>
          </StudentRoute>
        </ProtectedRoute>
      } />
      <Route path="/reviews" element={
        <ProtectedRoute>
          <AppLayout><AssignedReviewsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/review/:id" element={
        <ProtectedRoute>
          <AppLayout><ReviewPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/view-review/:submissionId" element={
        <ProtectedRoute>
          <AppLayout><ViewReviewPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Peer Review routes (both roles) */}
      <Route path="/peer-review" element={
        <ProtectedRoute>
          <AppLayout><PeerReviewSessionsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/peer-review/:sessionId" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><PeerReviewFormPage /></AppLayout>
          </StudentRoute>
        </ProtectedRoute>
      } />
      <Route path="/peer-review/:sessionId/results" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><PeerReviewResultsPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Instructor routes */}
      <Route path="/instructor" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><InstructorDashboardPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
