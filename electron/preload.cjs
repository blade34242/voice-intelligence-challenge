const { contextBridge, ipcRenderer } = require("electron");

const validChannels = new Set([
  "overlay.open",
  "overlay.hide",
  "settings.get",
  "settings.set",
  "settings.reset",
  "settings.open",
  "stt.start",
  "stt.audioFrame",
  "stt.stop",
  "stt.realtimeCheck",
  "llm.enrich",
  "llm.update",
  "llm.applyUpdate",
  "llm.discardUpdate",
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
  "llm.updatePreview",
  "llm.updated",
  "llm.error",
  "settings.open",
  "record.start",
  "record.stop"
]);

contextBridge.exposeInMainWorld("everlast", {
  invoke: (channel, payload) => {
    if (!validChannels.has(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, callback) => {
    if (!validEvents.has(channel)) {
      throw new Error(`Invalid IPC event: ${channel}`);
    }
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
