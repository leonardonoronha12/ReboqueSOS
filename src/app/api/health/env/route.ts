import { NextResponse } from "next/server";

function pickSet(name: string) {
  return Boolean(process.env[name]);
}

function pickFirstSet(names: string[]) {
  for (const name of names) {
    if (process.env[name]) return name;
  }
  return null;
}

export async function GET() {
  const supabaseUrlKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"];
  const supabaseAnonKeys = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"];

  return NextResponse.json(
    {
      runtime: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        VERCEL: process.env.VERCEL ?? null,
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      supabase: {
        url_configured: supabaseUrlKeys.some(pickSet),
        anon_configured: supabaseAnonKeys.some(pickSet),
        service_role_configured: pickSet("SUPABASE_SERVICE_ROLE_KEY"),
        url_key_used: pickFirstSet(supabaseUrlKeys),
        anon_key_used: pickFirstSet(supabaseAnonKeys),
      },
      google_maps: {
        api_key_configured: pickSet("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") || pickSet("GOOGLE_MAPS_API_KEY"),
      },
    },
    { status: 200 },
  );
}

