import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",  // 🔥 MUST POINT TO BACKEND
});

// attach token on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
