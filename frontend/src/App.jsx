import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { addDays, prettyDate, sortByTimeline, todayStr, toDateStr, uid } from './lib/dates.js'
import { backendStatus, loadTodos, saveTodos } from './lib/store.js'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'previous', label: 'Previous' },
  { id: 'all', label: 'All' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'insights', label: 'Insights' },
]

function rangeStats(todos, days) {
  const today = todayStr()
  const since = addDays(today, -days + 1)
  const added = todos.filter((t) => {
    const d = (t.createdAt || t.date || '').slice(0, 10)
    return d >= since
  }).length
  const done = todos.filter((t) => t.completed && (t.completedAt || '').slice(0, 10) >= since).length
  return { added, done, rate: added ? Math.round((done / Math.max(added, 1)) * 100) : 0 }
}

function streak(todos) {
  const doneDays = new Set(
    todos.filter((t) => t.completed).map((t) => (t.completedAt || t.date || '').slice(0, 10))
  )
  let s = 0
  let cur = todayStr()
  if (!doneDays.has(cur)) cur = addDays(cur, -1)
  while (doneDays.has(cur)) {
    s += 1
    cur = addDays(cur, -1)
  }
  return s
}

function last14(todos) {
  const out = []
  const today = todayStr()
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i)
    const added = todos.filter((t) => (t.createdAt || t.date || '').slice(0, 10) === d).length
    const done = todos.filter((t) => t.completed && (t.completedAt || '').slice(0, 10) === d).length
    out.push({ date: d, label: d.slice(5), added, done })
  }
  return out
}

export default function App() {
  const [todos, setTodos] = useState(loadTodos)
  const [tab, setTab] = useState('today')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [monthCursor, setMonthCursor] = useState(() => todayStr().slice(0, 7))
  const [search, setSearch] = useState('')
  const [prioFilter, setPrioFilter] = useState('all')
  const [backend, setBackend] = useState({ configured: false, ok: false })

  const [text, setText] = useState('')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('medium')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => saveTodos(todos), [todos])
  useEffect(() => { backendStatus().then(setBackend) }, [])

  const today = todayStr()

  const filtered = useMemo(() => {
    let list = [...todos]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => (t.text + ' ' + (t.notes || '')).toLowerCase().includes(q))
    }
    if (prioFilter !== 'all') list = list.filter((t) => t.priority === prioFilter)
    if (tab === 'today') list = list.filter((t) => t.date === today)
    else if (tab === 'upcoming') list = list.filter((t) => t.date > today)
    else if (tab === 'previous') list = list.filter((t) => t.date < today)
    else if (tab === 'calendar') list = list.filter((t) => t.date === selectedDate)
    return list.sort(sortByTimeline)
  }, [todos, tab, today, selectedDate, search, prioFilter])

  const counts = useMemo(() => ({
    today: todos.filter((t) => t.date === today && !t.completed).length,
    upcoming: todos.filter((t) => t.date > today && !t.completed).length,
    previous: todos.filter((t) => t.date < today && !t.completed).length,
  }), [todos, today])

  const week = useMemo(() => rangeStats(todos, 7), [todos])
  const month = useMemo(() => rangeStats(todos, 30), [todos])
  const year = useMemo(() => rangeStats(todos, 365), [todos])
  const chart = useMemo(() => last14(todos), [todos])
  const maxBar = Math.max(1, ...chart.map((c) => Math.max(c.added, c.done)))

  function resetForm() {
    setText(''); setNotes(''); setTime(''); setPriority('medium')
    setDate(tab === 'calendar' ? selectedDate : todayStr())
    setEditingId(null)
  }

  function submit(e) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    if (editingId) {
      setTodos((prev) => prev.map((t) => (t.id === editingId ? { ...t, text: v.slice(0, 500), notes: notes.slice(0, 2000), date: date || todayStr(), time, priority } : t)))
    } else {
      setTodos((prev) => [{ id: uid(), text: v.slice(0, 500), notes: notes.slice(0, 2000), date: date || todayStr(), time, priority, completed: false, completedAt: null, createdAt: new Date().toISOString() }, ...prev])
    }
    resetForm()
  }

  function toggle(id) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t)))
  }
  function remove(id) { setTodos((prev) => prev.filter((t) => t.id !== id)) }
  function edit(todo) {
    setEditingId(todo.id); setText(todo.text); setNotes(todo.notes || '')
    setDate(todo.date); setTime(todo.time || ''); setPriority(todo.priority || 'medium')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function clearDone() { setTodos((prev) => prev.filter((t) => !t.completed)) }

  function jumpMonth(delta) {
    const [y, m] = monthCursor.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonthCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthCells = useMemo(() => {
    const [y, m] = monthCursor.split('-').map(Number)
    const first = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${monthCursor}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }, [monthCursor])

  const byDate = useMemo(() => {
    const map = {}
    for (const t of todos) {
      map[t.date] = map[t.date] || { total: 0, done: 0 }
      map[t.date].total += 1
      if (t.completed) map[t.date].done += 1
    }
    return map
  }, [todos])

  return (
    <div className="bg">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="shell">
        <header className="glass header">
          <div>
            <h1>✨ Glass Todo</h1>
            <p className="sub">Local-first daily planner • no login • data stays on this device
              {backend.configured && <span className={backend.ok ? 'pill ok' : 'pill bad'}>{backend.ok ? 'backend online' : 'backend offline'}</span>}
              {!backend.configured && <span className="pill">local mode</span>}
            </p>
          </div>
          <div className="head-stats">
            <div><b>{counts.today}</b><span>today left</span></div>
            <div><b>{streak(todos)}🔥</b><span>day streak</span></div>
            <div><b>{week.rate}%</b><span>week done</span></div>
          </div>
        </header>

        <nav className="glass tabs">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}>
              {t.label}
              {t.id === 'today' && counts.today > 0 && <i>{counts.today}</i>}
              {t.id === 'upcoming' && counts.upcoming > 0 && <i>{counts.upcoming}</i>}
              {t.id === 'previous' && counts.previous > 0 && <i>{counts.previous}</i>}
            </button>
          ))}
        </nav>

        {tab !== 'insights' && tab !== 'calendar' && (
          <div className="grid">
            <section className="glass card">
              <h2>{editingId ? 'Edit task' : 'Add task'}</h2>
              <form onSubmit={submit} className="form">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to be done?" aria-label="Task title" />
                <div className="row2">
                  <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                  <label>Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
                </div>
                <div className="row2">
                  <label>Priority
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tasks…" /></label>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
                <div className="form-actions">
                  <button type="submit" className="primary">{editingId ? 'Save' : 'Add task'}</button>
                  {editingId && <button type="button" onClick={resetForm}>Cancel</button>}
                </div>
                <div className="mini-filters">
                  {['all', 'low', 'medium', 'high'].map((p) => (
                    <button key={p} type="button" onClick={() => setPrioFilter(p)} className={prioFilter === p ? 'active' : ''}>{p}</button>
                  ))}
                </div>
              </form>
            </section>

            <section className="glass card">
              <h2>{tab === 'today' ? `Today • ${prettyDate(today)}` : tab === 'upcoming' ? 'Upcoming timeline' : tab === 'previous' ? 'Previous days' : 'All tasks'}</h2>
              <TodoList list={filtered} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} />
              {todos.some((t) => t.completed) && <button className="ghost" onClick={clearDone}>Clear completed</button>}
            </section>
          </div>
        )}

        {tab === 'calendar' && (
          <div className="grid single">
            <section className="glass card">
              <div className="cal-head">
                <h2>📅 {monthCursor}</h2>
                <div>
                  <button onClick={() => jumpMonth(-1)}>‹</button>
                  <button onClick={() => { const t = todayStr(); setMonthCursor(t.slice(0, 7)); setSelectedDate(t) }}>Today</button>
                  <button onClick={() => jumpMonth(1)}>›</button>
                </div>
              </div>
              <div className="cal-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="dow">{d}</div>)}
                {monthCells.map((ds, i) => {
                  if (!ds) return <div key={'e' + i} className="cell empty-cell" />
                  const info = byDate[ds]
                  const isSel = ds === selectedDate
                  const isToday = ds === today
                  return (
                    <button key={ds} onClick={() => { setSelectedDate(ds); setDate(ds) }} className={`cell${isSel ? ' sel' : ''}${isToday ? ' is-today' : ''}`}>
                      <span className="dnum">{Number(ds.slice(8))}</span>
                      {info && <span className="dots"><span className="bar"><span style={{ width: `${Math.round((info.done / info.total) * 100)}%` }} /></span><small>{info.done}/{info.total}</small></span>}
                    </button>
                  )
                })}
              </div>
              <h3>{prettyDate(selectedDate)} • {filtered.length} task(s)</h3>
              <TodoList list={filtered} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} />
            </section>
          </div>
        )}

        {tab === 'insights' && (
          <div className="grid single">
            <section className="glass card">
              <h2>📊 Insights — added vs completed</h2>
              <div className="stat-cards">
                {[['Last 7 days', week], ['Last 30 days', month], ['Last 365 days', year]].map(([label, s]) => (
                  <div key={label} className="stat">
                    <h4>{label}</h4>
                    <p className="big">{s.done}<small>/{s.added}</small></p>
                    <p>completion {s.rate}%</p>
                    <div className="meter"><span style={{ width: `${s.rate}%` }} /></div>
                  </div>
                ))}
              </div>
              <h3>Last 14 days</h3>
              <div className="chart">
                {chart.map((c) => (
                  <div key={c.date} className="col" title={`${c.date}: +${c.added} done ${c.done}`}>
                    <div className="bars">
                      <span className="a" style={{ height: `${Math.round((c.added / maxBar) * 90)}px` }} />
                      <span className="d" style={{ height: `${Math.round((c.done / maxBar) * 90)}px` }} />
                    </div>
                    <small>{c.label.slice(3)}</small>
                  </div>
                ))}
              </div>
              <p className="legend"><span className="sw a" /> added <span className="sw d" /> completed • streak: <b>{streak(todos)} days 🔥</b></p>
            </section>
          </div>
        )}

        <footer className="foot">Data is stored locally (localStorage{backend.configured ? ' + optional backend' : ''}) • installable as PWA or desktop app • no account needed</footer>
      </div>
    </div>
  )
}

function TodoList({ list, onToggle, onDelete, onEdit, today }) {
  if (!list.length) return <p className="empty">Nothing here. Add something small and win the day ✨</p>
  return (
    <ul className="todos">
      {list.map((t) => {
        const overdue = !t.completed && t.date < today
        return (
          <li key={t.id} className={`${t.completed ? 'done' : ''} prio-${t.priority || 'medium'}${overdue ? ' overdue' : ''}`}>
            <label className="check">
              <input type="checkbox" checked={!!t.completed} onChange={() => onToggle(t.id)} />
              <span className="box">✓</span>
            </label>
            <div className="tmain">
              <div className="trow">
                <b>{t.text}</b>
                {t.time && <span className="time">⏰ {t.time}</span>}
              </div>
              <div className="meta">
                <span>📆 {prettyDate(t.date)}</span>
                <span className="prio">{t.priority}</span>
                {overdue && <span className="over">overdue</span>}
                {t.notes && <span className="notes">📝 {t.notes}</span>}
              </div>
            </div>
            <div className="actions">
              <button onClick={() => onEdit(t)} title="Edit">✎</button>
              <button onClick={() => onDelete(t.id)} title="Delete" className="del">✕</button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
