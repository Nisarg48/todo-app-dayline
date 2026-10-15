import { todayStr } from './dates.js'

export const KEY_V3 = 'dayline-todos-v3'
const KEY_V2 = 'glass-todo-app-v2'
const KEY_V1 = 'vite-todo-app-items-v1'
const RECOVER_KEY = 'dayline-recovered-note'

export function normalize(t, today) {
  const d = today || todayStr()
  return {
    id: String(t.id ?? Math.random()),
    text: String(t.text ?? '').slice(0, 500),
    notes: String(t.notes || '').slice(0, 2000),
    date: t.date || d,
    endDate: t.endDate || t.date || d,
    time: t.time || '', // empty = all-day, due end of day
    priority: t.priority || 'medium',
    completed: !!t.completed,
    completedAt: t.completedAt || (t.completed ? new Date().toISOString() : null),
    createdAt: t.createdAt || new Date().toISOString(),
  }
}

function readKey(k) {
  try {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function seeds() {
  const t = todayStr()
  const now = new Date().toISOString()
  return [
    { id: 'seed-1', text: 'Plan today — pick 3 must-do tasks', notes: 'No time = all-day, due by end of day.', date: t, endDate: t, time: '09:00', priority: 'high', completed: false, completedAt: null, createdAt: now },
    { id: 'seed-2', text: 'Try a multi-day task (set an end date)', notes: 'Example: trip prep from the 5th to the 10th.', date: t, endDate: t, time: '', priority: 'medium', completed: false, completedAt: null, createdAt: now },
    { id: 'seed-3', text: 'Evening review — check Calendar + Insights', notes: '', date: t, endDate: t, time: '19:00', priority: 'low', completed: false, completedAt: null, createdAt: now },
  ]
}

export function loadTodos() {
  const today = todayStr()
  const v3 = readKey(KEY_V3)
  if (Array.isArray(v3)) return v3.map((t) => normalize(t, today))
  // migrate older versions so nothing is lost on update
  const v2 = readKey(KEY_V2)
  if (Array.isArray(v2) && v2.length) {
    const m = v2.map((t) => normalize(t, today))
    try {
      localStorage.setItem(KEY_V3, JSON.stringify(m))
      localStorage.setItem(RECOVER_KEY, `Recovered ${m.length} task(s) from the previous version. Nothing was lost.`)
    } catch { /* ignore */ }
    return m
  }
  const v1 = readKey(KEY_V1)
  if (Array.isArray(v1) && v1.length) {
    const m = v1.map((t) => normalize(t, today))
    try {
      localStorage.setItem(KEY_V3, JSON.stringify(m))
      localStorage.setItem(RECOVER_KEY, `Recovered ${m.length} task(s) from the previous version. Nothing was lost.`)
    } catch { /* ignore */ }
    return m
  }
  return seeds()
}

export function takeRecoveryNote() {
  try {
    const n = localStorage.getItem(RECOVER_KEY)
    if (n) localStorage.removeItem(RECOVER_KEY)
    return n
  } catch {
    return null
  }
}

export function saveTodos(todos) {
  try {
    localStorage.setItem(KEY_V3, JSON.stringify(todos))
  } catch {
    // storage full — ignore
  }
}

export function exportTodos(todos) {
  const blob = new Blob([JSON.stringify(todos, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dayline-backup-${todayStr()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export function parseImport(text) {
  const list = JSON.parse(text)
  if (!Array.isArray(list)) throw new Error('bad file')
  const today = todayStr()
  return list.map((t) => normalize(t, today)).filter((t) => t.text)
}

// ---- optional same-origin backend sync (single-server mode + backup) ----
async function req(path, opts) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), 2500)
  try {
    const r = await fetch(path, { ...opts, signal: ctrl.signal })
    if (!r.ok) return null
    return await r.json().catch(() => null)
  } catch {
    return null
  } finally {
    clearTimeout(id)
  }
}

export async function backendStatus() {
  // same-origin builtin server first (npm start / start.sh), then explicit VITE_API_URL
  const same = await req('/api/health')
  if (same && same.ok) return { configured: true, ok: true, mode: 'builtin' }
  const base = import.meta.env.VITE_API_URL
  if (!base) return { configured: false, ok: false, mode: 'local' }
  try {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), 2500)
    const r = await fetch(`${base}/api/health`, { signal: ctrl.signal })
    clearTimeout(id)
    return { configured: true, ok: r.ok, mode: 'external' }
  } catch {
    return { configured: true, ok: false, mode: 'external' }
  }
}

export async function fetchServerTodos() {
  const list = await req('/api/todos')
  if (Array.isArray(list)) return list.map((t) => normalize(t))
  const base = import.meta.env.VITE_API_URL
  if (base) {
    try {
      const r = await fetch(`${base}/api/todos`)
      const j = await r.json()
      if (Array.isArray(j)) return j.map((t) => normalize(t))
    } catch { /* ignore */ }
  }
  return null
}

export function mergeTodos(localList, remoteList) {
  const byId = new Map()
  for (const t of remoteList) byId.set(t.id, t)
  for (const t of localList) {
    const prev = byId.get(t.id)
    if (!prev) { byId.set(t.id, t); continue }
    // conflict: prefer the version with the latest activity stamp
    const stamp = (x) => (x.completedAt || x.createdAt || '')
    byId.set(t.id, stamp(t) >= stamp(prev) ? t : prev)
  }
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function mirrorToServer(action, todo) {
  const send = async (base) => {
    try {
      if (action === 'add') {
        await fetch(`${base}/api/todos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todo) })
      } else if (action === 'update') {
        await fetch(`${base}/api/todos/${todo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todo) })
      } else if (action === 'delete') {
        await fetch(`${base}/api/todos/${todo.id}`, { method: 'DELETE' })
      }
    } catch { /* best-effort backup only */ }
  }
  send('') // same-origin when served by backend
  const ext = import.meta.env.VITE_API_URL
  if (ext) send(ext)
}
