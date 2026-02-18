import { NavLink, useNavigate } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const isInstructor = user.role === 'instructor';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">AI Peer Review</div>
      <div className="navbar-links">
        {isInstructor ? (
          <>
            <NavLink to="/instructor" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
            <NavLink to="/instructor/peer-review" className={({ isActive }) => isActive ? 'active' : ''}>
              Student Check-ins
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              My Submissions
            </NavLink>
            <NavLink to="/upload" className={({ isActive }) => isActive ? 'active' : ''}>
              Upload
            </NavLink>
            <NavLink to="/student/checkins" className={({ isActive }) => isActive ? 'active' : ''}>
              My Check-ins
            </NavLink>
          </>
        )}
        <NavLink to="/reviews" className={({ isActive }) => isActive ? 'active' : ''}>
          Reviews
        </NavLink>
        <NavLink to="/peer-review" className={({ isActive }) => isActive ? 'active' : ''}>
          Peer Review
        </NavLink>
      </div>
      <div className="navbar-user">
        <span className="navbar-username">{user.name || 'User'}</span>
        <span className="chip chip-role">{user.role || 'student'}</span>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
