"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <>
        <div className="blob"></div>
        <main style={{ justifyContent: "center" }}>
          <div className="glass-card" style={{ maxWidth: "420px", textAlign: "center" }}>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Invalid Link</h2>
            <p style={{ marginBottom: "2rem", opacity: 0.8 }}>
              This password reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
              Request a New Link
            </Link>
          </div>
        </main>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Reset failed");
      }

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
            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Password Reset</h2>
            <p style={{ marginBottom: "2rem", opacity: 0.8 }}>
              Your password has been successfully reset.
            </p>
            <button className="btn-primary" onClick={() => router.push("/login")}>
              Sign In →
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
          <p className="subtitle">Choose a new password</p>
        </div>

        <form className="glass-card" onSubmit={handleSubmit} style={{ maxWidth: "420px" }}>
          <div className="stat-item" style={{ marginBottom: "1.5rem" }}>
            <label className="stat-label" htmlFor="password">New Password</label>
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
            <label className="stat-label" htmlFor="confirm-password">Confirm New Password</label>
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
            {loading ? "Resetting..." : "Reset Password →"}
          </button>
        </form>
      </main>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
