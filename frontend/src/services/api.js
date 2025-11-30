// frontend/src/services/api.js
import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.getReviewsForAssignment = (assignmentId) => {
  return API.get(`/api/reviews/by-assignment/${assignmentId}`);
};

export default API;
