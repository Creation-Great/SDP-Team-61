/**
 * Axios instance for API requests.
 *
 * - baseURL: from config (empty in dev → Vite proxy; set VITE_API_URL in production).
 * - withCredentials: true — browser sends httpOnly cookie on same-origin requests.
 * - On 401: dispatches 'auth:logout' so AuthContext clears user and routes redirect to login.
 *
 * @typedef {import('axios').AxiosInstance} AxiosInstance
 * @type {AxiosInstance}
 */
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

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
