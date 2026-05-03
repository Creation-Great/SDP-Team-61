import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} role
 * @property {string} [course_id]
 * @property {string} [group_id]
 * @property {Array<{enrollment_id:string,course_id:string,group_id:string,role:string,is_primary:boolean}>} [enrollments]
 */

/**
 * @typedef {Object} AuthValue
 * @property {AuthUser|null} user
 * @property {boolean} loading
 * @property {boolean} isInstructor
 * @property {boolean} isStudent
 * @property {() => Promise<AuthUser|null>} loginFromCas
 * @property {(userData: AuthUser) => void} loginWithData
 * @property {(newName: string) => void} updateUserName
 * @property {() => Promise<void>} logout
 */

/**
 * AuthProvider – single source of truth for authentication.
 *
 * JWT is stored in an httpOnly cookie. On mount we call GET /auth/me; if valid
 * the server returns the user profile. Route guards and UI use useAuth() — no
 * token in localStorage or React state.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {AuthUser|null} */ (null));
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await API.get('/auth/me');
      const u = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        course_id: data.course_id,
        group_id: data.group_id,
        enrollments: data.enrollments ?? [],
      };
      setUser(u);
      return u;
    } catch {
      // Cookie missing / token invalid / expired
      setUser(null);
      return null;
    }
  }, []);

  // ── Initial mount: verify existing session cookie ──
  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for 401 events dispatched by api.js interceptor ──
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  // ── Re-verify identity when the tab regains focus ──
  // This catches same-browser multi-account scenarios where another tab
  // logs in as a different user, overwriting the shared httpOnly cookie.
  // When the user switches back to this tab, we re-fetch /auth/me and
  // update React state so route guards and UI reflect the real identity.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchMe(); // silently re-sync — updates user or sets null
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Also handle window focus (covers alt-tab, taskbar click, etc.)
    window.addEventListener('focus', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [fetchMe]);

  /**
   * Called after CAS redirect lands on /login?cas=success.
   * The httpOnly cookie was already set by the backend CAS callback,
   * so we just need to fetch the profile.
   */
  const loginFromCas = useCallback(async () => {
    return await fetchMe();
  }, [fetchMe]);

  /**
   * Called after POST /auth/login succeeds (dev login). Cookie already set by backend.
   * @param {AuthUser} userData – user object from response body { user }
   */
  const loginWithData = useCallback((userData) => {
    setUser(userData);
  }, []);

  /**
   * Logout – tell the server to clear the cookie, then reset local state.
   */
  const logout = useCallback(async () => {
    try { await API.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  }, []);

  /**
   * Update the display name in local state (after PATCH /auth/profile succeeds).
   */
  const updateUserName = useCallback((newName) => {
    setUser((prev) => prev ? { ...prev, name: newName } : prev);
  }, []);

  // ── Computed role helpers (DRY – avoids repeated checks in every consumer) ──
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  const isStudent = !!user && !isInstructor;

  /** @type {AuthValue} */
  const value = {
    user,
    loading,
    isInstructor,
    isStudent,
    loginFromCas,
    loginWithData,
    updateUserName,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume authentication state. Must be used within <AuthProvider>.
 * @returns {AuthValue}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
