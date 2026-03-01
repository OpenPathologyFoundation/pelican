# Digital Viewer Module

**Pathology Portal Platform - Digital Viewer**

A modern, voice-enabled whole slide image viewer for digital pathology workflows. Built for clinical sign-out with patient safety features including the Focus Declaration Protocol (FDP).

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           DIGITAL VIEWER SYSTEM                                 │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                        Browser Application                               │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│   │  │  Viewer UI  │  │ Annotations │  │Review State │  │   Voice     │    │  │
│   │  │   (OSD)     │  │  (GeoJSON)  │  │  (Workflow) │  │  (Speech)   │    │  │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │  │
│   │         └────────────────┼────────────────┼────────────────┘           │  │
│   │                          │                │                             │  │
│   │                    ┌─────┴────────────────┴─────┐                       │  │
│   │                    │     FDP Library            │                       │  │
│   │                    │  (Focus Declaration)       │                       │  │
│   │                    └─────────────┬──────────────┘                       │  │
│   │                                  │                                      │  │
│   │                    ┌─────────────┴──────────────┐                       │  │
│   │                    │     Telemetry              │                       │  │
│   │                    │  (3-tier governance)       │                       │  │
│   │                    └────────────────────────────┘                       │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                     │                                          │
│                                     │ WebSocket                                │
│                                     ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                    Session Awareness Service                             │  │
│   │                    (FDP Layer 2 - Node.js)                               │  │
│   │                    Port: 8765                                            │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Large Image Tile Server                                 │
│                         (Python/FastAPI)                                        │
│                         Port: 8000                                              │
│                                                                                 │
│   Endpoints:                                                                    │
│   • /tiles/{id}/{z}/{x}/{y}     - XYZ tiles                                    │
│   • /deepzoom/{id}.dzi          - DeepZoom descriptors                         │
│   • /metadata/{id}              - Slide metadata                               │
│   • /thumbnail/{id}             - Quick previews                               │
└────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ File System
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              Image Storage                                      │
│                                                                                 │
│   Supported Formats: SVS, NDPI, MRXS, SCN, TIFF, OME-TIFF, DICOM, etc.        │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description | Documentation |
|---------|-------------|---------------|
| `@pathology/fdp-lib` | Focus Declaration Protocol - patient safety | [README](packages/fdp-lib/README.md) |
| `@pathology/session-service` | Session Awareness WebSocket hub | [README](packages/session-service/README.md) |
| `@pathology/viewer-core` | Svelte + OpenSeadragon components | [README](packages/viewer-core/README.md) |
| `@pathology/annotations` | GeoJSON-based annotations | [README](packages/annotations/README.md) |
| `@pathology/review-state` | Diagnostic mode & workflow | [README](packages/review-state/README.md) |
| `@pathology/telemetry` | 3-tier telemetry governance | [README](packages/telemetry/README.md) |
| `@pathology/voice` | Voice recognition & intent | [README](packages/voice/README.md) |

---

## Quick Start - Complete System

### Prerequisites

- **Python 3.10+** with virtual environment
- **Node.js 20+** with npm
- Whole slide images (SVS, NDPI, TIFF, etc.)

### Step 1: Start the Tile Server (Python)

```bash
# Navigate to the large_image repository root
cd /path/to/large_image

# Activate the Python virtual environment
source .venv/bin/activate

# Install the tile server (if not already installed)
pip install -e ./utilities/server[all]

# Start the tile server
large_image_server --image-dir /path/to/your/slides --port 8000

# Or with uvicorn directly for development
cd utilities/server
uvicorn large_image_server:app --reload --host 0.0.0.0 --port 8000
```

The tile server will be available at `http://localhost:8000`

**Verify it's running:**
```bash
curl http://localhost:8000/health
# Returns: {"status": "healthy", ...}
```

### Step 2: Start the Session Awareness Service (Node.js)

```bash
# In a new terminal, navigate to digital-viewer
cd digital-viewer

# Install dependencies (first time only)
npm install

# Start the session service
npm run dev:session

# Or run directly
cd packages/session-service
npm run dev
```

The session service will be available at `ws://localhost:8765`

### Step 3: Start the Viewer UI (Development)

```bash
# In a new terminal, from digital-viewer directory
cd digital-viewer

# Start the development server
npm run dev

# Or specifically the viewer
npm run dev:viewer
```

The viewer will be available at `http://localhost:5173`

---

## Service Reference

### 1. Large Image Tile Server (Python)

**Purpose:** Serves tile images from whole slide images

**Location:** `utilities/server/`

**Port:** 8000 (default)

**Start Command:**
```bash
source .venv/bin/activate
large_image_server --image-dir /path/to/slides --port 8000
```

**Key Endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /metadata/{slide_id}` | Slide metadata (dimensions, magnification) |
| `GET /tiles/{slide_id}/{z}/{x}/{y}` | XYZ tile |
| `GET /deepzoom/{slide_id}.dzi` | DeepZoom descriptor |
| `GET /thumbnail/{slide_id}` | Slide thumbnail |

**Documentation:** [utilities/server/README.md](../utilities/server/README.md)

---

### 2. Session Awareness Service (Node.js)

**Purpose:** FDP Layer 2 - tracks open cases across browser windows

**Location:** `packages/session-service/`

**Port:** 8765 (default)

**Start Command:**
```bash
cd packages/session-service
npm run dev
# Or: npx tsx src/cli.ts --port 8765
```

**WebSocket Messages:**
| Message | Direction | Description |
|---------|-----------|-------------|
| `register` | Client → Server | Register window with case |
| `deregister` | Client → Server | Unregister window |
| `heartbeat` | Client → Server | Keep-alive signal |
| `warning` | Server → Client | Multi-case or mismatch alert |

**Documentation:** [packages/session-service/README.md](packages/session-service/README.md)

---

### 3. Viewer UI (Browser)

**Purpose:** Interactive slide viewer with annotation support

**Location:** `packages/viewer-core/`

**Port:** 5173 (standalone) or 5174 (orchestrated mode, behind nginx)

**Start Command:**
```bash
# Standalone mode
npm run dev:viewer

# Orchestrated mode (behind nginx proxy)
VITE_BASE=/viewer/ npm run dev -- --port 5174 --host
```

**Documentation:** [packages/viewer-core/README.md](packages/viewer-core/README.md)

---

## Environment Configuration

Create a `.env` file in the `digital-viewer` directory:

```env
# Vite base path — set to /viewer/ when running behind the nginx proxy.
# This makes Vite serve all assets under /viewer/... and rewrite injected
# paths (e.g. /@vite/client → /viewer/@vite/client). Omit for standalone mode.
# VITE_BASE=/viewer/

# Tile Server
VITE_TILE_SERVER_URL=http://localhost:8000

# Session Service
VITE_SESSION_SERVICE_URL=ws://localhost:8765

# Features
VITE_DIAGNOSTIC_MODE_DEFAULT=true
VITE_VOICE_ENABLED=true

# Telemetry (optional)
VITE_TELEMETRY_WORKFLOW_ENDPOINT=http://localhost:8000/api/telemetry
VITE_TELEMETRY_AUDIT_ENDPOINT=http://localhost:8000/api/audit
```

---

## Running All Services (Development)

**Terminal 1 - Tile Server:**
```bash
cd /path/to/large_image
source .venv/bin/activate
large_image_server --image-dir ~/slides --port 8000
```

**Terminal 2 - Session Service:**
```bash
cd /path/to/large_image/digital-viewer
npm run dev:session
```

**Terminal 3 - Viewer UI:**
```bash
cd /path/to/large_image/digital-viewer
npm run dev
```

---

## Orchestrated Mode (with Okapi)

The viewer can run in two modes:

1. **Standalone mode** — opened directly at `http://localhost:5173` with the demo entry point (`index.html`). Used for viewer development and testing without the Okapi backend.
2. **Orchestrated mode** — launched as a child window by the Okapi web-client via the `orchestrated.html` entry point. This is the production deployment mode for clinical use.

### How Orchestrated Mode Works

In orchestrated mode, the viewer is launched by the Okapi orchestrator (web-client) via `window.open('/viewer/orchestrated.html')`. The two windows communicate through a typed `postMessage` bridge:

```
┌─────────────────┐          postMessage          ┌─────────────────┐
│  Okapi Web       │  ──────────────────────────>  │  Digital Viewer  │
│  Client          │  orchestrator:init            │                  │
│  (orchestrator)  │  orchestrator:token-refresh   │  orchestrated/   │
│                  │  orchestrator:case-change      │  App.svelte      │
│  ViewerBridge    │  orchestrator:heartbeat        │  Orchestrator-   │
│                  │  orchestrator:logout           │  Bridge          │
│                  │  <──────────────────────────  │                  │
│                  │  viewer:ready                  │                  │
│                  │  viewer:heartbeat-ack          │                  │
│                  │  viewer:case-loaded            │                  │
│                  │  viewer:audit-event            │                  │
└─────────────────┘                                └─────────────────┘
```

The orchestrator provides:
- **JWT tokens** for authenticated tile loading (passed via `orchestrator:init`, refreshed via `orchestrator:token-refresh`)
- **Case context** — which case and slides to load
- **Lifecycle management** — heartbeat every 5 seconds, orphan detection at 60 seconds
- **Audit event collection** — viewer reports events back, orchestrator batches and flushes to backend

### Entry Points

The Vite build produces two HTML entry points:

| File | Purpose |
|------|---------|
| `index.html` | Standalone demo entry point (uses `src/demo/main.ts`) |
| `orchestrated.html` | Orchestrated entry point (uses `src/orchestrated/main.ts`) |

The orchestrated entry point mounts `src/orchestrated/App.svelte`, which:
1. Creates an `OrchestratorBridge` instance and sends `viewer:ready`
2. Waits for `orchestrator:init` with JWT, case config, and tile server URL
3. Mounts `PathologyViewer` with the received configuration
4. Forwards token refreshes to the `authToken` store
5. Handles case changes by remounting PathologyViewer via Svelte `{#key}`
6. Shows lifecycle overlays (session ended, connection lost, reconnecting)
7. Reports audit events (case opened, slide viewed, case closed) back to orchestrator

### Lifecycle Overlays

When the orchestrator disconnects or ends, the viewer shows appropriate overlays:

| Bridge State | Viewer Behavior |
|-------------|-----------------|
| `waiting` | "Waiting for workstation..." spinner |
| `connected` | Normal viewer operation |
| `disconnected` | Yellow "Reconnecting..." banner (viewer still usable) |
| `lost` | Full "Connection Lost" overlay (>60s without heartbeat) |
| `ended` | "Session Ended" overlay (orchestrator sent logout) |

### Running in Orchestrated Mode

To run the full two-window system locally, you need all 5 services behind the nginx reverse proxy. From the **Okapi** repository:

```bash
# 1. Start infrastructure (Keycloak + Postgres)
docker compose -f auth-system/docker-compose.yml up -d

# 2. Start auth-system (:8080)
set -a && source auth-system/.env && set +a
cd auth-system && ./gradlew bootRun &

# 3. Start tile server (:8000) — from the large_image repo
source /path/to/large_image/.venv/bin/activate
large_image_server --image-dir /path/to/slides --port 8000 &

# 4. Start digital-viewer (:5174)
# --host is required so Docker's nginx can reach the dev server
# VITE_BASE=/viewer/ makes Vite serve assets under /viewer/ for the nginx proxy
cd /path/to/large_image/digital-viewer
VITE_BASE=/viewer/ npm run dev -- --port 5174 --host &

# 5. Start web-client (:5173)
cd /path/to/Okapi/web-client
npm run dev -- --host &

# 6. Start reverse proxy (:8443)
docker run --rm -p 8443:8443 \
  --add-host=host.docker.internal:host-gateway \
  -v /path/to/Okapi/proxy/nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

Then open `http://localhost:8443`, log in, navigate to a case, and click **Launch Viewer**.

### Vite Base Path (`VITE_BASE`)

When running behind the nginx reverse proxy, the viewer is served at `/viewer/`. Setting `VITE_BASE=/viewer/` tells Vite to:
- Serve HTML files at `/viewer/orchestrated.html` instead of `/orchestrated.html`
- Rewrite injected script tags (e.g., `/@vite/client` becomes `/viewer/@vite/client`)
- Rewrite all asset references in HTML files (favicon, main script, etc.)

This is required because two Vite dev servers share a single nginx origin — without the base path, Vite's internal paths (`/@vite/...`, `/@fs/...`) would conflict with the SvelteKit app's routes.

In standalone mode (no nginx), omit `VITE_BASE` and the viewer serves from `/` as usual.

### Vite Multi-Page Configuration

The `vite.config.ts` includes both entry points:

```ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      orchestrated: resolve(__dirname, 'orchestrated.html'),
    },
  },
},
```

### Key Orchestrated Mode Files

| File | Purpose |
|------|---------|
| `orchestrated.html` | HTML entry point for orchestrated mode |
| `src/orchestrated/main.ts` | Svelte 5 mount bootstrap |
| `src/orchestrated/App.svelte` | Orchestration wrapper with bridge lifecycle |
| `packages/viewer-core/src/orchestrator-bridge.ts` | `OrchestratorBridge` class (viewer-side bridge) |
| `packages/viewer-core/src/types/orchestrator-messages.ts` | Typed message protocol |
| `packages/viewer-core/src/stores.ts` | `authToken`, `orchestratorState`, `authExpired` stores |
| `packages/annotations/src/persistence.ts` | Annotation persistence provider interface |

---

## Running Tests

### TypeScript/JavaScript Tests (Vitest)

```bash
cd digital-viewer

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Python Tests (pytest)

```bash
source .venv/bin/activate
cd utilities/server

# Install test dependencies
pip install -e ".[test]"

# Run tests
pytest tests/
```

---

## Core Features

### Focus Declaration Protocol (FDP)

A patient safety mechanism ensuring pathologists always know which case they are examining.

- **Layer 1 (Local):** Visual announcement when window gains focus
- **Layer 2 (Session):** Cross-window awareness via WebSocket

### Telemetry Governance

Three-tier privacy-preserving telemetry:

| Tier | Name | Retention | Transmitted | Example |
|------|------|-----------|-------------|---------|
| 1 | Ephemeral | Session only | Never | Viewport position, zoom |
| 2 | Workflow | Case lifecycle | Batched | Annotations, review states |
| 3 | Audit | 7 years | Immediate | Sign-outs, amendments |

### Diagnostic Mode

For clinical sign-out with enforced constraints:

- Persistent header (cannot collapse)
- Calibration validation for measurements
- Required AI confidence indicators
- Minimum slide coverage tracking

---

## Production Deployment

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  tile-server:
    build: ./utilities/server
    ports:
      - "8000:8000"
    volumes:
      - /path/to/slides:/slides:ro
    environment:
      - IMAGE_DIR=/slides
      - CACHE_BACKEND=redis
      - REDIS_URL=redis://redis:6379

  session-service:
    build: ./digital-viewer/packages/session-service
    ports:
      - "8765:8765"

  viewer:
    build: ./digital-viewer
    ports:
      - "80:80"
    environment:
      - TILE_SERVER_URL=http://tile-server:8000
      - SESSION_SERVICE_URL=ws://session-service:8765

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

```bash
docker compose up -d
```

---

## License

Apache-2.0
