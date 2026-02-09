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

## Phase 1: Project Setup & Infrastructure

- [ ] Provision fresh Ubuntu 24.04 server (owner handles this)
- [ ] Install Docker and Docker Compose
- [ ] Create project directory structure
- [ ] Initialize Node.js project with TypeScript
- [ ] Set up Docker Compose (app, postgres, nginx)
- [ ] Configure environment variables
- [ ] Set up Prisma ORM with PostgreSQL connection
- [ ] Verify database connection and basic health check endpoint
- [ ] Set up DNS for app.whoopaid.com (owner handles this)
- [ ] Configure nginx reverse proxy with SSL (Let's Encrypt)

## Phase 2: Database & Authentication

- [ ] Create Prisma schema (all tables from build plan Section 5)
- [ ] Run initial migration
- [ ] Build auth routes: register, login, logout
- [ ] Implement JWT with httpOnly cookies
- [ ] Build auth middleware (household scoping on every request)
- [ ] Build household invite system (create invite, accept invite)
- [ ] Implement rate limiting on auth routes
- [ ] Test: user registration creates household
- [ ] Test: invited user joins existing household
- [ ] Test: users cannot access other households' data

## Phase 3: Core API — Cards & Payments

- [ ] Build card CRUD endpoints (create, read, update, deactivate)
- [ ] Ensure all card queries are scoped to household_id
- [ ] Build balance snapshot auto-creation on card balance update
- [ ] Build payment recording endpoint
- [ ] Auto-split payment into minimum + extra portions
- [ ] Build payment history endpoint with filters (card, user, date range)
- [ ] Build monthly payment summary endpoint
- [ ] Test: card operations respect household isolation
- [ ] Test: payment recording creates correct records

## Phase 4: Payoff Engine

- [ ] Implement avalanche sorting (highest APR first)
- [ ] Implement snowball sorting (lowest balance first)
- [ ] Build monthly allocation algorithm (extra budget distribution)
- [ ] Implement debt cascade (freed minimums roll to next card)
- [ ] Build payoff timeline projection (month-by-month forecast)
- [ ] Calculate total interest cost under current plan
- [ ] Build "this month's budget override" feature
- [ ] Build payment suggestion endpoint
- [ ] Build "what if" simulation endpoint (does not save data)
- [ ] Test: avalanche vs snowball produce different allocations
- [ ] Test: cascade correctly frees minimum payments
- [ ] Test: simulation does not modify database
- [ ] Test: budget override recalculates suggestions correctly

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

*This section will be updated after each phase is complete with a summary of changes made, decisions taken, and any issues encountered.*

---

## Change Log

| Date | Phase | Summary |
|------|-------|---------|
| | | |

