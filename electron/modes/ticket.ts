import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "ticket",
  label: "Ticket",
  description: "Issue/bug ticket with impact, environment, and clear steps.",
  route: "ticket",
  system:
    "Be concrete and concise. Do not invent steps or environment. " +
    "If unknown, use empty string for required strings and empty arrays for steps.",
  userHint:
    "Create a clear issue ticket. Title short; steps as bullet sentences. " +
    "Unknown: empty string for text fields, empty array for steps; severity must be low/medium/high.",
  dataSchemaJson: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      impact: { type: "string" },
      environment: { type: "string" },
      context: { type: "string" },
      steps: { type: "array", items: { type: "string" } },
      expected: { type: "string" },
      actual: { type: "string" },
      severity: { type: "string", enum: ["low", "medium", "high"] }
    },
    required: ["title", "impact", "environment", "context", "steps", "expected", "actual", "severity"]
  },
  dataSchemaZod: z.object({
    title: z.string(),
    impact: z.string(),
    environment: z.string(),
    context: z.string(),
    steps: z.array(z.string()),
    expected: z.string(),
    actual: z.string(),
    severity: z.enum(["low", "medium", "high"])
  })
};
