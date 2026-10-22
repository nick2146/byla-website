# BYLA Markets — Stock Market Simulator

BYLA Markets is an educational paper-trading platform. It uses virtual USD only; it does not connect to a brokerage, accept deposits, or place real orders.

## Stack
- Next.js App Router + TypeScript
- Supabase Auth + Postgres with Row Level Security
- Finnhub quote adapter (server-side API key; confirm account entitlements and licensing)
- Atomic Postgres paper-trade function; server-only execution permission
- Individual leaderboard with per-user database-backed rate limits

## Local setup
1. Use Node.js 22+ and enter this folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in your values locally.
4. Run the entire `supabase/schema.sql` in the Supabase SQL Editor before signing up test users.
5. In Supabase Auth settings, set the site URL and allowed redirect URLs to your local development URL and the eventual Vercel production domain.
7. Run `npm test`, `npm run typecheck`, `npm run build`, then `npm run dev`.

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the publishable key accepted by your project)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never prefix with `NEXT_PUBLIC_`, commit it, or paste it into chat
- `MARKET_DATA_API_KEY` — server-only; never commit or paste it into chat

## Vercel checklist (do not deploy until verified)
1. Create a separate Vercel project from this repository and set its Root Directory to `stock-simulator`.
2. Configure the four environment variables in Vercel Project Settings → Environment Variables. Use Preview values first; keep service-role and market-data keys private.
3. Set Supabase Auth Site URL / redirect allowlist to the correct Preview or production URL.
4. Apply the schema and verify that the signup trigger creates exactly one portfolio with $100,000 virtual USD and a unique username.
5. Confirm RLS is enabled and direct browser clients cannot insert/update/delete portfolios, positions, trades, or rate-limit counters.
6. Verify that unauthenticated quote, portfolio, trade, and leaderboard requests return 401; invalid/stale quote and insufficient-cash/share trades are rejected.
6. Run `npm test`, `npm run typecheck`, and `npm run build`. Inspect the GitHub Actions results and fix failures before deployment.
8. Test concurrent orders and rate-limit responses in a non-production Supabase project. Confirm your market-data plan permits the intended student-facing display and request volume.

## Security notes
- Quote and trade routes require a verified Supabase session.
- Trade prices are fetched by the server directly from the provider; browser-submitted prices are ignored.
- Quotes older than 15 minutes are rejected. The SQL trade function repeats freshness, quantity, cash, and holdings checks and locks the user's portfolio row during execution.
- Per-user quote/trade/leaderboard request limits use a server-only Postgres function.
- Leaderboard shows public usernames and estimated virtual account value, not email addresses or auth IDs. Unavailable quote values fall back to average cost and are marked in the UI.
- The static security tests are regression checks, not a substitute for live integration, penetration, licensing, or configuration review.

**Status:** development branch only. Not production-cleared until the database schema, credentials, CI checks, auth redirects, and live paper-trade tests are verified.
