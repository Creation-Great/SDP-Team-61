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
import InstructorPeerReviewPage from './pages/InstructorPeerReviewPage';
import StudentCheckinsPage from './pages/StudentCheckinsPage';
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
      <Route path="/student/checkins" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><StudentCheckinsPage /></AppLayout>
          </StudentRoute>
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

      {/* Instructor routes */}
      <Route path="/instructor" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><InstructorDashboardPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />
      <Route path="/instructor/peer-review" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><InstructorPeerReviewPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
