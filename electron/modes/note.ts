import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "note",
  label: "Note",
  description: "Structured notes with summary, bullets, and action items.",
  route: "notes",
  system: "You fill the JSON schema exactly. Do not add extra keys.",
  userHint:
    "Create a clear summary plus bullets. Use empty arrays if there are no actions/decisions/questions.",
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
