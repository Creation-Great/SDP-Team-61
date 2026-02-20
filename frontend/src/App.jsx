import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import InstructorRoute from './components/InstructorRoute';
import StudentRoute from './components/StudentRoute';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import InstructorDashboardPage from './pages/InstructorDashboardPage';
import UploadAssignment from './pages/UploadAssignment';
import AssignedReviewsPage from './pages/AssignedReviewsPage';
import ReviewPage from './pages/ReviewPage';
import ViewReviewPage from './pages/ViewReviewPage';
import PeerReviewSessionsPage from './pages/PeerReviewSessionsPage';
import PeerReviewFormPage from './pages/PeerReviewFormPage';
import PeerReviewResultsPage from './pages/PeerReviewResultsPage';
import StudentCheckinsPage from './pages/StudentCheckinsPage';
import InstructorPeerReviewPage from './pages/InstructorPeerReviewPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

/** Redirect root "/" based on auth state */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (user.role === 'instructor' || user.role === 'admin')
    ? <Navigate to="/instructor" replace />
    : <Navigate to="/dashboard" replace />;
}

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
      {/* Root redirect */}
      <Route path="/" element={<HomeRedirect />} />

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

      {/* Student check-ins */}
      <Route path="/student/checkins" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><StudentCheckinsPage /></AppLayout>
          </StudentRoute>
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

      {/* 404 */}
      <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
    </Routes>
  );
}
