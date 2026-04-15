"""
alpha_vantage.py
────────────────
DB-backed cache layer for Alpha Vantage API calls.

Strategy:
  • yfinance  → real-time quotes (unlimited, used on every load)
  • Alpha Vantage → fundamentals + earnings (cached in DB, max 1 call/symbol/day)

The TTL is set to 24 hours by default. Adjust CACHE_TTL_HOURS to change.
"""

import os
import requests
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
BASE_URL = "https://www.alphavantage.co/query"
FUNDAMENTALS_TTL_HOURS = 24    # refresh company overview once a day
EARNINGS_TTL_HOURS = 168       # refresh earnings once a week (7 × 24)

DATABASE_URL_SYNC = os.getenv("DATABASE_URL", "postgresql+psycopg2://localhost/finvintech")
engine = create_engine(DATABASE_URL_SYNC)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def _is_stale(last_fetched_at, ttl_hours: int = FUNDAMENTALS_TTL_HOURS) -> bool:
    """Return True if data is missing or older than the TTL."""
    if last_fetched_at is None:
        return True
    return datetime.utcnow() - last_fetched_at > timedelta(hours=ttl_hours)

def _safe_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

# ─────────────────────────────────────────────
# Fundamentals  (OVERVIEW endpoint)
# ─────────────────────────────────────────────
def get_fundamentals(symbol: str) -> dict | None:
    """
    Cache-first fetch of company fundamentals.
    Returns the DB row as a dict. Calls AV only if stale.
    """
    symbol = symbol.upper()

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM stock_fundamentals WHERE symbol = :s"),
            {"s": symbol}
        ).fetchone()

    # Cache hit — still fresh
    if row and not _is_stale(row.last_fetched_at, FUNDAMENTALS_TTL_HOURS):
        return dict(row._mapping)

    # Cache miss or stale — call Alpha Vantage
    if not API_KEY:
        return dict(row._mapping) if row else None   # no key, return stale or nothing

    resp = requests.get(BASE_URL, params={
        "function": "OVERVIEW",
        "symbol": symbol,
        "apikey": API_KEY,
    }, timeout=10)

    data = resp.json()
    if "Symbol" not in data:
        # AV returned an error (e.g. unknown symbol or rate limit hit)
        return dict(row._mapping) if row else None

    fundamentals = {
        "symbol": symbol,
        "company_name": data.get("Name"),
        "sector": data.get("Sector"),
        "industry": data.get("Industry"),
        "market_cap": _safe_float(data.get("MarketCapitalization")),
        "pe_ratio": _safe_float(data.get("PERatio")),
        "eps": _safe_float(data.get("EPS")),
        "dividend_yield": _safe_float(data.get("DividendYield")),
        "week_52_high": _safe_float(data.get("52WeekHigh")),
        "week_52_low": _safe_float(data.get("52WeekLow")),
        "description": data.get("Description", "")[:500],
        "last_fetched_at": datetime.utcnow(),
    }

    with engine.connect() as conn:
        if row:
            conn.execute(text("""
                UPDATE stock_fundamentals SET
                    company_name=:company_name, sector=:sector, industry=:industry,
                    market_cap=:market_cap, pe_ratio=:pe_ratio, eps=:eps,
                    dividend_yield=:dividend_yield, week_52_high=:week_52_high,
                    week_52_low=:week_52_low, description=:description,
                    last_fetched_at=:last_fetched_at
                WHERE symbol=:symbol
            """), fundamentals)
        else:
            conn.execute(text("""
                INSERT INTO stock_fundamentals
                    (symbol, company_name, sector, industry, market_cap, pe_ratio, eps,
                     dividend_yield, week_52_high, week_52_low, description, last_fetched_at)
                VALUES
                    (:symbol, :company_name, :sector, :industry, :market_cap, :pe_ratio, :eps,
                     :dividend_yield, :week_52_high, :week_52_low, :description, :last_fetched_at)
            """), fundamentals)
        conn.commit()

    return fundamentals

# ─────────────────────────────────────────────
# Earnings  (EARNINGS endpoint)
# ─────────────────────────────────────────────
def get_earnings(symbol: str) -> list[dict] | None:
    """
    Cache-first fetch of earnings dates (annual + quarterly).
    Calls AV only if no rows exist for this symbol or data is stale.
    """
    symbol = symbol.upper()

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM earnings_dates WHERE symbol = :s ORDER BY earnings_date DESC"),
            {"s": symbol}
        ).fetchall()

    # Check freshness on the first row
    if rows and not _is_stale(rows[0].last_fetched_at, EARNINGS_TTL_HOURS):
        return [dict(r._mapping) for r in rows]

    if not API_KEY:
        return [dict(r._mapping) for r in rows] if rows else None

    resp = requests.get(BASE_URL, params={
        "function": "EARNINGS",
        "symbol": symbol,
        "apikey": API_KEY,
    }, timeout=10)

    data = resp.json()
    quarterly = data.get("quarterlyEarnings", [])
    if not quarterly:
        return [dict(r._mapping) for r in rows] if rows else []

    now = datetime.utcnow()
    records = []
    for item in quarterly[:8]:  # last 8 quarters
        try:
            records.append({
                "symbol": symbol,
                "earnings_date": item.get("fiscalDateEnding"),
                "estimated_eps": _safe_float(item.get("estimatedEPS")),
                "reported_eps": _safe_float(item.get("reportedEPS")),
                "last_fetched_at": now,
            })
        except Exception:
            continue

    with engine.connect() as conn:
        # Delete old rows for this symbol, insert fresh ones
        conn.execute(text("DELETE FROM earnings_dates WHERE symbol = :s"), {"s": symbol})
        for r in records:
            conn.execute(text("""
                INSERT INTO earnings_dates (symbol, earnings_date, estimated_eps, reported_eps, last_fetched_at)
                VALUES (:symbol, :earnings_date, :estimated_eps, :reported_eps, :last_fetched_at)
            """), r)
        conn.commit()

    return records
