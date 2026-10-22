import { z } from "zod";

const quoteSchema = z.object({ c: z.number().finite().positive(), d: z.number().finite().nullable().optional(), dp: z.number().finite().nullable().optional(), t: z.number().int().positive() });
export type MarketQuote = { symbol: string; price: number; change: number | null; changePercent: number | null; asOf: string };

export async function getMarketQuote(symbol: string): Promise<MarketQuote> {
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key) throw new Error("MARKET_DATA_NOT_CONFIGURED");
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", key);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("MARKET_DATA_PROVIDER_UNAVAILABLE");
  const parsed = quoteSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.c <= 0 || parsed.data.t <= 0) throw new Error("NO_CURRENT_QUOTE");
  return { symbol, price: parsed.data.c, change: parsed.data.d ?? null, changePercent: parsed.data.dp ?? null, asOf: new Date(parsed.data.t * 1000).toISOString() };
}
