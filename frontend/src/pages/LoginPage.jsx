import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BookOpen, Loader2, Lock, Mail, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import API from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { strings } from '../i18n/strings';

/**
 * Login: local POST /auth/login or CAS redirect. On success, redirect by role (/instructor or /dashboard).
 * Handles CAS callback via loginFromCas and loginWithData. Rendered at /login.
 * @returns {JSX.Element}
 */
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
            setError(strings.login.casFailed);
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
      setError(err.response?.data?.message || strings.login.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: "url('/images/content.png')", backgroundSize: '100% 100%', backgroundColor: '#000E2F' }}>
      {/* Gradient overlay on top of background image */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(0,14,47,0.6) 0%, rgba(10,22,40,0.4) 40%, rgba(15,29,53,0.4) 70%, rgba(0,14,47,0.6) 100%)' }} />

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-8 py-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
            <BookOpen className="w-5 h-5 text-white/90" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white/90 text-sm font-semibold tracking-wide">UConn <strong>PR</strong></span>
            <span className="text-white/40 text-[10px] tracking-widest uppercase">Peer Review</span>
          </div>
        </div>
        <div className="text-[11px] text-white/50 font-medium tracking-wider uppercase bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
          {strings.login.signIn}
        </div>
      </nav>

      {/* ── HERO ── */}
      <main className="flex-1 flex items-start justify-center relative overflow-hidden px-4 pt-4">
        {/* Atmospheric elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
               style={{ background: 'radial-gradient(circle, rgba(59,125,216,0.6) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.04]"
               style={{ background: 'radial-gradient(circle, rgba(255,188,14,0.6) 0%, transparent 70%)' }} />
        </div>

        {/* Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-[20vw] font-black text-white/[0.015] leading-none tracking-tighter">PR</span>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10 origin-top scale-[0.78]"
        >
          <div className="rounded-3xl border border-white/[0.08] overflow-hidden"
               style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(24px)' }}>
            <div className="p-8 sm:p-10">
              {/* Card header */}
              <div className="flex items-center gap-2.5 mb-8">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white/70" />
                </div>
                <span className="text-white/50 text-xs font-medium tracking-wider uppercase">UConn Peer Review</span>
              </div>

              <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Peer Review</h1>
              <p className="text-white/30 text-xs tracking-[0.3em] uppercase mb-8">UConn Portal</p>

              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

              {searchParams.get('registered') === 'true' && (
                <p className="text-emerald-400 text-sm text-center mb-4 font-medium">
                  {strings.login.registrationSuccess}
                </p>
              )}
              {error && (
                <p id="login-error" className="text-red-400 text-sm text-center mb-4 font-medium" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}

              <p className="text-white/40 text-[11px] font-medium tracking-wider uppercase mb-3">Authentication</p>

              {/* CAS login */}
              <button
                onClick={handleCasLogin}
                disabled={casLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 mb-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,125,216,0.35), rgba(59,125,216,0.18))',
                  border: '1px solid rgba(59,125,216,0.3)',
                  boxShadow: '0 0 24px rgba(59,125,216,0.12)',
                }}
              >
                {casLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {strings.login.signInWithNetId}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <span className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-white/20 text-[10px] tracking-widest uppercase font-medium">{strings.login.orLabel}</span>
                <span className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Local login */}
              <form onSubmit={handleLocalLogin} className="space-y-3" aria-describedby={error ? 'login-error' : undefined}>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    id="login-email"
                    className="w-full py-3 pl-10 pr-4 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    type="email"
                    placeholder={strings.login.emailPlaceholder}
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    id="login-password"
                    className="w-full py-3 pl-10 pr-4 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    type="password"
                    placeholder={strings.login.passwordPlaceholder}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm text-white/80 font-medium transition-all duration-200 hover:text-white"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {loading ? strings.login.signingIn : strings.login.signInWithEmail}
                </button>
              </form>

              <p className="text-white/15 text-[10px] text-center mt-6 tracking-wider uppercase font-medium">
                Secured via UConn CAS single sign-on
              </p>

              <p className="text-center text-sm text-white/30 mt-4">
                {strings.login.noAccount}{' '}
                <Link to="/register" className="text-white/60 hover:text-white font-semibold transition-colors">
                  {strings.login.createOne}
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-white/15 text-xs tracking-wider">
            University of Connecticut &nbsp;·&nbsp; Collaborative Peer Review Platform
          </p>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="flex items-center justify-between px-8 py-5 relative z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-white/20" />
          <span className="text-white/20 text-xs font-medium">UConn <strong>PR</strong></span>
        </div>
        <span className="text-white/15 text-[10px] tracking-wider">© University of Connecticut</span>
      </footer>
    </div>
  );
}
