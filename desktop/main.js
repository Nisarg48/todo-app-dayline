import { app, BrowserWindow, utilityProcess } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// NOTE: packaged apps have NO NODE_ENV set, so `process.env.NODE_ENV`
// detection puts installed apps in dev mode (wrong backend path + wrong URL
// = blank window). app.isPackaged is the only reliable signal.
const isDev = !app.isPackaged
const PORT = process.env.PORT || '4000'

// Side-loaded Linux builds (deb/AppImage) can't use Electron's SUID sandbox
// (needs root-owned 4755 chrome-sandbox). Local-only app: run unsandboxed,
// and don't depend on /dev/shm (often inaccessible in such installs).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
}
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
  // Load the port the backend ACTUALLY bound (it auto-bumps when busy).
  // Never hardcode: a stale port = dark empty window.
  const base = Number(PORT)
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    for (let p = base; p < base + 10; p++) {
      try {
        const ctrl = new AbortController()
        const id = setTimeout(() => ctrl.abort(), 800)
        const r = await fetch(`http://localhost:${p}/api/health`, { signal: ctrl.signal })
        clearTimeout(id)
        if (r.ok) {
          await win.loadURL(`http://localhost:${p}`)
          return
        }
      } catch { /* try next port */ }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  await win.loadURL(`http://localhost:${base}`)
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

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Clicking the icon focuses the running app instead of spawning
    // competing backends on bumped ports.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    startBackend()
    createWindow()
    app.on('activate', () => { if (!win) createWindow() })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
