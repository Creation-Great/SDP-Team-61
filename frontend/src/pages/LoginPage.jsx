import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import API from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // Handle CAS callback — token comes back via query params
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      const user = {
        id: searchParams.get('id'),
        name: searchParams.get('name') || 'CAS User',
        email: searchParams.get('email') || '',
        role: searchParams.get('role') || 'student',
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (user.role === 'instructor' || user.role === 'admin') {
        navigate('/instructor');
      } else {
        navigate('/dashboard');
      }
    }
  }, [searchParams, navigate]);

  const handleCasLogin = () => {
    window.location.href = '/auth/cas/login';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      // Route based on role
      if (res.data.user.role === 'instructor' || res.data.user.role === 'admin') {
        navigate('/instructor');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p className="card-muted" style={{ marginBottom: '24px' }}>
          Sign in to AI Peer Review System
        </p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input
              className="form-input"
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="form-group password-container">
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="show-hide-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '16px 0', color: '#888' }}>or</div>

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={handleCasLogin}
          style={{ marginBottom: '16px' }}
        >
          Sign in with University CAS
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
