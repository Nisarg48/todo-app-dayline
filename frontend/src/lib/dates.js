export function toDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return toDateStr(dt)
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

export function sortByTimeline(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time || '99:99'
  const tb = b.time || '99:99'
  if (ta !== tb) return ta < tb ? -1 : 1
  return (b.createdAt || '') < (a.createdAt || '') ? 1 : -1
}
