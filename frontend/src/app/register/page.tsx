"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Registration failed");
      }

      const data = await res.json();
      localStorage.setItem("user", data.username);
      localStorage.setItem("user_id", String(data.user_id));
      localStorage.setItem("is_admin", String(data.is_admin));

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <div className="blob"></div>
        <main style={{ justifyContent: "center" }}>
          <div className="glass-card" style={{ maxWidth: "420px", textAlign: "center" }}>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Account Created</h2>
            <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
              Welcome to FinVinTech, <strong>{username}</strong>! Your account has been successfully created.
            </p>
            <p style={{ marginBottom: "2rem", opacity: 0.6, fontSize: "0.9rem" }}>
              A confirmation email will be sent to <strong>{email}</strong> in a future update.
            </p>
            <button className="btn-primary" onClick={() => router.push("/")}>
              Go to Dashboard →
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="blob"></div>
      <main style={{ justifyContent: "center" }}>
        <div className="hero">
          <h1 className="title">FinVinTech</h1>
          <p className="subtitle">Create your account</p>
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
              placeholder="vince"
              minLength={3}
            />
          </div>

          <div className="stat-item" style={{ marginBottom: "1.5rem" }}>
            <label className="stat-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vince@example.com"
            />
          </div>

          <div className="stat-item" style={{ marginBottom: "1.5rem" }}>
            <label className="stat-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div className="stat-item" style={{ marginBottom: "2rem" }}>
            <label className="stat-label" htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up →"}
          </button>

          <p style={{ marginTop: "1.5rem", textAlign: "center", opacity: 0.7 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
