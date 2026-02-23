import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { AxiosError } from 'axios';
import API from '../services/api';
import type { UserRole } from '../types';
import { InfiniteGridBackground } from '../components/ui/the-infinite-grid';
import { TextReveal } from '../components/ui/text-reveal-animation';

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <path d="M18 2.5 L31 9.75 L31 26.25 L18 33.5 L5 26.25 L5 9.75 Z"
        stroke="rgba(75,159,225,0.50)" strokeWidth="1.4" fill="rgba(75,159,225,0.08)" />
      <path d="M10.5 13v10M10.5 13h4.2a3 3 0 0 1 0 6h-4.2"
        stroke="rgba(226,237,255,0.90)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 13v10M19.5 13h4a2.8 2.8 0 0 1 0 5.6H19.5M22.5 18.6 L26 23"
        stroke="rgba(75,159,225,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await API.post('/auth/register', { name, email, password, role });
      navigate('/login?registered=true');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-full">
      <InfiniteGridBackground />

      <motion.div
        className="auth-full-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <div className="auth-full-logo">
          <LogoMark size={30} />
          <span className="auth-full-logo-text">
            UConn <strong>PR</strong>
          </span>
        </div>

        {/* Heading with reveal animation */}
        <h2 className="auth-full-heading">
          <TextReveal word="Create Account" />
        </h2>
        <p className="auth-full-sub">Join the UConn Peer Review System</p>
        <div className="auth-full-divider" />

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <input
              className="form-input"
              type="text"
              placeholder="Full name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <input
              className="form-input"
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group password-container">
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 6 chars)"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="show-hide-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="form-group password-container">
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <select
              className="form-select"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            className="btn btn-cta btn-block"
            disabled={loading}
            style={{ marginTop: '4px' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-full-switch">
          Already have an account?{' '}
          <Link to="/login">Sign in with NetID</Link>
        </p>
      </motion.div>
    </div>
  );
}
