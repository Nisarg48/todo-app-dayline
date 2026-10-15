export function toDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function nowHM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return toDateStr(dt)
}

export function diffDays(a, b) {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da)) / 86400000)
}

export function prettyDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ---- ranges ----
export function endOf(todo) {
  return todo.endDate || todo.date
}

export function isMultiDay(todo) {
  return endOf(todo) > todo.date
}

export function spanDays(todo) {
  return diffDays(todo.date, endOf(todo)) + 1
}

export function occursOn(todo, dateStr) {
  const s = todo.date || ''
  const e = endOf(todo) || s
  return s <= dateStr && dateStr <= e
}

export function isOverdue(todo, today, now) {
  if (todo.completed) return false
  const e = endOf(todo)
  if (e < today) return true
  // due today: timed tasks past their time are overdue; all-day gets till end of day
  if (e === today && !isMultiDay(todo) && todo.time && todo.time < (now || nowHM())) return true
  return false
}

export function sortByTimeline(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time || '99:99' // all-day sorts last: due end of day
  const tb = b.time || '99:99'
  if (ta !== tb) return ta < tb ? -1 : 1
  return (b.createdAt || '') < (a.createdAt || '') ? 1 : -1
}

// Sunday..Saturday week containing dateStr
export function weekRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const start = toDateStr(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dt.getDay()))
  const end = addDays(start, 6)
  return { start, end }
}
