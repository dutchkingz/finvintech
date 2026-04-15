"""
Seed script: creates the admin user with password admin123.
Run once from the backend directory:
  source venv/bin/activate && python seed.py
"""
from passlib.context import CryptContext
from sqlalchemy import create_engine, text

import os
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://localhost/finvintech")
engine = create_engine(DATABASE_URL)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed = pwd_context.hash("admin123")

with engine.connect() as conn:
    existing = conn.execute(
        text("SELECT id FROM users WHERE username = 'admin'")
    ).fetchone()

    if existing:
        conn.execute(
            text("UPDATE users SET hashed_password = :p, email = :e, is_admin = true WHERE username = 'admin'"),
            {"p": hashed, "e": "vince.mohanna@gmail.com"}
        )
        print("✅ Admin user updated.")
    else:
        conn.execute(
            text("INSERT INTO users (username, email, hashed_password, is_admin) VALUES ('admin', :e, :p, true)"),
            {"e": "vince.mohanna@gmail.com", "p": hashed}
        )
        print("✅ Admin user created.")

    conn.commit()
