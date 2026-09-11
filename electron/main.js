// electron/main.js (ESM)
import { app, BrowserWindow, Menu, shell, clipboard, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
let mainWindow = null;
let overlayWindow = null;

// Start the game server in-process
async function startServer() {
  try {
    await import("../server.js");
    console.log("[Electron] Express & Socket.IO server initialized successfully.");
  } catch (err) {
    console.error("[Electron] Error starting server:", err);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: "Ally's Odd One Out — Host Control Panel",
    backgroundColor: "#15102a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Handle new windows / clicks on external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("/admin.html")) {
      return { action: "allow" };
    }
    // Open in user's default browser (Safari, Chrome, etc.)
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Load the Admin Panel
  mainWindow.loadURL(`http://localhost:${PORT}/admin.html`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.focus();
    return;
  }

  // 9:16 aspect ratio window for OBS Window Capture or streamer preview
  overlayWindow = new BrowserWindow({
    width: 480,
    height: 853,
    title: "Ally's Odd One Out — Game Overlay",
    backgroundColor: "#ffebf3",
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlayWindow.loadURL(`http://localhost:${PORT}/`);

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function setupMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "Game & Stream",
      submenu: [
        {
          label: "Open Game Overlay in Browser",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            shell.openExternal(`http://localhost:${PORT}/`);
          }
        },
        {
          label: "Open Overlay Window (OBS Capture)",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => {
            createOverlayWindow();
          }
        },
        {
          label: "Copy OBS Browser Source URL",
          accelerator: "CmdOrCtrl+C",
          click: () => {
            clipboard.writeText(`http://localhost:${PORT}/`);
            dialog.showMessageBox({
              type: "info",
              title: "OBS URL Copied",
              message: "Copied http://localhost:3000/ to clipboard!\nPaste this into an OBS Browser Source."
            });
          }
        },
        { type: "separator" },
        {
          label: "Reload Admin Panel",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: "Toggle Full Screen",
          accelerator: isMac ? "Ctrl+Cmd+F" : "F11",
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        { type: "separator" },
        {
          label: "Developer Tools",
          accelerator: isMac ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" }
            ]
          : [{ role: "close" }])
      ]
    },
    {
      role: "help",
      submenu: [
        {
          label: "GitHub Repository",
          click: () => {
            shell.openExternal("https://github.com/MrDDubs/odd-one");
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await startServer();
  setupMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On all platforms, quit the app completely when windows close so port 3000 is freed
  app.quit();
});
