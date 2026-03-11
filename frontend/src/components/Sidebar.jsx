import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import API from '../services/api';
import {
  BookOpen, Upload, Users, BarChart3, CheckSquare, ClipboardList, UserPlus,
  LogOut, Sparkles, Menu, X, Pencil, Check, XCircle,
} from 'lucide-react';

const studentNav = [
  { to: '/dashboard', label: 'Dashboard', icon: BookOpen },
  { to: '/upload', label: 'Submit Work', icon: Upload },
  { to: '/reviews', label: 'Assigned Reviews', icon: Users },
  { to: '/peer-review', label: 'Peer Review', icon: BarChart3 },
  { to: '/student/checkins', label: 'Weekly Check-ins', icon: CheckSquare },
];

const instructorNav = [
  { to: '/instructor', label: 'Overview', icon: BookOpen },
  { to: '/peer-review', label: 'Manage Sessions', icon: Users },
  { to: '/instructor/peer-review', label: 'Weekly Scoring', icon: ClipboardList },
  { to: '/instructor/analytics', label: 'Review Analytics', icon: BarChart3 },
  { to: '/instructor/class-checkins', label: 'Student Check-ins', icon: CheckSquare },
  { to: '/instructor/enrollments', label: 'Enrollments', icon: UserPlus },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isInstructor, updateUserName } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef(null);

  const navItems = isInstructor ? instructorNav : studentNav;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const handleStartEdit = () => {
    setNewName(user?.name || '');
    setEditingName(true);
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setNewName('');
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === user?.name) { handleCancelEdit(); return; }
    setSavingName(true);
    try {
      await API.patch('/auth/profile', { name: trimmed });
      updateUserName(trimmed);
      setEditingName(false);
    } catch {
      /* ignore */
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06] shrink-0">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center mr-3">
          <Sparkles className="w-4 h-4 text-white/90" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm text-white/90 tracking-tight">
            Peer<span className="text-[#ffbc0e]">Review</span>
          </span>
          <span className="text-[10px] text-white/30 tracking-[0.14em] uppercase font-medium">
            UConn System
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div className="p-3 flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/instructor' || item.to === '/dashboard'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 no-underline text-sm relative ${
                isActive
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: '#ffbc0e' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className={`w-[18px] h-[18px] mr-3 transition-colors ${isActive ? 'text-white' : 'text-white/30'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User area */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        <div className="flex items-center px-3 py-2.5 bg-white/[0.04] rounded-xl mb-2">
          <div className="w-8 h-8 bg-[#ffbc0e]/20 text-[#ffbc0e] rounded-full flex items-center justify-center font-bold text-sm mr-3 shrink-0">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEdit(); }}
                  className="w-full text-sm font-semibold text-white bg-white/10 border border-white/20 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#ffbc0e]/50 placeholder-white/30"
                  disabled={savingName}
                  placeholder="Enter your full name"
                />
                <button onClick={handleSaveName} disabled={savingName} className="text-emerald-400 hover:text-emerald-300 p-0.5" title="Save">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleCancelEdit} className="text-white/30 hover:text-white/60 p-0.5" title="Cancel">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <div className="text-sm font-semibold text-white/90 truncate">
                  {user?.name || 'User'}
                </div>
                <button
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/60 transition-opacity p-0.5"
                  title="Edit display name"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="text-[11px] text-white/30 truncate capitalize">
              {user?.role || 'student'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — dark navy */}
      <aside className="w-64 hidden md:flex flex-col shrink-0" style={{ background: '#000E2F' }}>
        {sidebarContent}
      </aside>

      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4"
           style={{ background: 'rgba(0,14,47,0.95)', backdropFilter: 'blur(12px)' }}>
        <span className="font-bold text-sm text-white/90">
          Peer<span className="text-[#ffbc0e]">Review</span>
        </span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-white/60 hover:text-white rounded-lg"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#000E2F' }}
      >
        {sidebarContent}
      </aside>

    </>
  );
}
