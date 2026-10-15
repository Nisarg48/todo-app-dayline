# Dayline — day-wise daily planner

No login. No cloud. Data stays on device (localStorage + optional local server file). Glass-style UI.

```
todo-app/
  frontend/   React + Vite (glass UI, responsive, PWA — works alone, no backend needed)
  backend/    Express local API, file storage (backend/data/todos.json) — single-server mode + backup
  desktop/    Electron wrapper (native window + bundled backend) → .exe / .dmg / .AppImage
```

## Features
- Add task with **start + end date (multi-day ranges)**, time (empty = all-day, due end of day), priority, notes
- New tasks start **today or later** — history lives in Previous, never lost on update (auto-migration + export/import)
- Tabs: **Today / Upcoming (next 3 days) / Previous / Calendar / Insights / About**
- **Calendar month view**, ranges stretch across days, click a day to see it
- **Insights**: Sun–Sat week, calendar month/year + all-time, added vs done, best day, week/month/year charts, priority split, streaks
- Search + priority filter, edit, time-aware overdue, clear completed
- **About tab**: how-to, why-Dayline, data export/import
- **Glass UI**, responsive, localStorage key `dayline-todos-v3`

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

## How this app was built — with AI, in OpenCode

This whole application was made using an AI model — **Muse Spark** — working inside **OpenCode**, as a hands-on test of how it works, how powerful it is, and how well it tackles ideas:

- **Ideas → working app**: plain-language ideas ("glass UI", "a task that runs from the 5th to the 10th", "weeks mean Sun–Sat") were turned into real, tested features in the same session — no specs, no tickets.
- **Whole product, not snippets**: planning, React frontend, local Express backend, Electron desktop wrapper, PWA packaging, release automation, docs — handled as one connected build.
- **Real engineering loop**: actual errors were diagnosed from real output — a white screen traced to a stale service worker, port clashes, task loss across updates — then fixed, rebuilt, and re-verified (`npm run build`, HTTP checks) until green.
- **Human directs, model implements**: the person supplied the vision and feedback ("remove the All tab", "Upcoming = 3 days only"); the model did the scaffolding, boilerplate, wiring, and iteration.

It doubles as a demo of agentic development with OpenCode: describe the outcome, review, refine — the boring parts disappear and ideas become software.
