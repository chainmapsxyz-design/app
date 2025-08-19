// /src/auth/AuthProvider.jsx
import { createContext, useContext, useMemo, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL; // make sure this is set in .env.local

  // NEW: validate token against backend on mount or when token changes
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("invalid");
        const data = await res.json();
        // refresh user (in case tier/name changed)
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      } catch {
        // token invalid or user missing in DB -> force logout
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    })();
  }, [token, apiBase]);

  async function login(email, password) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Login failed");
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function signup(email, password, name) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Signup failed");
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  const value = useMemo(
    () => ({ token, user, login, signup, logout, loading, isAuthed: !!token }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
