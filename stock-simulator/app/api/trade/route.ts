import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const orderSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z.]{1,10}$/),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().finite().positive().max(1000000),
});

export async function POST(request: Request) {
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to place a paper trade." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid ticker, side, and share quantity." }, { status: 400 });

  // Price is always fetched on the server; client-supplied prices are ignored.
  const quoteUrl = new URL("/api/quote", request.url);
  quoteUrl.searchParams.set("symbol", parsed.data.symbol);
  const quoteResponse = await fetch(quoteUrl, { cache: "no-store" });
  const quote = await quoteResponse.json().catch(() => null) as { price?: number; asOf?: string; error?: string } | null;
  if (!quoteResponse.ok || !quote || typeof quote.price !== "number" || !quote.asOf) {
    return NextResponse.json({ error: quote?.error ?? "A fresh quote is required before trading." }, { status: 503 });
  }
  const quoteTime = new Date(quote.asOf);
  if (!Number.isFinite(quoteTime.getTime()) || Date.now() - quoteTime.getTime() > 15 * 60 * 1000 || quoteTime.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "The market quote is stale. Please try again." }, { status: 409 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("execute_paper_trade", {
      p_user_id: user.id,
      p_symbol: parsed.data.symbol,
      p_side: parsed.data.side,
      p_quantity: parsed.data.quantity,
      p_price: quote.price,
      p_quote_as_of: quote.asOf,
    });
    if (error) {
      const message = error.message.includes("INSUFFICIENT_CASH") ? "Not enough virtual cash for this order." : error.message.includes("INSUFFICIENT_SHARES") ? "You do not own enough shares to sell." : "Trade could not be completed. Please try again.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ success: true, trade: data, quote: { symbol: parsed.data.symbol, price: quote.price, asOf: quote.asOf } });
  } catch {
    return NextResponse.json({ error: "Trading service is not configured yet." }, { status: 503 });
  }
}
