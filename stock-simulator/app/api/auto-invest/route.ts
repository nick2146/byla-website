import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketQuote } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// This simulator's auto-invest worker is deliberately restricted to the owner's account.
const OWNER_USER_ID = "1db3a657-6ec0-45d5-b204-40a6fb29e699";
const WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "JPM", "KO", "SPY", "COST", "WMT"];
const MAX_POSITIONS = 5;
const MAX_POSITION_FRACTION = 0.2;
const CASH_DEPLOYMENT_FRACTION = 0.05;
const TAKE_PROFIT = 0.10;
const CUT_LOSS = -0.05;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("auto_invest_settings").select("enabled,last_run_at").eq("user_id", OWNER_USER_ID).maybeSingle();
  if (settingsError) return NextResponse.json({ error: "Auto-invest settings unavailable." }, { status: 503 });
  if (!settings?.enabled) return NextResponse.json({ ok: true, skipped: "disabled" });
  if (settings.last_run_at && Date.now() - new Date(settings.last_run_at).getTime() < 20 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: "already-ran-recently" });
  }

  // Record the run before trading to prevent overlapping cron invocations from duplicating orders.
  const { error: updateError } = await admin.from("auto_invest_settings")
    .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", OWNER_USER_ID).eq("enabled", true);
  if (updateError) return NextResponse.json({ error: "Could not reserve auto-invest run." }, { status: 503 });

  const { data: portfolio, error: portfolioError } = await admin.from("portfolios")
    .select("cash").eq("user_id", OWNER_USER_ID).maybeSingle();
  const { data: positions, error: positionsError } = await admin.from("positions")
    .select("symbol,quantity,average_cost").eq("user_id", OWNER_USER_ID);
  if (portfolioError || positionsError || !portfolio || !positions) {
    return NextResponse.json({ error: "Portfolio unavailable." }, { status: 503 });
  }

  const actions: Array<{ action: string; symbol: string; quantity: number; price: number; reason: string; status: string }> = [];
  const quoteResults = await Promise.all([...new Set([...WATCHLIST, ...positions.map(p => p.symbol)])].map(async symbol => {
    try { return [symbol, await getMarketQuote(symbol)] as const; } catch { return [symbol, null] as const; }
  }));
  const quotes = new Map(quoteResults);
  let cash = Number(portfolio.cash);
  const accountValue = cash + positions.reduce((sum, p) => sum + Number(p.quantity) * (quotes.get(p.symbol)?.price ?? Number(p.average_cost)), 0);

  // Risk controls: exit positions at a 10% gain or 5% loss from average cost.
  for (const position of positions) {
    const q = quotes.get(position.symbol);
    if (!q) continue;
    const returnFraction = (q.price - Number(position.average_cost)) / Number(position.average_cost);
    if (returnFraction >= TAKE_PROFIT || returnFraction <= CUT_LOSS) {
      const quantity = Number(position.quantity);
      const reason = returnFraction >= TAKE_PROFIT ? "Take-profit threshold reached (+10% from average cost)." : "Risk limit reached (-5% from average cost).";
      const { error } = await admin.rpc("execute_paper_trade", {
        p_user_id: OWNER_USER_ID, p_symbol: position.symbol, p_side: "sell",
        p_quantity: quantity, p_price: q.price, p_quote_as_of: q.asOf,
      });
      const status = error ? "failed" : "completed";
      actions.push({ action: "sell", symbol: position.symbol, quantity, price: q.price, reason, status });
      if (!error) {
        cash += quantity * q.price;
        await admin.from("auto_invest_runs").insert({ user_id: OWNER_USER_ID, action: "sell", symbol: position.symbol, quantity, price: q.price, reason, status });
      }
    }
  }

  const { data: freshPositions } = await admin.from("positions").select("symbol,quantity,average_cost").eq("user_id", OWNER_USER_ID);
  const held = freshPositions ?? [];
  const heldSymbols = new Set(held.map(p => p.symbol));
  const heldValue = held.reduce((sum, p) => sum + Number(p.quantity) * (quotes.get(p.symbol)?.price ?? Number(p.average_cost)), 0);
  const freshAccountValue = cash + heldValue;
  const slots = Math.max(0, MAX_POSITIONS - held.length);
  const candidates = WATCHLIST.map(symbol => ({ symbol, quote: quotes.get(symbol) }))
    .filter((item): item is { symbol: string; quote: NonNullable<typeof item.quote> } => Boolean(item.quote) && !heldSymbols.has(item.symbol) && (item.quote?.changePercent ?? -100) > 0)
    .sort((a, b) => (b.quote.changePercent ?? -100) - (a.quote.changePercent ?? -100))
    .slice(0, slots);

  // Only use 5% of cash per run, retain at least half of available cash, and cap each
  // position at 20% of estimated account value. This is simulated educational trading.
  let budget = Math.min(cash * CASH_DEPLOYMENT_FRACTION, Math.max(0, cash * 0.5));
  for (const candidate of candidates) {
    if (budget < candidate.quote.price || cash * 0.5 < candidate.quote.price) continue;
    const positionCap = Math.max(0, freshAccountValue * MAX_POSITION_FRACTION);
    const quantity = Math.floor((Math.min(budget, cash * 0.5, positionCap) / candidate.quote.price) * 1000000) / 1000000;
    if (quantity <= 0) continue;
    const total = quantity * candidate.quote.price;
    const { error } = await admin.rpc("execute_paper_trade", {
      p_user_id: OWNER_USER_ID, p_symbol: candidate.symbol, p_side: "buy",
      p_quantity: quantity, p_price: candidate.quote.price, p_quote_as_of: candidate.quote.asOf,
    });
    const status = error ? "failed" : "completed";
    const reason = "Daily momentum screen: positive latest daily change; position and cash limits applied.";
    actions.push({ action: "buy", symbol: candidate.symbol, quantity, price: candidate.quote.price, reason, status });
    if (!error) {
      cash -= total;
      budget -= total;
      await admin.from("auto_invest_runs").insert({ user_id: OWNER_USER_ID, action: "buy", symbol: candidate.symbol, quantity, price: candidate.quote.price, reason, status });
    }
  }

  return NextResponse.json({ ok: true, executedFor: OWNER_USER_ID, actions, note: "Virtual trading only. Thresholds are rule-based and cannot identify a stock's true peak." }, { headers: { "Cache-Control": "no-store" } });
}
