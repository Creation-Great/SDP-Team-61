import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

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

    const err = searchParams.get('error');
    if (err) setError(err);
  }, [searchParams, navigate]);

  const handleCasLogin = () => {
    window.location.href = '/auth/cas/login';
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Welcome</h2>
        <p className="card-muted" style={{ marginBottom: '24px' }}>
          Sign in to AI Peer Review System
        </p>
        {error && <p className="error-text">{error}</p>}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleCasLogin}
        >
          Sign in with University CAS
        </button>
      </div>
    </div>
  );
}
