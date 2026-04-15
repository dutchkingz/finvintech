"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Something went wrong");
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <div className="blob"></div>
        <main style={{ justifyContent: "center" }}>
          <div className="glass-card" style={{ maxWidth: "420px", textAlign: "center" }}>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Check Your Email</h2>
            <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
              If an account with <strong>{email}</strong> exists, we&apos;ve sent a password reset link.
            </p>
            <p style={{ marginBottom: "2rem", opacity: 0.6, fontSize: "0.9rem" }}>
              The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
            <Link href="/login" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
              Back to Login
            </Link>
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
          <p className="subtitle">Reset your password</p>
        </div>

        <form className="glass-card" onSubmit={handleSubmit} style={{ maxWidth: "420px" }}>
          <p style={{ marginBottom: "1.5rem", opacity: 0.7, fontSize: "0.95rem" }}>
            Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
          </p>

          <div className="stat-item" style={{ marginBottom: "2rem" }}>
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

          {error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link →"}
          </button>

          <p style={{ marginTop: "1.5rem", textAlign: "center", opacity: 0.7 }}>
            <Link href="/login" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              Back to login
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
