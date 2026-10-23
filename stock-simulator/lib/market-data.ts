import { z } from "zod";

const quoteSchema = z.object({ c: z.number().finite().positive(), d: z.number().finite().nullable().optional(), dp: z.number().finite().nullable().optional(), t: z.number().int().positive() });
const candlesSchema = z.object({
  s: z.literal("ok"),
  t: z.array(z.number().int()),
  o: z.array(z.number().finite().positive()),
  h: z.array(z.number().finite().positive()),
  l: z.array(z.number().finite().positive()),
  c: z.array(z.number().finite().positive()),
  v: z.array(z.number().finite().nonnegative()).optional(),
});
export type MarketQuote = { symbol: string; price: number; change: number | null; changePercent: number | null; asOf: string };
export type MarketCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export async function getMarketQuote(symbol: string): Promise<MarketQuote> {
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key) throw new Error("MARKET_DATA_NOT_CONFIGURED");
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", key);
  const response = await fetch(url, { next: { revalidate: 15 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("MARKET_DATA_PROVIDER_UNAVAILABLE");
  const parsed = quoteSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.c <= 0 || parsed.data.t <= 0) throw new Error("NO_CURRENT_QUOTE");
  return { symbol, price: parsed.data.c, change: parsed.data.d ?? null, changePercent: parsed.data.dp ?? null, asOf: new Date(parsed.data.t * 1000).toISOString() };
}

export async function getMarketCandles(symbol: string, range: string): Promise<MarketCandle[]> {
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key) throw new Error("MARKET_DATA_NOT_CONFIGURED");
  const now = Math.floor(Date.now() / 1000);
  const ranges: Record<string, { seconds: number; resolution: string }> = {
    "1D": { seconds: 24 * 60 * 60, resolution: "5" },
    "1W": { seconds: 7 * 24 * 60 * 60, resolution: "15" },
    "1M": { seconds: 30 * 24 * 60 * 60, resolution: "60" },
    "3M": { seconds: 90 * 24 * 60 * 60, resolution: "D" },
    "1Y": { seconds: 365 * 24 * 60 * 60, resolution: "W" },
  };
  const selected = ranges[range];
  if (!selected) throw new Error("INVALID_CHART_RANGE");
  const url = new URL("https://finnhub.io/api/v1/stock/candle");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", selected.resolution);
  url.searchParams.set("from", String(now - selected.seconds));
  url.searchParams.set("to", String(now));
  url.searchParams.set("token", key);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("MARKET_DATA_PROVIDER_UNAVAILABLE");
  const parsed = candlesSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("NO_CANDLE_DATA");
  const { t, o, h, l, c, v } = parsed.data;
  return t.map((time, i) => ({ time, open: o[i], high: h[i], low: l[i], close: c[i], volume: v?.[i] ?? 0 }))
    .filter((candle) => Number.isFinite(candle.open) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close))
    .sort((a, b) => a.time - b.time);
}
