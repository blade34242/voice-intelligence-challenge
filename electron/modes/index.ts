import fs from "fs";
import path from "path";
import { ModeDefinition } from "./types";

let cachedModes: ModeDefinition[] | null = null;

function getModesDir() {
  return __dirname;
}

function loadModeFiles(): string[] {
  const dir = getModesDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir);
  const hasTs = entries.some((file) => file.endsWith(".ts"));
  const ext = hasTs ? ".ts" : ".js";
  return entries
    .filter((file) => file.endsWith(ext))
    .filter((file) => !file.startsWith("_") && !file.startsWith("index."));
}

export function loadModes(): ModeDefinition[] {
  if (cachedModes) return cachedModes;
  const files = loadModeFiles();
  const modes: ModeDefinition[] = [];
  for (const file of files) {
    const fullPath = path.join(getModesDir(), file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(fullPath);
    const mode = (mod?.mode ?? mod?.default) as ModeDefinition | undefined;
    if (mode?.id) {
      modes.push(mode);
    }
  }
  cachedModes = modes;
  return modes;
}

export function getModeById(id: string): ModeDefinition | undefined {
  return loadModes().find((mode) => mode.id === id);
}

export function listModes() {
  return loadModes().map((mode) => ({
    id: mode.id,
    label: mode.label,
    description: mode.description,
    route: mode.route
  }));
}

export function listModeDefinitions(): ModeDefinition[] {
  return loadModes();
}
