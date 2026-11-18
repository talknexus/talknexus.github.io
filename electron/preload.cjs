const { contextBridge, ipcRenderer } = require('electron');

let authCallback = null;
const pendingCallbacks = [];

ipcRenderer.on('desktop-auth-callback', (_event, url) => {
    if (authCallback) {
        authCallback(url);
    } else {
        pendingCallbacks.push(url);
    }
});

contextBridge.exposeInMainWorld('nexusDesktop', {
    openBrowserAuth: (url) =>
        ipcRenderer.invoke('open-browser-auth', url),

    onAuthCallback: (callback) => {
        authCallback = callback;

        while (pendingCallbacks.length > 0) {
            authCallback(pendingCallbacks.shift());
        }

        return () => {
            if (authCallback === callback) {
                authCallback = null;
            }
        };
    }
});
