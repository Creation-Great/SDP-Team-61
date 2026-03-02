import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { User } from '../types';

function LogoMark({ size = 32 }: { size?: number }) {
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

function getInitials(name?: string): string {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onClick?: () => void;
}

function SidebarNavLink({ to, icon, label, open, onClick }: SidebarLinkProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <button
      type="button"
      onClick={() => { navigate(to); onClick?.(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 10px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        background: isActive ? 'rgba(75,159,225,0.12)' : 'transparent',
        color: isActive ? 'var(--tech-blue)' : 'var(--text-secondary)',
        transition: 'background 0.15s ease, color 0.15s ease',
        textAlign: 'left',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 400,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(75,159,225,0.06)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      <span style={{ flexShrink: 0, width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <motion.span
        animate={{
          display: open ? 'block' : 'none',
          opacity: open ? 1 : 0,
        }}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
      >
        {label}
      </motion.span>
    </button>
  );
}

export default function AppSidebar() {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const user: Partial<User> = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') as Partial<User>; }
    catch { return {}; }
  })();

  const isInstructor = user.role === 'instructor' || user.role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const iconStyle = { width: 18, height: 18, strokeWidth: 1.8 };

  const studentLinks = [
    { to: '/student/reviews', icon: <ClipboardList {...iconStyle} />, label: 'My Reviews' },
  ];

  const instructorLinks = [
    { to: '/instructor/courses', icon: <LayoutDashboard {...iconStyle} />, label: 'Courses' },
  ];

  const links = isInstructor ? instructorLinks : studentLinks;

  // ── Desktop Sidebar ──────────────────────────────────────
  const DesktopSidebar = (
    <motion.div
      className="hidden md:flex"
      animate={{ width: open ? '220px' : '60px' }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        height: '100vh',
        flexDirection: 'column',
        flexShrink: 0,
        background: 'var(--surface-raised)',
        borderRight: '1px solid var(--glass-border)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '18px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
        <div style={{ flexShrink: 0 }}>
          <LogoMark size={32} />
        </div>
        <motion.div
          animate={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none' }}
          style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            UConn <span style={{ color: 'var(--tech-blue)' }}>PR</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '1px' }}>
            Peer Review
          </div>
        </motion.div>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', overflowX: 'hidden' }}>
        {links.map(link => (
          <SidebarNavLink key={link.to} {...link} open={open} />
        ))}
      </div>

      {/* User section */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', marginBottom: '4px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--tech-blue), var(--uconn-orange))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, color: '#fff', fontFamily: 'Montserrat, sans-serif',
          }}>
            {getInitials(user.name ?? undefined)}
          </div>
          <motion.div animate={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none' }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Montserrat, sans-serif' }}>
              {user.name ?? user.email ?? 'User'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--tech-blue)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {user.role ?? 'student'}
            </div>
          </motion.div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            padding: '8px 10px', borderRadius: '8px', border: 'none',
            cursor: 'pointer', background: 'transparent',
            color: 'var(--danger)', transition: 'background 0.15s ease',
            fontFamily: 'Montserrat, sans-serif', fontSize: '0.875rem',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,92,92,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <LogOut width={18} height={18} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <motion.span animate={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none' }} style={{ whiteSpace: 'nowrap' }}>
            Logout
          </motion.span>
        </button>
      </div>
    </motion.div>
  );

  // ── Mobile Top Bar ──────────────────────────────────────
  const MobileBar = (
    <div
      className="flex md:hidden"
      style={{
        height: '52px', flexShrink: 0,
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--glass-border)',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <LogoMark size={28} />
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          UConn <span style={{ color: 'var(--tech-blue)' }}>PR</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
      >
        <Menu width={22} height={22} />
      </button>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--surface-page)',
            display: 'flex', flexDirection: 'column',
            padding: '24px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LogoMark size={32} />
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                UConn <span style={{ color: 'var(--tech-blue)' }}>PR</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <X width={22} height={22} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {links.map(link => (
              <SidebarNavLink key={link.to} {...link} open={true} onClick={() => setMobileOpen(false)} />
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--tech-blue), var(--uconn-orange))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, color: '#fff',
              }}>
                {getInitials(user.name ?? undefined)}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name ?? user.email ?? 'User'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--tech-blue)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{user.role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: 'rgba(224,92,92,0.08)', color: 'var(--danger)',
                fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem',
              }}
            >
              <LogOut width={18} height={18} />
              Logout
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileBar}
    </>
  );
}
