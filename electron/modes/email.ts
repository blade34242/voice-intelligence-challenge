import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "email",
  label: "Email",
  description: "Email draft with subject, body, recipients, and intent.",
  route: "email",
  system: "You fill the JSON schema exactly. Do not add extra keys.",
  userHint:
    "Draft a clear email. Use empty arrays for unknown recipients. Include intent and tone.",
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
