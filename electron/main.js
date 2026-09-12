// electron/main.js (ESM)
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Set up globals for server.js path resolution
global.IS_ELECTRON = true;

// Import and start your existing server
await import('../server.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 900,
        title: "Ally's Stream Studio — Host Control Panel",
        frame: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.setMenuBarVisibility(false);
    win.setMenu(null);

    // Force external links to open in default browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
            return { action: 'allow' };
        }
        import('electron').then(({ shell }) => shell.openExternal(url));
        return { action: 'deny' };
    });

    // Small delay to ensure server is ready
    setTimeout(() => {
        const port = process.env.PORT || 4000;
        win.loadURL(`http://localhost:${port}/admin-overlay`);
    }, 1800);
}

// Handle close/reload from UI
ipcMain.on('close-app', () => {
    app.quit();
});

ipcMain.on('reload-app', (event) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
        win.reload();
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
