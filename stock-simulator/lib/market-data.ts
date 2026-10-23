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
  if (key) {
    try {
      const url = new URL("https://finnhub.io/api/v1/quote");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("token", key);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const parsed = quoteSchema.safeParse(await response.json());
        if (parsed.success && parsed.data.c > 0 && parsed.data.t > 0) {
          return { symbol, price: parsed.data.c, change: parsed.data.d ?? null, changePercent: parsed.data.dp ?? null, asOf: new Date(parsed.data.t * 1000).toISOString() };
        }
      }
    } catch {
      // Try the independent quote source below.
    }
  }

  // Use the most recent market price from Yahoo when Finnhub is unavailable or not configured.
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 BYLA-Markets/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(key ? "MARKET_DATA_PROVIDER_UNAVAILABLE" : "MARKET_DATA_NOT_CONFIGURED");
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const price = Number(meta?.regularMarketPrice ?? result?.indicators?.quote?.[0]?.close?.filter((v: unknown) => typeof v === "number").at(-1));
  const timestamp = Number(meta?.regularMarketTime ?? result?.timestamp?.at(-1));
  const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) throw new Error("NO_CURRENT_QUOTE");
  const change = Number.isFinite(previous) && previous > 0 ? price - previous : null;
  const changePercent = change !== null && previous > 0 ? change / previous * 100 : null;
  return { symbol, price, change, changePercent, asOf: new Date(timestamp * 1000).toISOString() };
}

const chartRanges: Record<string, { seconds: number; resolution: string; yahooRange: string; yahooInterval: string }> = {
  "1D": { seconds: 24 * 60 * 60, resolution: "5", yahooRange: "1d", yahooInterval: "5m" },
  "1W": { seconds: 7 * 24 * 60 * 60, resolution: "15", yahooRange: "5d", yahooInterval: "15m" },
  "1M": { seconds: 30 * 24 * 60 * 60, resolution: "60", yahooRange: "1mo", yahooInterval: "60m" },
  "3M": { seconds: 90 * 24 * 60 * 60, resolution: "D", yahooRange: "3mo", yahooInterval: "1d" },
  "1Y": { seconds: 365 * 24 * 60 * 60, resolution: "W", yahooRange: "1y", yahooInterval: "1wk" },
};

async function getYahooCandles(symbol: string, range: string): Promise<MarketCandle[]> {
  const selected = chartRanges[range];
  if (!selected) throw new Error("INVALID_CHART_RANGE");
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", selected.yahooRange);
  url.searchParams.set("interval", selected.yahooInterval);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 BYLA-Markets/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("FALLBACK_MARKET_DATA_UNAVAILABLE");
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const timestamps: unknown[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) throw new Error("NO_CANDLE_DATA");
  return timestamps.map((time: unknown, i: number) => ({
    time: Number(time),
    open: Number(quote.open?.[i]),
    high: Number(quote.high?.[i]),
    low: Number(quote.low?.[i]),
    close: Number(quote.close?.[i]),
    volume: Number(quote.volume?.[i] ?? 0),
  })).filter((candle: MarketCandle) =>
    Number.isFinite(candle.time) && candle.time > 0 &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0
  ).sort((a: MarketCandle, b: MarketCandle) => a.time - b.time);
}

export async function getMarketCandles(symbol: string, range: string): Promise<MarketCandle[]> {
  const selected = chartRanges[range];
  if (!selected) throw new Error("INVALID_CHART_RANGE");
  const key = process.env.MARKET_DATA_API_KEY;

  // Prefer Finnhub when configured, but fall back to Yahoo chart history if the key,
  // subscription, or intraday candle endpoint is unavailable.
  if (key) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const url = new URL("https://finnhub.io/api/v1/stock/candle");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("resolution", selected.resolution);
      url.searchParams.set("from", String(now - selected.seconds));
      url.searchParams.set("to", String(now));
      url.searchParams.set("token", key);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const parsed = candlesSchema.safeParse(await response.json());
        if (parsed.success) {
          const { t, o, h, l, c, v } = parsed.data;
          const candles = t.map((time, i) => ({ time, open: o[i], high: h[i], low: l[i], close: c[i], volume: v?.[i] ?? 0 }))
            .filter((candle) => Number.isFinite(candle.open) && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close))
            .sort((a, b) => a.time - b.time);
          if (candles.length) return candles;
        }
      }
    } catch {
      // Try the independent historical chart source below.
    }
  }

  const fallbackCandles = await getYahooCandles(symbol, range);
  if (!fallbackCandles.length) throw new Error("NO_CANDLE_DATA");
  return fallbackCandles;
}
