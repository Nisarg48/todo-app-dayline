import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data', 'todos.json')
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist')
const PORT = process.env.PORT || 4000

const app = express()
app.use(cors())
app.use(express.json())

async function readTodos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(raw)
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: 'local-file', auth: false })
})

app.get('/api/todos', async (_req, res) => {
  res.json(await readTodos())
})

app.post('/api/todos', async (req, res) => {
  const { id, text, notes = '', date, endDate, time = '', priority = 'medium', completed = false, completedAt = null, createdAt } = req.body || {}
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' })
  const todos = await readTodos()
  if (id && todos.some((t) => t.id === id)) return res.status(409).json({ error: 'id exists' })
  const todo = {
    id: id ? String(id) : uid(),
    text: String(text).trim().slice(0, 500),
    notes: String(notes).slice(0, 2000),
    date: date || new Date().toISOString().slice(0, 10),
    endDate: endDate || date || new Date().toISOString().slice(0, 10),
    time,
    priority,
    completed: !!completed,
    completedAt,
    createdAt: createdAt || new Date().toISOString(),
  }
  todos.unshift(todo)
  await writeTodos(todos)
  res.status(201).json(todo)
})

app.patch('/api/todos/:id', async (req, res) => {
  const todos = await readTodos()
  const i = todos.findIndex((t) => t.id === req.params.id)
  if (i === -1) return res.status(404).json({ error: 'not found' })
  const prev = todos[i]
  const next = { ...prev, ...req.body, id: prev.id }
  if (typeof next.completed === 'boolean') {
    next.completedAt = next.completed ? new Date().toISOString() : null
  }
  todos[i] = next
  await writeTodos(todos)
  res.json(next)
})

app.delete('/api/todos/:id', async (req, res) => {
  const todos = await readTodos()
  const next = todos.filter((t) => t.id !== req.params.id)
  if (next.length === todos.length) return res.status(404).json({ error: 'not found' })
  await writeTodos(next)
  res.json({ ok: true })
})

app.get('/api/stats', async (req, res) => {
  const range = req.query.range || 'week'
  const todos = await readTodos()
  const now = new Date()
  let days = 7
  if (range === 'month') days = 30
  if (range === 'year') days = 365
  const since = new Date(now)
  since.setDate(now.getDate() - days)
  const inRange = todos.filter((t) => new Date(t.createdAt) >= since)
  const completed = inRange.filter((t) => t.completed).length
  res.json({
    range,
    total: inRange.length,
    completed,
    pending: inRange.length - completed,
    rate: inRange.length ? Math.round((completed / inRange.length) * 100) : 0,
  })
})

// Serve built frontend so ONE server = full app (double-click friendly).
// If frontend/dist exists, http://localhost:PORT opens the app directly.
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  })
}

function listen(port, attemptsLeft = 10) {
  const server = app.listen(port, () => {
    console.log(`GlassTodo running → open http://localhost:${port} (API + app, local file storage)`)
  })
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`Port ${port} is busy (another GlassTodo may be running). Trying ${port + 1}…`)
      setTimeout(() => listen(port + 1, attemptsLeft - 1), 300)
    } else if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is busy. Stop the other app first, or run: PORT=5000 node backend/server.js`)
      process.exit(1)
    } else {
      throw err
    }
  })
}
listen(Number(PORT))
