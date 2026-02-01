import { getN8nConfig } from "./settings";

export type WebhookPayload = {
  source: "everlast";
  created_at: string;
  mode: string;
  kind: string;
  route?: string;
  transcript: string;
  result: unknown;
};

export async function sendWebhook(payload: WebhookPayload) {
  const config = getN8nConfig();
  if (!config.url) {
    return { ok: false, skipped: true };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (config.secret) {
    headers["X-Everlast-Secret"] = config.secret;
  }

  const res = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, message: text };
  }

  return { ok: true };
}
