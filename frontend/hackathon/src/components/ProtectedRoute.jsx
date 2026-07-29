import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ProtectedRoute({ children }) {
  // Support both 'token' (existing) and 'authToken' (new alias) keys
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");

  // Fast-exit: no token at all → redirect immediately (same behaviour as before)
  if (!token) {
    return <Navigate to="/login" />;
  }

  // Token exists — validate it with the backend before rendering children
  const [checking, setChecking] = useState(true);
  const [valid, setValid]       = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyToken() {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (cancelled) return;

        if (res.ok) {
          // Token is valid — refresh cached user data and keep both keys in sync
          try {
            const user = await res.json();
            if (user.role)           localStorage.setItem("role", user.role);
            if (user.name)           localStorage.setItem("name", user.name);
            if (user.id)             localStorage.setItem("userId", String(user.id));
            if (user.enterpriseName) localStorage.setItem("enterpriseName", user.enterpriseName);
            // Keep authToken alias in sync with token
            localStorage.setItem("authToken", token);
          } catch (_) { /* non-critical — JSON parse failure is fine */ }
          setValid(true);
        } else if (res.status === 401) {
          // Genuinely expired / revoked token — clear both keys
          localStorage.removeItem("authToken");
          localStorage.clear();
          setValid(false);
        } else {
          // Any other server error — treat as offline, let the app proceed
          setValid(true);
        }
      } catch (_) {
        // Network error (offline) — keep the user in the app
        if (!cancelled) setValid(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verifyToken();
    return () => { cancelled = true; };
  }, [token]);

  if (checking) {
    // Lightweight loading state — shown only during the /me round-trip (~200ms)
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FDF8E1",
        fontFamily: "Poppins, sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48,
            height: 48,
            border: "4px solid #D8D5C5",
            borderTop: "4px solid #3E3E5C",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px"
          }} />
          <p style={{ color: "#7A7490", fontSize: 14, fontWeight: 600 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!valid) {
    return <Navigate to="/login" />;
  }

  return children;
}
