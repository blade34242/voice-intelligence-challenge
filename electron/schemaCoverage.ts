import { RunOutput } from "../src/lib/schemas";
import { ModeDefinition } from "./modes/types";

export type CoverageInfo = {
  percent: number;
  filled: number;
  total: number;
  missing: string[];
};

export function computeCoverage(mode: ModeDefinition, result: RunOutput): CoverageInfo {
  const dataSchema = mode.dataSchemaJson as { required?: string[] };
  const required = Array.isArray(dataSchema?.required) ? dataSchema.required : [];
  const data = (result?.data ?? {}) as Record<string, unknown>;
  const missing: string[] = [];
  let filled = 0;

  for (const key of required) {
    const value = data[key];
    if (isFilled(value)) {
      filled += 1;
    } else {
      missing.push(key);
    }
  }

  const total = required.length;
  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  return { percent, filled, total, missing };
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.some((item) => isFilled(item));
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
}
