import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isInstructor } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Close mobile menu on route change */
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  /* Lock body scroll when menu is open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">AI Peer Review</div>

        {/* Hamburger button — visible only on mobile */}
        <button
          className={`navbar-hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        {/* Desktop links — hidden on mobile */}
        <div className="navbar-links navbar-desktop-only">
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

        {/* Desktop user section — hidden on mobile */}
        <div className="navbar-user navbar-desktop-only">
          <span className="navbar-username">{user?.name || 'User'}</span>
          <span className="chip chip-role">{user?.role || 'student'}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* Mobile overlay + slide-in drawer */}
      {menuOpen && (
        <div
          className="navbar-overlay"
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuOpen(false); } }}
        />
      )}
      <div className={`navbar-drawer${menuOpen ? ' open' : ''}`}>
        <div className="navbar-drawer-user">
          <span className="navbar-username">{user?.name || 'User'}</span>
          <span className="chip chip-role">{user?.role || 'student'}</span>
        </div>
        <div className="navbar-drawer-links">
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
        <button className="btn-logout navbar-drawer-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </>
  );
}
