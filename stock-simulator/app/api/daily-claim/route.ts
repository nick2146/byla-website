import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data, error: claimError } = await admin.from("daily_cash_claims")
      .select("last_claimed_at").eq("user_id", user.id).maybeSingle();
    if (claimError) throw claimError;
    const last = data?.last_claimed_at ? new Date(data.last_claimed_at).getTime() : 0;
    const next = last ? last + 24 * 60 * 60 * 1000 : 0;
    return NextResponse.json({ canClaim: !last || Date.now() >= next, nextClaimAt: next ? new Date(next).toISOString() : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Daily reward status is unavailable." }, { status: 503 });
  }
}

export async function POST() {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data, error: claimError } = await session.rpc("claim_daily_virtual_cash");
  if (claimError) return NextResponse.json({ error: claimError.message || "Could not claim virtual cash." }, { status: 400 });
  if (!data?.claimed) return NextResponse.json({ error: "You have already claimed today's reward.", ...data }, { status: 429 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
