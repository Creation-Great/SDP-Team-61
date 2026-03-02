import { Routes, Route, Navigate } from 'react-router-dom';
import AppSidebar from './components/AppSidebar';
import { InfiniteGridBackground } from './components/ui/the-infinite-grid';
import ProtectedRoute from './components/ProtectedRoute';
import InstructorRoute from './components/InstructorRoute';
import StudentRoute from './components/StudentRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import InstructorCoursesPage from './pages/InstructorCoursesPage';
import InstructorCourseDetailPage from './pages/InstructorCourseDetailPage';
import InstructorWeekDetailPage from './pages/InstructorWeekDetailPage';
import StudentReviewsPage from './pages/StudentReviewsPage';
import StudentWeekPage from './pages/StudentWeekPage';
import StudentReviewFormPage from './pages/StudentReviewFormPage';
import type { UserRole } from './types';

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

/**
 * RootRedirect: routes users to the correct home page based on their role.
 */
function RootRedirect() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  let role: UserRole | null = null;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    role = user.role || null;
  } catch { }

  if (role === 'instructor' || role === 'admin') {
    return <Navigate to="/instructor/courses" replace />;
  }
  return <Navigate to="/student/reviews" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Instructor routes */}
      <Route
        path="/instructor/courses"
        element={
          <ProtectedRoute>
            <InstructorRoute>
              <AppLayout>
                <InstructorCoursesPage />
              </AppLayout>
            </InstructorRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/courses/:courseId"
        element={
          <ProtectedRoute>
            <InstructorRoute>
              <AppLayout>
                <InstructorCourseDetailPage />
              </AppLayout>
            </InstructorRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/courses/:courseId/weeks/:weekId"
        element={
          <ProtectedRoute>
            <InstructorRoute>
              <AppLayout>
                <InstructorWeekDetailPage />
              </AppLayout>
            </InstructorRoute>
          </ProtectedRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/student/reviews"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <StudentReviewsPage />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/weeks/:weekId"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <StudentWeekPage />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments/:assignmentId"
        element={
          <ProtectedRoute>
            <StudentRoute>
              <AppLayout>
                <StudentReviewFormPage />
              </AppLayout>
            </StudentRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
