import { Navigate } from 'react-router-dom';
import type { User } from '../types';

interface StudentRouteProps {
  children: React.ReactNode;
}

export default function StudentRoute({ children }: StudentRouteProps) {
  const token = localStorage.getItem('token');
  let user: Partial<User> = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}') as Partial<User>;
  } catch {
    // invalid JSON
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user.role === 'instructor' || user.role === 'admin') {
    return <Navigate to="/instructor" replace />;
  }
  return <>{children}</>;
}
