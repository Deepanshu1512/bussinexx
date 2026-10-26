# Bussinex — inventory management

Bussinex currently contains a FastAPI + SQLAlchemy product API and a React/Vite inventory dashboard. The frontend supports listing, searching, filtering, creating, editing, deleting, stock adjustments, and CSV export.

## Requirements

- Python 3.11+ (use the Python version supported by your installed dependencies)
- Node.js 20+ and npm
- PostgreSQL running locally or a reachable PostgreSQL instance

## 1. Configure the backend

From `backend/`, create a `.env` file based on `.env.example` and set a valid SQLAlchemy PostgreSQL URL. If your database password contains URL-reserved characters (including spaces, `@`, `/`, or `:`), URL-encode the password or use a URL builder. Do not commit `.env` or credentials.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API docs: `http://127.0.0.1:8000/docs`.

## 2. Run the frontend

Open a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`. If your API runs elsewhere, update `VITE_API_URL` in `frontend/.env` and restart Vite.

## Current scope and next improvements

- The UI is wired to the existing `/products/` API routes.
- CORS is enabled only for the local Vite origins above. Add your actual deployed frontend origin before deployment.
- The current API has no authentication, roles, pagination, category/supplier support, or transaction/sales endpoints yet. The dashboard's value is calculated as price × current stock; it is an inventory estimate, not revenue.
- Database tables are currently created at app startup. Add migrations before evolving the schema for a production release.
- Add server-side validation and a clear 409 response for duplicate SKUs before the hackathon demo.
