// Stages a self-contained desktop app into desktop/staged:
//   staged/frontend-dist  <- built web app (frontend/dist)
//   staged/backend        <- server.js (zero dependencies, runs anywhere)
// Run after `npm --prefix frontend run build`, before `electron-builder`.
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
fs.copyFileSync(path.join(root, 'backend', 'server.js'), path.join(backendDst, 'server.js'))

console.log('staged OK →', staged)
