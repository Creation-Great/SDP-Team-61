import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
