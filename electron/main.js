// electron/main.js (ESM)
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Import and start your existing server
await import('../server.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1240,
        height: 880,
        title: "Ally's Odd One Out — Host Control Panel",
        frame: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.setMenuBarVisibility(false);
    win.setMenu(null);

    // Small delay to ensure server is ready
    setTimeout(() => {
        const port = process.env.PORT || 3000;
        win.loadURL(`http://localhost:${port}/admin.html`);
    }, 1500);
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
