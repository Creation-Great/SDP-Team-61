import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined' || token === 'null') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
