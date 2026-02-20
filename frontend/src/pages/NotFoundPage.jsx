import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFoundPage() {
  const { user, isInstructor } = useAuth();
  const home = !user ? '/login' : isInstructor ? '/instructor' : '/dashboard';

  return (
    <div className="empty-state" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-muted, #666)', margin: '0.5rem 0 1.5rem' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link to={home} className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Go Home
      </Link>
    </div>
  );
}
