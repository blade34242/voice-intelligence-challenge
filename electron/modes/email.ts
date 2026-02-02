import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "email",
  label: "Email",
  description: "Email draft with subject, body, recipients, and intent.",
  route: "email",
  system:
    "Be concrete and concise. Do not invent recipients. " +
    "If unknown, use empty string for required strings and empty arrays for recipients.",
  userHint:
    "Draft a clear email. Subject short; body 4-8 sentences. " +
    "Unknown: empty arrays for to/cc/bcc, empty string for subject/body/intent/tone.",
  dataSchemaJson: {
    type: "object",
    additionalProperties: false,
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      to: { type: "array", items: { type: "string" } },
      cc: { type: "array", items: { type: "string" } },
      bcc: { type: "array", items: { type: "string" } },
      intent: { type: "string" },
      tone: { type: "string" }
    },
    required: ["subject", "body", "to", "cc", "bcc", "intent", "tone"]
  },
  dataSchemaZod: z.object({
    subject: z.string(),
    body: z.string(),
    to: z.array(z.string()),
    cc: z.array(z.string()),
    bcc: z.array(z.string()),
    intent: z.string(),
    tone: z.string()
  })
};
