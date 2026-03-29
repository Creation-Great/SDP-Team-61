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

/**
 * Retry config: retry up to 3 times on 5xx and network errors with exponential backoff.
 * Does NOT retry 4xx (client errors) or 401 (auth).
 */
const MAX_RETRIES = 3;

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config._retryCount = config._retryCount || 0;

    // Only retry on network errors or 5xx server errors (not 401/4xx)
    const isRetryable =
      (!error.response && error.code !== 'ERR_CANCELED') || // network error
      (error.response?.status >= 500); // server error

    if (isRetryable && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      const delay = Math.pow(2, config._retryCount) * 500; // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
      return API(config);
    }

    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default API;
