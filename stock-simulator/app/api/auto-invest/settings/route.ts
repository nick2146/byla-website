import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OWNER_USER_ID = "1db3a657-6ec0-45d5-b204-40a6fb29e699";

export async function GET() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.id !== OWNER_USER_ID) return NextResponse.json({ enabled: false, ownerOnly: true });
  const admin = createAdminClient();
  const { data, error: queryError } = await admin.from("auto_invest_settings")
    .select("enabled,last_run_at").eq("user_id", OWNER_USER_ID).maybeSingle();
  if (queryError) return NextResponse.json({ error: "Auto-invest settings unavailable." }, { status: 503 });
  return NextResponse.json({ enabled: Boolean(data?.enabled), lastRunAt: data?.last_run_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.id !== OWNER_USER_ID) return NextResponse.json({ error: "This control is restricted to the account owner." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Choose whether auto-investing should be enabled." }, { status: 400 });
  const admin = createAdminClient();
  const { error: updateError } = await admin.from("auto_invest_settings")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() }).eq("user_id", OWNER_USER_ID);
  if (updateError) return NextResponse.json({ error: "Could not update auto-invest settings." }, { status: 503 });
  return NextResponse.json({ enabled: body.enabled });
}
