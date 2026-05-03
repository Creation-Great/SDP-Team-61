import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wraps content that requires authentication. Redirects to /login if not logged in.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {React.ReactNode}
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page" style={{ textAlign: 'center', padding: '3rem' }}>Verifying session…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
