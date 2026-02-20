import axios from 'axios';
import { API_BASE_URL } from '../config';

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,   // send httpOnly cookies with every request
});

// No request interceptor needed — the httpOnly cookie is attached
// automatically by the browser for same-origin requests.

// Handle 401 responses globally (token expired / invalid)
// The event sets AuthContext.user → null, which causes <ProtectedRoute>
// to render <Navigate to="/login"> via React Router (no hard reload).
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default API;
