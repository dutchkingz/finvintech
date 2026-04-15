"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StockQuote {
  symbol: string;
  company_name: string;
  current_price: number;
  prev_close: number;
  change: number;
  change_pct: number;
  currency: string;
  market_cap: number | null;
  pe_ratio: number | null;
  eps: number | null;
  dividend_yield: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  avg_volume: number | null;
  sector: string | null;
  industry: string | null;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchQuote(symbol: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/stock/${symbol}/quote`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Stock not found");
      }
      setQuote(await res.json());
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestions(query: string) {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setSuggestions(await res.json());
      }
    } catch {
      // silently ignore search errors
    }
  }

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }
    setUsername(user);
    setIsAdmin(localStorage.getItem("is_admin") === "true");
    setAuthChecked(true);
    fetchQuote("AAPL");
  }, [router]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(value: string) {
    setSearchSymbol(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 250);
  }

  function handleSelectSuggestion(symbol: string) {
    setSearchSymbol(symbol);
    setSuggestions([]);
    setShowSuggestions(false);
    setQuote(null);
    fetchQuote(symbol);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const symbol = searchSymbol.trim().toUpperCase();
    if (!symbol) return;
    setSuggestions([]);
    setShowSuggestions(false);
    setQuote(null);
    fetchQuote(symbol);
  }

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("user_id");
    localStorage.removeItem("is_admin");
    router.push("/login");
  }

  if (!authChecked) return null;

  return (
    <>
      <div className="blob"></div>

      {/* Navbar */}
      <nav className="navbar">
        <span className="navbar-brand">FinVinTech</span>
        <div className="navbar-user">
          <Link href="/profile" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}>Profile</Link>
          <span style={{ color: "#4b5563" }}>|</span>
          <Link href="/watchlist" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}>Watchlist</Link>
          {isAdmin && (
            <>
              <span style={{ color: "#4b5563" }}>|</span>
              <Link href="/admin" style={{ color: "#00c896", textDecoration: "none", fontSize: "0.9rem" }}>Admin</Link>
            </>
          )}
          <span style={{ color: "#4b5563" }}>|</span>
          <span>👤 {username}</span>
          <button id="logout-btn" className="btn-logout" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </nav>

      <main>
        <div className="hero">
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">
            Live market data, powered by yFinance & FastAPI
          </p>
        </div>

        {/* Search box with autocomplete */}
        <div ref={searchRef} style={{ position: "relative", maxWidth: "900px", width: "100%", margin: "0 auto" }}>
          <form onSubmit={handleSearch} style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            background: "var(--card-bg)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--card-border)",
            borderRadius: "14px",
            padding: "0.75rem 1rem",
          }}>
            <input
              type="text"
              value={searchSymbol}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search stocks (e.g. Apple, TSLA, Microsoft)"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--foreground)", fontSize: "1.1rem", fontFamily: "inherit" }}
              autoFocus
            />
            <button type="submit" disabled={loading} style={{
              whiteSpace: "nowrap",
              padding: "0.5rem 1.2rem",
              background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}>
              {loading ? "Looking up..." : "Get Quote"}
            </button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              marginTop: "4px",
              zIndex: 50,
              overflow: "hidden",
            }}>
              {suggestions.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => handleSelectSuggestion(s.symbol)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "0.7rem 1rem",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.9rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span>
                    <strong style={{ color: "#00c896" }}>{s.symbol}</strong>
                    <span style={{ marginLeft: "0.75rem", opacity: 0.7 }}>{s.name}</span>
                  </span>
                  <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>{s.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="error-msg" style={{ maxWidth: "500px" }}>
            {error}
          </div>
        )}

        {quote && (
          <div className="glass-card" style={{ maxWidth: "900px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2>{quote.company_name} ({quote.symbol})</h2>
              {quote.sector && (
                <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                  {quote.sector}{quote.industry ? ` · ${quote.industry}` : ""}
                </span>
              )}
            </div>

            <div className="stock-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="stat-item">
                <span className="stat-label">Last Price</span>
                <span className="stat-value" style={{ color: quote.change >= 0 ? "#00c896" : "#ff4444" }}>
                  {quote.current_price.toLocaleString('en-US', {
                    style: 'currency',
                    currency: quote.currency,
                  })}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Previous Close</span>
                <span className="stat-value">
                  {quote.prev_close.toLocaleString('en-US', {
                    style: 'currency',
                    currency: quote.currency,
                  })}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Change</span>
                <span className="stat-value" style={{ color: quote.change >= 0 ? "#00c896" : "#ff4444" }}>
                  {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Change %</span>
                <span className="stat-value" style={{ color: quote.change_pct >= 0 ? "#00c896" : "#ff4444" }}>
                  {quote.change_pct >= 0 ? "+" : ""}{quote.change_pct.toFixed(2)}%
                </span>
              </div>
              {quote.market_cap != null && (
                <div className="stat-item">
                  <span className="stat-label">Market Cap</span>
                  <span className="stat-value">
                    {quote.market_cap >= 1e12
                      ? `$${(quote.market_cap / 1e12).toFixed(2)}T`
                      : quote.market_cap >= 1e9
                      ? `$${(quote.market_cap / 1e9).toFixed(2)}B`
                      : `$${(quote.market_cap / 1e6).toFixed(2)}M`}
                  </span>
                </div>
              )}
              {quote.pe_ratio != null && (
                <div className="stat-item">
                  <span className="stat-label">P/E Ratio</span>
                  <span className="stat-value">{quote.pe_ratio.toFixed(2)}</span>
                </div>
              )}
              {quote.eps != null && (
                <div className="stat-item">
                  <span className="stat-label">EPS</span>
                  <span className="stat-value">${quote.eps.toFixed(2)}</span>
                </div>
              )}
              {quote.dividend_yield != null && (
                <div className="stat-item">
                  <span className="stat-label">Dividend Yield</span>
                  <span className="stat-value">{quote.dividend_yield.toFixed(2)}%</span>
                </div>
              )}
              {quote.week_52_high != null && quote.week_52_low != null && (
                <div className="stat-item">
                  <span className="stat-label">52-Week Range</span>
                  <span className="stat-value" style={{ fontSize: "1.3rem" }}>
                    {quote.week_52_low.toLocaleString('en-US', { style: 'currency', currency: quote.currency })}
                    {" — "}
                    {quote.week_52_high.toLocaleString('en-US', { style: 'currency', currency: quote.currency })}
                  </span>
                </div>
              )}
              {quote.avg_volume != null && (
                <div className="stat-item">
                  <span className="stat-label">Avg Volume</span>
                  <span className="stat-value">
                    {quote.avg_volume >= 1e6
                      ? `${(quote.avg_volume / 1e6).toFixed(2)}M`
                      : quote.avg_volume.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
