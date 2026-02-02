import { z } from "zod";
import { Mode, RunOutput, ChangeLogEntry, changeLogEntrySchema } from "../src/lib/schemas";
import { getApiKey } from "./settings";
import { getModeById, listModes, listModeDefinitions } from "./modes";
import { ModeDefinition } from "./modes/types";

const ENRICH_MODEL = "gpt-4o-mini";
const CLASSIFY_MODEL = "gpt-4o-mini";

export async function enrichTranscript(params: { transcript: string; mode: Mode }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key missing. Add it in Settings.");
  }

  const chosenModeId = params.mode === "auto" ? await classifyMode(apiKey, params.transcript) : params.mode;
  const mode = resolveMode(chosenModeId);
  const schema = buildEnvelopeJsonSchema(mode.dataSchemaJson);
  const validator = buildEnvelopeZodSchema(mode.dataSchemaZod);

  const system =
    "You are an assistant that must return STRICT JSON that matches the provided schema. Do not add extra keys. " +
    "Always fill clean_transcript, summary, actions, tags, and data. " +
    mode.system;
  const user =
    `Transcript:\n${params.transcript}\n\n` +
    `Mode: ${mode.id.toUpperCase()}\n` +
    `Instructions: ${mode.userHint}`;

  const response = await callOpenAI(apiKey, system, user, schema);
  const parsed = parseAndValidate(response, validator);
  if (parsed.ok) {
    return { result: parsed.value as RunOutput, mode: mode.id };
  }

  const retryResponse = await callOpenAI(
    apiKey,
    system,
    `Fix the JSON to match the schema exactly. Return only JSON.\n\n${JSON.stringify(response)}`,
    schema
  );
  const retryParsed = parseAndValidate(retryResponse, validator);
  if (retryParsed.ok) {
    return { result: retryParsed.value as RunOutput, mode: mode.id };
  }

  throw new Error("Enrichment JSON did not match schema.");
}

export async function updateWithFollowUp(params: {
  transcript: string;
  mode: Mode;
  previous: RunOutput;
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key missing. Add it in Settings.");
  }

  const fallbackMode = listModes()[0]?.id ?? "note";
  const mode = resolveMode(params.mode === "auto" ? fallbackMode : params.mode);
  const schema = buildUpdateJsonSchema(mode.dataSchemaJson);
  const validator = buildUpdateZodSchema(mode.dataSchemaZod);
  const system =
    "You are updating existing structured data with a follow-up transcript. " +
    "Return STRICT JSON matching the provided schema. Update only what changed. " +
    "Keep unchanged fields the same. " +
    "Set clean_transcript to the concatenation of the previous clean_transcript and the new transcript separated by a newline. " +
    mode.system;

  const user =
    `Previous structured result (JSON):\n${JSON.stringify(params.previous)}\n\n` +
    `New follow-up transcript:\n${params.transcript}\n\n` +
    `Mode: ${mode.id.toUpperCase()}\n` +
    `Instructions: ${mode.userHint}\n` +
    "Provide change_log entries with path, before, and after. Use null for unknown values.";

  const response = await callOpenAI(apiKey, system, user, schema);
  const parsed = parseAndValidateUpdate(response, validator);
  if (parsed.ok) {
    const changeLog = buildChangeLog(params.previous, parsed.value.result as RunOutput);
    return {
      result: parsed.value.result as RunOutput,
      mode: mode.id,
      changeLog
    };
  }

  const retryResponse = await callOpenAI(
    apiKey,
    system,
    `Fix the JSON to match the schema exactly. Return only JSON.\n\n${JSON.stringify(response)}`,
    schema
  );
  const retryParsed = parseAndValidateUpdate(retryResponse, validator);
  if (retryParsed.ok) {
    const changeLog = buildChangeLog(params.previous, retryParsed.value.result as RunOutput);
    return {
      result: retryParsed.value.result as RunOutput,
      mode: mode.id,
      changeLog
    };
  }

  throw new Error("Update JSON did not match schema.");
}

async function callOpenAI(
  apiKey: string,
  system: string,
  user: string,
  schema: Record<string, unknown>
) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ENRICH_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "enriched_output",
          strict: true,
          schema
        }
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errorText}`);
  }

  return res.json();
}

async function classifyMode(apiKey: string, transcript: string): Promise<string> {
  const modes = listModes();
  const modeIds = modes.map((m) => m.id);
  const descriptions = modes.map((m) => `${m.id}: ${m.description}`).join("\n");
  const system =
    "Choose the best mode id for the transcript. Return JSON only.\n" +
    `Available modes:\n${descriptions}`;
  const user = `Transcript:\n${transcript}\n\nReturn the best mode id.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CLASSIFY_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mode_select",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { type: "string", enum: modeIds }
            },
            required: ["mode"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    return "note";
  }

  try {
    const payload = extractJsonPayload(await response.json());
    const mode = payload?.mode;
    if (modeIds.includes(mode)) {
      return mode;
    }
  } catch {
    // ignore
  }

  return modeIds[0] ?? "note";
}

function parseAndValidate(
  response: any,
  validator: z.ZodType<RunOutput>
): { ok: true; value: RunOutput } | { ok: false; error: string } {
  try {
    const payload = extractJsonPayload(response);
    const value = validator.parse(payload);
    return { ok: true, value };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Validation error" };
  }
}

function parseAndValidateUpdate(
  response: any,
  validator: z.ZodType<{ result: RunOutput; change_log: ChangeLogEntry[] }>
): { ok: true; value: { result: RunOutput; change_log: ChangeLogEntry[] } } | { ok: false; error: string } {
  try {
    const payload = extractJsonPayload(response);
    const value = validator.parse(payload);
    return { ok: true, value };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Validation error" };
  }
}

function extractJsonPayload(response: any) {
  if (response?.output_text) {
    return JSON.parse(response.output_text);
  }

  const content = response?.output?.[0]?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item?.type === "output_json" && item?.json) {
        return item.json;
      }
      if (item?.text && typeof item.text === "string") {
        return JSON.parse(item.text);
      }
    }
  }

  if (response?.text && typeof response.text === "string") {
    return JSON.parse(response.text);
  }

  return response;
}

function buildChangeLog(previous: RunOutput, next: RunOutput): ChangeLogEntry[] {
  const changes: ChangeLogEntry[] = [];
  const add = (path: string, before: unknown, after: unknown) => {
    if (isEqual(before, after)) return;
    changes.push({
      path,
      before: stringifyValue(before),
      after: stringifyValue(after)
    });
  };

  add("clean_transcript", previous.clean_transcript, next.clean_transcript);
  add("summary", previous.summary, next.summary);
  add("actions", previous.actions, next.actions);
  add("tags", previous.tags, next.tags);

  const prevData = (previous.data ?? {}) as Record<string, unknown>;
  const nextData = (next.data ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(prevData), ...Object.keys(nextData)]);
  for (const key of keys) {
    add(`data.${key}`, prevData[key], nextData[key]);
  }

  return changes;
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a === "object" && typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function resolveMode(id: string): ModeDefinition {
  const mode = getModeById(id);
  if (!mode) {
    const fallback = listModeDefinitions()[0];
    if (!fallback) {
      throw new Error("No modes found. Add mode definitions in electron/modes.");
    }
    return fallback;
  }
  return mode;
}

function buildEnvelopeZodSchema(dataSchema: z.ZodTypeAny): z.ZodType<RunOutput> {
  return z
    .object({
      clean_transcript: z.string(),
      summary: z.string(),
      actions: z.array(z.string()),
      tags: z.array(z.string()),
      data: dataSchema
    })
    .transform((value) => value as RunOutput);
}

function buildEnvelopeJsonSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      clean_transcript: { type: "string" },
      summary: { type: "string" },
      actions: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      data: dataSchema
    },
    required: ["clean_transcript", "summary", "actions", "tags", "data"]
  };
}

function buildUpdateZodSchema(
  dataSchema: z.ZodTypeAny
): z.ZodType<{ result: RunOutput; change_log: ChangeLogEntry[] }> {
  return z.object({
    result: buildEnvelopeZodSchema(dataSchema),
    change_log: z.array(changeLogEntrySchema)
  });
}

function buildUpdateJsonSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      result: buildEnvelopeJsonSchema(dataSchema),
      change_log: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            before: { type: ["string", "null"] },
            after: { type: ["string", "null"] }
          },
          required: ["path", "before", "after"]
        }
      }
    },
    required: ["result", "change_log"]
  };
}
