const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
    closeApp: () => ipcRenderer.send('close-app'),
    reloadApp: () => ipcRenderer.send('reload-app'),
    isElectron: true
});
