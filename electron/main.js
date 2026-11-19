
import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell
} from 'electron'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROTOCOL = 'nexus'
const WEBSITE_ORIGIN = 'https://nexus.qwertydev.me'

const WINDOW_MODES = {
  welcome: {
    width: 1000,
    height: 450,
    resizable: false,
    maximizable: false
  },
  app: {
    width: 1400,
    height: 900,
    resizable: true,
    maximizable: true
  }
}

let mainWindow = null
let pendingAuthCallback = null
let currentWindowMode = 'welcome'

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthCallback(url)
  })

  app.on('second-instance', (_event, argv) => {
    const callbackUrl = argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`)
    )

    if (callbackUrl) {
      handleAuthCallback(callbackUrl)
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  function handleAuthCallback(url) {
    try {
      const parsed = new URL(url)

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
        return
      }

      const code = parsed.searchParams.get('code')

      if (!code || !/^[a-f0-9]{64}$/.test(code)) {
        return
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'desktop-auth-callback',
          parsed.toString()
        )
      } else {
        pendingAuthCallback = parsed.toString()
      }
    } catch {
      // Ignore malformed external URLs.
    }
  }

  ipcMain.handle('open-browser-auth', async (_event, url) => {
    try {
      const parsed = new URL(url)

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
        throw new Error('Invalid browser authentication URL.')
      }

      await shell.openExternal(parsed.toString())
      return true
    } catch {
      throw new Error('Could not open NEXUS browser authentication.')
    }
  })

  ipcMain.handle('set-window-mode', (event, mode) => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      event.sender !== mainWindow.webContents ||
      !Object.hasOwn(WINDOW_MODES, mode)
    ) {
      return false
    }

    const settings = WINDOW_MODES[mode]
    currentWindowMode = mode

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    }

    mainWindow.setResizable(settings.resizable)
    mainWindow.setMaximizable(settings.maximizable)
    mainWindow.setMinimumSize(
      mode === 'app' ? 900 : settings.width,
      mode === 'app' ? 600 : settings.height
    )
    mainWindow.setSize(settings.width, settings.height, true)
    mainWindow.center()

    return true
  })

  function createWindow() {
    const settings = WINDOW_MODES[currentWindowMode]

    mainWindow = new BrowserWindow({
      width: settings.width,
      height: settings.height,
      minWidth: settings.width,
      minHeight: settings.height,
      resizable: settings.resizable,
      maximizable: settings.maximizable,
      fullscreenable: false,

      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },

      title: 'NEXUS',
      backgroundColor: '#17181c',

      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    if (!app.isPackaged) {
      mainWindow.loadURL('http://localhost:5173')
    } else {
      mainWindow.loadFile(
        path.join(__dirname, '../dist/index.html')
      )
    }

    mainWindow.webContents.on('did-finish-load', () => {
      if (pendingAuthCallback) {
        mainWindow.webContents.send(
          'desktop-auth-callback',
          pendingAuthCallback
        )

        pendingAuthCallback = null
      }
    })
  }

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient(PROTOCOL)

    Menu.setApplicationMenu(null)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
