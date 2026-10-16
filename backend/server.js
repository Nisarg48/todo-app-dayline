// Dayline local server — ZERO dependencies (plain node:http, no express).
// One process serves the API + the built web app, so double-click just works.
// Env: PORT (default 4000), DATA_DIR, FRONTEND_DIR.
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'todos.json')
// Packaged desktop app passes FRONTEND_DIR; dev/single-server uses ../frontend/dist.
const FRONTEND_DIST =
  [process.env.FRONTEND_DIR, path.join(__dirname, '..', 'frontend', 'dist')].find((d) => d && existsSync(d)) || null
const PORT = Number(process.env.PORT || 4000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

async function readTodos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function writeTodos(todos) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(todos, null, 2))
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...corsHeaders() })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = ''
    req.on('data', (c) => {
      buf += c
      if (buf.length > 1e6) req.destroy()
    })
    req.on('end', () => {
      if (!buf) return resolve({})
      try {
        resolve(JSON.parse(buf))
      } catch {
        resolve(null)
      }
    })
  })
}

async function serveStatic(req, res, pathname) {
  if (!FRONTEND_DIST) {
    res.writeHead(404, corsHeaders())
    res.end('Not found (frontend not built)')
    return
  }
  let rel = decodeURIComponent(pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  const resolved = path.normalize(path.join(FRONTEND_DIST, rel))
  if (!resolved.startsWith(FRONTEND_DIST)) {
    res.writeHead(403, corsHeaders())
    res.end('Forbidden')
    return
  }
  try {
    const stat = await fs.stat(resolved)
    const file = stat.isDirectory() ? path.join(resolved, 'index.html') : resolved
    const body = await fs.readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length, ...corsHeaders() })
    res.end(body)
  } catch {
    // SPA fallback: unknown paths serve the app (client tabs are hashless routes)
    try {
      const body = await fs.readFile(path.join(FRONTEND_DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, ...corsHeaders() })
      res.end(body)
    } catch {
      res.writeHead(404, corsHeaders())
      res.end('Not found')
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      json(res, 200, { ok: true, storage: 'local-file', auth: false })
      return
    }

    if (pathname === '/api/todos' && req.method === 'GET') {
      json(res, 200, await readTodos())
      return
    }

    if (pathname === '/api/todos' && req.method === 'POST') {
      const body = await readBody(req)
      if (!body || !body.text || !String(body.text).trim()) {
        json(res, 400, { error: 'text is required' })
        return
      }
      const todos = await readTodos()
      const id = body.id ? String(body.id) : uid()
      if (todos.some((t) => t.id === id)) {
        json(res, 409, { error: 'id exists' })
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const todo = {
        id,
        text: String(body.text).trim().slice(0, 500),
        notes: String(body.notes || '').slice(0, 2000),
        date: body.date || today,
        endDate: body.endDate || body.date || today,
        time: body.time || '',
        priority: body.priority || 'medium',
        completed: !!body.completed,
        completedAt: body.completedAt || null,
        createdAt: body.createdAt || new Date().toISOString(),
      }
      todos.unshift(todo)
      await writeTodos(todos)
      json(res, 201, todo)
      return
    }

    const idMatch = pathname.match(/^\/api\/todos\/([^/]+)$/)
    if (idMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const id = decodeURIComponent(idMatch[1])
      const todos = await readTodos()
      const i = todos.findIndex((t) => t.id === id)
      if (i === -1) {
        json(res, 404, { error: 'not found' })
        return
      }
      if (req.method === 'DELETE') {
        todos.splice(i, 1)
        await writeTodos(todos)
        json(res, 200, { ok: true })
        return
      }
      const body = await readBody(req)
      if (!body) {
        json(res, 400, { error: 'bad json' })
        return
      }
      const prev = todos[i]
      const next = { ...prev, ...body, id: prev.id }
      if (typeof next.completed === 'boolean') {
        next.completedAt = next.completed ? (prev.completedAt || new Date().toISOString()) : null
      }
      todos[i] = next
      await writeTodos(todos)
      json(res, 200, next)
      return
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      const range = url.searchParams.get('range') || 'week'
      const todos = await readTodos()
      const now = new Date()
      let days = 7
      if (range === 'month') days = 30
      if (range === 'year') days = 365
      const since = new Date(now)
      since.setDate(now.getDate() - days)
      const inRange = todos.filter((t) => new Date(t.createdAt) >= since)
      const completed = inRange.filter((t) => t.completed).length
      json(res, 200, {
        range,
        total: inRange.length,
        completed,
        pending: inRange.length - completed,
        rate: inRange.length ? Math.round((completed / inRange.length) * 100) : 0,
      })
      return
    }

    if (pathname.startsWith('/api/')) {
      json(res, 404, { error: 'not found' })
      return
    }

    if (req.method === 'GET') {
      await serveStatic(req, res, pathname)
      return
    }

    res.writeHead(405, corsHeaders())
    res.end('Method not allowed')
  } catch {
    try {
      json(res, 500, { error: 'internal' })
    } catch { /* socket gone */ }
  }
})

function listen(port, attemptsLeft = 10) {
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`Port ${port} is busy (another Dayline may be running). Trying ${port + 1}…`)
      setTimeout(() => listen(port + 1, attemptsLeft - 1), 300)
    } else if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is busy. Stop the other app first, or run: PORT=5000 node backend/server.js`)
      process.exit(1)
    } else {
      throw err
    }
  })
  server.listen(port, () => {
    console.log(`Dayline running → open http://localhost:${port} (API + app, local file storage)`)
  })
}
listen(PORT)
