import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wraps content for instructor-only routes. Redirects to /login or /dashboard if not instructor.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {React.ReactNode}
 */
export default function InstructorRoute({ children }) {
  const { user, loading, isInstructor } = useAuth();

  if (loading) {
    return <div className="page" style={{ textAlign: 'center', padding: '3rem' }}>Verifying session…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isInstructor) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
