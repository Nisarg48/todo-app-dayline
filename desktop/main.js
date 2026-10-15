import { app, BrowserWindow, utilityProcess } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV !== 'production'
const PORT = process.env.PORT || '4000'
let win = null
let api = null

function backendPaths() {
  if (isDev) {
    return {
      server: path.join(__dirname, '..', 'backend', 'server.js'),
      frontendDir: path.join(__dirname, '..', 'frontend', 'dist'),
      dataDir: path.join(__dirname, '..', 'backend', 'data'),
    }
  }
  // packaged app: everything lives in staged/ next to main.js
  const staged = path.join(__dirname, 'staged')
  return {
    server: path.join(staged, 'backend', 'server.js'),
    frontendDir: path.join(staged, 'frontend-dist'),
    dataDir: path.join(app.getPath('userData'), 'data'),
  }
}

function startBackend() {
  const p = backendPaths()
  // utilityProcess runs real Node.js inside Electron (process.execPath is
  // the Electron binary in prod, so plain child_process would NOT work)
  api = utilityProcess.fork(p.server, [], {
    env: { ...process.env, PORT, FRONTEND_DIR: p.frontendDir, DATA_DIR: p.dataDir },
    serviceName: 'dayline-backend',
  })
}

async function openApp() {
  const url = `http://localhost:${PORT}`
  for (let i = 0; i < 20; i++) {
    try {
      await win.loadURL(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    title: 'Dayline',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  if (isDev) {
    try {
      await win.loadURL('http://localhost:5173')
      win.on('closed', () => { win = null })
      return
    } catch {
      // vite not running — fall through to the single-server URL
    }
  }
  await openApp()
  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  startBackend()
  createWindow()
  app.on('activate', () => { if (!win) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
