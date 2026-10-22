import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const [portfolioResult, positionsResult, tradesResult] = await Promise.all([
      admin.from("portfolios").select("cash,updated_at").eq("user_id", user.id).maybeSingle(),
      admin.from("positions").select("symbol,quantity,average_cost,updated_at").eq("user_id", user.id).order("symbol"),
      admin.from("trades").select("id,symbol,side,quantity,price,total,quote_as_of,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (portfolioResult.error || positionsResult.error || tradesResult.error) throw new Error("Portfolio query failed");
    return NextResponse.json({ portfolio: portfolioResult.data, positions: positionsResult.data ?? [], trades: tradesResult.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Portfolio service is not configured yet." }, { status: 503 });
  }
}
