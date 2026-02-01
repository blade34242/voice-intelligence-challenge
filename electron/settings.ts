export type AppSettings = {
  apiKey?: string;
  n8nWebhookUrl?: string;
  n8nSharedSecret?: string;
  hotkey?: string;
  sttLanguage?: string;
  sttModel?: string;
  sttTransport?: string;
};

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+Space";

let store: any | null = null;
let storeInit: Promise<any> | null = null;

async function ensureStore() {
  if (store) return store;
  if (!storeInit) {
    storeInit = import("electron-store").then((mod) => {
      const Store = mod.default ?? mod;
      store = new Store<AppSettings>({
        defaults: {
          hotkey: DEFAULT_HOTKEY
        }
      });
      return store;
    });
  }
  return storeInit;
}

function getStore() {
  if (!store) {
    throw new Error("Settings store not initialized. Call initSettingsStore() first.");
  }
  return store;
}

export async function initSettingsStore() {
  await ensureStore();
}

export function getApiKey(): string | undefined {
  return getStore().get("apiKey");
}

export function getSettingsSafe() {
  const hotkey = normalizeHotkey(getStore().get("hotkey", DEFAULT_HOTKEY));
  return {
    hotkey,
    apiKeyPresent: Boolean(getStore().get("apiKey")),
    n8nWebhookUrl: getStore().get("n8nWebhookUrl", ""),
    n8nSecretPresent: Boolean(getStore().get("n8nSharedSecret")),
    sttLanguage: getStore().get("sttLanguage", "auto"),
    sttModel: getStore().get("sttModel", "gpt-4o-transcribe"),
    sttTransport: getStore().get("sttTransport", "batch")
  };
}

export function setSettings(input: {
  apiKey?: string;
  n8nWebhookUrl?: string;
  n8nSharedSecret?: string;
  sttLanguage?: string;
  sttModel?: string;
  sttTransport?: string;
  hotkey?: string;
}) {
  if (input.apiKey !== undefined) {
    const trimmed = input.apiKey.trim();
    if (trimmed.length === 0) {
      getStore().delete("apiKey");
    } else {
      getStore().set("apiKey", trimmed);
    }
  }
  if (input.n8nWebhookUrl !== undefined) {
    getStore().set("n8nWebhookUrl", input.n8nWebhookUrl.trim());
  }
  if (input.n8nSharedSecret !== undefined) {
    getStore().set("n8nSharedSecret", input.n8nSharedSecret.trim());
  }
  if (input.sttLanguage !== undefined) {
    getStore().set("sttLanguage", input.sttLanguage.trim());
  }
  if (input.sttModel !== undefined) {
    getStore().set("sttModel", input.sttModel.trim());
  }
  if (input.sttTransport !== undefined) {
    getStore().set("sttTransport", input.sttTransport.trim());
  }
  if (input.hotkey !== undefined) {
    getStore().set("hotkey", normalizeHotkey(input.hotkey.trim()));
  }
}

export function getHotkey(): string {
  return normalizeHotkey(getStore().get("hotkey", DEFAULT_HOTKEY));
}

export function getN8nConfig() {
  return {
    url: getStore().get("n8nWebhookUrl", "").trim(),
    secret: getStore().get("n8nSharedSecret", "").trim()
  };
}

export function getSttLanguage(): string {
  return getStore().get("sttLanguage", "auto");
}

export function getSttModel(): string {
  return getStore().get("sttModel", "gpt-4o-transcribe");
}

export function getSttTransport(): string {
  return getStore().get("sttTransport", "batch");
}

export function normalizeHotkey(value: string) {
  return value.replace(/SPACE/gi, "Space");
}
