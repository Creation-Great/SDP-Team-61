import { Routes, Route, Navigate } from 'react-router-dom';
import AppSidebar from './components/AppSidebar';
import { InfiniteGridBackground } from './components/ui/the-infinite-grid';
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
import WeeklyFeedback from './WeeklyFeedback';

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppSidebar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          minWidth: 0,
        }}
      >
        <InfiniteGridBackground />
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          <div style={{ padding: '36px 40px', maxWidth: '1200px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Student routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <StudentDashboardPage />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <UploadAssignment />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/checkins"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <StudentCheckinsPage />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />

      {/* Shared protected routes */}
      <Route
        path="/reviews"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AssignedReviewsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/review/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReviewPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/view-review/:submissionId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ViewReviewPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/weekly-feedback"
        element={
          <ProtectedRoute>
            <AppLayout>
              <WeeklyFeedback />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Instructor routes */}
      <Route
        path="/instructor"
        element={
          <ProtectedRoute>
            <InstructorRoute>
              <AppLayout>
                <InstructorDashboardPage />
              </AppLayout>
            </InstructorRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/peer-review"
        element={
          <ProtectedRoute>
            <InstructorRoute>
              <AppLayout>
                <InstructorPeerReviewPage />
              </AppLayout>
            </InstructorRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
