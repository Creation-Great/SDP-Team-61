import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, Upload, Users, BarChart3, CheckSquare,
  LogOut, Sparkles, Menu, X,
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
  { to: '/instructor/analytics', label: 'Review Analytics', icon: BarChart3 },
  { to: '/instructor/class-checkins', label: 'Student Check-ins', icon: CheckSquare },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isInstructor } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isInstructor ? instructorNav : studentNav;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
          <div className="w-8 h-8 bg-[#000E2F]/10 text-[#000E2F] rounded-full flex items-center justify-center font-bold mr-3">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {user?.name || 'User'}
            </div>
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
