import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  const { user, isInstructor } = useAuth();
  const home = !user ? '/login' : isInstructor ? '/instructor' : '/dashboard';

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-7xl font-bold text-indigo-600">404</h1>
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
