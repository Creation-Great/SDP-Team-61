import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
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
import InstructorAnalyticsPage from './pages/InstructorAnalyticsPage';
import ClassCheckinsPage from './pages/ClassCheckinsPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

import { Search, Bell } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Desktop top header */}
        <header className="hidden md:flex h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
          <div className="flex flex-1">
            <div className="relative w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses, students..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 md:mt-0 mt-14">
          {children}
        </main>
      </div>
    </div>
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

      {/* 404 */}
      <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
    </Routes>
  );
}
