// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import api from "../api/client";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Helper: actually perform logout (used on button click + timeout + 401)
  const performLogout = useCallback(
    async (reason = "manual") => {
      try {
        await api.post("/auth/logout");
      } catch (_) {
        // ignore errors; if token is already invalid, it's fine
      } finally {
        setUser(null);
        // Hard redirect so everything resets cleanly
        if (window.location.pathname !== "/login") {
          const url = reason === "timeout" ? "/login?reason=timeout" : "/login";
          window.location.href = url;
        }
      }
    },
    []
  );

  // On app load: check if we have a valid session
  useEffect(() => {
    let isMounted = true;
    api
      .get("/auth/me")
      .then((res) => {
        if (!isMounted) return;
        setUser(res.data);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setInitializing(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for 401s from axios (broadcast as "app:unauthorized")
  useEffect(() => {
    const handleUnauthorized = () => {
      // If we already know there is no user, ignore
      if (!user) return;
      performLogout("unauthorized");
    };
    window.addEventListener("app:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("app:unauthorized", handleUnauthorized);
    };
  }, [user, performLogout]);

  // Idle timeout: if user is logged in and inactive for 1 hour, log them out
  useEffect(() => {
    if (!user) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        performLogout("timeout");
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );
    resetTimer(); // start timer immediately

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, [user, performLogout]);

  // Login function used by Login page
  const login = async (email, password) => {
    // backend expects query params on POST
    await api.post("/auth/login", null, {
      params: { email, password },
    });

    // Fetch the current user
    const me = await api.get("/auth/me");
    setUser(me.data);

    // Redirect to dashboard
    window.location.href = "/";
  };

  const value = {
    user,
    initializing,
    login,
    logout: () => performLogout("manual"),
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!initializing && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
