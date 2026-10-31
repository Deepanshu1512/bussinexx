# ⚡ BUSSINEX — Intelligent Business Management SaaS

> *"Your entire business. One intelligent platform."*

Bussinex is an autonomous, AI-powered business management platform designed for growing enterprises and small-to-medium businesses. It does not merely store business records—it continuously analyzes operational telemetry, tracks unit economics, flags supply chain risks, and provides contextual executive intelligence.

---

## 🏛️ System Architecture

```
Bussinex SaaS Platform
├── Frontend (Client Layer)
│   ├── React 19 + TypeScript (SPA)
│   ├── Tailwind CSS v4 (Dark Professional SaaS Theme)
│   ├── Recharts (High-precision Financial & Inventory Visualizations)
│   ├── Lucide Icons + Custom Glassmorphic Surfaces
│   └── Vite 8 (Sub-millisecond HMR & Production Bundler)
│
├── Backend (API & Intelligence Layer)
│   ├── Node.js 25 + Express 5 (TypeScript / ESM)
│   ├── Business Brain AI Service (Gemini API + Deterministic Fallback)
│   ├── Controlled Database Query Engine (Strictly Anti-Hallucination)
│   ├── Inventory Audit & Stock Movement Engine
│   └── Multi-Item Transactional Order Service
│
└── Database (Persistence Layer)
    ├── SQLite Engine via Node 25 Native DatabaseSync
    ├── Write-Ahead Logging (WAL) Mode
    ├── Foreign Key Cascades & ACID Transaction Safety
    └── File-based Persistence (`./data/bussinex.db`)
```

---

## 🌟 Core Modules

### 1. 📊 Executive Dashboard
* **Real-time Financial Telemetry:** Live Gross Revenue, Cost of Goods Sold (COGS), Net Profit, and Gross Margin %.
* **Operational Velocity:** Total completed orders, Average Order Value (AOV), and active customer counts.
* **14-Day Trajectory Area Chart:** Visualizes daily sales volume and cash inflows.
* **Category Yield Analysis:** Breakdown of revenue contributions across catalog departments.
* **Recent Transactions Feed:** Real-time visibility into customer purchases and fulfillment status.

### 2. 📦 Inventory & Catalog Management
* **Comprehensive Product Catalog:** Full CRUD management with SKU tracking, category mapping, cost price, selling price, and descriptions.
* **Automated Stock Threshold Alerts:** Visual alerts when current stock dips below defined safety minimums.
* **Stock Adjustment & Audit Logs:** Every manual stock count change, restock delivery, or audit discrepancy is permanently logged with reasons in `stock_logs`.
* **Asset Valuation:** Tracks total tied-up working capital vs. projected retail inventory yield.

### 3. 🛒 Sales & Transactional Orders
* **Multi-Item Order Creation Wizard:** Add multiple line items with live stock validation.
* **Automatic Financial Computations:** Real-time subtotal, custom discounts, configurable sales tax (8.5%), and grand total calculations.
* **ACID Transaction Safety:** Placing an order executes inside an atomic SQLite transaction. Available inventory is automatically decremented. If any product is out of stock, the transaction cleanly rolls back.
* **Fulfillment Lifecycle:** Transition orders between `Pending`, `Processing`, `Completed`, and `Cancelled` (with automated inventory restoration on cancellations).
* **Itemized Receipt Drawer:** Comprehensive invoice viewer with line items and customer details.

### 4. 👥 Customer Relationship Management (CRM)
* **Client Accounts:** Profiles with contact details, company names, billing addresses, and internal notes.
* **Tier Classification:** Categorize clients into `VIP`, `Wholesale`, `Regular`, and `New`.
* **Lifetime Value (LTV) Tracking:** Calculates cumulative revenue and order frequency per client.
* **Complete Purchase History:** Drill down into any client to inspect all historical invoices.

### 5. 📈 Deep Analytics & Reports
* **Flexible Time Horizon:** Toggle between 7-Day, 30-Day, and 90-Day analytical windows.
* **Profit Contribution Ranking:** Identifies which products yield the highest net cash margin vs. pure unit volume.
* **Account Concentration Risk:** Highlights key client concentration to mitigate churn exposure.
* **One-Click Executive Business Health Report:** Automatically scans the entire database to generate a structured briefing with financial health KPIs, inventory shortage flags, and strategic operational recommendations. Includes a print/export view.

### 6. 🧠 Business Brain AI (Central Intelligence)
* **Central Executive Intelligence:** A conversational business partner grounded in verified database facts.
* **No Fabricated Statistics:** The AI never invents statistics. Every cited number is extracted by controlled server aggregation queries.
* **Hosted LLM Integration:** Powered by Google Gemini (`gemini-2.5-flash`, `gemini-1.5-pro`). Keys are stored securely on the backend in SQLite settings and never exposed in client bundles.
* **Built-in Deterministic Engine Fallback:** Even without an external API key, Bussinex includes a full statistical business analyst engine that performs Economic Order calculations, margin evaluations, dead-stock diagnoses, and risk evaluations out of the box.
* **Persistent Sessions:** Multi-turn consultations are saved to SQLite with full history recall.

### 7. ⚙️ Settings & Database Management
* **Enterprise Profile:** Customize Business Name, Currency Symbol, Tax Rate %, and Headquarters address.
* **AI Configuration:** Manage LLM providers, set API keys, select models, and execute live connection tests.
* **Sample Data Generator:** Populate 18 products, 12 customers, and 32 historical orders with one click.
* **Database Reset Safeguard:** Clear operational tables to test zero-state handling.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v22.5.0 or higher (Tested and certified on Node.js v25.7.0).

### Installation & Launch

1. **Navigate to the Project Root:**
   ```powershell
   cd C:\Users\ravin\OneDrive\Desktop\Bussinex-AGY
   ```

2. **Run in Development Mode (Vite Frontend + Express Backend with live reload):**
   ```powershell
   npm run dev
   ```
   * Frontend: `http://localhost:3000`
   * Backend API: `http://localhost:5001`

3. **Or Run Single-Port Fullstack Production Server:**
   ```powershell
   npm run build
   npm start
   ```
   * Fullstack application served on `http://localhost:5001`

---

## 🧪 Automated Verification Suite

Run the end-to-end integration test suite:
```powershell
npx tsx server/test-suite.ts
```

Verifies:
* Server health and database connection
* Live KPI calculation and margin mathematics
* Product creation and stock audit adjustments
* Atomic order placement with automatic inventory deduction
* Executive Report generation and strategic observations
* Business Brain AI contextual grounded responses across multiple query types
