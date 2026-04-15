This Project is a FinTech application used to genereate signals for investing in Financial Markets.
A Good Starting Point
If you're ready to get your hands dirty, I recommend starting with:
	1	Frontend: Next.js (built on Node.js).
	2	Backend: FastAPI (Python).
	3	Data: A free API key from Alpha Vantage

  Walkthrough: A Good Starting Point Setup
We've successfully set up both the backend API and the frontend client for the "A Good Starting Point" project.

Changes Made
Backend (FastAPI): Created a backend directory with requirements.txt and main.py. The backend hosts a yfinance API proxy serving Apple (AAPL) data.
Frontend (Next.js): Created a clean frontend directory using Next.js. We implemented Vanilla CSS with a globals.css matching a premium "Wow" aesthetic (dark mode, glassmorphism card, glowing background blob, data visualization), avoiding Tailwind as requested.
Integration: The Next.js client component (page.tsx) queries http://127.0.0.1:8000/api/stock/AAPL and dynamically renders the financial response with animations.
Next Steps
You can verify the deployment by running both servers side-by-side using two separate terminal instances.

1. Run the Backend API:

bash
cd backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
2. Run the Frontend App:

bash
cd frontend
npm run dev
Then visit http://localhost:3000 in your browser! You'll see the stylish frontend retrieving data securely from the FastAPI backend. You can now tweak main.py to query different tickers, add interactive charts, and expand the project!
