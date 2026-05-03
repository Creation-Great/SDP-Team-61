// API base URL
// - Development: leave VITE_API_URL unset → defaults to '' (Vite proxy handles /api → backend)
// - Production:  set VITE_API_URL to the backend origin, e.g. https://api.example.com
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
