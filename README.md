<div align="center">

<img src="https://raw.githubusercontent.com/BasilZafar11//Asset-_-Flow/devyash/frontend/public/favicon.png" alt="AssetFlow Logo" width="120" height="120" />

# AssetFlow

### Next-Gen Enterprise Asset & Resource Management Infrastructure

**Multi-tenant workspace architecture, conflict-free bookings, transactional audits, and live operations reports.**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.0-000000?logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://mysql.com)

[Features](#key-features) • [Quick Start](#quick-start) • [Architecture](#-architectural-model-the-workspace-concept) • [Team](#team)

</div>

---

## What is AssetFlow?

AssetFlow transitions organizations away from fragile tracking spreadsheets and paper logs into a centralized dashboard. It operates as a high-performance, multi-tenant workspace platform featuring secure data isolation, resource conflict validation, 6-phase compliance audit lifecycles, and realtime operations analytics.

### Key Features

- **Multi-Tenant Workspaces** - Google Cloud Console / Slack-style independent workspaces sharing a single global credential.
- **Conflict-Free Bookings** - Time overlap detection logic to prevent double-booking of shared resources.
- **Pessimistic State Locks** - Multi-asset checkout secured by database-level `FOR UPDATE` transaction locks.
- **6-Phase Auditing** - Comprehensive compliance lifecycle from setup through execution and discrepancy resolution.
- **Realtime Analytics** - Operational utilization rates, maintenance frequencies, and department ratios driven by direct SQL aggregate queries.
- **Exports & Docs** - Instant CSV reports downloads and interactive API exploration with integrated Swagger UI.

---

## Quick Start

### Prerequisites

Make sure you have these installed:

```bash
node -v    # v18 or higher
npm -v     # v9 or higher
mysql --version  # MySQL 8.0+
```

### 1. Clone the Repository

```bash
git clone https://github.com/BasilZafar11/Asset-_-Flow.git
cd Asset-_-Flow
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Configure your `.env`:

```env
PORT=3000
DATABASE_URL=mysql://your_user:your_password@localhost:3306/assetflow
JWT_SECRET=your_jwt_secret_key_here
```

Start the backend server:

```bash
npm run dev
```

Backend runs on `http://localhost:3000`

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Start the dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 🏗️ Architectural Model: The Workspace Concept

AssetFlow operates as a unified platform mirroring modern SaaS tenant architecture:

* **Global Accounts:** A user maintains a single global credential identity across the entire platform.
* **Independent Workspaces:** Within an account, users dynamically initialize completely separate Organizations.
* **Isolation Mapping:** Data segregation is strictly maintained at the relational database tier via an `organization_id` context. Global users map to organizations via the `Organization_Members` IAM bridge table, meaning a user can act as an `Admin` in one workspace and a base `Employee` in another.

### Role Permissions Matrix

| Role | Operational Scope & Context Responsibilities |
| :--- | :--- |
| **Org Owner** | Workspace Owner; manages platform tenancy, generates initial invitations, and inherits full Admin rights. |
| **Admin** | Master Data Architect; manages internal Departments, hierarchies, Asset Categories, custom JSON metadata rules, and employee workspace promotion/demotion. |
| **Asset Manager** | Tactical Inventory Control; registers new assets, handles allocations, approves transfers, maintenance requests, returns, condition checks, and resolves audit discrepancies. |
| **Department Head** | Team Resource Governor; views assets allocated to their target department, approves/rejects internal asset re-allocations, and places reservations on behalf of their department. |
| **Employee** | Everyday End-User; views personal asset dashboard tracking, books shared company resources, raises maintenance tickets, and requests return/transfer workflows. |

---

## 🛡️ Key Engineering Solutions & Edge Cases

### 1. The Double-Allocation Logic Trap
**Problem:** Race conditions could allow two managers to concurrently execute checkout actions on the same piece of hardware, causing duplicate active allocations.

**Solution:** State locking with pessimistic `FOR UPDATE` transactions in Sequelize:
```javascript
const asset = await Asset.findOne({
  where: { tag: asset_tag, organization_id },
  transaction,
  lock: transaction.LOCK.UPDATE
});
```

### 2. Calendar Booking Overlap Detection
**Problem:** Simple equality checks fail to detect overlapping schedule intervals for rooms or vehicles.

**Solution:** Time overlap checks block overlapping bookings:
```sql
SELECT * FROM Bookings
WHERE asset_tag = :tag
  AND status != 'Cancelled'
  AND (start_time < :new_end_time AND end_time > :new_start_time);
```

### 3. Department Deactivation Guard
**Problem:** Deactivating a department containing active employee profiles could lead to unassigned users or orphaned reference records.

**Solution:** Validation blocks deactivation if active members are still assigned to the department:
```javascript
const activeMembersCount = await OrganizationMember.count({
  where: { organization_id, department_id, status: 'Active' }
});
if (activeMembersCount > 0) throw new Error('Cannot deactivate department with active members.');
```

---

## 📋 Compliance Audit Lifecycle (6-Phases)

AssetFlow implements a thorough compliance audit workflow:

- **Phase 1 — Audit Creation** - Managers define the target department, set completion windows, assign auditors, and save the Audit Cycle as **Draft**.
- **Phase 2 — Asset Registration** - Auditors define scope by adding asset tags or uploading bulk comma-separated values (CSV). All items begin in **Pending**.
- **Phase 3 — Physical Audit Execution** - Auditors inspect each asset on-site, updating status to `Verified`, `Missing`, or `Damaged`.
- **Phase 4 — Discrepancy Resolution** - Asset managers review items flagged as missing or damaged, choosing to `Confirm` or `Dismiss` the discrepancy.
- **Phase 5 — Audit Closure** - Once no pending items remain, the audit is closed. The database runs transaction-safe state changes: confirmed missing assets become **Lost**, and damaged assets transition to **Under Maintenance**.
- **Phase 6 — Historical Archiving** - The closed audit is frozen as read-only.

---

## 📊 Reports & Analytics Layer

The Reports screen compiles operational insights through live aggregate SQL queries:

1. **Asset Utilization** - Top-used assets (ranked by bookings + allocations) and idle assets (zero activity inside selected window).
2. **Maintenance Frequency** - High-maintenance categories, priority distribution, and status breakdown.
3. **Lifecycle & Retirement** - Identifies assets with frequent breakdowns (due for maintenance) and assets older than 4 years (nearing retirement).
4. **Department Summary** - Active allocations per department and headcount-to-asset ratios.
5. **Booking Heatmap** - Peak booking densities mapped in a 7×12 day-of-week vs hour-of-day grid.

---

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool
- **TailwindCSS v4** - Styling
- **Zustand** - State management
- **React Router v7** - Navigation
- **TanStack Query** - Server state caching

### Backend
- **Node.js + Express** - API server
- **Sequelize ORM** - DB access
- **MySQL** - Database engine
- **Swagger** - API documentation

---

## API Documentation

Once the backend is running, visit:

```
http://localhost:3000/api-docs
```

Interactive Swagger UI with all endpoints documented.

---

## Project Structure

```
Asset-_-Flow/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files (DB, Swagger)
│   │   ├── controllers/    # Route controllers (MVC)
│   │   ├── middleware/     # Auth & Tenant isolation
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # API routes
│   │   └── utils/          # Logger & Notification helpers
│   ├── index.js            # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API config
│   │   ├── components/     # React layouts & elements
│   │   ├── pages/          # View page controllers
│   │   ├── store/          # Zustand global state stores
│   │   └── App.jsx         # App router
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## Team

<div align="center">

| [Mayank Padhi](https://github.com/Diclo-fenac) | [Devyash Rasela](https://github.com/devyashrasela) | [Basil Zafar](https://github.com/BasilZafar11) |
|:---:|:---:|:---:|
| [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mayank-padhi-zia/) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/devyash-rasela/) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/basil-zafar-490b08302/) |

</div>

---

## Contributing

We welcome contributions! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">

### Made with love by ZeroLag

**[Back to Top](#assetflow)**

</div>
