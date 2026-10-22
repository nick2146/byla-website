import { NextResponse } from "next/server";
import { z } from "zod";

const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z.]{1,10}$/);

export async function GET(request: Request) {
  const parsed = symbolSchema.safeParse(new URL(request.url).searchParams.get("symbol") ?? "AAPL");
  if (!parsed.success) return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key) return NextResponse.json({ error: "Market data is not configured yet." }, { status: 503 });
  // Finnhub adapter. Confirm your provider plan and market-data license before public launch.
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", parsed.data);
  url.searchParams.set("token", key);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return NextResponse.json({ error: "Market data provider unavailable." }, { status: 502 });
    const raw: unknown = await response.json();
    const quote = z.object({ c: z.number().nonnegative(), d: z.number().nullable().optional(), dp: z.number().nullable().optional(), t: z.number().int().positive() }).safeParse(raw);
    if (!quote.success || quote.data.c <= 0 || quote.data.t <= 0) return NextResponse.json({ error: "No current quote available for this ticker." }, { status: 502 });
    return NextResponse.json({ symbol: parsed.data, price: quote.data.c, change: quote.data.d ?? null, changePercent: quote.data.dp ?? null, asOf: new Date(quote.data.t * 1000).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not retrieve a market quote." }, { status: 502 });
  }
}
