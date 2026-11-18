import {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    shell
} from 'electron';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTOCOL = 'nexus';
const WEBSITE_ORIGIN = 'https://nexus.qwertydev.me';

let mainWindow = null;
let pendingAuthCallback = null;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('open-url', (event, url) => {
        event.preventDefault();
        handleAuthCallback(url);
    });

    app.on('second-instance', (_event, argv) => {
        const callbackUrl = argv.find((arg) =>
            arg.startsWith(`${PROTOCOL}://`)
        );

        if (callbackUrl) {
            handleAuthCallback(callbackUrl);
        }

        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    function handleAuthCallback(url) {
        try {
            const parsed = new URL(url);

            if (
                parsed.protocol !== `${PROTOCOL}:` ||
                parsed.hostname !== 'auth' ||
                parsed.pathname !== '/callback' ||
                parsed.username ||
                parsed.password ||
                parsed.port ||
                parsed.hash ||
                parsed.searchParams.size !== 1
            ) {
                return;
            }

            const code = parsed.searchParams.get('code');

            if (!code || !/^[a-f0-9]{64}$/.test(code)) {
                return;
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(
                    'desktop-auth-callback',
                    parsed.toString()
                );
            } else {
                pendingAuthCallback = parsed.toString();
            }
        } catch {
            // Ignore malformed external URLs.
        }
    }

    ipcMain.handle('open-browser-auth', async (_event, url) => {
        try {
            const parsed = new URL(url);

            if (
                parsed.origin !== WEBSITE_ORIGIN ||
                parsed.pathname !== '/desktop-auth' ||
                parsed.username ||
                parsed.password ||
                parsed.hash ||
                parsed.searchParams.size !== 1 ||
                !/^[A-Za-z0-9_-]{43}$/.test(
                    parsed.searchParams.get('challenge') || ''
                )
            ) {
                throw new Error('Invalid browser authentication URL.');
            }

            await shell.openExternal(parsed.toString());
            return true;
        } catch {
            throw new Error('Could not open NEXUS browser authentication.');
        }
    });

    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 16, y: 16 },
            title: 'NEXUS',
            backgroundColor: '#111111',
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });

        if (!app.isPackaged) {
            mainWindow.loadURL('http://localhost:5173');
        } else {
            mainWindow.loadFile(
                path.join(__dirname, '../dist/index.html')
            );
        }

        mainWindow.webContents.on('did-finish-load', () => {
            if (pendingAuthCallback) {
                mainWindow.webContents.send(
                    'desktop-auth-callback',
                    pendingAuthCallback
                );

                pendingAuthCallback = null;
            }
        });
    }

    app.whenReady().then(() => {
        app.setAsDefaultProtocolClient(PROTOCOL);

        Menu.setApplicationMenu(null);
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
