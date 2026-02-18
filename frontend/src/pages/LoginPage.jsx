import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const id = params.get('id');
    const name = params.get('name');
    const email = params.get('email');
    const role = params.get('role');

    if (!token || !id || !role) return;

    localStorage.setItem('token', token);
    localStorage.setItem(
      'user',
      JSON.stringify({
        id,
        name: name || id,
        email: email || '',
        role,
      })
    );

    window.history.replaceState({}, '', `${window.location.origin}/login`);
    if (role === 'instructor' || role === 'admin') {
      navigate('/instructor', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>UConn Sign In</h2>
        <p className="card-muted" style={{ marginBottom: '24px' }}>
          Use NetID single sign-on to access AI Peer Review.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            window.location.href = '/auth/cas/login';
          }}
        >
          Sign in with UConn
        </button>
      </div>
    </div>
  );
}
