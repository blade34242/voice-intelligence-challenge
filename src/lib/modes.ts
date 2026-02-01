import { Mode } from "./schemas";

export const MODES: { id: Mode; label: string; description: string }[] = [
  { id: "auto", label: "Auto", description: "LLM decides" },
  { id: "event", label: "Event", description: "Calendar event" },
  { id: "email", label: "Email", description: "Draft email" },
  { id: "note", label: "Note", description: "Structured notes" },
  { id: "ticket", label: "Ticket", description: "Bug/issue format" }
];
