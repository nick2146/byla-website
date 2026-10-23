"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MarketChart from "./market-chart";

type Position = { symbol: string; quantity: number; average_cost: number };
type Trade = { id: string; symbol: string; side: string; quantity: number; price: number; total: number; created_at: string };
type Portfolio = { portfolio: { cash: number; updated_at: string } | null; positions: Position[]; trades: Trade[] };
type Quote = { symbol: string; price: number; asOf: string; change?: number | null; changePercent?: number | null };
type Leader = { rank: number; username: string; totalValue: number; returnPercent: number; isCurrentUser: boolean; quotesComplete: boolean };
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const stocks = [
  ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["NVDA", "NVIDIA"], ["TSLA", "Tesla"],
  ["AMZN", "Amazon"], ["GOOGL", "Alphabet"], ["META", "Meta Platforms"], ["NFLX", "Netflix"],
  ["AMD", "Advanced Micro Devices"], ["INTC", "Intel"], ["ORCL", "Oracle"], ["CRM", "Salesforce"],
  ["JPM", "JPMorgan Chase"], ["KO", "Coca-Cola"], ["DIS", "Disney"], ["WMT", "Walmart"],
  ["COST", "Costco"], ["UBER", "Uber"], ["SHOP", "Shopify"], ["SPY", "S&P 500 ETF"],
] as const;

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPortfolio = useCallback(async () => {
    const response = await fetch("/api/portfolio", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Portfolio unavailable.");
    setPortfolio(data);
    const next: Record<string, Quote> = {};
    await Promise.all((data.positions as Position[]).map(async (position) => {
      try {
        const result = await fetch("/api/quote?symbol=" + encodeURIComponent(position.symbol), { cache: "no-store" });
        if (result.ok) next[position.symbol] = await result.json();
      } catch { /* Keep average cost as the fallback when a quote is unavailable. */ }
    }));
    setQuotes(next);
  }, []);

  const loadLeaders = useCallback(async () => {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setLeaders(data.entries ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) { window.location.href = "/"; return; }
        if (active) setEmail(data.user.email ?? "");
        await Promise.all([loadPortfolio(), loadLeaders()]);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load account.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadPortfolio, loadLeaders]);

  async function getQuote() {
    setBusy(true); setNotice(""); setQuote(null);
    try {
      const response = await fetch("/api/quote?symbol=" + encodeURIComponent(symbol), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Quote unavailable.");
      setQuote(data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Quote unavailable."); }
    finally { setBusy(false); }
  }

  async function trade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) { setNotice("Enter a valid positive share quantity."); setBusy(false); return; }
    try {
      const response = await fetch("/api/trade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, quantity: qty }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Trade failed.");
      setNotice("Paper trade completed. No real money was used.");
      setQuote(data.quote);
      await Promise.all([loadPortfolio(), loadLeaders()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Trade failed."); }
    finally { setBusy(false); }
  }

  async function signOut() { await createClient().auth.signOut(); window.location.href = "/"; }

  const cash = Number(portfolio?.portfolio?.cash ?? 100000);
  const equity = (portfolio?.positions ?? []).reduce((sum, position) => sum + Number(position.quantity) * (quotes[position.symbol]?.price ?? Number(position.average_cost)), 0);

  if (loading) return <main className="dashboard-shell"><p>Loading your paper-trading account…</p></main>;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-top">
        <a className="brand" href="/"><span className="brand-mark">B</span><span>BYLA <b>MARKETS</b><small>STUDENT PAPER TRADING</small></span></a>
        <div className="dashboard-user"><span>{email}</span><button className="button secondary" onClick={signOut}>Sign out</button></div>
      </header>

      <section className="dashboard-heading">
        <div><span className="eyebrow">YOUR LEARNING TERMINAL</span><h1>Portfolio overview</h1><p>Every order uses virtual cash. No brokerage or real-money transactions.</p></div>
        <div className="dashboard-value"><span>ESTIMATED ACCOUNT VALUE</span><strong>{money(cash + equity)}</strong><small>Starting balance: $100,000 USD virtual</small></div>
      </section>

      <div className="dashboard-stats">
        <article><span>Available virtual cash</span><strong>{money(cash)}</strong></article>
        <article><span>Positions</span><strong>{portfolio?.positions.length ?? 0}</strong></article>
        <article><span>Estimated holdings value</span><strong>{money(equity)}</strong></article>
      </div>

      <MarketChart symbol={symbol} onSymbolChange={(nextSymbol) => { setSymbol(nextSymbol); setQuote(null); }} />

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">PAPER TRADING</span><h2>Place an order</h2></div><span className="virtual-pill">VIRTUAL ONLY</span></div>
          <form className="trade-form" onSubmit={trade}>
            <label>Stock<select value={symbol} onChange={(event) => { setSymbol(event.target.value); setQuote(null); }}>{
              stocks.map(([ticker, name]) => <option key={ticker} value={ticker}>{ticker} — {name}</option>)
            }</select></label>
            <div className="trade-inline">
              <label>Action<select value={side} onChange={(event) => setSide(event.target.value as "buy" | "sell")}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
              <label>Shares<input type="number" min="0.000001" max="1000000" step="0.000001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
            </div>
            <button type="button" className="button secondary" disabled={busy} onClick={getQuote}>Check latest quote</button>
            {quote && <div className="quote-preview"><span>{quote.symbol} indicative quote</span><strong>{money(quote.price)}</strong><small>Provider timestamp: {new Date(quote.asOf).toLocaleString()}</small></div>}
            <button type="submit" className="button primary full" disabled={busy}>{busy ? "Processing…" : side === "buy" ? "Buy with virtual cash" : "Sell virtual shares"} →</button>
          </form>
          <p className="legal">The server retrieves and validates the quote again when an order is submitted; preview prices are not locked in.</p>
          {notice && <p className="notice" role="status">{notice}</p>}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">YOUR HOLDINGS</span><h2>Positions</h2></div></div>
          {!portfolio?.positions.length ? <p className="empty-state">No holdings yet. Select a stock, check its quote, and place a practice order.</p> :
            <div className="table-wrap"><table><thead><tr><th>Symbol</th><th>Shares</th><th>Average cost</th><th>Latest quote</th><th>Market value</th></tr></thead><tbody>{portfolio.positions.map((position) =>
              <tr key={position.symbol}><td><b>{position.symbol}</b></td><td>{Number(position.quantity).toLocaleString()}</td><td>{money(Number(position.average_cost))}</td><td>{quotes[position.symbol] ? money(quotes[position.symbol].price) : "Unavailable"}</td><td>{money(Number(position.quantity) * (quotes[position.symbol]?.price ?? Number(position.average_cost)))}</td></tr>
            )}</tbody></table></div>}
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-heading"><div><span className="eyebrow">ACTIVITY</span><h2>Recent paper trades</h2></div></div>
        {!portfolio?.trades.length ? <p className="empty-state">Completed practice trades appear here.</p> :
          <div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Symbol</th><th>Shares</th><th>Price</th><th>Total</th></tr></thead><tbody>{portfolio.trades.map((trade) =>
            <tr key={trade.id}><td>{new Date(trade.created_at).toLocaleString()}</td><td>{trade.side.toUpperCase()}</td><td>{trade.symbol}</td><td>{Number(trade.quantity).toLocaleString()}</td><td>{money(Number(trade.price))}</td><td>{money(Number(trade.total))}</td></tr>
          )}</tbody></table></div>}
      </section>

      <section className="panel history-panel" id="leaderboard">
        <div className="panel-heading"><div><span className="eyebrow">COMMUNITY CHALLENGE</span><h2>Individual leaderboard</h2></div><button className="button secondary" onClick={loadLeaders}>Refresh</button></div>
        <p className="legal">Ranked by estimated account value using latest quotes; unavailable quotes fall back to average cost and are marked with an asterisk.</p>
        {!leaders.length ? <p className="empty-state">No leaderboard data yet, or the service is temporarily unavailable.</p> :
          <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Estimated value</th><th>Return</th></tr></thead><tbody>{leaders.map((leader) =>
            <tr key={leader.rank} className={leader.isCurrentUser ? "current-user-row" : ""}><td>#{leader.rank}</td><td>{leader.username}{leader.isCurrentUser ? " (you)" : ""}</td><td>{money(leader.totalValue)}{!leader.quotesComplete ? " *" : ""}</td><td>{leader.returnPercent >= 0 ? "+" : ""}{leader.returnPercent.toFixed(2)}%</td></tr>
          )}</tbody></table></div>}
      </section>
      <footer className="dashboard-footer">BYLA Markets · Educational simulation only · No real money is involved.</footer>
    </main>
  );
}
