// src/api/client.js
import axios from "axios";

// use the same hostname the browser is using for the frontend
const API_HOST = window.location.hostname;

const api = axios.create({
  baseURL: `http://${API_HOST}:8000/api`,
  withCredentials: true, // send cookies
});
// If backend returns 401, broadcast an event so AuthContext can log out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event("app:unauthorized"));
    }
    return Promise.reject(error);
  }
);
export default api;