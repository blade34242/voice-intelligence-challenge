import Store from "electron-store";

export type AppSettings = {
  apiKey?: string;
  n8nWebhookUrl?: string;
  n8nSharedSecret?: string;
  hotkey?: string;
  sttLanguage?: string;
  sttModel?: string;
  sttTransport?: string;
};

const DEFAULT_HOTKEY = "CommandOrControl+Shift+Space";

const store = new Store<AppSettings>({
  defaults: {
    hotkey: DEFAULT_HOTKEY
  }
});

export function getApiKey(): string | undefined {
  return store.get("apiKey");
}

export function getSettingsSafe() {
  const hotkey = store.get("hotkey", DEFAULT_HOTKEY);
  return {
    hotkey,
    apiKeyPresent: Boolean(store.get("apiKey")),
    n8nWebhookUrl: store.get("n8nWebhookUrl", ""),
    n8nSecretPresent: Boolean(store.get("n8nSharedSecret")),
    sttLanguage: store.get("sttLanguage", "auto"),
    sttModel: store.get("sttModel", "gpt-4o-transcribe"),
    sttTransport: store.get("sttTransport", "batch")
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
      store.delete("apiKey");
    } else {
      store.set("apiKey", trimmed);
    }
  }
  if (input.n8nWebhookUrl !== undefined) {
    store.set("n8nWebhookUrl", input.n8nWebhookUrl.trim());
  }
  if (input.n8nSharedSecret !== undefined) {
    store.set("n8nSharedSecret", input.n8nSharedSecret.trim());
  }
  if (input.sttLanguage !== undefined) {
    store.set("sttLanguage", input.sttLanguage.trim());
  }
  if (input.sttModel !== undefined) {
    store.set("sttModel", input.sttModel.trim());
  }
  if (input.sttTransport !== undefined) {
    store.set("sttTransport", input.sttTransport.trim());
  }
  if (input.hotkey !== undefined) {
    store.set("hotkey", input.hotkey.trim());
  }
}

export function getHotkey(): string {
  return store.get("hotkey", DEFAULT_HOTKEY);
}

export function getN8nConfig() {
  return {
    url: store.get("n8nWebhookUrl", "").trim(),
    secret: store.get("n8nSharedSecret", "").trim()
  };
}

export function getSttLanguage(): string {
  return store.get("sttLanguage", "auto");
}

export function getSttModel(): string {
  return store.get("sttModel", "gpt-4o-transcribe");
}

export function getSttTransport(): string {
  return store.get("sttTransport", "batch");
}
