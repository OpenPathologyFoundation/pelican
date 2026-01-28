# Software Design Specification — Viewer Core Architecture

---
document_id: SDS-VWR-001
title: Digital Viewer Module — Viewer Core Architecture
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements SYS-VWR-*, SYS-UI-*, SYS-MSR-*)
trace_destination: VVP-001 (Verification Tests TEST-VWR-*, TEST-UI-*, TEST-MSR-*)
references:
  - Digital Viewer Module Specification v2.1 (Sections 4, 6, 15)
  - IEC 62304:2006+A1:2015 (Section 5.4)
---

## 1. Purpose

This document specifies the software architecture for the Viewer Core, including image rendering, user interface, measurement tools, and dual-context window management.

## 2. Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIEWER CORE                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Viewer Controller                                  │   │
│  │  • State management (Svelte stores)                                  │   │
│  │  • Window lifecycle                                                  │   │
│  │  • Event coordination                                                │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
│       ┌──────────────────────────┼──────────────────────────────┐          │
│       │                          │                              │          │
│       ▼                          ▼                              ▼          │
│  ┌─────────────┐         ┌─────────────┐              ┌─────────────┐      │
│  │ Image       │         │ UI          │              │ Measurement │      │
│  │ Renderer    │         │ Components  │              │ Engine      │      │
│  │             │         │             │              │             │      │
│  │ OpenSeadragon         │ • Header    │              │ • Linear    │      │
│  │ + WebGL     │         │ • Gallery   │              │ • Area      │      │
│  │ + Tile Cache│         │ • Tools     │              │ • Calibration      │
│  └─────────────┘         └─────────────┘              └─────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Design Decisions

### 3.1 Image Rendering Library

**Decision**: Use OpenSeadragon with WebGL overlay

**Rationale**:
- Mature, well-tested pyramidal image viewer
- Native tile pyramid support (DZI, IIIF, custom)
- Active community and documentation
- WebGL overlay enables custom rendering for annotations

**Alternatives Considered**:
- Custom WebGL renderer: Higher development effort; reinventing well-solved problems
- Leaflet: Optimized for maps; less suited for pathology coordinate systems

### 3.2 Frontend Framework

**Decision**: SvelteKit

**Rationale**:
- Reactive state management fits viewer needs
- Smaller bundle size than React/Angular
- SSR capabilities for future progressive enhancement
- TypeScript support

### 3.3 Dual-Context Window Architecture

**Decision**: Parent-child windows via `window.open()` with WebSocket fallback

**Rationale**:
- Direct control for same-browser scenarios
- `postMessage()` for deterministic synchronization
- WebSocket (Session Awareness) for cross-browser coordination

## 4. Data Model

### 4.1 Viewer State

```typescript
interface ViewerState {
  // Case context
  caseId: string;              // lab_code:accession
  patientId: string;           // Display identifier

  // Slide context
  currentSlideId: string;
  currentScanId: string;
  slides: SlideRef[];

  // Viewport
  viewport: {
    center: { x: number; y: number };  // Level 0 coordinates
    zoom: number;                       // Current zoom level
    rotation: number;                   // Rotation degrees
  };

  // Mode
  diagnosticMode: boolean;
  diagnosticModeOptOut: boolean;

  // Session (Tier 1 - ephemeral)
  sessionStartedAt: Date;
  reviewStates: Map<string, 'opened' | 'in_progress'>;  // Session only
}

interface SlideRef {
  slideId: string;
  scanId: string;
  barcode: string;
  partLabel: string;
  stain: string;
  thumbnailUrl: string;
  status: 'current' | 'superseded';
}
```

### 4.2 Measurement Data

```typescript
interface Measurement {
  id: string;
  slideId: string;
  scanId: string;
  type: 'line' | 'rectangle' | 'polygon';
  geometry: GeoJSON.Geometry;  // Level 0 coordinates
  value: number;               // Computed measurement
  unit: 'um' | 'mm';
  mpp: number;                 // MPP used for calculation
  mppSource: 'scanner' | 'manual';
  calibrationState: 'site_calibrated' | 'factory' | 'unvalidated' | 'unknown';
  createdAt: Date;
  createdBy: string;
}
```

## 5. Interface Contracts

### 5.1 Tile Server Integration

The viewer consumes tiles from a Level 1+ conformant tile server:

```typescript
// Tile URL pattern
const tileUrl = `${baseUrl}/slides/${slideId}/tiles/${z}/${x}/${y}.jpeg`;

// Info endpoint
interface SlideInfo {
  slide_id: string;
  scan_id: string;
  width: number;      // Level 0 width
  height: number;     // Level 0 height
  tile_size: number;  // Typically 256 or 512
  levels: number;     // Pyramid depth
  mpp: number;        // Microns per pixel
  mpp_source: 'scanner' | 'manual';
  mpp_validation: {
    state: 'site_calibrated' | 'factory' | 'unvalidated' | 'unknown';
    calibration_date?: string;
  };
  format: 'jpeg' | 'png' | 'webp';
}
```

### 5.2 Parent-Child Window Communication

```typescript
// Case Context → Viewer Context
interface ViewerOpenMessage {
  type: 'VIEWER_OPEN';
  caseId: string;
  patientId: string;
  slideId?: string;
  jwt: string;
}

interface ViewerCloseMessage {
  type: 'VIEWER_CLOSE';
}

interface CaseSwitchMessage {
  type: 'CASE_SWITCH';
  newCaseId: string;
  newPatientId: string;
}

// Viewer Context → Case Context
interface ViewerReadyMessage {
  type: 'VIEWER_READY';
  windowId: string;
}

interface SlideChangedMessage {
  type: 'SLIDE_CHANGED';
  slideId: string;
}
```

## 6. Behavioral Specifications

### 6.1 Viewer Initialization Sequence

```
1. Case Context opens Viewer Context via window.open()
2. Viewer Context receives VIEWER_OPEN message
3. Viewer fetches slide list from Portal API
4. Viewer initializes OpenSeadragon with first slide
5. Viewer sends VIEWER_READY message
6. FDP Controller registers focus handler
7. Viewer displays focus announcement
```

### 6.2 Case Switching Flow

```
User clicks different case in Case Context
         │
         ▼
┌─────────────────────────┐
│ Is Viewer open?         │──No──▶ Switch normally
└───────────┬─────────────┘
            │ Yes
            ▼
┌─────────────────────────┐
│ Display confirmation:   │
│ "Switch to new slides?" │
│ [Switch] [Keep] [Cancel]│
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
 Switch          Keep + Warn
 - Close old     - Leave open
 - Open new      - Register warning
```

### 6.3 Performance Requirements Implementation

| Requirement | Implementation |
|:------------|:---------------|
| Initial load < 2s | Prefetch visible tiles on slide info receipt |
| Pan response < 16ms | Canvas-based rendering; avoid DOM operations |
| Zoom response < 50ms | Precomputed zoom levels; progressive tile load |
| Memory < 2GB | LRU tile cache with configurable max size |

## 7. Security Controls

| Control | Implementation |
|:--------|:---------------|
| JWT validation | Token attached to all tile/API requests |
| No credential storage | JWT kept in memory only; no localStorage |
| HTTPS required | All tile/API URLs use HTTPS |

## 8. Traceability Table

| Design Element | System Requirement | Risk Control |
|:---------------|:-------------------|:-------------|
| OpenSeadragon renderer | SYS-VWR-001, SYS-VWR-005 | — |
| Tile prefetching | SYS-VWR-002, SYS-VWR-007 | — |
| LRU tile cache | SYS-VWR-006, SYS-VWR-008 | — |
| Minimal default UI | SYS-UI-001, SYS-UI-002 | — |
| Slide gallery | SYS-UI-003, SYS-UI-004 | — |
| Dual-window architecture | SYS-UI-006 | — |
| Measurement engine | SYS-MSR-001, SYS-MSR-002, SYS-MSR-003 | RC-003 |
| Calibration display | SYS-MSR-004, SYS-MSR-005, SYS-DXM-003 | RC-003 |
| DX Mode measurement block | SYS-MSR-007 | RC-003 |

## 9. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial viewer architecture |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
