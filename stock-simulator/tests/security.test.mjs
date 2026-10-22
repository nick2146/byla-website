import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
test("service-role key is isolated to a server-only module", async () => {
  const admin = await read("../lib/supabase/admin.ts");
  const client = await read("../lib/supabase/client.ts");
  assert.match(admin, /import ["']server-only["']/);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(client, /SERVICE_ROLE|MARKET_DATA_API_KEY/);
});
test("trade endpoint authenticates user and fetches provider quote on server", async () => {
  const route = await read("../app/api/trade/route.ts");
  assert.match(route, /session\.auth\.getUser\(\)/);
  assert.match(route, /getMarketQuote\(parsed\.data\.symbol\)/);
  assert.match(route, /p_user_id:\s*user\.id/);
  assert.doesNotMatch(route, /body\.price|parsed\.data\.price/);
  assert.match(route, /900000/);
});
test("quote endpoint requires authentication and never exposes provider token", async () => {
  const route = await read("../app/api/quote/route.ts");
  assert.match(route, /session\.auth\.getUser\(\)/);
  assert.match(route, /getMarketQuote/);
  assert.doesNotMatch(route, /MARKET_DATA_API_KEY/);
});
test("database locks down direct trade writes and service-role function execution", async () => {
  const sql = await read("../supabase/schema.sql");
  assert.match(sql, /alter table public\.portfolios enable row level security/);
  assert.match(sql, /revoke all on function public\.execute_paper_trade[\s\S]*from authenticated/);
  assert.match(sql, /grant execute on function public\.execute_paper_trade[\s\S]*to service_role/);
  assert.match(sql, /for update/);
  assert.match(sql, /INSUFFICIENT_CASH/);
  assert.match(sql, /INSUFFICIENT_SHARES/);
  assert.match(sql, /consume_api_rate_limit/);
  assert.match(sql, /grant execute on function public\.consume_api_rate_limit[\s\S]*to service_role/);
});
test("leaderboard requires a signed-in session and does not return auth IDs", async () => {
  const route = await read("../app/api/leaderboard/route.ts");
  assert.match(route, /session\.auth\.getUser\(\)/);
  assert.match(route, /isCurrentUser/);
  assert.doesNotMatch(route, /return \{userId:/);
});
