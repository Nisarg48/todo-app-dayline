import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  addDays, diffDays, endOf, isMultiDay, isOverdue, nowHM,
  occursOn, prettyDate, sortByTimeline, spanDays, todayStr, uid, weekRange,
} from './lib/dates.js'
import {
  backendStatus, exportTodos, fetchServerTodos, loadTodos, mergeTodos,
  mirrorToServer, parseImport, saveTodos, takeRecoveryNote,
} from './lib/store.js'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'previous', label: 'Previous' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'insights', label: 'Insights' },
  { id: 'about', label: 'About' },
]

function dayKey(iso) { return (iso || '').slice(0, 10) }

function scopeStats(todos, start, end) {
  const added = todos.filter((t) => { const d = dayKey(t.createdAt || t.date); return d >= start && d <= end })
  const doneList = todos.filter((t) => t.completed && dayKey(t.completedAt) >= start && dayKey(t.completedAt) <= end)
  const perDay = {}
  for (const t of doneList) {
    const d = dayKey(t.completedAt)
    perDay[d] = (perDay[d] || 0) + 1
  }
  let bestDay = null
  for (const [d, n] of Object.entries(perDay)) {
    if (!bestDay || n > bestDay.n) bestDay = { d, n }
  }
  return { added: added.length, done: doneList.length, rate: added.length ? Math.round((doneList.length / added.length) * 100) : 0, bestDay }
}

function doneDaySet(todos) {
  return new Set(todos.filter((t) => t.completed).map((t) => dayKey(t.completedAt || t.date)).filter(Boolean))
}

function currentStreak(todos) {
  const s = doneDaySet(todos)
  let n = 0
  let cur = todayStr()
  if (!s.has(cur)) cur = addDays(cur, -1)
  while (s.has(cur)) { n += 1; cur = addDays(cur, -1) }
  return n
}

function longestStreak(todos) {
  const days = [...doneDaySet(todos)].sort()
  let best = 0, run = 0, prev = null
  for (const d of days) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export default function App() {
  const [todos, setTodos] = useState(loadTodos)
  const [tab, setTab] = useState('today')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [monthCursor, setMonthCursor] = useState(() => todayStr().slice(0, 7))
  const [search, setSearch] = useState('')
  const [prioFilter, setPrioFilter] = useState('all')
  const [server, setServer] = useState({ configured: false, ok: false, mode: 'local' })
  const [notice, setNotice] = useState(null)

  const [text, setText] = useState('')
  const [date, setDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('medium')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editMin, setEditMin] = useState(todayStr())
  const [formError, setFormError] = useState('')

  const mergedOnce = useRef(false)
  useEffect(() => saveTodos(todos), [todos])
  useEffect(() => {
    setNotice(takeRecoveryNote())
    backendStatus().then(setServer)
    fetchServerTodos().then((remote) => {
      if (mergedOnce.current || !remote || !remote.length) return
      mergedOnce.current = true
      setTodos((prev) => {
        if (!prev.length || prev.every((t) => String(t.id).startsWith('seed-'))) return mergeTodos(prev, remote)
        const known = new Set(prev.map((t) => t.id))
        const fresh = remote.filter((t) => !known.has(t.id))
        return fresh.length ? [...fresh, ...prev] : prev
      })
    })
  }, [])

  const today = todayStr()
  const now = nowHM()
  const next3 = useMemo(() => [addDays(today, 1), addDays(today, 2), addDays(today, 3)], [today])

  const matchFilters = (t) => {
    if (search.trim() && !(t.text + ' ' + (t.notes || '')).toLowerCase().includes(search.toLowerCase())) return false
    if (prioFilter !== 'all' && t.priority !== prioFilter) return false
    return true
  }

  const todayList = useMemo(() => todos.filter((t) => occursOn(t, today) && matchFilters(t)).sort(sortByTimeline), [todos, today, search, prioFilter])
  const upcomingGroups = useMemo(() => next3.map((d) => ({ date: d, items: todos.filter((t) => occursOn(t, d) && matchFilters(t)).sort(sortByTimeline) })), [todos, next3, search, prioFilter])
  const previousList = useMemo(() => todos.filter((t) => endOf(t) < today && matchFilters(t)).sort((a, b) => (endOf(a) < endOf(b) ? 1 : -1)), [todos, today, search, prioFilter])
  const calList = useMemo(() => todos.filter((t) => occursOn(t, selectedDate) && matchFilters(t)).sort(sortByTimeline), [todos, selectedDate, search, prioFilter])

  const counts = useMemo(() => ({
    today: todos.filter((t) => occursOn(t, today) && !t.completed).length,
    upcoming: todos.filter((t) => !t.completed && next3.some((d) => occursOn(t, d))).length,
    previous: todos.filter((t) => endOf(t) < today && !t.completed).length,
  }), [todos, today, next3])

  // ---- calendar cells (span-aware) ----
  const monthCells = useMemo(() => {
    const [y, m] = monthCursor.split('-').map(Number)
    const first = new Date(y, m - 1, 1).getDay()
    const days = new Date(y, m, 0).getDate()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(`${monthCursor}-${String(d).padStart(2, '0')}`)
    return cells
  }, [monthCursor])

  const byDate = useMemo(() => {
    const map = {}
    const mStart = `${monthCursor}-01`
    const mEnd = `${monthCursor}-31`
    for (const t of todos) {
      const s = t.date < mStart ? mStart : t.date
      const e = endOf(t) > mEnd ? mEnd : endOf(t)
      if (s > e) continue
      let d = s
      let guard = 0
      while (d <= e && guard++ < 40) {
        map[d] = map[d] || { total: 0, done: 0 }
        map[d].total += 1
        if (t.completed) map[d].done += 1
        d = addDays(d, 1)
      }
    }
    return map
  }, [todos, monthCursor])

  // ---- insights (calendar-based: Sun–Sat week, calendar month/year) ----
  const wk = useMemo(() => weekRange(today), [today])
  const monthStart = today.slice(0, 7) + '-01'
  const monthEnd = today.slice(0, 7) + '-31'
  const yearStart = today.slice(0, 4) + '-01-01'
  const yearEnd = today.slice(0, 4) + '-12-31'
  const sWeek = useMemo(() => scopeStats(todos, wk.start, wk.end), [todos, wk])
  const sMonth = useMemo(() => scopeStats(todos, monthStart, monthEnd), [todos, monthStart, monthEnd])
  const sYear = useMemo(() => scopeStats(todos, yearStart, yearEnd), [todos, yearStart, yearEnd])
  const sAll = useMemo(() => scopeStats(todos, '0000-01-01', '9999-12-31'), [todos])

  const weekBars = useMemo(() => {
    const out = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(wk.start, i)
      out.push({
        date: d,
        label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i],
        added: todos.filter((t) => dayKey(t.createdAt || t.date) === d).length,
        done: todos.filter((t) => t.completed && dayKey(t.completedAt) === d).length,
      })
    }
    return out
  }, [todos, wk])

  const monthBars = useMemo(() => {
    const [y, m] = monthStart.split('-').map(Number)
    const dim = new Date(y, m, 0).getDate()
    const buckets = []
    for (let s = 1; s <= dim; s += 7) {
      const a = `${monthStart.slice(0, 8)}${String(s).padStart(2, '0')}`
      const b = `${monthStart.slice(0, 8)}${String(Math.min(s + 6, dim)).padStart(2, '0')}`
      buckets.push({
        label: `${s}–${Math.min(s + 6, dim)}`,
        added: todos.filter((t) => { const d = dayKey(t.createdAt || t.date); return d >= a && d <= b }).length,
        done: todos.filter((t) => t.completed && dayKey(t.completedAt) >= a && dayKey(t.completedAt) <= b).length,
      })
    }
    return buckets
  }, [todos, monthStart])

  const yearBars = useMemo(() => {
    const y = today.slice(0, 4)
    const names = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
    return names.map((label, i) => {
      const p = `${y}-${String(i + 1).padStart(2, '0')}`
      return {
        label,
        added: todos.filter((t) => dayKey(t.createdAt || t.date).slice(0, 7) === p).length,
        done: todos.filter((t) => t.completed && dayKey(t.completedAt).slice(0, 7) === p).length,
      }
    })
  }, [todos, today])

  const prioSplit = useMemo(() => ['high', 'medium', 'low'].map((p) => {
    const all = todos.filter((t) => (t.priority || 'medium') === p)
    return { p, total: all.length, done: all.filter((t) => t.completed).length }
  }), [todos])

  const overdueCount = todos.filter((t) => isOverdue(t, today, now)).length
  const dueToday = todos.filter((t) => occursOn(t, today) && !t.completed).length
  const barMax = Math.max(1, ...weekBars.map((b) => Math.max(b.added, b.done)), ...monthBars.map((b) => Math.max(b.added, b.done)), ...yearBars.map((b) => Math.max(b.added, b.done)))

  // ---- actions ----
  function resetForm() {
    setText(''); setNotes(''); setTime(''); setPriority('medium')
    const base = tab === 'calendar' ? selectedDate : today
    setDate(base); setEndDate(base)
    setEditingId(null); setEditMin(today); setFormError('')
  }

  function submit(e) {
    e.preventDefault()
    const v = text.trim()
    if (!v) { setFormError('Give the task a title first.'); return }
    const s = date || today
    const en = endDate || s
    if (!editingId && s < today) { setFormError('New tasks start today or later — history lives in Previous.'); return }
    if (en < s) { setFormError('End date can’t be before start date.'); return }
    setFormError('')
    if (editingId) {
      let updated = null
      setTodos((prev) => prev.map((t) => {
        if (t.id !== editingId) return t
        updated = { ...t, text: v.slice(0, 500), notes: notes.slice(0, 2000), date: s, endDate: en, time, priority }
        return updated
      }))
      if (updated) mirrorToServer('update', updated)
    } else {
      const todo = { id: uid(), text: v.slice(0, 500), notes: notes.slice(0, 2000), date: s, endDate: en, time, priority, completed: false, completedAt: null, createdAt: new Date().toISOString() }
      setTodos((prev) => [todo, ...prev])
      mirrorToServer('add', todo)
    }
    resetForm()
  }

  function toggle(id) {
    let updated = null
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t
      updated = { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
      return updated
    }))
    if (updated) mirrorToServer('update', updated)
  }
  function remove(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    mirrorToServer('delete', { id })
  }
  function edit(todo) {
    setEditingId(todo.id); setText(todo.text); setNotes(todo.notes || '')
    setDate(todo.date); setEndDate(endOf(todo)); setTime(todo.time || ''); setPriority(todo.priority || 'medium')
    setEditMin(todo.date < today ? todo.date : today)
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function clearDone() { setTodos((prev) => { const gone = prev.filter((t) => t.completed); gone.forEach((t) => mirrorToServer('delete', t)); return prev.filter((t) => !t.completed) }) }

  function onImportFile(file) {
    const r = new FileReader()
    r.onload = () => {
      try {
        const imported = parseImport(String(r.result))
        setTodos((prev) => mergeTodos(prev, imported))
        setNotice(`Imported ${imported.length} task(s). Merged with your current list — nothing overwritten.`)
      } catch {
        setNotice('Import failed — that file is not a Dayline backup.')
      }
    }
    r.readAsText(file)
  }

  function jumpMonth(delta) {
    const [y, m] = monthCursor.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonthCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="bg">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="shell">
        <header className="glass header">
          <div>
            <h1>◈ Dayline</h1>
            <p className="sub">Day-wise daily planner • no login • data stays on this device
              {server.mode === 'builtin' && <span className={server.ok ? 'pill ok' : 'pill bad'}>{server.ok ? 'server + backup on' : 'server offline'}</span>}
              {server.mode === 'external' && <span className={server.ok ? 'pill ok' : 'pill bad'}>{server.ok ? 'backend online' : 'backend offline'}</span>}
              {server.mode === 'local' && <span className="pill">local mode</span>}
            </p>
          </div>
          <div className="head-stats">
            <div><b>{dueToday}</b><span>due today</span></div>
            <div><b>{currentStreak(todos)}🔥</b><span>day streak</span></div>
            <div><b>{sWeek.rate}%</b><span>this week</span></div>
          </div>
        </header>

        {notice && <div className="glass notice">{notice}<button onClick={() => setNotice(null)}>✕</button></div>}

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

        {(tab === 'today' || tab === 'upcoming' || tab === 'previous') && (
          <div className="grid">
            <section className="glass card">
              <h2>{editingId ? 'Edit task' : 'Add task'}</h2>
              <form onSubmit={submit} className="form">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to be done?" aria-label="Task title" />
                <div className="row2">
                  <label>Start date (today or later)<input type="date" value={date} min={editMin} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }} /></label>
                  <label>End date (for multi-day)<input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} /></label>
                </div>
                <div className="row2">
                  <label>Time (empty = all-day)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
                  <label>Priority
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
                <label className="wide">Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tasks…" /></label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
                {formError && <p className="err">{formError}</p>}
                <p className="hint">No time = all-day, due by end of day. • A task can span days (e.g. 5th → 10th). • Past dates can’t be added — find history in Previous.</p>
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
              {tab === 'today' && (<><h2>Today • {prettyDate(today)}</h2><TodoList list={todayList} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} now={now} /></>)}
              {tab === 'upcoming' && (<>
                <h2>Next 3 days</h2>
                <p className="hint">Only the next 3 days live here — anything further is on the Calendar tab.</p>
                {upcomingGroups.map((g) => (
                  <div key={g.date} className="daygroup">
                    <h3>{prettyDate(g.date)} <small>• {g.items.filter((t) => !t.completed).length} open</small></h3>
                    <TodoList list={g.items} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} now={now} compact />
                  </div>
                ))}
              </>)}
              {tab === 'previous' && (<><h2>Previous days</h2><p className="hint">Read-only history — tick off anything you finished late, or delete clutter.</p><TodoList list={previousList} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} now={now} /></>)}
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
                  return (
                    <button key={ds} onClick={() => { setSelectedDate(ds); setDate(ds); setEndDate(ds) }} className={`cell${ds === selectedDate ? ' sel' : ''}${ds === today ? ' is-today' : ''}`}>
                      <span className="dnum">{Number(ds.slice(8))}</span>
                      {info && <span className="dots"><span className="bar"><span style={{ width: `${Math.round((info.done / info.total) * 100)}%` }} /></span><small>{info.done}/{info.total}</small></span>}
                    </button>
                  )
                })}
              </div>
              <h3>{prettyDate(selectedDate)} • {calList.length} task(s)</h3>
              <TodoList list={calList} onToggle={toggle} onDelete={remove} onEdit={edit} today={today} now={now} />
            </section>
          </div>
        )}

        {tab === 'insights' && (
          <div className="grid single">
            <section className="glass card">
              <h2>📊 Insights</h2>
              <p className="hint">Week = Sunday → Saturday ({prettyDate(wk.start)} – {prettyDate(wk.end)}). Added = created that period, Done = finished that period.</p>
              <div className="stat-cards">
                <ScopeCard title="This week" s={sWeek} />
                <ScopeCard title="This month" s={sMonth} />
                <ScopeCard title="This year" s={sYear} />
                <ScopeCard title="All time" s={sAll} />
              </div>
              <div className="insight-grid">
                <div className="panel">
                  <h3>This week, day by day</h3>
                  <Bars data={weekBars} max={barMax} />
                </div>
                <div className="panel">
                  <h3>This month, week by week</h3>
                  <Bars data={monthBars} max={barMax} />
                </div>
              </div>
              <div className="insight-grid">
                <div className="panel">
                  <h3>This year, month by month</h3>
                  <Bars data={yearBars} max={barMax} />
                </div>
                <div className="panel">
                  <h3>By priority</h3>
                  {prioSplit.map((r) => (
                    <div key={r.p} className="split-row">
                      <span className="prio">{r.p}</span>
                      <div className="meter"><span style={{ width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%` }} /></div>
                      <small>{r.done}/{r.total}</small>
                    </div>
                  ))}
                  <p className="legend">🔥 current streak <b>{currentStreak(todos)} days</b> • longest <b>{longestStreak(todos)} days</b></p>
                  <p className="legend">⚠️ overdue <b>{overdueCount}</b> • due today <b>{dueToday}</b> • total <b>{todos.length}</b></p>
                </div>
              </div>
              <p className="legend"><span className="sw a" /> added <span className="sw d" /> completed</p>
            </section>
          </div>
        )}

        {tab === 'about' && (
          <div className="grid single">
            <section className="glass card">
              <h2>◈ Dayline — your day, lined up</h2>
              <div className="about-grid">
                <div className="panel">
                  <h3>How to use</h3>
                  <ul className="bullets">
                    <li><b>Today</b> — everything due today, timed first, all-day last.</li>
                    <li><b>Upcoming</b> — only the next 3 days. Further ahead? Use <b>Calendar</b>.</li>
                    <li><b>Previous</b> — history. Tick off late finishes, delete clutter. New tasks can’t start in the past.</li>
                    <li><b>Calendar</b> — month view, multi-day tasks stretch across days. Click a day to see it.</li>
                    <li><b>Insights</b> — Sun–Sat week, month, year + all-time. Added vs done, best day, streaks.</li>
                    <li><b>Ranges</b> — set an end date and one task covers e.g. the 5th → 10th.</li>
                    <li><b>No time</b> = all-day, due by end of day.</li>
                  </ul>
                </div>
                <div className="panel">
                  <h3>Why Dayline (vs other todo apps)</h3>
                  <ul className="bullets">
                    <li>🔒 <b>No login, no cloud, no tracking</b> — data lives on your device.</li>
                    <li>📴 <b>Works offline</b> — installable PWA + desktop builds.</li>
                    <li>📅 <b>Day-wise + ranges + calendar + insights</b> in one place — most apps split these across paywalls.</li>
                    <li>💾 <b>Export anytime</b> — your data is a plain JSON file, never locked in.</li>
                    <li>🪟 <b>Glass UI, fast, free forever</b> — no account walls, no subscriptions.</li>
                  </ul>
                </div>
              </div>
              <div className="panel">
                <h3>Your data</h3>
                <p className="hint">Stored in this browser (localStorage, key <code>dayline-todos-v3</code>) — {todos.length} task(s). {server.mode === 'builtin' ? 'Also mirrored to the local server file.' : 'Turn on the local server (start.sh) for an extra file backup.'} Old versions auto-migrate, so updates never wipe tasks.</p>
                <div className="data-actions">
                  <button className="ghost" onClick={() => exportTodos(todos)}>⬇ Export backup</button>
                  <label className="ghost file">⬆ Import backup<input type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && onImportFile(e.target.files[0])} /></label>
                  {todos.some((t) => t.completed) && <button className="ghost" onClick={clearDone}>Clear completed</button>}
                </div>
              </div>
            </section>
          </div>
        )}

        <footer className="foot">Dayline • data stored locally • installable as PWA or desktop app • no account needed</footer>
      </div>
    </div>
  )
}

function ScopeCard({ title, s }) {
  return (
    <div className="stat">
      <h4>{title}</h4>
      <p className="big">{s.done}<small>/{s.added}</small></p>
      <p>done / added • {s.rate}%</p>
      <div className="meter"><span style={{ width: `${Math.min(s.rate, 100)}%` }} /></div>
      <p className="legend">{s.bestDay ? <>best: {prettyDate(s.bestDay.d)} ({s.bestDay.n})</> : 'no finishes yet'}</p>
    </div>
  )
}

function Bars({ data, max }) {
  return (
    <div className="chart">
      {data.map((c, i) => (
        <div key={i} className="col" title={`${c.date || c.label}: +${c.added} done ${c.done}`}>
          <div className="bars">
            <span className="a" style={{ height: `${Math.round((c.added / max) * 90)}px` }} />
            <span className="d" style={{ height: `${Math.round((c.done / max) * 90)}px` }} />
          </div>
          <small>{c.label}</small>
        </div>
      ))}
    </div>
  )
}

function TodoList({ list, onToggle, onDelete, onEdit, today, now, compact }) {
  if (!list.length) return compact ? <p className="empty small">—</p> : <p className="empty">Nothing here. Add something small and win the day ✨</p>
  return (
    <ul className="todos">
      {list.map((t) => {
        const overdue = isOverdue(t, today, now)
        const multi = isMultiDay(t)
        return (
          <li key={t.id} className={`${t.completed ? 'done' : ''} prio-${t.priority || 'medium'}${overdue ? ' overdue' : ''}`}>
            <label className="check">
              <input type="checkbox" checked={!!t.completed} onChange={() => onToggle(t.id)} />
              <span className="box">✓</span>
            </label>
            <div className="tmain">
              <div className="trow">
                <b>{t.text}</b>
                {t.time ? <span className="time">⏰ {t.time}</span> : <span className="allday">All day</span>}
              </div>
              <div className="meta">
                {multi
                  ? <span>📆 {prettyDate(t.date)} → {prettyDate(endOf(t))} • {spanDays(t)}d</span>
                  : <span>📆 {prettyDate(t.date)}</span>}
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
