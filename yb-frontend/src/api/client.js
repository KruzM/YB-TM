// src/api/client.js
import axios from "axios";

// use the same hostname the browser is using for the frontend
const API_HOST = window.location.hostname;

const api = axios.create({
  baseURL: `http://${API_HOST}:8000/api`,
  withCredentials: true, // send cookies
});

export default api;