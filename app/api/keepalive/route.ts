import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("users").select("id").limit(1);

  if (error) {
    console.error("[keepalive] Supabase ping failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log("[keepalive] Supabase ping OK at", new Date().toISOString());
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
