# FinVinTech Architecture

## Tech Stack

### Frontend

| Layer | What it is | Role in this project |
|-------|-----------|---------------------|
| **Node.js** | JavaScript runtime | The engine that runs everything |
| **React** | UI library | The components we write (buttons, forms, pages) |
| **Next.js** | Framework built on React | Routing, server-side rendering, builds, dev server |

Next.js is the car, React is the steering wheel and dashboard, Node.js is the engine under the hood.

### Backend

| Layer | What it is | Role in this project |
|-------|-----------|---------------------|
| **Python** | Programming language | The language the backend is written in |
| **FastAPI** | Web framework | API endpoints, request validation, middleware |
| **SQLAlchemy** | ORM / database toolkit | Database queries and connection management |
| **Alembic** | Migration tool | Version-controlled database schema changes |
| **yfinance** | Market data library | Real-time stock quotes and price history |
| **Alpha Vantage** | Market data API | Fundamentals and earnings data (cached in DB) |

### Database

| Layer | What it is | Role in this project |
|-------|-----------|---------------------|
| **PostgreSQL** | Relational database | Stores users, watchlists, cached market data |

### Infrastructure

| Layer | What it is | Role in this project |
|-------|-----------|---------------------|
| **Docker** | Containerisation | Packages backend, frontend, and database into containers |
| **Docker Compose** | Multi-container orchestration | Runs all three containers together locally |

## Project Structure

```
finvintech/
  backend/          # FastAPI (Python)
    main.py         # API endpoints
    models.py       # SQLAlchemy models
    database.py     # DB connection
    alpha_vantage.py # AV cache layer
    seed.py         # Admin user seed script
    alembic/        # Database migrations
    Dockerfile
  frontend/         # Next.js (React + Node.js)
    src/app/        # Pages (login, register, watchlist, profile)
    Dockerfile
  docs/             # Project documentation
  docker-compose.yml
```
