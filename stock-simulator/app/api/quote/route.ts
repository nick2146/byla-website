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
    const quote = await getMarketQuote(parsed.data);
    const age = Date.now() - new Date(quote.asOf).getTime();
    if (age > 900000 || age < -60000) return NextResponse.json({ error: "The provider returned a stale quote." }, { status: 409 });
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const missing = e instanceof Error && e.message === "MARKET_DATA_NOT_CONFIGURED";
    return NextResponse.json({ error: missing ? "Market data is not configured." : "A current quote is unavailable." }, { status: missing ? 503 : 502 });
  }
}