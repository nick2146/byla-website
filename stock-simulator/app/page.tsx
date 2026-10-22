"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const watchlist = [
  { symbol: "AAPL", name: "Apple", price: "Market quote required", change: "—" },
  { symbol: "MSFT", name: "Microsoft", price: "Market quote required", change: "—" },
  { symbol: "NVDA", name: "NVIDIA", price: "Market quote required", change: "—" },
  { symbol: "TSLA", name: "Tesla", price: "Market quote required", change: "—" },
];

export default function Home() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("Create an account to start your virtual portfolio.");
  const [busy, setBusy] = useState(false);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const supabase = createClient();
    const result = mode === "signup" ? await supabase.auth.signUp({ email, password, options: { data: { username } } }) : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) { setNotice(result.error.message); return; }
    if (mode === "signup" && !result.data.session) { setNotice("Check your email to confirm your account, then sign in."); return; }
    if (result.data.user) { window.location.href = "/dashboard"; }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="BYLA Markets home">
          <span className="brand-mark">B</span>
          <span>BYLA <b>MARKETS</b><small>STUDENT PAPER TRADING</small></span>
        </a>
        <nav><a href="#markets">Markets</a><a href="#learn">Learn</a><a href="#leaderboard">Leaderboard</a></nav>
        <a className="top-cta" href="#account">Get started <span>↗</span></a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> BUILT FOR THE NEXT GENERATION OF INVESTORS</div>
          <h1>Learn the market.<br /><em>Own your decisions.</em></h1>
          <p>Practice investing with virtual money, explore real-world market data, and build your financial confidence — without risking a dollar.</p>
          <div className="hero-actions"><a className="button primary" href="#account">Start with $100,000 virtual cash ↗</a><a className="button secondary" href="#learn">How it works</a></div>
          <div className="trust-row"><span>✓ No real money</span><span>✓ Beginner-friendly</span><span>✓ Learn by doing</span></div>
        </div>
        <aside className="account-card" id="account">
          <div className="card-heading"><div><span className="muted">YOUR PAPER TRADING ACCOUNT</span><h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2></div><div className="secure-icon">↗</div></div>
          <p className="card-subtitle">Your virtual portfolio starts at $100,000.</p>
          <div className="mode-switch"><button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>Create account</button><button className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")}>Sign in</button></div>
          <form onSubmit={submitAuth}>
            {mode === "signup" && <label>Public username<input type="text" autoComplete="nickname" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required value={username} onChange={e => setUsername(e.target.value)} placeholder="MarketLearner24" /></label>}
            <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
            <button className="button primary full" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"} <span>→</span></button>
          </form>
          <p className="notice" role="status">{notice}</p>
          <p className="legal">By continuing, you agree this is an educational simulation. No real trades are placed.</p>
        </aside>
      </section>

      <section className="metrics" aria-label="Platform highlights">
        <div><strong>$100,000</strong><span>Starting virtual balance</span></div>
        <div><strong>Real-world data</strong><span>Provider connection pending</span></div>
        <div><strong>Zero risk</strong><span>Virtual money only</span></div>
        <div><strong>All skill levels</strong><span>Learn at your own pace</span></div>
      </section>

      <section className="market-section" id="markets">
        <div className="section-head"><div><span className="eyebrow">MARKET WATCH</span><h2>Explore the companies<br />shaping the world.</h2></div><span className="market-status"><i /> Live data activates after provider setup</span></div>
        <div className="stocks">{watchlist.map(stock => <article className="stock" key={stock.symbol}><div className="stock-symbol">{stock.symbol.slice(0, 1)}</div><div className="stock-main"><b>{stock.symbol}</b><span>{stock.name}</span></div><div className="stock-price"><b>{stock.price}</b><span>{stock.change}</span></div></article>)}</div>
        <p className="disclaimer">Prices are not displayed until a licensed market-data provider is configured. This preview does not show live quotes.</p>
      </section>

      <section className="learn-section" id="learn">
        <div><span className="eyebrow">LEARN BY DOING</span><h2>More than a trading game.</h2><p>Understand what moves markets, practice making decisions, and learn to think about risk before investing real money in the future.</p></div>
        <div className="learn-grid"><article><span>01</span><h3>Build a portfolio</h3><p>Choose companies and understand how holdings fit together.</p></article><article><span>02</span><h3>Track performance</h3><p>See how your portfolio changes as market prices move.</p></article><article id="leaderboard"><span>03</span><h3>Climb the leaderboard</h3><p>Compare paper-trading performance with other learners.</p></article></div>
      </section>

      <footer><a className="brand" href="#"><span className="brand-mark">B</span><span>BYLA <b>MARKETS</b></span></a><span>Educational simulation only · Virtual money, real-world learning.</span><span>© BYLA Markets</span></footer>
    </main>
  );
}
