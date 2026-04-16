import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import InstructorRoute from './components/InstructorRoute';
import StudentRoute from './components/StudentRoute';
import { useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import InfiniteGridBackground from './components/ui/InfiniteGridBackground';
import HeaderSearchBar from './components/HeaderSearchBar';
import NotificationBell from './components/NotificationBell';
import { Loader2 } from 'lucide-react';

// ── Route-level code splitting ─────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage'));
const InstructorDashboardPage = lazy(() => import('./pages/InstructorDashboardPage'));
const UploadAssignment = lazy(() => import('./pages/UploadAssignment'));
const AssignedReviewsPage = lazy(() => import('./pages/AssignedReviewsPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const ViewReviewPage = lazy(() => import('./pages/ViewReviewPage'));
const PeerReviewSessionsPage = lazy(() => import('./pages/PeerReviewSessionsPage'));
const PeerReviewFormPage = lazy(() => import('./pages/PeerReviewFormPage'));
const PeerReviewResultsPage = lazy(() => import('./pages/PeerReviewResultsPage'));
const StudentCheckinsPage = lazy(() => import('./pages/StudentCheckinsPage'));
const InstructorPeerReviewPage = lazy(() => import('./pages/InstructorPeerReviewPage'));
const InstructorAnalyticsPage = lazy(() => import('./pages/InstructorAnalyticsPage'));
const ClassCheckinsPage = lazy(() => import('./pages/ClassCheckinsPage'));
const EnrollmentManagementPage = lazy(() => import('./pages/EnrollmentManagementPage'));
const StudentScoresPage = lazy(() => import('./pages/StudentScoresPage'));
const StudentGradesPage = lazy(() => import('./pages/StudentGradesPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'));
const ExportCenterPage = lazy(() => import('./pages/ExportCenterPage'));
const AssignmentTemplatesPage = lazy(() => import('./pages/AssignmentTemplatesPage'));
const RevisionHistoryPage = lazy(() => import('./pages/RevisionHistoryPage'));
const SimilarityDashboardPage = lazy(() => import('./pages/SimilarityDashboardPage'));
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
const GradeManagementPage = lazy(() => import('./pages/GradeManagementPage'));
const LmsConfigPage = lazy(() => import('./pages/LmsConfigPage'));
const SemesterManagementPage = lazy(() => import('./pages/SemesterManagementPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const AdvancedAnalyticsPage = lazy(() => import('./pages/AdvancedAnalyticsPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const UserPreferencesPage = lazy(() => import('./pages/UserPreferencesPage'));
const DataExportPage = lazy(() => import('./pages/DataExportPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** Loading fallback for lazy-loaded pages */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#000E2F]" />
    </div>
  );
}

/** Redirect root "/" based on auth state */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (user.role === 'instructor' || user.role === 'admin')
    ? <Navigate to="/instructor" replace />
    : <Navigate to="/dashboard" replace />;
}

/** Offline detection banner */
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);
  if (!offline) return null;
  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium z-50 relative" role="alert">
      You are offline. Some features may be unavailable.
    </div>
  );
}

/** Sidebar + header layout for authenticated pages */
function AppLayout({ children }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
        style={{ backgroundImage: "url('/images/background3.jpg')", backgroundSize: '100% 100%', backgroundColor: '#FFFFFF' }}
      >
        {/* Skip-to-content link for keyboard navigation (WCAG 2.1) */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[#000E2F] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">
          Skip to main content
        </a>
        {/* Offline detection */}
        <OfflineBanner />
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
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 md:mt-0 mt-14 relative z-[1] outline-none">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
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
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>} />

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
      {/* Legacy notification link redirect */}
      <Route path="/assigned-reviews" element={<Navigate to="/reviews" replace />} />
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
      <Route path="/my-grades" element={
        <ProtectedRoute>
          <StudentRoute>
            <AppLayout><StudentGradesPage /></AppLayout>
          </StudentRoute>
        </ProtectedRoute>
      } />
      <Route path="/settings/notifications" element={
        <ProtectedRoute>
          <AppLayout><NotificationPreferencesPage /></AppLayout>
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
      <Route path="/instructor/exports" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><ExportCenterPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />
      <Route path="/instructor/assignment-templates" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><AssignmentTemplatesPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Revision history */}
      <Route path="/submissions/:id/revisions" element={
        <ProtectedRoute>
          <AppLayout><RevisionHistoryPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Similarity dashboard (instructor) */}
      <Route path="/instructor/similarity" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><SimilarityDashboardPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* AI assistant */}
      <Route path="/ai-assistant" element={
        <ProtectedRoute>
          <AppLayout><AiChatPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Grade management (instructor) */}
      <Route path="/instructor/grades" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><GradeManagementPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* LMS config (instructor) */}
      <Route path="/instructor/lms" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><LmsConfigPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Semester management (instructor) */}
      <Route path="/instructor/semesters" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><SemesterManagementPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Calendar */}
      <Route path="/calendar" element={
        <ProtectedRoute>
          <AppLayout><CalendarPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Advanced analytics (instructor) */}
      <Route path="/instructor/advanced-analytics" element={
        <ProtectedRoute>
          <InstructorRoute>
            <AppLayout><AdvancedAnalyticsPage /></AppLayout>
          </InstructorRoute>
        </ProtectedRoute>
      } />

      {/* Audit log (admin) */}
      <Route path="/admin/audit" element={
        <ProtectedRoute>
          <AppLayout><AuditLogPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* User preferences */}
      <Route path="/settings/preferences" element={
        <ProtectedRoute>
          <AppLayout><UserPreferencesPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Data export */}
      <Route path="/settings/data-export" element={
        <ProtectedRoute>
          <AppLayout><DataExportPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* 404 — show sidebar only for authenticated users */}
      <Route path="*" element={<NotFoundWrapper />} />
    </Routes>
  );
}
