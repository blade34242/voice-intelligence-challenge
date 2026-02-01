import { contextBridge, ipcRenderer } from "electron";

const validChannels = new Set([
  "overlay.open",
  "overlay.hide",
  "settings.get",
  "settings.set",
  "settings.open",
  "stt.start",
  "stt.audioFrame",
  "stt.stop",
  "stt.realtimeCheck",
  "llm.enrich",
  "llm.update",
  "clipboard.copy",
  "export.json",
  "export.md",
  "n8n.webhook",
  "history.list",
  "history.get",
  "history.rename",
  "modes.list"
]);

const validEvents = new Set([
  "app.state",
  "stt.delta",
  "stt.live",
  "stt.final",
  "stt.error",
  "llm.result",
  "llm.updated",
  "llm.error",
  "settings.open",
  "record.start",
  "record.stop"
]);

contextBridge.exposeInMainWorld("everlast", {
  invoke: (channel: string, payload?: any) => {
    if (!validChannels.has(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (!validEvents.has(channel)) {
      throw new Error(`Invalid IPC event: ${channel}`);
    }
    const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
