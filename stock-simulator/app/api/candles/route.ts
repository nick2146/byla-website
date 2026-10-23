import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMarketCandles } from "@/lib/market-data";

const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z.]{1,10}$/);
const rangeSchema = z.enum(["1D", "1W", "1M", "3M", "1Y"]);

export async function GET(request: Request) {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to view market charts." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const symbol = symbolSchema.safeParse(params.get("symbol") ?? "AAPL");
  const range = rangeSchema.safeParse(params.get("range") ?? "1D");
  if (!symbol.success || !range.success) return NextResponse.json({ error: "Choose a valid stock and chart range." }, { status: 400 });
  try {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const { data: allowed, error: limitError } = await admin.rpc("consume_api_rate_limit", { p_user_id: user.id, p_action: "chart", p_limit: 30 });
    if (limitError) throw new Error("RATE_LIMIT_SERVICE_UNAVAILABLE");
    if (!allowed) return NextResponse.json({ error: "Chart refresh limit reached. Please wait a minute." }, { status: 429 });
    const candles = await getMarketCandles(symbol.data, range.data);
    if (!candles.length) return NextResponse.json({ error: "No chart data is available for this stock and time range. The market may be closed or the provider may not support this symbol." }, { status: 404 });
    return NextResponse.json({ symbol: symbol.data, range: range.data, candles }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const missing = error instanceof Error && error.message === "MARKET_DATA_NOT_CONFIGURED";
    return NextResponse.json({ error: missing ? "Market data is not configured. Add MARKET_DATA_API_KEY in Vercel project settings." : "Market chart is temporarily unavailable." }, { status: missing ? 503 : 502 });
  }
}
