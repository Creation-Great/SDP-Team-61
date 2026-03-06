import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import type { User } from '../types';
import oakLeafImg from '../../brand_assets/oak-leaf1.png';

/* ── UConn Logo badge + wordmark ──────────────────────────── */
function NavLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', userSelect: 'none' }}>
      {/* Oak leaf PNG — white on dark */}
      <img
        src={oakLeafImg}
        alt="UConn"
        style={{
          width: '34px',
          height: '34px',
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          filter: 'invert(1)',
          mixBlendMode: 'screen',
          opacity: 0.92,
        }}
      />
      {/* Wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 900,
          fontSize: '1.05rem',
          color: 'rgba(255,255,255,0.97)',
          letterSpacing: '-0.02em',
        }}>
          UCONN
        </span>
        <span style={{
          fontFamily: 'Roboto Mono, monospace',
          fontSize: '0.46rem',
          color: 'rgba(255,255,255,0.36)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginTop: '3px',
        }}>
          Peer Review
        </span>
      </div>
    </div>
  );
}

/* ── Nav link ─────────────────────────────────────────────── */
interface NavLinkProps {
  to: string;
  label: string;
  badge?: number;
}

function TopNavLink({ to, label, badge }: NavLinkProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 22px',
        height: '68px',
        border: 'none',
        borderBottom: isActive ? '2.5px solid #ffbc0e' : '2.5px solid transparent',
        borderTop: '2.5px solid transparent',
        background: 'transparent',
        cursor: 'pointer',
        color: isActive ? '#ffffff' : 'rgba(255,255,255,0.52)',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '0.90rem',
        fontWeight: isActive ? 700 : 500,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        transition: 'color 0.18s ease, background 0.18s ease, border-color 0.22s ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = 'rgba(255,255,255,0.88)';
          el.style.background = 'rgba(255,255,255,0.07)';
          el.style.borderBottomColor = 'rgba(255,188,14,0.40)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = 'rgba(255,255,255,0.52)';
          el.style.background = 'transparent';
          el.style.borderBottomColor = 'transparent';
        }
      }}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span style={{
          minWidth: '18px',
          height: '18px',
          borderRadius: '9px',
          background: '#ffbc0e',
          color: '#111113',
          fontSize: '0.58rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
          fontFamily: 'Roboto Mono, monospace',
          letterSpacing: '0',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/* ── Circle icon button (Wooting-style, dark) ─────────────── */
function CircleIconBtn({
  icon,
  onClick,
  title,
  danger = false,
  label,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  danger?: boolean;
  label?: string;
}) {
  const baseColor = danger ? 'rgba(255,100,120,0.65)' : label ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.48)';
  const hoverColor = danger ? 'rgba(255,100,120,1)' : 'rgba(255,255,255,0.95)';
  const baseBorder = danger ? 'rgba(255,100,120,0.22)' : 'rgba(255,255,255,0.14)';
  const hoverBorder = danger ? 'rgba(255,100,120,0.50)' : 'rgba(255,255,255,0.30)';
  const hoverBg = danger ? 'rgba(255,80,100,0.10)' : 'rgba(255,255,255,0.07)';

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: `1.5px solid ${baseBorder}`,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.18s ease, background 0.18s ease, color 0.18s ease',
        color: baseColor,
        flexShrink: 0,
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '0.66rem',
        fontWeight: 700,
      }}
      onMouseEnter={e => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = hoverBorder;
        el.style.background = hoverBg;
        el.style.color = hoverColor;
      }}
      onMouseLeave={e => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = baseBorder;
        el.style.background = 'transparent';
        el.style.color = baseColor;
      }}
    >
      {label ?? icon}
    </button>
  );
}

function getInitials(name?: string): string {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();

  const user: Partial<User> = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') as Partial<User>; }
    catch { return {}; }
  })();

  const isInstructor = user.role === 'instructor' || user.role === 'admin';

  useEffect(() => {
    if (isInstructor) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/me/assigned-reviews', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then((reviews: Array<{ status: string; week_open?: boolean }>) => {
        const count = reviews.filter(r => r.status === 'PENDING' && r.week_open !== false).length;
        setPendingCount(count);
      })
      .catch(() => { /* silently ignore */ });
  }, [isInstructor]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  interface NavItem { to: string; label: string; badge?: number; }

  const studentLinks: NavItem[] = [
    { to: '/student/overview', label: 'Overview' },
    { to: '/student/reviews', label: 'My Reviews', badge: pendingCount },
    { to: '/student/history', label: 'My Scores' },
  ];

  const instructorLinks: NavItem[] = [
    { to: '/instructor/overview', label: 'Overview' },
    { to: '/instructor/courses', label: 'Courses' },
    { to: '/instructor/analytics', label: 'Analytics' },
  ];

  const links = isInstructor ? instructorLinks : studentLinks;
  const initials = getInitials(user.name ?? undefined);
  const userTooltip = `${user.name ?? user.email ?? 'User'} · ${user.role ?? 'student'}`;

  /* ── Dark Wooting-style Navbar ───────────────────────────── */
  const DesktopNav = (
    <nav
      className="hidden md:flex"
      style={{
        height: '68px',
        flexShrink: 0,
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex' as const,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px 0 24px',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Left: Logo + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '0' }}>
        {/* Logo */}
        <div style={{
          paddingRight: '36px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          marginRight: '8px',
        }}>
          <NavLogo />
        </div>

        {/* Nav links — text only, Wooting-style */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
          {links.map(link => (
            <TopNavLink key={link.to} {...link} />
          ))}
        </div>
      </div>

      {/* Right: circle icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* User avatar circle */}
        <CircleIconBtn
          icon={null}
          label={initials}
          title={userTooltip}
        />

        {/* Thin separator */}
        <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.10)' }} />

        {/* Logout circle */}
        <CircleIconBtn
          icon={<LogOut width={16} height={16} strokeWidth={1.8} />}
          title="Log out"
          onClick={handleLogout}
          danger
        />
      </div>
    </nav>
  );

  /* ── Mobile Top Bar ─────────────────────────────────────── */
  const MobileBar = (
    <div
      className="flex md:hidden"
      style={{
        height: '52px',
        flexShrink: 0,
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}
    >
      <NavLogo />
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', padding: '4px' }}
      >
        <Menu width={20} height={20} strokeWidth={1.8} />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: '#111113',
              display: 'flex', flexDirection: 'column',
              padding: '20px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <NavLogo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.40)', padding: '4px' }}
              >
                <X width={20} height={20} strokeWidth={1.8} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              {links.map(link => (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => { navigate(link.to); setMobileOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '13px 14px', borderRadius: '8px', border: 'none',
                    background: 'transparent', color: 'rgba(255,255,255,0.58)',
                    fontFamily: 'Montserrat, sans-serif', fontSize: '0.92rem',
                    fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {link.label}
                  {link.badge !== undefined && link.badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ffbc0e', color: '#111113', borderRadius: '8px', fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px' }}>
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', marginBottom: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.60rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'Montserrat, sans-serif', flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.90)', fontFamily: 'Montserrat, sans-serif' }}>
                    {user.name ?? user.email ?? 'User'}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Roboto Mono, monospace' }}>
                    {user.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,100,120,0.22)',
                  cursor: 'pointer', background: 'rgba(255,80,100,0.08)',
                  color: 'rgba(255,100,120,0.75)', fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem',
                }}
              >
                <LogOut width={16} height={16} strokeWidth={1.8} />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {DesktopNav}
      {MobileBar}
    </>
  );
}
