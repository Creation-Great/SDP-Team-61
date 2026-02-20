import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginFromCas, loginWithData } = useAuth();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [casLoading, setCasLoading] = useState(false);

  /** Redirect based on role after successful authentication */
  const navigateByRole = (u) => {
    const dest = (u.role === 'instructor' || u.role === 'admin') ? '/instructor' : '/dashboard';
    navigate(dest);
  };

  // Handle CAS callback — cookie already set by server, just fetch profile
  useEffect(() => {
    if (searchParams.get('cas') === 'success') {
      loginFromCas()
        .then((user) => {
          if (!user) {
            setError('Failed to verify CAS session. Please try again.');
            return;
          }
          navigateByRole(user);
        });
      return;
    }

    if (searchParams.get('registered') === 'true') {
      setError('');
    }

    const err = searchParams.get('error');
    if (err) setError(err);
  }, [searchParams, navigate, loginFromCas]);

  const handleCasLogin = () => {
    setCasLoading(true);
    window.location.href = '/auth/cas/login';
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      loginWithData(data.user);
      navigateByRole(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200 blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100 blur-3xl opacity-50" />

      <Card className="w-full max-w-md p-8 shadow-2xl border-0 relative z-10 backdrop-blur-sm bg-white/90">
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-teal-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PeerReview System</h1>
          <p className="text-slate-500 mt-2 text-sm">University Single Sign-On (CAS)</p>
        </div>

        {searchParams.get('registered') === 'true' && (
          <p className="text-emerald-600 text-sm text-center mb-4 font-medium">
            Registration successful! Please sign in.
          </p>
        )}
        {error && (
          <p className="text-red-600 text-sm text-center mb-4 font-medium" role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <div className="space-y-6">
          {/* CAS login */}
          <Button
            size="lg"
            className="w-full py-3"
            onClick={handleCasLogin}
            loading={casLoading}
          >
            Login via CAS (SSO)
          </Button>

          {/* Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200" />
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase tracking-wider font-semibold">
              Developer Mode
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Local dev login form */}
          <form onSubmit={handleLocalLogin} className="space-y-4">
            <div>
              <label className="sr-only" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 focus:bg-white text-sm"
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 focus:bg-white text-sm"
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium hover:text-indigo-700">
              Create one
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
