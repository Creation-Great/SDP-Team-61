import { Navigate } from 'react-router-dom';

export default function StudentRoute({ children }) {
  const token = localStorage.getItem('token');
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    // invalid JSON
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user.role === 'instructor' || user.role === 'admin') {
    return <Navigate to="/instructor" replace />;
  }
  return children;
}
