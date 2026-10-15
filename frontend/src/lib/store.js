import { todayStr } from './dates.js'

export const KEY_V2 = 'glass-todo-app-v2'
const KEY_V1 = 'vite-todo-app-items-v1'

function migrateV1(list) {
  const today = todayStr()
  return (list || []).map((t) => ({
    id: String(t.id ?? Math.random()),
    text: String(t.text ?? '').slice(0, 500),
    notes: '',
    date: t.date || today,
    time: t.time || '',
    priority: t.priority || 'medium',
    completed: !!t.completed,
    completedAt: t.completed ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  }))
}

export function loadTodos() {
  try {
    const raw2 = localStorage.getItem(KEY_V2)
    if (raw2) return JSON.parse(raw2)
    const raw1 = localStorage.getItem(KEY_V1)
    if (raw1) {
      const migrated = migrateV1(JSON.parse(raw1))
      localStorage.setItem(KEY_V2, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // ignore
  }
  const t = todayStr()
  return [
    { id: 'seed-1', text: 'Plan today — pick 3 must-do tasks', notes: 'Keep it small and winnable.', date: t, time: '09:00', priority: 'high', completed: false, completedAt: null, createdAt: new Date().toISOString() },
    { id: 'seed-2', text: 'Deep work block (50 min)', notes: '', date: t, time: '11:00', priority: 'medium', completed: false, completedAt: null, createdAt: new Date().toISOString() },
    { id: 'seed-3', text: 'Evening review — check calendar + insights', notes: '', date: t, time: '19:00', priority: 'low', completed: false, completedAt: null, createdAt: new Date().toISOString() },
  ]
}

export function saveTodos(todos) {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(todos))
  } catch {
    // storage full — ignore
  }
}

export async function backendStatus() {
  const base = import.meta.env.VITE_API_URL
  if (!base) return { configured: false, ok: false }
  try {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), 2500)
    const r = await fetch(`${base}/api/health`, { signal: ctrl.signal })
    clearTimeout(id)
    return { configured: true, ok: r.ok }
  } catch {
    return { configured: true, ok: false }
  }
}
