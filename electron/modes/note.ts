import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "note",
  label: "Note",
  description: "Structured notes with summary, bullets, and action items.",
  route: "notes",
  system:
    "Be concrete and concise. Do not invent details. " +
    "If unknown, use empty string for required strings and empty arrays for lists.",
  userHint:
    "Create a clear summary plus bullets (3-7). Actions should be imperative. " +
    "Unknown: empty arrays for actions/decisions/questions, empty string for title/summary.",
  dataSchemaJson: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      bullets: { type: "array", items: { type: "string" } },
      action_items: { type: "array", items: { type: "string" } },
      decisions: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } }
    },
    required: ["title", "summary", "bullets", "action_items", "decisions", "questions"]
  },
  dataSchemaZod: z.object({
    title: z.string(),
    summary: z.string(),
    bullets: z.array(z.string()),
    action_items: z.array(z.string()),
    decisions: z.array(z.string()),
    questions: z.array(z.string())
  })
};
