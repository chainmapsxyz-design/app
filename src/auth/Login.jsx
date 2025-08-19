import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function Login() {
  const { login, signup, loading } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
      } else {
        await signup(form.email.trim(), form.password, form.name.trim());
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={{ marginBottom: 8 }}>
          {mode === "login" ? "Log in" : "Sign up"}
        </h1>
        <p style={{ marginTop: 0, color: "#666" }}>
          to continue to Chainmaps dashboard
        </p>
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          {mode === "signup" && (
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ada Lovelace"
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button style={styles.button} disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          {mode === "login" ? (
            <span>
              No account?{" "}
              <a href="#" onClick={() => setMode("signup")}>
                Sign up
              </a>
            </span>
          ) : (
            <span>
              Have an account?{" "}
              <a href="#" onClick={() => setMode("login")}>
                Log in
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0b1220",
  },
  card: {
    width: 360,
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  label: { fontSize: 12, color: "#555" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
  },
  button: {
    width: "100%",
    marginTop: 8,
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    background: "#111827",
    color: "white",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
};
