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
  const whatsappProvider = process.env.WHATSAPP_PROVIDER ?? "custom";
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? null;
  const stripeMode = stripeKey?.startsWith("sk_test_") ? "test" : stripeKey?.startsWith("sk_live_") ? "live" : null;

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
      whatsapp: {
        provider: whatsappProvider,
        custom_configured: pickSet("WHATSAPP_WEBHOOK_URL"),
        twilio_configured: pickSet("TWILIO_ACCOUNT_SID") && pickSet("TWILIO_AUTH_TOKEN") && pickSet("TWILIO_WHATSAPP_FROM"),
        zapi_configured: pickSet("ZAPI_BASE_URL") && pickSet("ZAPI_TOKEN") && pickSet("ZAPI_INSTANCE_ID"),
      },
      stripe: {
        secret_key_configured: pickSet("STRIPE_SECRET_KEY"),
        publishable_key_configured: pickSet("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
        webhook_secret_configured: pickSet("STRIPE_WEBHOOK_SECRET"),
        mode: stripeMode,
      },
    },
    { status: 200 },
  );
}
