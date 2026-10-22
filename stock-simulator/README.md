# BYLA Markets — Stock Market Simulator

A standalone educational paper-trading platform for students. All trades use virtual money; no real brokerage or deposits are supported.

## Planned stack
- Next.js App Router + TypeScript
- Supabase Auth and Postgres with Row Level Security
- Server-side quote proxy; provider API key stays server-only
- Atomic Postgres trade function validates price, quantity, cash, and holdings
- Individual performance leaderboard

## Local setup
1. Install Node.js 22+.
2. Run `npm install` inside this folder.
3. Copy `.env.example` to `.env.local` and fill in values from your Supabase project and chosen market-data provider.
4. Apply `supabase/schema.sql` in the Supabase SQL Editor.
5. Run `npm run dev`.

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key supported by your Supabase project)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never prefix with `NEXT_PUBLIC_` or commit it
- `MARKET_DATA_API_KEY` — server-only
- `MARKET_DATA_PROVIDER` — provider adapter name

## Important
This branch is a development foundation, not a production-ready financial product. Market data may be delayed and is subject to the provider's licensing. Do not deploy until authentication, RLS, database migrations, trade tests, rate limiting, and error handling have been verified. Prices are indicative only; trade execution uses a server-validated quote snapshot and records its timestamp.