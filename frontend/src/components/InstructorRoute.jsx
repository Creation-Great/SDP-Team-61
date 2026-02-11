import { Navigate } from 'react-router-dom';

export default function InstructorRoute({ children }) {
  const token = localStorage.getItem('token');
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    // invalid JSON
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== 'instructor' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
