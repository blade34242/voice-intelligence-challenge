import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from "electron";
import fs from "fs";
import path from "path";
import { registerIpcHandlers } from "./ipcMainHandlers";
import { DEFAULT_HOTKEY, getHotkey, initSettingsStore } from "./settings";
import { SttClient } from "./sttClient";
import { initHistoryDb } from "./historyDb";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isRecording = false;
let currentHotkey = DEFAULT_HOTKEY;
const platformIcon = process.platform === "win32" ? "icon.ico" : "icon.png";
const platformRecordingIcon = process.platform === "win32" ? "icon-recording.ico" : "icon-recording.png";

function resolveAssetPath(filename: string) {
  if (app.isPackaged) {
    const packagedPath = path.join(app.getAppPath(), "electron", "assets", filename);
    if (fs.existsSync(packagedPath)) return packagedPath;
    const resourcesPath = path.join(process.resourcesPath, "assets", filename);
    if (fs.existsSync(resourcesPath)) return resourcesPath;
    return packagedPath;
  }
  return path.join(__dirname, "assets", filename);
}

const iconPath = resolveAssetPath(platformIcon);
const recordingIconPath = resolveAssetPath(platformRecordingIcon);

const isDev = !app.isPackaged || process.env.ELECTRON_IS_DEV === "1";
const disableSandbox = process.env.ELECTRON_DISABLE_SANDBOX === "1";

if (disableSandbox) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 720,
    show: false,
    resizable: true,
    alwaysOnTop: false,
    frame: false,
    transparent: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    const devUrl = await resolveDevUrl();
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "out", "index.html"));
  }
}

function createTray() {
  if (tray) return;
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image);
  tray.setToolTip("Everlast Voice Intelligence");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Overlay", click: () => showOverlay() },
      { label: "Settings", click: () => openSettings() },
      { type: "separator" },
      { label: "Quit", click: () => quitApp() }
    ])
  );
  tray.on("click", () => showOverlay());
}

function registerHotkey() {
  applyHotkey(currentHotkey);
}

function applyHotkey(hotkey: string) {
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(hotkey, () => handleRecordHotkey());
  if (ok) {
    currentHotkey = hotkey;
  }
  return ok;
}

function updateHotkey(nextHotkey: string) {
  if (nextHotkey === currentHotkey) return true;
  const ok = applyHotkey(nextHotkey);
  if (!ok) {
    applyHotkey(currentHotkey);
  }
  return ok;
}

async function showOverlay() {
  if (!mainWindow) {
    await createMainWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
}

function openSettings() {
  void showOverlay();
  sendToRenderer("settings.open", {});
}

function sendToRenderer(channel: string, payload?: any) {
  if (!mainWindow) return;
  const webContents = mainWindow.webContents;
  if (webContents.isLoading()) {
    webContents.once("did-finish-load", () => {
      webContents.send(channel, payload);
    });
    return;
  }
  webContents.send(channel, payload);
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function handleRecordHotkey() {
  if (isRecording) {
    sendToRenderer("record.stop", {});
    return;
  }
  if (!mainWindow) {
    createMainWindow().then(() => sendToRenderer("record.start", {}));
    return;
  }
  sendToRenderer("record.start", {});
}

function setTrayIcon(recording: boolean) {
  if (!tray) return;
  const icon = recording ? recordingIconPath : iconPath;
  tray.setImage(nativeImage.createFromPath(icon));
}

async function resolveDevUrl() {
  const envUrl = process.env.NEXT_DEV_URL;
  if (envUrl) return envUrl;

  const candidates = ["http://localhost:3000", "http://localhost:3001"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return url;
    } catch {
      // ignore
    }
  }
  return candidates[0];
}

const sttClient = new SttClient({
  onDelta: (delta) => sendToRenderer("stt.delta", { textDelta: delta }),
  onLive: (liveText) => sendToRenderer("stt.live", { liveText }),
  onError: (message) => {
    isRecording = false;
    sendToRenderer("stt.error", { message });
  }
});

app.whenReady().then(async () => {
  app.setAppUserModelId("com.everlast.voice");
  await initSettingsStore();
  currentHotkey = getHotkey();
  await initHistoryDb();
  createMainWindow();
  createTray();
  registerHotkey();

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    stt: sttClient,
    sendToRenderer,
    openSettings,
    onHotkeyChange: updateHotkey,
    onRecordingChange: (active) => {
      isRecording = active;
      setTrayIcon(active);
    }
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
  void showOverlay();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    app.quit();
  }
});
