# Glass Todo — local-first daily planner

No login. No cloud. Data stays on device (localStorage). Optional local backend + installable desktop/mobile app.

```
todo-app/
  frontend/   React + Vite (glass UI, responsive, PWA)
  backend/    Express local API, file storage (backend/data/todos.json)
  desktop/    Electron wrapper → .exe / .dmg / .AppImage
```

## Features
- Add task with **date + time timeline**, priority, notes
- Tabs: **Today / Upcoming / Previous / All / Calendar / Insights**
- **Calendar month view** like Google Calendar, click a day to see tasks
- **Insights**: last 7 / 30 / 365 days added vs completed, % meter, 14-day chart, day streak 🔥
- Search + priority filter, edit, overdue highlight, clear completed
- **Glass UI**, responsive (mobile → desktop)
- localStorage key `glass-todo-app-v2` (auto-migrates old `vite-todo-app-items-v1`), no data loss

## Run (any OS with Node 18+)

Frontend only (simplest, 100% local):
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

With local backend API:
```bash
cd backend
npm install
npm run dev      # http://localhost:4000/api/health
# frontend can use it via VITE_API_URL=http://localhost:4000
```

Root shortcuts:
```bash
npm run dev:frontend
npm run dev:backend
npm run build    # builds frontend/dist
```

## For end users — no code, no commands (click to open)

You have 3 ways. Pick one. No `npm`, no terminal needed after setup.

**A. Download the app (easiest, like normal software)**
1. Maintainer pushes a tag (`git tag v1.0.0 && git push --tag`) → GitHub Actions builds automatically.
2. User goes to GitHub → Releases → downloads:
   - Windows: `GlassTodo-*.exe` → double-click → install → open from Start menu
   - Mac: `GlassTodo-*.dmg` → drag to Applications → open
   - Linux: `GlassTodo-*.AppImage` → double-click (or `*.deb` → install)
3. Done. App opens with its own window, data saved locally on that machine.

**B. Double-click starter (from this folder, needs Node once)**
- Windows: double-click `start.bat`
- Mac/Linux: double-click (or `./start.sh`)
- It auto-installs, auto-builds, then opens `http://localhost:4000` in the browser. Close terminal to stop.
- Only requirement: install Node 18+ once from https://nodejs.org.

**C. Phone / PWA (no install file)**
- Host `frontend/dist` once (Vercel / Netlify / GitHub Pages), share the link.
- User opens link → Chrome/Edge menu → Install / Add to Home Screen. Works offline after that.

> Why this works now: `backend/server.js` serves BOTH the API and the built app, so one process = full app on `http://localhost:4000`. The `desktop/` Electron wrapper bundles that into a real `.exe/.dmg/.AppImage`.

## Backend API
- `GET /api/health`
- `GET /api/todos`
- `POST /api/todos {text, notes, date, time, priority}`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`
- `GET /api/stats?range=week|month|year`
