import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginFromCas, loginWithData } = useAuth();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    window.location.href = '/auth/cas/login';
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      // httpOnly cookie already set by the server; just store user in state
      loginWithData(data.user);
      navigateByRole(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Welcome</h2>
        <p className="card-muted mb-24">
          Sign in to AI Peer Review System
        </p>

        {searchParams.get('registered') === 'true' && (
          <p className="text-success mb-12">Registration successful! Please sign in.</p>
        )}
        {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}

        {/* CAS login — always available */}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleCasLogin}
        >
          Sign in with University CAS
        </button>

        {/* Local dev login */}
        <div className="text-center text-secondary" style={{ margin: '16px 0' }}>— or sign in with email (dev) —</div>
        <form onSubmit={handleLocalLogin}>
          <div className="form-group">
            <label className="sr-only" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="sr-only" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch mt-12">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
