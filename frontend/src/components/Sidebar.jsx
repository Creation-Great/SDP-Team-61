import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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

  const linkClass = ({ isActive }) =>
    `w-full flex items-center px-4 py-3 rounded-xl transition-all no-underline text-sm ${
      isActive
        ? 'bg-[#000E2F]/10 text-[#000E2F] font-semibold'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const iconClass = (isActive) =>
    `w-5 h-5 mr-3 ${isActive ? 'text-[#000E2F]' : 'text-slate-400'}`;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 bg-[#000E2F] rounded-lg flex items-center justify-center mr-3">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg text-slate-900 tracking-tight">
          Peer<span className="text-[#000E2F]">Review</span>
        </span>
      </div>

      {/* Nav items */}
      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/instructor' || item.to === '/dashboard'}
            onClick={() => setMobileOpen(false)}
            className={linkClass}
          >
            {({ isActive }) => (
              <>
                <item.icon className={iconClass(isActive)} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User area */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="flex items-center px-4 py-3 bg-slate-50 rounded-xl mb-3">
          <div className="w-8 h-8 bg-[#000E2F]/10 text-[#000E2F] rounded-full flex items-center justify-center font-bold mr-3 shrink-0">
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
                  className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#000E2F]"
                  disabled={savingName}
                  placeholder="Enter your full name"
                />
                <button onClick={handleSaveName} disabled={savingName} className="text-emerald-600 hover:text-emerald-700 p-0.5" title="Save">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 p-0.5" title="Cancel">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user?.name || 'User'}
                </div>
                <button
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#000E2F] transition-opacity p-0.5"
                  title="Edit display name"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="text-xs text-slate-500 truncate capitalize">
              {user?.role || 'student'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4">
        <span className="font-bold text-lg text-slate-900">
          Peer<span className="text-[#000E2F]">Review</span>
        </span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

    </>
  );
}
