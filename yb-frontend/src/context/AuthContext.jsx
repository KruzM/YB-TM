// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore token if present and fetch /auth/me
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    // ?? If no token, don't hit /auth/me at all
    if (!token) {
      setLoading(false);
      return;
    }

    // Set Authorization header for all future requests
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    async function loadUser() {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err) {
        console.error("Error loading current user:", err);
        // token might be invalid/expired
        localStorage.removeItem("access_token");
        delete api.defaults.headers.common["Authorization"];
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email, password) => {
    // Backend expects query params
    const res = await api.post("/auth/login", null, {
      params: { email, password },
    });

    const token = res.data.access_token;

    // Save token & set header
    localStorage.setItem("access_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Fetch current user
    const meRes = await api.get("/auth/me");
    setUser(meRes.data);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem("access_token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
