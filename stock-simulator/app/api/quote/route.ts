import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMarketQuote } from "@/lib/market-data";
const schema = z.string().trim().toUpperCase().regex(/^[A-Z.]{1,10}$/);
export async function GET(request: Request) {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to view market quotes." }, { status: 401 });
  const parsed = schema.safeParse(new URL(request.url).searchParams.get("symbol") ?? "AAPL");
  if (!parsed.success) return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  try {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const { data: allowed, error: limitError } = await admin.rpc("consume_api_rate_limit", { p_user_id: user.id, p_action: "quote", p_limit: 60 });
    if (limitError) throw new Error("RATE_LIMIT_SERVICE_UNAVAILABLE");
    if (!allowed) return NextResponse.json({ error: "Quote request limit reached. Please wait a minute." }, { status: 429 });
    const quote = await getMarketQuote(parsed.data);
    const age = Date.now() - new Date(quote.asOf).getTime();
    if (age > 900000 || age < -60000) return NextResponse.json({ error: "The provider returned a stale quote." }, { status: 409 });
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const missing = e instanceof Error && e.message === "MARKET_DATA_NOT_CONFIGURED";
    return NextResponse.json({ error: missing ? "Market data is not configured." : "A current quote is unavailable." }, { status: missing ? 503 : 502 });
  }
}