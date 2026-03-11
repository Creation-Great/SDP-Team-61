import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import InstructorRoute from './components/InstructorRoute';
import StudentRoute from './components/StudentRoute';
import { useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import InfiniteGridBackground from './components/ui/InfiniteGridBackground';
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
import InstructorAnalyticsPage from './pages/InstructorAnalyticsPage';
import ClassCheckinsPage from './pages/ClassCheckinsPage';
import EnrollmentManagementPage from './pages/EnrollmentManagementPage';
import RegisterPage from './pages/RegisterPage';
import StudentScoresPage from './pages/StudentScoresPage';
import NotFoundPage from './pages/NotFoundPage';

import HeaderSearchBar from './components/HeaderSearchBar';
import NotificationBell from './components/NotificationBell';

/** Redirect root "/" based on auth state */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (user.role === 'instructor' || user.role === 'admin')
    ? <Navigate to="/instructor" replace />
    : <Navigate to="/dashboard" replace />;
}

/** Sidebar + header layout for authenticated pages */
function AppLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
        style={{ backgroundImage: "url('/images/background3.jpg')", backgroundSize: '100% 100%', backgroundColor: '#FFFFFF' }}
      >
        {/* Subtle grid overlay on top of background image */}
        <InfiniteGridBackground />
        {/* Desktop top header */}
        <header className="hidden md:flex h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
          <div className="flex flex-1">
            <HeaderSearchBar />
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 md:mt-0 mt-14 relative z-[1]">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/** 404 wrapper: show sidebar for authenticated users, plain page for guests */
function NotFoundWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <NotFoundPage />;
  return <AppLayout><NotFoundPage /></AppLayout>;
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
      <Route path="/peer-review/:sessionId/my-scores" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><StudentScoresPage /></AppLayout>
          </StudentRoute>
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
      <Route path="/instructor/analytics" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><InstructorAnalyticsPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />
      <Route path="/instructor/class-checkins" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><ClassCheckinsPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />
      <Route path="/instructor/enrollments" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><EnrollmentManagementPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* 404 — show sidebar only for authenticated users */}
      <Route path="*" element={<NotFoundWrapper />} />
    </Routes>
  );
}
