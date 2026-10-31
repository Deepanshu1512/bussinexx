# ⚡ BUSSINEX — Intelligent Business Management SaaS

> *"Your entire business. One intelligent platform."*

Bussinex is an enterprise-grade, AI-powered business management SaaS platform designed for growing businesses and enterprises. It provides real-time financial telemetry, automated inventory deduction, multi-item transactional billing, customer CRM, deep analytics, and **Business Brain AI**—a central intelligence engine grounded in your verified operational database.

---

## 🏛️ Modern Architecture

```
Bussinex SaaS Platform
├── Client Layer (Frontend SPA)
│   ├── React 19 + TypeScript
│   ├── Tailwind CSS v4 (Dark Professional SaaS Theme)
│   ├── Lucide Icons + Custom Glassmorphic Cards
│   ├── Recharts (Financial & Operational Visualizations)
│   ├── JWT Authentication State & Role-Based UI
│   └── Configurable API Client (Production & Development URLs)
│
├── Serverless & API Layer (Backend)
│   ├── Vercel-Compatible Serverless Handler (`api/index.ts` + `vercel.json`)
│   ├── Node.js / Express 5 with ESM & TypeScript
│   ├── JWT Bearer Authentication & Authorization Middleware
│   ├── Strict Multi-Tenant Data Isolation (Tenant-scoped queries)
│   ├── Business Brain AI Service (Server-side Google Gemini + Deterministic Engine)
│   └── Multi-Item Transactional Order Processing
│
└── Database Layer (Persistence)
    ├── Persistent PostgreSQL Engine (Neon / Supabase / AWS RDS / Local Postgres)
    ├── Connection Pooling via `pg.Pool` with SSL Support
    ├── Zero-Setup Local SQLite Dual-Engine Fallback
    └── ACID Transactions with Automated Inventory Decrements
```

---

## 🔐 Security & Multi-Tenancy Architecture

| Security Dimension | Implementation |
| :--- | :--- |
| **Authentication** | Password hashing via `bcryptjs` (salt rounds: 10) and stateless JSON Web Tokens (JWT) signed with `JWT_SECRET`. |
| **Authorization** | Every private endpoint is guarded by `authenticateToken` middleware extracting user identity and role. |
| **Data Isolation** | Multi-tenant schema where all tables (`products`, `orders`, `customers`, `settings`, `brain_conversations`) strictly isolate data by `business_id`. |
| **AI Protection** | Google Gemini API keys are maintained **exclusively on the server**. The client receives only a boolean indicator (`has_custom_api_key`) and masked tokens (`••••••••`). |

---

## 🚀 Deployment to Vercel

Bussinex is configured for instant zero-configuration deployment to **Vercel**:

### 1. Vercel Configuration (`vercel.json`)
The application defines serverless builds for `api/index.ts` and static builds for Vite in `dist/`. All `/api/*` traffic routes automatically to the serverless function.

### 2. Environment Variables in Vercel
Set the following in **Project Settings > Environment Variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@ep-cool-123.neon.tech/bussinex?sslmode=require` |
| `DATABASE_SSL` | Enable SSL for cloud PostgreSQL | `true` |
| `JWT_SECRET` | Secret key for signing session tokens | `your-secure-random-jwt-secret-string` |
| `GEMINI_API_KEY` | Server-side Google Gemini API Key | `AIzaSy...` (Optional; fallback engine active if blank) |
| `AI_MODEL` | Target Gemini Model | `gemini-2.5-flash` |
| `VITE_API_URL` | Client API endpoint | *(Leave empty in Vercel to use relative `/api`)* |

---

## 🏃 Local Development Quickstart

### 1. Install Dependencies
```powershell
npm install
```

### 2. Run in Development Mode (Live Reload)
```powershell
npm run dev
```
* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **API Server:** [http://localhost:5001](http://localhost:5001)

### 3. Demo Credentials
The initial launch automatically provisions a starter business and administrator:
* **Email:** `admin@bussinex.com`
* **Password:** `admin123`

*(Or click "Register Enterprise" to create a fresh, isolated company tenant).*

---

## 🧪 Comprehensive Verification Suite

Run the automated end-to-end security and business test suite:
```powershell
npx tsx server/test-suite.ts
```

Verifies:
1. Server health and serverless architecture
2. Admin login & JWT token issuance
3. Multi-tenant data isolation across different business tenants
4. AI key protection (verifying raw keys are never exposed in responses)
5. Executive dashboard telemetry & financial KPI calculations
6. Inventory CRUD and safety stock auditing
7. Order creation with atomic inventory deductions
8. Business Brain AI grounded inquiries
