import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV !== 'production'
let win = null
let api = null

function startBackend() {
  // backend runs as separate local process, file storage only
  const serverPath = path.join(__dirname, '..', 'backend', 'server.js')
  api = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: process.env.PORT || '4000' },
    stdio: 'inherit',
  })
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  if (isDev) {
    await win.loadURL('http://localhost:5173')
  } else {
    await win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }

  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  startBackend()
  createWindow()
  app.on('activate', () => { if (!win) createWindow() })
})

app.on('window-all-closed', () => {
  if (api) api.kill()
  if (process.platform !== 'darwin') app.quit()
})
