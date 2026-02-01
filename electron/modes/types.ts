import { z } from "zod";

export type ModeDefinition = {
  id: string;
  label: string;
  description: string;
  route: string;
  system: string;
  userHint: string;
  dataSchemaJson: Record<string, unknown>;
  dataSchemaZod: z.ZodTypeAny;
};
