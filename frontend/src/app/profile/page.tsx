"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface StockQuote {
  symbol: string;
  company_name: string;
  current_price: number;
  change: number;
  change_pct: number;
  currency: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [searchSymbol, setSearchSymbol] = useState("");
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) { router.push("/login"); return; }
    setUsername(user);
  }, [router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchSymbol.trim()) return;
    setSearching(true);
    setQuote(null);
    setSearchError(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/stock/${searchSymbol.trim().toUpperCase()}/quote`);
      if (!res.ok) throw new Error("Symbol not found");
      setQuote(await res.json());
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("user_id");
    router.push("/login");
  }

  return (
    <>
      <div className="blob"></div>

      <nav className="navbar">
        <span className="navbar-brand">FinVinTech</span>
        <div className="navbar-user">
          <Link href="/" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}>Dashboard</Link>
          <span style={{ color: "#4b5563" }}>|</span>
          <span>👤 {username}</span>
          <button id="logout-btn" className="btn-logout" onClick={handleLogout}>Log Out</button>
        </div>
      </nav>

      <main>
        <div className="hero">
          <h1 className="title">My Profile</h1>
          <p className="subtitle">Welcome back, {username}</p>
        </div>

        {/* Quick Quote Search */}
        <div className="glass-card" style={{ maxWidth: "600px", marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1.25rem", fontSize: "1.1rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Quote</h2>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem" }}>
            <input
              id="quote-search"
              type="text"
              placeholder="Enter ticker (e.g. TSLA)"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              style={{ flex: 1 }}
            />
            <button
              id="quote-search-btn"
              type="submit"
              className="btn-primary"
              style={{ width: "auto", padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
              disabled={searching}
            >
              {searching ? "..." : "Get Quote"}
            </button>
          </form>

          {searchError && <div className="error-msg" style={{ marginTop: "1rem" }}>{searchError}</div>}

          {quote && (
            <div className="stock-grid" style={{ marginTop: "1.5rem" }}>
              <div className="stat-item">
                <span className="stat-label">{quote.company_name}</span>
                <span className="stat-value">{quote.symbol}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Price</span>
                <span className="stat-value" style={{ color: quote.change >= 0 ? "var(--success)" : "#ef4444" }}>
                  {quote.current_price.toLocaleString("en-US", { style: "currency", currency: quote.currency })}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Change</span>
                <span className="stat-value" style={{ fontSize: "1.3rem", color: quote.change >= 0 ? "var(--success)" : "#ef4444" }}>
                  {quote.change >= 0 ? "▲" : "▼"} {Math.abs(quote.change_pct).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Watchlist Link */}
        <div className="glass-card" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>📈 My Watchlist</h2>
          <p style={{ color: "#9ca3af", marginBottom: "1.5rem" }}>
            Track your favourite stocks with live quotes and sparklines.
          </p>
          <Link href="/watchlist" id="goto-watchlist-btn" style={{ display: "block" }}>
            <button className="btn-primary">Open Watchlist →</button>
          </Link>
        </div>
      </main>
    </>
  );
}
