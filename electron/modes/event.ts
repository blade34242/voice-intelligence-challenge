import { z } from "zod";
import { ModeDefinition } from "./types";

export const mode: ModeDefinition = {
  id: "event",
  label: "Event",
  description: "Calendar event details with date/time, location, attendees, and reminders.",
  route: "calendar",
  system: "You fill the JSON schema exactly. Do not add extra keys.",
  userHint:
    "Extract a calendar event. Use null for unknown date/time/timezone/location/duration. Use empty arrays if unknown.",
  dataSchemaJson: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      date: { type: ["string", "null"] },
      time: { type: ["string", "null"] },
      timezone: { type: ["string", "null"] },
      location: { type: ["string", "null"] },
      attendees: { type: "array", items: { type: "string" } },
      duration_minutes: { type: ["number", "null"] },
      description: { type: "string" },
      reminders: { type: "array", items: { type: "string" } }
    },
    required: [
      "title",
      "date",
      "time",
      "timezone",
      "location",
      "attendees",
      "duration_minutes",
      "description",
      "reminders"
    ]
  },
  dataSchemaZod: z.object({
    title: z.string(),
    date: z.string().nullable(),
    time: z.string().nullable(),
    timezone: z.string().nullable(),
    location: z.string().nullable(),
    attendees: z.array(z.string()),
    duration_minutes: z.number().nullable(),
    description: z.string(),
    reminders: z.array(z.string())
  })
};
