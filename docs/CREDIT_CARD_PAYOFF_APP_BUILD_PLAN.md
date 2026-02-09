# WhooPaid — Credit Card Payoff Tracker
## Project Build Plan v1.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Guidelines](#2-development-guidelines)
3. [Tech Stack](#3-tech-stack)
4. [Data Architecture](#4-data-architecture)
5. [Database Schema](#5-database-schema)
6. [Authentication & Multi-Tenancy](#6-authentication--multi-tenancy)
7. [Core Features — v1](#7-core-features--v1)
8. [Payoff Engine Logic](#8-payoff-engine-logic)
9. [API Endpoint Design](#9-api-endpoint-design)
10. [UI/UX Screens](#10-uiux-screens)
11. [Local Development Environment](#11-local-development-environment)
12. [Production Deployment](#12-production-deployment)
13. [v2 Roadmap](#13-v2-roadmap)

---

## 1. Project Overview

### What We're Building
A multi-tenant, mobile-responsive web application that helps couples and individuals pay off credit card debt as fast as possible. The app tracks balances, calculates optimal payment strategies (avalanche and snowball), and tells users exactly which card to pay and how much — factoring in that minimum payments are already handled by autopay.

### Primary Users (v1)
- **Household 1:** Steven & Kimberly (couple)
- **Household 2:** Friend couple #1
- **Household 3:** Friend couple #2
- **Household 4:** Friend (single user)

### Core Problem Solved
"I have $X extra dollars this month beyond my autopay minimums. Which card(s) do I send money to, and how much to each?"

### Key Goals
- Reduce credit utilization from 88% to below 30%
- Provide clear, actionable payment instructions each month
- Track whether actual payments are ahead or behind the payoff plan
- Keep each household's financial data completely isolated from others

---

## 2. Development Guidelines

These rules govern how the application should be built. Follow them strictly throughout the entire development process.

### Planning & Verification Workflow
1. Before writing any code, read the codebase and write a task plan to `tasks/todo.md`
2. The plan must contain a checklist of discrete todo items that can be marked complete
3. **Stop and check in with me before beginning work.** I will verify the plan before any code is written
4. Work through todo items one at a time, marking each complete as you go
5. Provide a brief, high-level explanation of what changed after each task
6. After all tasks are complete, add a review section to `tasks/todo.md` summarizing all changes

### Code Quality Standards
- **Simplicity is the highest priority.** Every change should be as small and simple as possible
- Each change should impact as little code as possible — touch only what is necessary for the task
- The goal is zero introduced bugs. Achieve this through simplicity, not cleverness
- If there is a bug, find the root cause and fix it properly. No temporary fixes, no workarounds, no band-aids
- You are a senior developer. Never take shortcuts. Never be lazy. Do it right or don't do it
- Prefer readable code over clever code. Someone should understand what a function does in 10 seconds
- Small, focused commits. One logical change per commit

### Architecture Principles
- Build incrementally — verify each piece works before moving to the next
- Start with the data model and API, then build the UI on top
- Every feature should work on mobile Chrome first, desktop second
- Keep the dependency count low. Don't add a library for something you can write in 20 lines
- All financial calculations must be deterministic and testable

---

## 3. Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling (mobile-first responsive design)
- **Recharts** for payoff timeline and utilization charts
- **React Router** for client-side navigation
- **Vite** for build tooling

### Backend
- **Node.js** with **Express.js** and TypeScript
- **Prisma ORM** for database access and migrations
- **bcrypt** for password hashing
- **jsonwebtoken (JWT)** for session management
- **express-rate-limit** for API protection

### Database
- **PostgreSQL 16** — strong data integrity, excellent for financial calculations, ACID-compliant
- Row-level security via application logic (all queries scoped to household_id)

### Infrastructure
- **VPS** (Ubuntu 22.04 or 24.04 LTS, 1-2 GB RAM, 25 GB SSD)
- **Docker + Docker Compose** for containerized deployment
- **Nginx** as reverse proxy with SSL via Let's Encrypt
- **Domain:** app.whoopaid.com

---

## 4. Data Architecture

### Multi-Tenancy Model

```
Household (tenant boundary)
├── User (Steven)
│   ├── Card (Chase Visa)
│   │   └── Payment records
│   ├── Card (Discover)
│   │   └── Payment records
│   └── ...
├── User (Kimberly)
│   ├── Card (Capital One)
│   │   └── Payment records
│   └── ...
└── Household Settings
    ├── Monthly extra payment budget
    ├── Payoff strategy (avalanche/snowball)
    └── Utilization goals
```

### Data Isolation Rules
- Every database query MUST filter by `household_id`
- Users can ONLY see data within their own household
- API middleware enforces household scoping on every request — no exceptions
- There is no admin view that crosses household boundaries in v1
- A user belongs to exactly one household
- Household-level settings (strategy, budget) are shared between household members

---

## 5. Database Schema

### Tables

#### households
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR(100) | e.g., "The Smiths" |
| monthly_extra_budget | DECIMAL(10,2) | Total extra $ available beyond minimums |
| payoff_strategy | ENUM | 'avalanche' or 'snowball' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| household_id | UUID | FK → households.id |
| email | VARCHAR(255) | Unique, used for login |
| password_hash | VARCHAR(255) | bcrypt hashed |
| first_name | VARCHAR(50) | |
| last_name | VARCHAR(50) | |
| role | ENUM | 'owner' or 'member' (owner can invite) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### cards
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users.id (card owner) |
| household_id | UUID | FK → households.id (denormalized for query performance) |
| card_name | VARCHAR(100) | e.g., "Chase Sapphire" |
| issuer | VARCHAR(100) | e.g., "Chase" |
| last_four | VARCHAR(4) | Last 4 digits for identification |
| current_balance | DECIMAL(10,2) | Updated manually by user |
| credit_limit | DECIMAL(10,2) | For utilization calculation |
| apr | DECIMAL(5,3) | Annual percentage rate (e.g., 28.990) |
| minimum_payment | DECIMAL(10,2) | Current minimum payment amount |
| due_day | INTEGER | Day of month payment is due (1-31) |
| autopay_enabled | BOOLEAN | Default true (all cards assumed autopay min) |
| is_active | BOOLEAN | Soft delete — false hides card from views |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### payments
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| card_id | UUID | FK → cards.id |
| household_id | UUID | FK → households.id |
| payment_date | DATE | Date payment was sent |
| amount | DECIMAL(10,2) | Total amount paid |
| minimum_amount | DECIMAL(10,2) | The minimum payment portion |
| extra_amount | DECIMAL(10,2) | Amount above minimum |
| payment_type | ENUM | 'autopay_minimum', 'extra', 'snowflake', 'full_payoff' |
| notes | VARCHAR(255) | Optional (e.g., "tax refund") |
| created_at | TIMESTAMP | |

#### balance_snapshots
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| card_id | UUID | FK → cards.id |
| household_id | UUID | FK → households.id |
| snapshot_date | DATE | Date balance was recorded |
| balance | DECIMAL(10,2) | Balance on that date |
| credit_limit | DECIMAL(10,2) | Limit at time of snapshot |
| created_at | TIMESTAMP | |

*Purpose: Captures balance history over time for trend charts and utilization tracking. A snapshot is created automatically whenever a user updates a card's balance.*

#### household_invites
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| household_id | UUID | FK → households.id |
| email | VARCHAR(255) | Invited user's email |
| invited_by | UUID | FK → users.id |
| token | VARCHAR(255) | Unique invite token |
| status | ENUM | 'pending', 'accepted', 'expired' |
| expires_at | TIMESTAMP | 72 hours from creation |
| created_at | TIMESTAMP | |

### Indexes
- `cards`: compound index on `(household_id, user_id, is_active)`
- `payments`: compound index on `(card_id, payment_date)`
- `balance_snapshots`: compound index on `(household_id, snapshot_date)`
- `users`: unique index on `email`

---

## 6. Authentication & Multi-Tenancy

### Registration Flow
1. First user creates account → automatically creates a new household → assigned role 'owner'
2. Owner invites partner/spouse via email → invite link with token
3. Invited user clicks link → creates account → joins existing household as 'member'
4. Both owner and member have equal access to all household data

### Authentication
- Email + password login
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens stored in httpOnly cookies (not localStorage — security matters with financial data)
- Token expiry: 7 days with refresh rotation
- Rate limiting: 5 login attempts per 15 minutes per IP

### Authorization Middleware
Every API route (except auth routes) must:
1. Validate JWT
2. Extract user_id and household_id from token
3. Inject household_id into every database query
4. Reject any request attempting to access data outside the user's household

```
// Pseudocode for every protected route
const user = verifyJWT(req.cookies.token)
req.householdId = user.householdId  // This scopes ALL queries
req.userId = user.userId
```

---

## 7. Core Features — v1

### 7.1 Dashboard (Home Screen)
**What the user sees when they log in.**

- **Household summary card:** Total debt across all cards, total credit limit, household utilization percentage
- **User breakdown:** Steven's total debt / utilization vs. Kimberly's total debt / utilization
- **This month's action plan:** A clear list showing "Pay $X extra to [Card Name]" for each card that needs an extra payment beyond autopay minimum
- **Progress indicators:** Total debt paid down this month, interest saved vs. minimum-only payments
- **Utilization progress bar:** Visual bar showing current % with milestone markers at 50%, 30%, 10%
- **Days until next due date:** Countdown to the nearest card due date

### 7.2 Cards Management
**View, add, edit, and deactivate credit cards.**

- **Card list view:** Grouped by user (Steven's Cards / Kimberly's Cards)
- **Each card shows:** Name, last four digits, balance, limit, APR, utilization %, minimum payment, due day, autopay status
- **Add card form:** All fields from the cards table
- **Edit card:** Update balance, limit, APR, minimum payment. When balance is updated, automatically create a balance_snapshot record
- **Deactivate card:** Soft delete (is_active = false). Card and its history remain in the database but hidden from active views. Paid-off cards should be deactivated
- **Sort/filter:** By balance (high to low), by APR (high to low), by utilization, by due date

### 7.3 Payment Tracker
**Record payments and see history.**

- **Log a payment:** Select card, enter amount, date, type (extra / snowflake / full payoff), optional note
- **Auto-calculate:** When entering total amount paid, app auto-splits into minimum + extra portions based on card's current minimum payment
- **Payment history:** Filterable list showing all payments by card, by user, by date range
- **Monthly summary:** What was paid across all cards this month vs. what the plan suggested
- **Ahead/behind indicator:** Compare actual payments to the suggested payoff plan. Green = ahead, yellow = on track, red = behind

### 7.4 Payoff Plan & Suggestions
**The brain of the app — tells you exactly what to do.**

- **Strategy toggle:** Switch between avalanche (highest APR first) and snowball (lowest balance first) at the household level
- **"This Month's Budget" override:** An input field at the top of the payoff plan screen that defaults to the household's baseline monthly extra budget from settings. The user can adjust this number for any given month (e.g., bonus month, tight month) WITHOUT changing the baseline setting. When adjusted, all payment suggestions, timeline projections, and interest calculations below it update instantly in real-time. The baseline in settings remains unchanged. This allows the user to answer: "I have an extra $1,200 this month instead of my usual $800 — where does it go?" The override resets to the baseline when the user navigates away or starts a new month.
- **Monthly allocation display:** Given your extra budget of $X (or overridden amount), here's exactly how to distribute it:
  - Card A (autopay covers $min) → pay extra $Y
  - Card B (autopay covers $min) → pay extra $Z
  - Card C (autopay covers $min) → no extra this month
- **Payoff timeline chart:** Line chart showing projected balance for each card over time, with projected zero-balance dates
- **Total interest cost:** How much interest you'll pay under current plan vs. minimum-only payments
- **Recalculates on every balance update, budget change, or monthly budget override**

### 7.5 Credit Utilization Tracker
**Track your path from 88% to under 30%.**

- **Current utilization:** Overall household, per-user, and per-card
- **Utilization formula:** (Total Balances / Total Credit Limits) × 100
- **Milestone markers:** 75%, 50%, 30%, 10% — each milestone noted with its impact on credit scoring
- **Dollars to next milestone:** "Pay down $X more to reach 50% utilization"
- **Historical utilization chart:** Line chart from balance_snapshots showing utilization over time
- **Per-user view:** Steven's utilization vs. Kimberly's utilization vs. household combined

### 7.6 "What If" Simulator
**Model scenarios without affecting your actual data.**

- **Extra payment scenario:** "What if I throw an extra $500 at my cards this month?" → shows new payoff dates and interest savings
- **Lump sum scenario:** "What if I pay $5,000 toward debt right now?" → recalculates everything
- **Budget change scenario:** "What if I increase my monthly extra from $400 to $600?" → shows accelerated timeline
- **Compare view:** Side-by-side of current plan vs. simulated plan
- **Does NOT modify actual card data** — clearly labeled as simulation

### 7.7 Snowflake Payments
**Quick-add for unplanned extra payments.**

- **Quick-add button** accessible from dashboard
- **Enter amount and source** (e.g., "sold old furniture - $200")
- **App suggests allocation:** Based on current strategy, tells you which card(s) to apply it to
- **Records as payment type 'snowflake'**
- **Immediately recalculates payoff timeline**

### 7.8 Settings
**Household and user configuration.**

- **Monthly extra budget:** Amount available beyond all minimum payments combined
- **Payoff strategy:** Avalanche or snowball (with explanation of each)
- **Profile:** Name, email, password change
- **Household management:** Invite new member, view members
- **Data management:** Export data as CSV

---

## 8. Payoff Engine Logic

This is the most critical piece of the application. It must be accurate, testable, and produce results the user can act on immediately.

### Core Algorithm

```
INPUTS:
  - cards[]: array of { balance, apr, minimum_payment, due_day }
  - monthly_extra_budget: total extra dollars available
  - strategy: 'avalanche' | 'snowball'

PROCESS:
  1. All minimums are paid by autopay — do not include them in allocation
  2. Sort cards by strategy:
     - Avalanche: highest APR first (ties broken by lowest balance)
     - Snowball: lowest balance first (ties broken by highest APR)
  3. Allocate extra budget:
     a. Start with top-priority card
     b. If extra budget >= (card balance - minimum payment already covered):
        - Allocate enough to pay off this card completely
        - Remaining extra rolls to next card
     c. If extra budget < remaining balance:
        - Allocate entire remaining extra to this card
        - No more extra for other cards this month
  4. Calculate monthly interest: (balance × APR) / 12
  5. Project forward month-by-month until all balances = 0

OUTPUT:
  - payment_instructions[]: { card_name, extra_amount_to_pay, projected_payoff_date }
  - timeline[]: { month, card_balances[], total_debt, total_interest_paid }
  - total_interest_cost: sum of all interest over the plan
  - months_to_debt_free: total months until $0
```

### Key Calculation Rules
- Interest is calculated on the average daily balance, but for simplicity in v1, we use: `monthly_interest = (balance × apr) / 12`
- When a card is paid off, its minimum payment amount is freed up and added to the extra budget for the next card (the "debt avalanche cascade")
- The engine must handle: cards with $0 balance, cards with balance < minimum payment, mid-month balance updates
- All monetary values stored and calculated as cents (integers) internally, displayed as dollars

### Payment Suggestion Display Format
The dashboard should display suggestions like:

```
📋 This Month's Payment Plan
Your autopay handles all minimums. Here's where to send your extra $800:

1. Chase Visa (28.99% APR) .............. Pay $650 extra
   → Pays off this card! 🎉
   → $150 freed up rolls to next card

2. Discover (24.49% APR) ................ Pay $150 extra
   → Remaining balance after: $1,247.33
   → Projected payoff: March 2026

3. Capital One (19.99% APR) ............. $0 extra this month
   → Autopay minimum covers it
   → Projected payoff: August 2026
```

---

## 9. API Endpoint Design

### Auth Routes (no authentication required)
```
POST   /api/auth/register          Create account + household
POST   /api/auth/login             Login, returns JWT cookie
POST   /api/auth/logout            Clear JWT cookie
POST   /api/auth/invite/accept     Accept household invite
```

### Card Routes (authentication required, household-scoped)
```
GET    /api/cards                  List all cards in household
GET    /api/cards/:id              Get single card details
POST   /api/cards                  Add new card
PUT    /api/cards/:id              Update card (balance, limit, APR, etc.)
PUT    /api/cards/:id/deactivate   Soft delete card
```

### Payment Routes
```
GET    /api/payments               List payments (filterable by card, user, date range)
POST   /api/payments               Record a payment
GET    /api/payments/summary       Monthly summary (actual vs. planned)
```

### Payoff Engine Routes
```
GET    /api/payoff/plan            Get current payoff plan with payment suggestions
GET    /api/payoff/timeline        Get projected timeline data for charts
POST   /api/payoff/simulate        Run "what if" simulation (does not save)
```

### Utilization Routes
```
GET    /api/utilization            Current utilization (household, per-user, per-card)
GET    /api/utilization/history    Historical utilization from snapshots
GET    /api/utilization/milestones Dollars needed to reach each milestone
```

### Household & Settings Routes
```
GET    /api/household              Get household details + settings
PUT    /api/household/settings     Update budget, strategy
POST   /api/household/invite       Send invite to new member
GET    /api/household/members      List household members
```

### User Routes
```
GET    /api/user/profile           Get current user profile
PUT    /api/user/profile           Update name, email
PUT    /api/user/password          Change password
```

---

## 10. UI/UX Screens

### Design Principles
- **Mobile-first:** All layouts designed for 375px width first, then scaled up
- **PWA-capable:** Add to home screen support for app-like experience on mobile Chrome
- **Minimal navigation:** Bottom tab bar on mobile (Dashboard, Cards, Payments, Settings)
- **Color coding:** Green = good/ahead, Yellow = caution/on track, Red = behind/high utilization
- **Dark mode:** Support system preference (nice-to-have for v1, not required)

### Screen List

1. **Login** — Email + password, link to register
2. **Register** — Name, email, password, household name (or invite token)
3. **Dashboard** — Household summary, this month's payment plan, utilization bar, progress
4. **Cards List** — All cards grouped by user, with key stats
5. **Card Detail** — Full card info, payment history for this card, balance trend mini-chart
6. **Add/Edit Card** — Form for card data entry
7. **Payment Log** — Record a new payment (select card, amount, type)
8. **Payment History** — Filterable list of all payments
9. **Payoff Plan** — Strategy toggle, detailed allocation, timeline chart
10. **What-If Simulator** — Input scenarios, see projected impact
11. **Utilization Tracker** — Current stats, milestones, historical chart
12. **Settings** — Budget, strategy, profile, household members, invite
13. **Snowflake Quick-Add** — Modal/drawer for quick unplanned payment entry

---

## 11. Local Development Environment

### Overview
All development and testing happens locally on your machine. The production server (Hetzner VPS) is only touched during final deployment. The Docker Compose configuration runs identically in both environments.

### Prerequisites (your local machine)
- **Docker Desktop** installed and running
- **Node.js 20+** (for running CLI tools, linting, etc.)
- **Git** for version control
- **VS Code** or your preferred editor
- A modern browser (Chrome recommended)

### Local Development Workflow
1. Clone the project repository to your local machine
2. Copy `.env.example` to `.env` and fill in local values
3. Run `docker compose up` — this starts the app, PostgreSQL, and nginx locally
4. Access the app at `http://localhost:3000`
5. Make changes → test locally → verify on mobile using your local IP (e.g., `http://192.168.x.x:3000`)
6. When a feature is complete and tested, commit and push
7. Deploy to production server only when ready

### Environment Parity
The Docker Compose file should use the same images and configuration for both local and production, with only these differences:
- **Local:** No SSL, uses localhost, debug logging enabled
- **Production:** SSL via Let's Encrypt, uses app.whoopaid.com, production logging

### Local Database
PostgreSQL runs in a Docker container locally with a named volume for persistence. Your local database is completely separate from production. You can reset it anytime by removing the volume (`docker compose down -v`).

### Mobile Testing (Local)
To test on your phone during development, ensure your phone is on the same Wi-Fi network as your development machine. Access the app via your machine's local IP address (e.g., `http://192.168.1.100:3000`). This lets you verify mobile responsiveness with real touch interactions.

---

## 12. Production Deployment

### How It Works
The entire project is deployed to the server as a Git repository (or copied via SCP). Docker Compose builds and runs everything on the server the same way it does locally. There is no separate "build folder" — the server clones the repo, runs `docker compose up`, and the app is live.

### Deployment Steps (detailed)
1. Provision and secure VPS (Ubuntu 24.04, Docker installed, firewall configured)
2. SSH into the server
3. Clone the project repository to the server (e.g., `/opt/whoopaid/`)
4. Copy `.env.example` to `.env` and configure production values:
   - Set `DATABASE_URL` with a strong password
   - Generate a random `JWT_SECRET` (64+ characters)
   - Set `NODE_ENV=production`
   - Set `CORS_ORIGIN=https://app.whoopaid.com`
5. Run `docker compose -f docker-compose.prod.yml up -d`
6. Run database migrations: `docker compose exec app npx prisma migrate deploy`
7. Configure SSL with certbot for app.whoopaid.com
8. Verify the app loads at https://app.whoopaid.com
9. Create Steven's account → this creates the household
10. Invite Kimberly via the invite flow

### Docker Compose Files
The project should include two Docker Compose files:
- **`docker-compose.yml`** — Local development (no SSL, debug mode, localhost)
- **`docker-compose.prod.yml`** — Production (SSL via nginx, production logging, restart policies)

### Updating the App After Deployment
When changes are made and tested locally:
1. SSH into the server
2. `cd /opt/whoopaid`
3. `git pull`
4. `docker compose -f docker-compose.prod.yml up -d --build`
5. Run any new migrations: `docker compose exec app npx prisma migrate deploy`

Claude Code must create both Docker Compose files and include a `DEPLOYMENT.md` file in the `docs/` folder with these exact steps so the project owner can deploy and update independently.
- Ubuntu 22.04 or 24.04 LTS
- 1 vCPU, 1-2 GB RAM, 25 GB SSD minimum
- Root/SSH access
- Docker and Docker Compose installed
- Dedicated IPv4 address
- Automatic daily backups enabled (critical for financial data)

### Docker Compose Services
```
services:
  app        — Node.js application (Express + React build)
  postgres   — PostgreSQL 16 database
  nginx      — Reverse proxy with SSL termination
```

### Domain & SSL
- Point `app.whoopaid.com` A record to VPS IP address
- SSL via Let's Encrypt (certbot with nginx plugin)
- Force HTTPS redirect on all routes

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@postgres:5432/whoopaid
JWT_SECRET=<random-64-char-string>
NODE_ENV=production
CORS_ORIGIN=https://app.whoopaid.com
```

### Backup Strategy
- Automated daily PostgreSQL dump via cron
- Retain 30 days of backups
- Store backups on VPS filesystem (consider off-site backup for v2)

### Deployment Steps (high level)
1. Provision VPS, install Docker
2. Clone repository to VPS
3. Configure environment variables
4. Set up DNS (app.whoopaid.com → VPS IP)
5. Run `docker compose up -d`
6. Configure SSL with certbot
7. Verify application loads at https://app.whoopaid.com
8. Create first user account (Steven) — this creates the household
9. Invite Kimberly via the invite flow

---

## 13. v2 Roadmap

Features deferred from v1, to be built after core app is stable and in use.

### Planned v2 Features
- **Email/push notifications:** Due date reminders, payment suggestions, milestone celebrations
- **HELOC integration:** Track HELOC balance as a separate debt instrument with its own payoff schedule. Model "pay off cards with HELOC draw" and track consolidated repayment
- **Billing/subscription:** Allow new households to sign up with paid plans. Stripe integration for monthly billing
- **Plaid/Monarch integration:** Auto-import balances and transactions instead of manual entry
- **"Path to Score" goal tracker:** Set a target credit score (e.g., 700) and track progress with estimated utilization thresholds
- **Multiple debt types:** Student loans, auto loans, personal loans — expand beyond credit cards
- **Shared household reports:** Monthly PDF summary emailed to all household members
- **Dark mode**
- **Off-site encrypted backups**
- **Admin dashboard:** For managing households if the app grows beyond friends and family

---

## Appendix A: Data Entry

All card data will be entered by users through the application UI after deployment. No seed data file is needed. For development and testing, use realistic mock data that covers edge cases: cards with $0 balance, cards near their limit, varying APRs, and different due dates.

## Appendix B: Credit Utilization Reference

| Utilization Range | Credit Impact | Rating |
|---|---|---|
| 0-9% | Excellent | 🟢 |
| 10-29% | Good | 🟢 |
| 30-49% | Fair | 🟡 |
| 50-74% | Poor | 🟠 |
| 75-100%+ | Very Poor | 🔴 |

**Current household utilization: ~88% (Very Poor)**
**Target: Below 30% (Good)**

---

*Document version: 1.0*
*Created: February 2026*
*Project: WhooPaid — Credit Card Payoff Tracker*
*Domain: app.whoopaid.com*
