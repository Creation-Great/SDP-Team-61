import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await API.post('/auth/register', { name, email, password, role, group_id: groupId || undefined });
      navigate('/login?registered=true');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 ' +
    'focus:border-indigo-300 transition-all';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Gradient blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <Card className="w-full max-w-md relative z-10 !shadow-2xl !bg-white/90 backdrop-blur-sm !p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
          <p className="text-slate-500 text-sm mt-1">Join the PeerReview System</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="reg-name"
              className={inputClass}
              type="text"
              placeholder="John Doe"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              id="reg-email"
              className={inputClass}
              type="email"
              placeholder="you@university.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="reg-password"
                className={inputClass + ' pr-12'}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirm Password
            </label>
            <input
              id="reg-confirm-password"
              className={inputClass}
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="reg-role" className="block text-sm font-medium text-slate-700 mb-1.5">
              Role
            </label>
            <select
              id="reg-role"
              className={inputClass + ' appearance-none cursor-pointer'}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>

          {/* Team Number (students only) */}
          {role === 'student' && (
            <div>
              <label htmlFor="reg-team" className="block text-sm font-medium text-slate-700 mb-1.5">
                Team Number
              </label>
              <input
                id="reg-team"
                className={inputClass}
                type="text"
                placeholder="e.g., 61"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
