"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Login failed");
      }

      const data = await res.json();
      localStorage.setItem("user", data.username);
      localStorage.setItem("user_id", String(data.user_id));
      localStorage.setItem("is_admin", String(data.is_admin));

      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="blob"></div>
      <main style={{ justifyContent: "center" }}>
        <div className="hero">
          <h1 className="title">FinVinTech</h1>
          <p className="subtitle">Sign in to access your dashboard</p>
        </div>

        <form className="glass-card" onSubmit={handleSubmit} style={{ maxWidth: "420px" }}>
          <div className="stat-item" style={{ marginBottom: "1.5rem" }}>
            <label className="stat-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin"
            />
          </div>

          <div className="stat-item" style={{ marginBottom: "2rem" }}>
            <label className="stat-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}

          <p style={{ marginBottom: "1rem", textAlign: "right" }}>
            <Link href="/forgot-password" style={{ color: "var(--accent)", textDecoration: "underline", fontSize: "0.9rem", opacity: 0.7 }}>
              Forgot password?
            </Link>
          </p>

          <button id="login-submit" type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p style={{ marginTop: "1.5rem", textAlign: "center", opacity: 0.7 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              Sign up
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
