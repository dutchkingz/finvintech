"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchUsers() {
    const userId = localStorage.getItem("user_id");
    fetch(`http://127.0.0.1:8000/api/admin/users?user_id=${userId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Failed to load users");
        }
        return res.json();
      })
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const isAdmin = localStorage.getItem("is_admin");
    if (isAdmin !== "true") {
      router.push("/");
      return;
    }
    fetchUsers();
  }, [router]);

  async function handleDelete(targetId: number, username: string) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
      return;
    }

    const userId = localStorage.getItem("user_id");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/users/${targetId}?user_id=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete user");
      }
      setUsers(users.filter((u) => u.id !== targetId));
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <>
      <div className="blob"></div>
      <main>
        <div className="hero">
          <h1 className="title">Admin Panel</h1>
          <p className="subtitle">Registered Users</p>
        </div>

        <div className="glass-card" style={{ maxWidth: "800px", width: "100%" }}>
          {loading && <p>Loading users...</p>}
          {error && <div className="error-msg">{error}</div>}

          {!loading && !error && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem", opacity: 0.6, fontSize: "0.85rem" }}>ID</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", opacity: 0.6, fontSize: "0.85rem" }}>Username</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", opacity: 0.6, fontSize: "0.85rem" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", opacity: 0.6, fontSize: "0.85rem" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", opacity: 0.6, fontSize: "0.85rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <td style={{ padding: "0.75rem" }}>{u.id}</td>
                    <td style={{ padding: "0.75rem" }}>{u.username}</td>
                    <td style={{ padding: "0.75rem", opacity: 0.8 }}>{u.email}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        background: u.is_admin ? "rgba(0, 200, 150, 0.2)" : "rgba(255,255,255,0.1)",
                        color: u.is_admin ? "#00c896" : "inherit",
                      }}>
                        {u.is_admin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem", textAlign: "right" }}>
                      {!u.is_admin && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          style={{
                            background: "rgba(255, 60, 60, 0.15)",
                            color: "#ff4444",
                            border: "1px solid rgba(255, 60, 60, 0.3)",
                            padding: "0.3rem 0.8rem",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ marginTop: "1.5rem", opacity: 0.5, fontSize: "0.85rem" }}>
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Back to Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
