import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ canTransmit: false }, { status: 200 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ canTransmit: false }, { status: 200 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ canTransmit: false }, { status: 200 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,driver_id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return NextResponse.json({ canTransmit: false }, { status: 200 });
  if (profile.role === "admin") return NextResponse.json({ canTransmit: true }, { status: 200 });
  return NextResponse.json({ canTransmit: String(trip.driver_id) === user.id }, { status: 200 });
}

