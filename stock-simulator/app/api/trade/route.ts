import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketQuote } from "@/lib/market-data";
const schema = z.object({ symbol: z.string().trim().toUpperCase().regex(/^[A-Z.]{1,10}$/), side: z.enum(["buy","sell"]), quantity: z.number().finite().positive().max(1000000) });
export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to place a paper trade." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid ticker, side, and share quantity." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: allowed, error: limitError } = await admin.rpc("consume_api_rate_limit", { p_user_id: user.id, p_action: "trade", p_limit: 20 });
    if (limitError) throw new Error("RATE_LIMIT_SERVICE_UNAVAILABLE");
    if (!allowed) return NextResponse.json({ error: "Paper-trading order limit reached. Please wait a minute." }, { status: 429 });
    // Never trust client prices or the request Host header. Fetch directly from the configured provider.
    const quote = await getMarketQuote(parsed.data.symbol);
    const quoteTime = new Date(quote.asOf).getTime();
    if (!Number.isFinite(quoteTime) || quoteTime <= 0 || quoteTime > Date.now()+60000) return NextResponse.json({ error: "The market provider returned an invalid quote. Please try again." }, { status: 409 });
    // Outside regular market hours, the provider's latest closing price can be older than 15 minutes.
    // That is still valid for a clearly labeled educational paper trade.
    const { data, error } = await admin.rpc("execute_paper_trade", { p_user_id:user.id, p_symbol:parsed.data.symbol, p_side:parsed.data.side, p_quantity:parsed.data.quantity, p_price:quote.price, p_quote_as_of:quote.asOf });
    if (error) {
      const message = error.message.includes("INSUFFICIENT_CASH") ? "Not enough virtual cash." : error.message.includes("INSUFFICIENT_SHARES") ? "You do not own enough shares to sell." : "Trade could not be completed.";
      return NextResponse.json({ error:message }, { status:422 });
    }
    return NextResponse.json({ success:true, trade:data, quote }, { headers:{"Cache-Control":"private, no-store"} });
  } catch (e) {
    const missing = e instanceof Error && e.message === "MARKET_DATA_NOT_CONFIGURED";
    return NextResponse.json({ error:missing ? "Market data is not configured yet." : "Trading service is temporarily unavailable." }, { status:503 });
  }
}