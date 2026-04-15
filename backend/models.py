from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False, default="")
    is_admin = Column(Boolean, default=False, nullable=False)

    watchlists = relationship("Watchlist", back_populates="user")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)

    user = relationship("User")

class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)

    user = relationship("User", back_populates="watchlists")

class StockPrice(Base):
    """Daily OHLCV history — populated by Alpha Vantage."""
    __tablename__ = "stock_prices"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    date = Column(Date, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)

class EarningsDate(Base):
    """Earnings calendar — cached from Alpha Vantage."""
    __tablename__ = "earnings_dates"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    earnings_date = Column(Date, nullable=False)
    estimated_eps = Column(Float, nullable=True)
    reported_eps = Column(Float, nullable=True)
    last_fetched_at = Column(DateTime, nullable=True)

class StockFundamentals(Base):
    """Company overview fundamentals — cached from Alpha Vantage.
    One row per symbol. Updated at most once per day."""
    __tablename__ = "stock_fundamentals"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    company_name = Column(String, nullable=True)
    sector = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    market_cap = Column(Float, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    week_52_high = Column(Float, nullable=True)
    week_52_low = Column(Float, nullable=True)
    description = Column(String, nullable=True)
    last_fetched_at = Column(DateTime, nullable=True)
