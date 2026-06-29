import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { audit, readAgentStore, writeAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";

type LineWebhookEvent = {
  type: string;
  timestamp?: number;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
  follow?: {
    isUnblocked?: boolean;
  };
};

function verifyLineSignature(body: string, signature: string | null) {
  const secret = serverEnv("LINE_CHANNEL_SECRET");
  if (!secret) return { ok: false, reason: "LINE_CHANNEL_SECRET is not configured" };
  if (!signature) return { ok: false, reason: "Missing x-line-signature" };

  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return { ok: false, reason: "Invalid signature" };
  return { ok: timingSafeEqual(expectedBuffer, actualBuffer), reason: "Invalid signature" };
}

function eventSummary(event: LineWebhookEvent) {
  const source = event.source?.userId || event.source?.groupId || event.source?.roomId || "unknown-source";
  const text = event.message?.text ? ` text="${event.message.text.slice(0, 80)}"` : "";
  return `${event.type} from ${source}${text}`;
}

export const Route = createFileRoute("/api/line-webhook")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          endpoint: "/api/line-webhook",
          mode: "LINE Messaging API webhook",
          checkedAt: new Date().toISOString(),
        }),
      POST: async ({ request }) => {
        const body = await request.text();
        const verification = verifyLineSignature(body, request.headers.get("x-line-signature"));
        if (!verification.ok) {
          return Response.json({ ok: false, error: verification.reason }, { status: 401 });
        }

        const payload = JSON.parse(body || "{}") as { events?: LineWebhookEvent[]; destination?: string };
        const events = Array.isArray(payload.events) ? payload.events : [];
        const store = readAgentStore();

        for (const event of events) {
          audit(store, {
            actor: "system",
            action: "line_webhook_received",
            detail: eventSummary(event),
          });
        }

        writeAgentStore(store);
        return Response.json({
          ok: true,
          received: events.length,
          checkedAt: new Date().toISOString(),
        });
      },
    },
  },
});
