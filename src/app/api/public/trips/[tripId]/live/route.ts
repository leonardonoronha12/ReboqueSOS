import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: live } = await supabaseAdmin
    .from("tow_live_location")
    .select("lat,lng,updated_at")
    .eq("trip_id", tripId)
    .maybeSingle();

  return NextResponse.json({ live: live ?? null }, { status: 200 });
}

