import { getRequiredEnv, getOptionalEnv } from "@/lib/env";

export type WhatsAppProvider = "twilio" | "zapi" | "custom";

export async function sendWhatsAppMessage(input: { to: string; body: string }) {
  const provider = (getOptionalEnv("WHATSAPP_PROVIDER") ?? "custom") as WhatsAppProvider;

  if (provider === "twilio") {
    const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
    const from = getRequiredEnv("TWILIO_WHATSAPP_FROM");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const form = new URLSearchParams();
    form.set("To", input.to.startsWith("whatsapp:") ? input.to : `whatsapp:${input.to}`);
    form.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
    form.set("Body", input.body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio WhatsApp error: ${res.status} ${text}`);
    }

    return { ok: true as const };
  }

  if (provider === "zapi") {
    const baseUrl = getRequiredEnv("ZAPI_BASE_URL");
    const token = getRequiredEnv("ZAPI_TOKEN");
    const instanceId = getRequiredEnv("ZAPI_INSTANCE_ID");
    const clientToken = getOptionalEnv("ZAPI_CLIENT_TOKEN");

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({
        phone: input.to.replace(/[\s()-]/g, ""),
        message: input.body,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Z-API WhatsApp error: ${res.status} ${text}`);
    }

    return { ok: true as const };
  }

  const webhookUrl = getRequiredEnv("WHATSAPP_WEBHOOK_URL");
  const bearer = getOptionalEnv("WHATSAPP_WEBHOOK_BEARER");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Custom WhatsApp webhook error: ${res.status} ${text}`);
  }

  return { ok: true as const };
}
