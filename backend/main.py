from dotenv import load_dotenv
load_dotenv()

import os
import secrets
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import resend
from pydantic import BaseModel
from typing import Optional, List
from passlib.context import CryptContext
from sqlalchemy import create_engine, text
import requests
import alpha_vantage as av

# ---------- App ----------
app = FastAPI(title="FinVinTech API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Password hashing ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- Resend (email) ----------
resend.api_key = os.getenv("RESEND_API_KEY", "")

# ---------- Sync DB ----------
DATABASE_URL_SYNC = os.getenv("DATABASE_URL", "postgresql+psycopg2://localhost/finvintech")
engine = create_engine(DATABASE_URL_SYNC)

# ---------- Pydantic schemas ----------
class StockInfo(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    currency: str
    summary: str

class StockQuote(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    prev_close: float
    change: float
    change_pct: float
    currency: str
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None
    dividend_yield: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    avg_volume: Optional[int] = None
    sector: Optional[str] = None
    industry: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    username: str
    user_id: int
    is_admin: bool
    message: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

class WatchlistAddRequest(BaseModel):
    user_id: int
    symbol: str

class WatchlistItem(BaseModel):
    id: int
    symbol: str

# ---------- Helpers ----------
def get_user(username: str):
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id, username, hashed_password, is_admin FROM users WHERE username = :u"),
            {"u": username}
        ).fetchone()

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ---------- Auth ----------
@app.get("/api/ping")
def run_ping():
    return {"status": "ok", "message": "Pong!"}

@app.post("/api/register", response_model=LoginResponse)
def register(req: RegisterRequest):
    username = req.username.strip()
    email = req.email.strip().lower()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    existing = get_user(username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    with engine.connect() as conn:
        existing_email = conn.execute(
            text("SELECT id FROM users WHERE email = :e"),
            {"e": email}
        ).fetchone()
        if existing_email:
            raise HTTPException(status_code=409, detail="Email already registered")
        hashed = pwd_context.hash(req.password)
        result = conn.execute(
            text("INSERT INTO users (username, email, hashed_password) VALUES (:u, :e, :p) RETURNING id"),
            {"u": username, "e": email, "p": hashed}
        )
        user_id = result.fetchone().id
        conn.commit()

    # Send welcome email
    if resend.api_key:
        resend.Emails.send({
            "from": "FinVinTech <onboarding@resend.dev>",
            "to": ["vince.mohanna@gmail.com"],
            "subject": f"Welcome to FinVinTech, {username}!",
            "html": f"""
                <h2>Welcome to FinVinTech!</h2>
                <p>Hi {username},</p>
                <p>Your account has been successfully created.</p>
                <p><strong>Username:</strong> {username}</p>
                <p><strong>Email:</strong> {email}</p>
                <p>You can now log in and start tracking your favourite stocks.</p>
                <p>— The FinVinTech Team</p>
            """
        })

    return LoginResponse(success=True, username=username, user_id=user_id, is_admin=False, message="Registration successful")

@app.post("/api/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = get_user(req.username)
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return LoginResponse(success=True, username=user.username, user_id=user.id, is_admin=user.is_admin, message="Login successful")

# ---------- Password reset ----------
RESET_TOKEN_EXPIRY_HOURS = 1
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

@app.post("/api/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT id, username FROM users WHERE email = :e"),
            {"e": email}
        ).fetchone()

        if not user:
            # Don't reveal whether the email exists
            return {"message": "If an account with that email exists, a reset link has been sent."}

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)

        conn.execute(
            text("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (:uid, :t, :exp)"),
            {"uid": user.id, "t": token, "exp": expires_at}
        )
        conn.commit()

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    if resend.api_key:
        resend.Emails.send({
            "from": "FinVinTech <onboarding@resend.dev>",
            "to": ["vince.mohanna@gmail.com"],
            "subject": "Reset your FinVinTech password",
            "html": f"""
                <h2>Password Reset</h2>
                <p>Hi {user.username},</p>
                <p>Click the link below to reset your password. This link expires in {RESET_TOKEN_EXPIRY_HOURS} hour.</p>
                <p><a href="{reset_link}">{reset_link}</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            """
        })

    return {"message": "If an account with that email exists, a reset link has been sent."}

@app.post("/api/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = :t"),
            {"t": req.token}
        ).fetchone()

        if not row:
            raise HTTPException(status_code=400, detail="Invalid reset link")
        if row.used:
            raise HTTPException(status_code=400, detail="This reset link has already been used")
        if datetime.utcnow() > row.expires_at:
            raise HTTPException(status_code=400, detail="This reset link has expired")

        hashed = pwd_context.hash(req.password)
        conn.execute(
            text("UPDATE users SET hashed_password = :p WHERE id = :uid"),
            {"p": hashed, "uid": row.user_id}
        )
        conn.execute(
            text("UPDATE password_reset_tokens SET used = 1 WHERE id = :id"),
            {"id": row.id}
        )

        user = conn.execute(
            text("SELECT username, email FROM users WHERE id = :uid"),
            {"uid": row.user_id}
        ).fetchone()
        conn.commit()

    if resend.api_key and user:
        resend.Emails.send({
            "from": "FinVinTech <onboarding@resend.dev>",
            "to": ["vince.mohanna@gmail.com"],
            "subject": "Your FinVinTech password has been changed",
            "html": f"""
                <h2>Password Changed</h2>
                <p>Hi {user.username},</p>
                <p>Your password has been successfully changed.</p>
                <p>If you did not make this change, please contact us immediately.</p>
                <p>— The FinVinTech Team</p>
            """
        })

    return {"message": "Password reset successful"}

# ---------- Admin endpoints ----------
def require_admin(user_id: int):
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT is_admin FROM users WHERE id = :uid"),
            {"uid": user_id}
        ).fetchone()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

@app.get("/api/admin/users")
def get_all_users(user_id: int):
    require_admin(user_id)
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, username, email, is_admin FROM users ORDER BY id")
        ).fetchall()
    return [{"id": r.id, "username": r.username, "email": r.email, "is_admin": r.is_admin} for r in rows]

@app.delete("/api/admin/users/{target_user_id}")
def delete_user(target_user_id: int, user_id: int):
    require_admin(user_id)
    with engine.connect() as conn:
        target = conn.execute(
            text("SELECT id, is_admin FROM users WHERE id = :uid"),
            {"uid": target_user_id}
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target.is_admin:
            raise HTTPException(status_code=400, detail="Cannot delete an admin user")
        conn.execute(text("DELETE FROM watchlists WHERE user_id = :uid"), {"uid": target_user_id})
        conn.execute(text("DELETE FROM password_reset_tokens WHERE user_id = :uid"), {"uid": target_user_id})
        conn.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": target_user_id})
        conn.commit()
    return {"success": True}

# ---------- Search / autocomplete ----------
@app.get("/api/search")
def search_stocks(q: str):
    if len(q.strip()) < 1:
        return []
    try:
        resp = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 8, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5,
        )
        data = resp.json()
        results = []
        for item in data.get("quotes", []):
            if item.get("quoteType") in ("EQUITY", "ETF", "INDEX"):
                results.append({
                    "symbol": item.get("symbol"),
                    "name": item.get("shortname") or item.get("longname", ""),
                    "type": item.get("quoteType"),
                    "exchange": item.get("exchDisp", ""),
                })
        return results
    except Exception:
        return []

# ---------- Stock endpoints ----------
@app.get("/api/stock/{symbol}", response_model=StockInfo)
def get_stock_info(symbol: str):
    try:
        info = yf.Ticker(symbol).info
        if not info or 'shortName' not in info:
            raise HTTPException(status_code=404, detail="Stock not found")
        return StockInfo(
            symbol=symbol.upper(),
            company_name=info.get("shortName", "Unknown"),
            current_price=info.get("currentPrice", info.get("regularMarketPrice", 0.0)),
            currency=info.get("currency", "USD"),
            summary=info.get("longBusinessSummary", "No summary available.")[:250] + "..."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/quote", response_model=StockQuote)
def get_stock_quote(symbol: str):
    """Returns price + previous close for % change calculation."""
    try:
        info = yf.Ticker(symbol).info
        if not info or 'shortName' not in info:
            raise HTTPException(status_code=404, detail="Stock not found")
        current = info.get("currentPrice", info.get("regularMarketPrice", 0.0))
        prev = info.get("previousClose", current)
        change = current - prev
        change_pct = (change / prev * 100) if prev else 0.0
        div_yield = info.get("trailingAnnualDividendYield")
        return StockQuote(
            symbol=symbol.upper(),
            company_name=info.get("shortName", "Unknown"),
            current_price=current,
            prev_close=prev,
            change=change,
            change_pct=change_pct,
            currency=info.get("currency", "USD"),
            market_cap=info.get("marketCap"),
            pe_ratio=info.get("trailingPE"),
            eps=info.get("trailingEps"),
            dividend_yield=round(div_yield * 100, 2) if div_yield else None,
            week_52_high=info.get("fiftyTwoWeekHigh"),
            week_52_low=info.get("fiftyTwoWeekLow"),
            avg_volume=info.get("averageVolume"),
            sector=info.get("sector"),
            industry=info.get("industry"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/history")
def get_stock_history(symbol: str, period: str = "1mo"):
    try:
        history = yf.Ticker(symbol).history(period=period)
        if history.empty:
            raise HTTPException(status_code=404, detail="History not found")
        dates = history.index.strftime('%Y-%m-%d').tolist()
        closes = history['Close'].tolist()
        return {"symbol": symbol.upper(), "dates": dates, "prices": closes}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Watchlist endpoints ----------
@app.get("/api/watchlist/{user_id}", response_model=List[WatchlistItem])
def get_watchlist(user_id: int):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, symbol FROM watchlists WHERE user_id = :uid ORDER BY id"),
            {"uid": user_id}
        ).fetchall()
    return [WatchlistItem(id=r.id, symbol=r.symbol) for r in rows]

@app.post("/api/watchlist", response_model=WatchlistItem)
def add_to_watchlist(req: WatchlistAddRequest):
    symbol = req.symbol.upper().strip()
    with engine.connect() as conn:
        # Prevent duplicates
        existing = conn.execute(
            text("SELECT id FROM watchlists WHERE user_id = :uid AND symbol = :s"),
            {"uid": req.user_id, "s": symbol}
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"{symbol} already in watchlist")
        result = conn.execute(
            text("INSERT INTO watchlists (user_id, symbol) VALUES (:uid, :s) RETURNING id"),
            {"uid": req.user_id, "s": symbol}
        )
        new_id = result.fetchone().id
        conn.commit()
    return WatchlistItem(id=new_id, symbol=symbol)

@app.delete("/api/watchlist/{item_id}")
def remove_from_watchlist(item_id: int):
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM watchlists WHERE id = :id"),
            {"id": item_id}
        )
        conn.commit()
    return {"success": True}

# ---------- Alpha Vantage enriched endpoints ----------

@app.get("/api/stock/{symbol}/fundamentals")
def get_stock_fundamentals(symbol: str):
    """
    Returns cached company fundamentals from Alpha Vantage.
    Cache TTL: 24 hours. Falls back to stale or None gracefully.
    """
    data = av.get_fundamentals(symbol)
    if not data:
        raise HTTPException(status_code=404, detail="Fundamentals not available")
    return data

@app.get("/api/stock/{symbol}/earnings")
def get_stock_earnings(symbol: str):
    """
    Returns upcoming and past earnings dates from yfinance.
    """
    import pandas as pd
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.earnings_dates
        if df is None or df.empty:
            return []
        records = []
        for date_idx, row in df.iterrows():
            est = row.get("EPS Estimate")
            rep = row.get("Reported EPS")
            records.append({
                "earnings_date": date_idx.strftime("%Y-%m-%d"),
                "estimated_eps": None if pd.isna(est) else round(float(est), 2),
                "reported_eps": None if pd.isna(rep) else round(float(rep), 2),
            })
        return records
    except Exception:
        return []
