# WhooPaid — Project Tasks & Progress

---

## Development Rules

> **These rules are non-negotiable. Follow them for every task, every feature, every bug fix.**

### Planning & Verification
1. Before writing any code, read the codebase and understand what exists
2. Write your task plan in this file as a checklist before starting work
3. **Stop and check in with the project owner before beginning work** — get plan approval first
4. Work through tasks one at a time, marking each complete as you go
5. After each task, provide a brief high-level explanation of what changed

### Code Standards
6. **Simplicity is the highest priority.** Every change must be as small and simple as possible
7. Each change should impact as little code as possible — touch only what is necessary
8. The goal is zero introduced bugs. Achieve this through simplicity, not cleverness
9. If there is a bug, find the root cause and fix it properly. No temporary fixes. No workarounds. No band-aids
10. **You are a senior developer. Never take shortcuts. Never be lazy. Do it right or don't do it.**
11. Prefer readable code over clever code. Anyone should understand a function in 10 seconds
12. Small, focused changes. One logical change at a time

### Architecture
13. Build incrementally — verify each piece works before moving to the next
14. Start with the data model and API, then build the UI on top
15. Every feature must work on mobile Chrome first, desktop second
16. Keep dependencies low. Don't add a library for something you can write in 20 lines
17. All financial calculations must be deterministic and testable

---

## Phase 1: Project Setup & Infrastructure ✅

- [x] Provision fresh Ubuntu 24.04 server (owner handles this)
- [x] Install Docker and Docker Compose
- [x] Create project directory structure
- [x] Initialize Node.js project with TypeScript
- [x] Set up Docker Compose (app, postgres, nginx)
- [x] Configure environment variables
- [x] Set up Prisma ORM with PostgreSQL connection
- [x] Verify database connection and basic health check endpoint
- [x] Set up DNS for app.whoopaid.com (owner handles this)
- [x] Configure nginx reverse proxy with SSL (Let's Encrypt)

## Phase 2: Database & Authentication ✅

- [x] Create Prisma schema (all tables from build plan Section 5)
- [x] Run initial migration
- [x] Build auth routes: register, login, logout
- [x] Implement JWT with httpOnly cookies
- [x] Build auth middleware (household scoping on every request)
- [x] Build household invite system (create invite, accept invite)
- [x] Implement rate limiting on auth routes
- [x] Test: user registration creates household
- [x] Test: invited user joins existing household
- [x] Test: users cannot access other households' data

## Phase 3: Core API — Cards & Payments ✅

- [x] Build card CRUD endpoints (create, read, update, deactivate)
- [x] Ensure all card queries are scoped to household_id
- [x] Build balance snapshot auto-creation on card balance update
- [x] Build payment recording endpoint
- [x] Auto-split payment into minimum + extra portions
- [x] Build payment history endpoint with filters (card, user, date range)
- [x] Build monthly payment summary endpoint
- [x] Test: card operations respect household isolation
- [x] Test: payment recording creates correct records

## Phase 4: Payoff Engine ✅

- [x] Implement avalanche sorting (highest APR first)
- [x] Implement snowball sorting (lowest balance first)
- [x] Build monthly allocation algorithm (extra budget distribution)
- [x] Implement debt cascade (freed minimums roll to next card)
- [x] Build payoff timeline projection (month-by-month forecast)
- [x] Calculate total interest cost under current plan
- [x] Build "this month's budget override" feature
- [x] Build payment suggestion endpoint
- [x] Build "what if" simulation endpoint (does not save data)
- [x] Test: avalanche vs snowball produce different allocations
- [x] Test: cascade correctly frees minimum payments
- [x] Test: simulation does not modify database
- [x] Test: budget override recalculates suggestions correctly

## Phase 5: Credit Utilization

- [ ] Build utilization calculation (per-card, per-user, household)
- [ ] Build milestone calculator (dollars to reach 50%, 30%, 10%)
- [ ] Build historical utilization from balance snapshots
- [ ] Build utilization API endpoints
- [ ] Test: utilization math is accurate across all levels

## Phase 6: Frontend — Foundation

- [ ] Set up React with TypeScript and Vite
- [ ] Configure Tailwind CSS (mobile-first)
- [ ] Build app shell with bottom tab navigation (mobile)
- [ ] Build login and registration pages
- [ ] Build invite acceptance page
- [ ] Implement JWT cookie auth in frontend
- [ ] Build protected route wrapper
- [ ] Test: login flow works end-to-end
- [ ] Test: unauthenticated users redirected to login

## Phase 7: Frontend — Dashboard & Cards

- [ ] Build dashboard with household summary card
- [ ] Build user breakdown (Steven vs Kimberly totals)
- [ ] Build "this month's payment plan" display
- [ ] Build utilization progress bar with milestone markers
- [ ] Build cards list view (grouped by user)
- [ ] Build card detail view
- [ ] Build add/edit card forms
- [ ] Build card deactivation flow
- [ ] Test: dashboard reflects accurate data
- [ ] Test: card CRUD works from UI

## Phase 8: Frontend — Payments & Payoff

- [ ] Build payment log form (card select, amount, type, notes)
- [ ] Build auto-split display (minimum vs extra)
- [ ] Build payment history list with filters
- [ ] Build ahead/behind indicator
- [ ] Build payoff plan screen with strategy toggle
- [ ] Build "this month's budget" override input on payoff screen
- [ ] Build payment suggestion cards (which card, how much)
- [ ] Build payoff timeline chart (Recharts)
- [ ] Build interest cost display
- [ ] Build snowflake quick-add modal
- [ ] Test: payment recording works from UI
- [ ] Test: strategy toggle updates suggestions
- [ ] Test: budget override updates suggestions in real-time

## Phase 9: Frontend — Utilization & Simulator

- [ ] Build utilization tracker screen
- [ ] Build utilization history chart
- [ ] Build milestone progress display
- [ ] Build "what if" simulator screen
- [ ] Build comparison view (current plan vs simulated)
- [ ] Test: simulator does not affect real data

## Phase 10: Frontend — Settings & Household

- [ ] Build settings screen (budget, strategy)
- [ ] Build profile management (name, email, password change)
- [ ] Build household member list
- [ ] Build invite flow from settings
- [ ] Build CSV export
- [ ] Test: settings changes reflect across app

## Phase 11: Production Readiness

- [ ] Security audit: verify household isolation on all endpoints
- [ ] Set up automated daily PostgreSQL backups via cron
- [ ] Configure production environment variables
- [ ] Build production Docker images
- [ ] Deploy to Hetzner VPS
- [ ] Verify SSL and HTTPS redirect
- [ ] Create Steven's account and household
- [ ] Invite Kimberly
- [ ] Enter real card data
- [ ] Smoke test all features on mobile Chrome
- [ ] Smoke test all features on desktop Chrome

---

## Review

### Phase 1 Review
Infrastructure stood up: Docker Compose with PostgreSQL 16, Node.js app (tsx watch for hot reload), and Nginx reverse proxy. Express entry point with /health endpoint. Bootstrap 5 placeholder page.

### Phase 2 Review
Full Prisma schema with 6 tables (households, users, cards, payments, balance_snapshots, household_invites) and 4 enums. Auth routes with registration (creates household + owner), login, logout, invite/accept. JWT in httpOnly cookies (7-day expiry). requireAuth and requireOwner middleware. Rate limiting (5/15min) on auth routes. All tested via curl.

### Phase 3 Review
Created src/routes/cards.ts (5 endpoints) and src/routes/payments.ts (3 endpoints). Card CRUD with full validation, household-scoped queries, and automatic balance snapshot creation on card create and balance update (using Prisma transactions). Payment recording with auto-split logic: snowflake (all extra), autopay_minimum (all minimum), extra/full_payoff (split at card's minimum payment). Payment history with filters (cardId, userId, date range). Monthly payment summary with aggregation by card and by user. All endpoints tested including household isolation (second household cannot see first household's data) and validation error cases.

### Phase 4 Review
Created src/utils/payoffEngine.ts (pure calculation engine, no Prisma/Express dependency) and src/routes/payoff.ts (3 endpoints). The engine implements avalanche sorting (highest APR first, ties by lowest balance) and snowball sorting (lowest balance first, ties by highest APR). Core calculatePayoffPlan function runs a month-by-month simulation capped at 360 months: applies interest, deducts minimums, allocates extra budget by strategy priority, and cascades freed minimums when cards are paid off. GET /api/payoff/plan returns payment instructions and summary (supports ?budget= override without modifying saved settings). GET /api/payoff/timeline returns full month-by-month projection for charts. POST /api/payoff/simulate runs what-if comparisons (oneTimePayment, budgetChange, strategy) without modifying the database. All monetary calculations use Number() with roundCents() rounding, consistent with existing codebase. All 4 test scenarios verified via curl: avalanche vs snowball produce different allocations, cascade correctly frees minimums, simulation is read-only, budget override is temporary.

---

## Change Log

| Date | Phase | Summary |
|------|-------|---------|
| 2026-02-09 | Phase 1 | Project infrastructure, Docker, Express, health check |
| 2026-02-09 | Phase 2 | Prisma schema, auth routes, JWT, middleware, invite system |
| 2026-02-10 | Phase 3 | Card CRUD (5 endpoints), Payment API (3 endpoints), auto-split, balance snapshots |
| 2026-02-10 | Phase 4 | Payoff engine (3 endpoints), avalanche/snowball sorting, debt cascade, timeline projection, what-if simulation |

