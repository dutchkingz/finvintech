"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = "http://127.0.0.1:8000";

interface WatchlistItem {
  id: number;
  symbol: string;
}

interface QuoteData {
  current_price: number;
  change_pct: number;
  currency: string;
}

interface EarningsRecord {
  earnings_date: string;
  estimated_eps: number | null;
  reported_eps: number | null;
}

// --- SVG Sparkline Component ---
function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices || prices.length < 2) return <span style={{ color: "#4b5563", fontSize: "0.8rem" }}>—</span>;

  const W = 96, H = 36;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  const color = positive ? "#10b981" : "#ef4444";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Format earnings date helper ---
function formatEarningsDate(records: EarningsRecord[] | undefined): string {
  if (!records || records.length === 0) return "—";
  const today = new Date();

  // Find next upcoming earnings
  const upcoming = records
    .map(r => ({ ...r, date: new Date(r.earnings_date) }))
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const diff = Math.ceil((next.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = next.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const epsNote = next.estimated_eps != null ? ` (est. $${next.estimated_eps.toFixed(2)})` : "";
    return `${formatted}${epsNote} · in ${diff}d`;
  }

  // Fallback: show most recent past
  const past = records.sort((a, b) =>
    new Date(b.earnings_date).getTime() - new Date(a.earnings_date).getTime()
  );
  const lastDate = new Date(past[0].earnings_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const actualEps = past[0].reported_eps != null ? ` · EPS $${past[0].reported_eps.toFixed(2)}` : "";
  return `Last: ${lastDate}${actualEps}`;
}

// --- Main Page ---
export default function WatchlistPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [earnings, setEarnings] = useState<Record<string, EarningsRecord[]>>({});
  const [newSymbol, setNewSymbol] = useState("");
  const [suggestions, setSuggestions] = useState<{symbol: string; name: string; exchange: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWatchlist = useCallback(async (uid: number) => {
    if (!uid) return;
    const res = await fetch(`${API}/api/watchlist/${uid}`);
    const parsed = await res.json();
    const data: WatchlistItem[] = Array.isArray(parsed) ? parsed : [];
    setItems(data);

    // Fetch quote, sparkline, and earnings for each symbol in parallel
    data.forEach(async (item) => {
      try {
        const [qRes, sRes, eRes] = await Promise.all([
          fetch(`${API}/api/stock/${item.symbol}/quote`),
          fetch(`${API}/api/stock/${item.symbol}/history?period=1mo`),
          fetch(`${API}/api/stock/${item.symbol}/earnings`),
        ]);
        if (qRes.ok) {
          const q = await qRes.json();
          setQuotes(prev => ({ ...prev, [item.symbol]: q }));
        }
        if (sRes.ok) {
          const s = await sRes.json();
          setSparklines(prev => ({ ...prev, [item.symbol]: s.prices }));
        }
        if (eRes.ok) {
          const e = await eRes.json();
          setEarnings(prev => ({ ...prev, [item.symbol]: Array.isArray(e) ? e : [] }));
        }
      } catch (_) {}
    });
  }, []);

  useEffect(() => {
    const user = localStorage.getItem("user");
    const uid = localStorage.getItem("user_id");
    if (!user || !uid) { router.push("/login"); return; }
    setUsername(user);
    const uidNum = parseInt(uid);
    setUserId(uidNum);
    loadWatchlist(uidNum);
  }, [router, loadWatchlist]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSymbolInput(value: string) {
    setNewSymbol(value.toUpperCase());
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 1) { setSuggestions([]); return; }
      try {
        const res = await fetch(`${API}/api/search?q=${encodeURIComponent(value)}`);
        if (res.ok) setSuggestions(await res.json());
      } catch {}
    }, 250);
  }

  function handleSelectSuggestion(symbol: string) {
    setNewSymbol(symbol);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newSymbol.trim() || !userId) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`${API}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, symbol: newSymbol.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Could not add symbol");
      }
      setNewSymbol("");
      setSuggestions([]);
      setShowSuggestions(false);
      await loadWatchlist(userId);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(itemId: number, symbol: string) {
    await fetch(`${API}/api/watchlist/${itemId}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== itemId));
    setQuotes(prev => { const n = { ...prev }; delete n[symbol]; return n; });
    setSparklines(prev => { const n = { ...prev }; delete n[symbol]; return n; });
    setEarnings(prev => { const n = { ...prev }; delete n[symbol]; return n; });
  }

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("user_id");
    router.push("/login");
  }

  const headers = ["Symbol", "Price", "Change", "1mo Trend", "Next Earnings", ""];

  return (
    <>
      <div className="blob"></div>

      <nav className="navbar">
        <span className="navbar-brand">FinVinTech</span>
        <div className="navbar-user">
          <Link href="/" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}>Dashboard</Link>
          <span style={{ color: "#4b5563" }}>|</span>
          <Link href="/profile" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem" }}>Profile</Link>
          <span style={{ color: "#4b5563" }}>|</span>
          <span>👤 {username}</span>
          <button id="logout-btn" className="btn-logout" onClick={handleLogout}>Log Out</button>
        </div>
      </nav>

      <main>
        <div className="hero">
          <h1 className="title">Watchlist</h1>
          <p className="subtitle">Live quotes, sparklines & earnings dates</p>
        </div>

        {/* Add symbol form */}
        <div ref={searchRef} className="glass-card" style={{ maxWidth: "900px", marginBottom: "2rem", position: "relative" }}>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.75rem" }}>
            <input
              id="add-symbol-input"
              type="text"
              placeholder="Add ticker (e.g. NVDA)"
              value={newSymbol}
              onChange={(e) => handleSymbolInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              style={{ flex: 1 }}
            />
            <button
              id="add-symbol-btn"
              type="submit"
              className="btn-primary"
              style={{ width: "auto", padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
              disabled={adding}
            >
              {adding ? "Adding..." : "+ Add"}
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

          {addError && <div className="error-msg" style={{ marginTop: "1rem" }}>{addError}</div>}
        </div>

        {/* Watchlist table */}
        <div className="glass-card" style={{ maxWidth: "900px", padding: "0", overflow: "hidden" }}>
          {items.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#4b5563" }}>
              No stocks yet — add your first ticker above!
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                  {headers.map((h) => (
                    <th key={h} style={{
                      padding: "1rem 1.25rem",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const q = quotes[item.symbol];
                  const sp = sparklines[item.symbol];
                  const er = earnings[item.symbol];
                  const positive = q ? q.change_pct >= 0 : true;
                  const earningsText = earningsDisplay(er);
                  const isUpcoming = er?.some(r => new Date(r.earnings_date) >= new Date());

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: idx < items.length - 1 ? "1px solid var(--card-border)" : "none",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "1rem 1.25rem", fontWeight: 700, fontSize: "1rem" }}>
                        {item.symbol}
                      </td>
                      <td style={{ padding: "1rem 1.25rem", color: positive ? "var(--success)" : "#ef4444", fontWeight: 600 }}>
                        {q ? q.current_price.toLocaleString("en-US", { style: "currency", currency: q.currency }) : "—"}
                      </td>
                      <td style={{ padding: "1rem 1.25rem", color: positive ? "var(--success)" : "#ef4444" }}>
                        {q ? `${positive ? "▲" : "▼"} ${Math.abs(q.change_pct).toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <Sparkline prices={sp ?? []} positive={positive} />
                      </td>
                      <td style={{ padding: "1rem 1.25rem", fontSize: "0.82rem", color: isUpcoming ? "#f59e0b" : "#9ca3af", whiteSpace: "nowrap" }}>
                        {er === undefined
                          ? <span style={{ color: "#4b5563" }}>Loading…</span>
                          : earningsText
                        }
                      </td>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <button
                          id={`remove-${item.symbol}`}
                          onClick={() => handleRemove(item.id, item.symbol)}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#ef4444",
                            borderRadius: "6px",
                            padding: "0.3rem 0.7rem",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}

// Alias so JSX can reference the helper
function earningsDisplay(records: EarningsRecord[] | undefined): string {
  return formatEarningsDate(records);
}
