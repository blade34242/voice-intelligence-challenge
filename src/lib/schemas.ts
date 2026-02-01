import { z } from "zod";

export type Mode = string;

export type RunOutput = {
  clean_transcript: string;
  summary: string;
  actions: string[];
  tags: string[];
  data: Record<string, unknown>;
};

export const changeLogEntrySchema = z.object({
  path: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable()
});

export type ChangeLogEntry = z.infer<typeof changeLogEntrySchema>;
