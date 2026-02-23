import { NavLink, useNavigate } from 'react-router-dom';
import type { User } from '../types';

export default function Navbar() {
  const navigate = useNavigate();

  const user: Partial<User> = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') as Partial<User>;
    } catch {
      return {};
    }
  })();

  const isInstructor = user.role === 'instructor' || user.role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-brand-badge">UP</span>
        <div className="navbar-brand-text">
          <span className="navbar-brand-title">UConn PR</span>
          <span className="navbar-brand-sub">Peer Review System</span>
        </div>
      </div>

      <div className="navbar-links">
        {isInstructor ? (
          <>
            <NavLink to="/instructor" className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/instructor/peer-review" className={navClass}>
              Student Check-ins
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/dashboard" className={navClass}>
              My Submissions
            </NavLink>
            <NavLink to="/student/checkins" className={navClass}>
              My Check-ins
            </NavLink>
            <NavLink to="/upload" className={navClass}>
              Upload
            </NavLink>
          </>
        )}
        <NavLink to="/reviews" className={navClass}>
          Reviews
        </NavLink>
      </div>

      <div className="navbar-user">
        <span className="navbar-username">{user.name ?? 'User'}</span>
        <span className={`chip chip-role${isInstructor ? ' chip-role-instructor' : ''}`}>
          {user.role ?? 'student'}
        </span>
        <button className="btn-logout" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
