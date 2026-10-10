# PlentyPay - Developer Guide & Agent Instructions

## Project Overview
PlentyPay is a B2B Electronic Invoicing SaaS platform for Panama. It is a "Cloud-Native" solution designed to handle fiscal management with an Offline-First PWA architecture.

## Git Workflow
The project follows a consolidated 3-branch strategy (unified in June 2026):

### 1. Production (`main`)
- **Status**: Stable, Production-Ready.
- **Purpose**: Contains the code currently running in the production environment.
- **Rules**: Direct commits are prohibited. Changes arrive only via Pull Requests from `Development/preview` or `Hotfix`.
- **Deployment**: Automatic deployment to **Production** environment via Vercel on push.
- **Database**: Neon branch `production`. NEVER used outside production.

### 2. Development, Staging & Preview (`Development/preview`)
- **Status**: Active Development, QA and Testing — the single unified non-production environment.
- **Purpose**:
    - Integration branch for all new features.
    - QA / staging validation before merging to `main`.
    - Testing ground for refactors; code must be refined here until it is 100% functional and tested before moving to `main`.
- **Rules**: Main target for feature Pull Requests. Short-lived feature branches (including `claude/*` agent branches) must branch from and merge back into `Development/preview`, then be deleted.
- **Deployment**: Automatic deployment to **Preview** environment via Vercel on push.
- **Database**: Neon branch `preview/Development/preview` (Copy-on-Write child of `production`, managed by the Neon↔Vercel integration).

### 3. Hotfix (`Hotfix`)
- **Status**: Emergency response.
- **Purpose**: Dedicated branch for resolving production incidents. Created from `main`, merged back to `main` via PR, then `main` is merged back into `Development/preview`.
- **Deployment**: Automatic deployment to **Preview** environment for validation before the PR to `main`.
- **Database**: Neon branch `preview/Hotfix` (auto-created by the integration) or an ephemeral child of `production` to reproduce the incident — see docs/NEON-CHILD-BRANCH-SETUP.md.

> Legacy branches `develop`, `staging`, `fix/*`, `kayak-203` and long-lived `claude/*` branches were consolidated into `Development/preview` and deleted.

## Tech Stack

### Core
- **Frontend Framework**: Next.js 15 (App Router, Server Actions)
- **UI Library**: React 19
- **Language**: TypeScript

### Styling & UI
- **CSS Framework**: Tailwind CSS v4
- **Component Library**: Shadcn/ui
- **Icons**: Lucide React
- **Theming**: next-themes (Dark/Light support)

### Backend & Data
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Prisma ORM 6.19.2
- **Authentication**: NextAuth.js v5
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Caching/Rate Limiting**: Upstash Redis (distributed locking, rate limiting, catalog cache)

### AI & Biometrics
- **ML Framework**: TensorFlow.js
- **Face Recognition**: @vladmandic/face-api (Client-side)
- **AI Gateway**: Vercel AI Gateway + Vercel AI SDK (asistente de soporte con streaming)

### Infrastructure & DevOps
- **Deployment**: Vercel (crons nativos para background jobs — sin Railway/BullMQ)
- **CI/CD**: GitHub Actions
    - `ci.yml`: Runs linting, testing, and build checks on push to `main`, `develop`, `fix`.
    - `deploy.yml`: Manages Vercel deployments.
- **Testing**: Jest (Unit), Playwright (E2E)

## Project Structure

- `app/`: Next.js App Router (Routes, Layouts, API, Actions)
    - `(marketing)/`: SEO optimized public pages
    - `dashboard/`: Protected application routes
- `components/`: React components (UI, Dashboard, Landing)
- `core/`: Business logic agnostic of UI (Auth, DB)
- `features/`: Domain-specific modules (Invoicing, Inventory, POS, HKA)
- `lib/`: Utilities and library configurations
- `prisma/`: Database schema and seed scripts
- `public/`: Static assets
- `scripts/`: Maintenance and setup scripts
- `shared/`: Shared UI and hooks

## Coding Conventions
- **Naming**:
    - Use `admin` for super-admin related logic/routes.
    - Use `client` for tenant-specific logic/routes.
- **Linting**: ESLint + Prettier
- **Commits**: Conventional Commits (enforced by Commitlint)
- **Architecture**: Feature-Sliced Design (cohesion over layering)

## Development Workflow

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment: Copy `env.template` to `.env.local` and fill in credentials.
4. Setup Database:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

### Common Commands
- **Start Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint` (or `npm run lint:fix`)
- **Test (Unit)**: `npm test`
- **Test (E2E)**: `npx playwright test`
- **Database Studio**: `npm run db:studio`

## Key Integrations
- **The Factory HKA**: SOAP Web Services for DGI compliance (9 methods, DGI Reconciliation Engine).
- **Upstash Redis**: Rate limiting, distributed locking, catalog caching.
- **Vercel AI Gateway**: LLM routing for AI support assistant.
- **Resend**: Transactional emails.
- **Web Push**: Notifications.
