"use client";

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
const ranges = ["1D", "1W", "1M", "3M", "1Y"] as const;

export default function MarketChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [range, setRange] = useState<(typeof ranges)[number]>("1D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: { background: { type: ColorType.Solid, color: "#0b1220" }, textColor: "#aab7cc", attributionLogo: false },
      grid: { vertLines: { color: "#1c2940" }, horzLines: { color: "#1c2940" } },
      rightPriceScale: { borderColor: "#26344a" },
      timeScale: { borderColor: "#26344a", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#65758e" }, horzLine: { color: "#65758e" } },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#35c88a", downColor: "#f06b78", borderUpColor: "#35c88a", borderDownColor: "#f06b78",
      wickUpColor: "#35c88a", wickDownColor: "#f06b78",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let firstLoad = true;
    async function loadCandles() {
      if (firstLoad) setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load chart.");
        if (cancelled) return;
        const next = data.candles as Candle[];
        setCandles(next);
        const first = next[0]?.close;
        const last = next[next.length - 1]?.close;
        setLastClose(last ?? null);
        setChangePct(first && last ? ((last - first) / first) * 100 : null);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load chart.");
      } finally {
        if (!cancelled) setLoading(false);
        firstLoad = false;
      }
    }
    void loadCandles();
    const interval = window.setInterval(() => { void loadCandles(); }, 60000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [symbol, range]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !candles.length) return;
    series.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <section className="panel market-chart-panel">
      <div className="panel-heading chart-heading">
        <div><span className="eyebrow">LIVE MARKET CHART</span><h2>{symbol} price action</h2></div>
        <div className="chart-price">{lastClose === null ? "—" : lastClose.toLocaleString("en-US", { style: "currency", currency: "USD" })}<small className={changePct !== null && changePct < 0 ? "negative" : "positive"}>{changePct === null ? "Selected period" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% selected period`}</small></div>
      </div>
      <div className="chart-controls" aria-label="Chart time range" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>{ranges.map((item) => <button type="button" key={item} className={range === item ? "selected" : "button secondary"} onClick={() => setRange(item)} style={{ minWidth: 54, padding: "8px 12px", borderRadius: 8, border: "1px solid #2b3b53", background: range === item ? "#2457e6" : "#111b2c", color: "#f4f7fb", cursor: "pointer" }}>{item}</button>)}</div>
      {loading && <p className="chart-message">Loading latest market candles…</p>}
      {error && <p className="chart-message notice" role="status">{error}</p>}
      <div ref={containerRef} className="chart-canvas" style={{ height: 320, minHeight: 320, width: "100%" }} aria-label={`${symbol} candlestick price chart`} />
      <p className="chart-footnote">Market data may be delayed or unavailable outside trading hours. Candles are historical provider data; this is a virtual trading simulator, not a brokerage.</p>
    </section>
  );
}
