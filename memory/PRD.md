# ClAImb AI Coach — Product Requirements Document

**Last Updated:** 2026-03-06

---

## Problem Statement
Build ClAImb AI Coach — an Expo + FastAPI app with Service-Oriented Architecture where climbers:
1. Take photos of climbing walls
2. AI (Claude Sonnet 4-6 Vision + optional Roboflow) detects holds and overlays SVG circles
3. GradingService assigns a V-scale bouldering grade
4. Route history is tracked with Coach notes

Stack: React Native (Expo SDK 54) + FastAPI + MongoDB (env default, not PostgreSQL)

---

## Architecture (SOA)

```
/backend
  server.py              ← FastAPI entry, imports routers
  database.py            ← MongoDB async motor connection
  models/schemas.py      ← Pydantic contracts (HoldLocation, AnalysisRequest/Response, RouteRecord)
  services/
    vision_service.py    ← Claude Vision (primary) + Roboflow (optional, ROBOFLOW_API_KEY)
    grading_service.py   ← Claude Sonnet 4-6 V-scale grading
  routes/
    analysis.py          ← POST /api/analyze, GET /api/analyze/{id}
    history.py           ← GET /api/history, DELETE /api/history/{id}, GET /api/history/stats
  worker.py              ← Celery config (Redis broker, graceful fallback when Redis unavailable)
  tasks.py               ← analyze_route_async Celery task

/frontend
  app/_layout.tsx            ← Root Stack navigator
  app/index.tsx              ← Redirect → /(tabs)
  app/(tabs)/_layout.tsx     ← Bottom Tab navigator (Home | Scan | History)
  app/(tabs)/index.tsx       ← Home dashboard
  app/(tabs)/camera.tsx      ← Camera capture (CameraView native, ImagePicker web)
  app/(tabs)/history.tsx     ← Route history list
  app/result.tsx             ← Analysis result: SVG hold overlay + grade + coach notes
  utils/store.ts             ← In-memory store for analysis→result handoff
  utils/api.ts               ← Typed API client functions
```

---

## User Personas
- **Primary:** Rock climbers (bouldering), ages 16–35, want AI coach feedback
- **Secondary:** Route setters / gym staff monitoring route difficulty

---

## Core Requirements (Static)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Camera captures photo → sends to backend | ✅ Done |
| 2 | VisionService detects holds (x, y, radius) | ✅ Done |
| 3 | SVG circles overlay on image | ✅ Done |
| 4 | GradingService assigns V-scale grade | ✅ Done |
| 5 | Pydantic models define mobile↔backend contract | ✅ Done |
| 6 | Celery worker for async processing | ✅ Done (worker.py + tasks.py) |
| 7 | Route history stored + displayed | ✅ Done |
| 8 | Dark theme (Digital Crag) | ✅ Done |
| 9 | Guest mode, no auth | ✅ Done |
| 10 | Claude Sonnet 4-6 via Emergent Universal Key | ✅ Done |

---

## What's Been Implemented (2026-03-06)

### Backend
- **VisionService** — Claude Vision primary; Roboflow optional (set ROBOFLOW_API_KEY)
- **GradingService** — Claude Sonnet 4-6 grades route V0–V11+, returns coach notes
- **Routes** — `/api/analyze`, `/api/history`, `/api/history/stats`, `/api/history/{id}`
- **Celery worker** — Configured for Redis broker; gracefully skips if Redis unavailable
- **MongoDB** — `route_history` collection with RouteRecord schema

### Frontend
- **Home Dashboard** — Stats (total routes, best grade, AI model), recent climbs, How-it-works
- **Camera Screen** — CameraView (native) + ImagePicker (web), gym name input
- **Result Screen** — Photo + absolute-positioned SVG overlay (color-coded by hold type: start=green, finish=pink, hand=cyan, foot=yellow), grade badge, confidence bar, coach notes
- **History Screen** — FlatList of route cards, swipe-to-delete, grade color coding

### API Test Results (2026-03-06)
- Backend: 100% (8/8 tests passed)
- Frontend: 95% (all screens + tabs functional; minor web console warning on back navigation)

---

## Environment / Keys
- `EMERGENT_LLM_KEY` — Set in `/app/backend/.env`
- `ROBOFLOW_API_KEY` — Optional; enables Roboflow hybrid detection
- `REDIS_URL` — Optional; enables Celery async processing (currently in-process)

---

## Prioritized Backlog

### P0 (Blocking for production)
- None currently

### P1 (High value, next sprint)
- Store full holds array in MongoDB RouteRecord (currently not persisted, result re-fetch loses overlay)
- Roboflow API key integration + testing
- Redis + Celery live testing

### P2 (Nice to have)
- User authentication (JWT or Google OAuth)
- Route photo gallery in history cards
- Progress analytics (grade progression chart)
- Share result as image
- Offline mode with cached results
- Push notifications after async analysis complete

---

## Next Tasks
1. Add `holds` field to RouteRecord schema and persist in analysis.py
2. Seed a few demo routes for first-run experience
3. Add Roboflow hybrid mode documentation
4. Enable Redis + Celery worker in production deployment
