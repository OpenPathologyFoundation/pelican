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

**Port:** 5173 (Vite dev server)

**Start Command:**
```bash
npm run dev:viewer
```

**Documentation:** [packages/viewer-core/README.md](packages/viewer-core/README.md)

---

## Environment Configuration

Create a `.env` file in the `digital-viewer` directory:

```env
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
