import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '../types';

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 2.5 L31 9.75 L31 26.25 L18 33.5 L5 26.25 L5 9.75 Z"
        stroke="rgba(75,159,225,0.50)" strokeWidth="1.4" fill="rgba(75,159,225,0.08)"
      />
      <path
        d="M10.5 13v10M10.5 13h4.2a3 3 0 0 1 0 6h-4.2"
        stroke="rgba(226,237,255,0.90)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M19.5 13v10M19.5 13h4a2.8 2.8 0 0 1 0 5.6H19.5M22.5 18.6 L26 23"
        stroke="rgba(75,159,225,0.85)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const id    = params.get('id');
    const name  = params.get('name');
    const email = params.get('email');
    const role  = params.get('role') as UserRole | null;

    if (!token || !id || !role) return;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id, name: name ?? id, email: email ?? '', role }));

    window.history.replaceState({}, '', `${window.location.origin}/login`);
    if (role === 'instructor' || role === 'admin') {
      navigate('/instructor', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="login-page">

      {/* ── NAVIGATION ── */}
      <nav className="login-nav">
        <a href="#" className="login-nav-brand">
          <LogoMark size={36} />
          <div className="login-nav-wordmark">
            <span className="login-nav-wordmark-primary">UConn <strong>PR</strong></span>
            <span className="login-nav-wordmark-sub">Peer Review System</span>
          </div>
        </a>
        <div className="login-nav-pill">Sign In</div>
      </nav>

      {/* ── HERO ── */}
      <main className="login-hero">
        <div className="login-hero-atmo" />
        <div className="login-hero-grid" />
        <div className="login-hero-watermark">PR</div>

        {/* Card */}
        <div className="login-card">
          <div className="login-card-bg" />
          <div className="login-card-inner">

            <div className="login-card-logo">
              <LogoMark size={30} />
              <span className="login-card-logo-text">UConn Peer Review</span>
            </div>

            <h1 className="login-card-title">Peer Review</h1>
            <p className="login-card-eyebrow">UConn Portal</p>

            <div className="login-card-divider" />

            <p className="login-auth-label">Authentication</p>

            <a href="/auth/cas/login" className="login-cas-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2"
                  stroke="white" strokeWidth="2" fill="none" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4"
                  stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
              Sign in with UConn NetID
            </a>

            <p className="login-card-security">Secured via UConn CAS single sign-on</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="login-tagline">
          <p>University of Connecticut &nbsp;·&nbsp; Collaborative Peer Review Platform</p>
        </div>
      </main>

      {/* ── LOWER BAND ── */}
      <section className="login-lower">
        <p className="login-lower-phrase">
          A Collaborative<br />Platform.<em><br />Built for<br />UConn.</em>
        </p>
        <div className="login-lower-body">
          <p>
            UConn Peer Review is a secure, instructor-led platform for structured
            collaborative feedback. Students submit, review, and grow together.
          </p>
          <p>
            <strong>Access is restricted</strong> to University of Connecticut members.
            Sign in with your NetID to continue.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="login-footer">
        <a href="#" className="login-footer-brand">
          <LogoMark size={24} />
          <span className="login-footer-name">UConn <strong>PR</strong></span>
        </a>
        <div className="login-footer-right">
          <a href="/auth/cas/login" className="login-footer-pill">Sign In</a>
          <span className="login-footer-copy">© University of Connecticut</span>
        </div>
      </footer>

    </div>
  );
}
