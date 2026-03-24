import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home } from 'lucide-react';
import Button from '../components/ui/Button';

/**
 * 404 fallback. Renders link to login (if unauthenticated) or instructor/dashboard (by role).
 * No API calls. Used by router for unknown paths.
 * @returns {JSX.Element}
 */
export default function NotFoundPage() {
  const { user, isInstructor } = useAuth();
  const home = !user ? '/login' : isInstructor ? '/instructor' : '/dashboard';

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-7xl font-bold text-[#000E2F]">404</h1>
      <p className="text-lg text-slate-500 mt-2 mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link to={home}>
        <Button>
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </Link>
    </div>
  );
}
