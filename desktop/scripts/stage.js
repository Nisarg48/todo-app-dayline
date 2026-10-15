// Stages a self-contained desktop app into desktop/staged:
//   staged/frontend-dist  <- built web app (frontend/dist)
//   staged/backend        <- server.js + package.json + production deps
// Run after `npm --prefix frontend run build`, before `electron-builder`.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const staged = path.join(here, '..', 'staged')

const dist = path.join(root, 'frontend', 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('frontend/dist missing — run: npm --prefix frontend run build')
  process.exit(1)
}

fs.rmSync(staged, { recursive: true, force: true })
fs.mkdirSync(staged, { recursive: true })
fs.cpSync(dist, path.join(staged, 'frontend-dist'), { recursive: true })

const backendDst = path.join(staged, 'backend')
fs.mkdirSync(backendDst, { recursive: true })
for (const f of ['server.js', 'package.json']) {
  fs.copyFileSync(path.join(root, 'backend', f), path.join(backendDst, f))
}
execSync('npm install --omit=dev --no-audit --no-fund', { cwd: backendDst, stdio: 'inherit' })

console.log('staged OK →', staged)
