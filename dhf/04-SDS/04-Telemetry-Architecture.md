# Software Design Specification — Telemetry Governance Architecture

---
document_id: SDS-TEL-001
title: Digital Viewer Module — Telemetry Governance Architecture
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements SYS-TEL-*, SYS-RVW-003-005)
trace_destination: VVP-001 (Verification Tests TEST-TEL-*)
references:
  - Digital Viewer Module Specification v2.1 (Section 10)
  - IEC 62304:2006+A1:2015 (Section 5.4)
---

## 1. Purpose

This document specifies the software architecture for telemetry governance, ensuring that navigation behavior is protected from discoverable retention while clinical declarations form the appropriate audit record.

## 2. Governance Rationale

### 2.1 The Core Principle

> "Navigation behavior is not evidence of clinical diligence."

The time a pathologist spends viewing a slide, the regions they examine, and the zoom levels they use are **wayfinding behaviors**, not measures of competence or completeness. This architecture enforces a strict separation between:

- **Ephemeral wayfinding data** (Tier 1) — Session-only, never retained
- **Clinical declarations** (Tier 2) — User-initiated attestations
- **Minimal audit data** (Tier 3) — Compliance logging without behavioral inference

### 2.2 Legal and Regulatory Context

| Risk | Mitigation |
|:-----|:-----------|
| Navigation traces subpoenaed in litigation | Tier 1 data never persisted; cannot be produced |
| "Diligence metrics" constructed from viewing patterns | No duration, tile coordinates, or viewport in retained data |
| Perverse incentives for performative viewing | System cannot measure "time spent" |

## 3. Three-Tier Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TIER 1: EPHEMERAL                                  │
│                      (Session-only, browser-only)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  • Navigation telemetry (viewport center, zoom, pan events)                 │
│  • Tile request coordinates (z, x, y)                                       │
│  • Viewport history / heatmaps                                              │
│  • "Opened" / "In Progress" review states                                   │
│  • Voice transcripts                                                        │
│  • AI query history                                                         │
│                                                                             │
│  Storage: Browser memory / IndexedDB                                        │
│  Lifetime: Session close → PURGE                                            │
│  Server transmission: PROHIBITED                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TIER 2: DECLARATIONS                               │
│                      (Case lifecycle retention)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  • Review state changes (Reviewed, Flagged, Needs_Attending)                │
│  • Annotation create/edit/delete events                                     │
│  • Annotation sharing requests                                              │
│  • Diagnostic Mode opt-out attestations                                     │
│  • Measurement recordings (with calibration state)                          │
│                                                                             │
│  Storage: PostgreSQL (Annotation Service)                                   │
│  Lifetime: Case lifecycle + retention policy                                │
│  Server transmission: REQUIRED                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TIER 3: AUDIT                                      │
│                      (7-year compliance retention)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  • Session start / end                                                      │
│  • Case access events                                                       │
│  • Sign-out events                                                          │
│                                                                             │
│  EXCLUDED from Tier 3:                                                      │
│  • slide_id (except in Tier 2 clinical artifacts)                           │
│  • Tile coordinates                                                         │
│  • Viewport state                                                           │
│  • Duration / time calculations                                             │
│  • Annotation counts                                                        │
│                                                                             │
│  Storage: Compliance Service / SIEM                                         │
│  Lifetime: 7 years per HIPAA                                                │
│  Server transmission: REQUIRED                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 1 STORE (Browser Only)                       │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │   │
│  │  │ Navigation  │    │ Voice       │    │ Session     │              │   │
│  │  │ Telemetry   │    │ Transcripts │    │ State       │              │   │
│  │  │             │    │             │    │             │              │   │
│  │  │ In-memory   │    │ In-memory   │    │ In-memory   │              │   │
│  │  │ queue       │    │ buffer      │    │ only        │              │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘              │   │
│  │                                                                      │   │
│  │  Purge on: window.beforeunload, session timeout, explicit clear     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 2 CLIENT                                     │   │
│  │                                                                      │   │
│  │  Transmits: review_state_change, annotation_persisted,              │   │
│  │             share_requested, dx_mode_opt_out, measurement_recorded  │   │
│  │                                                                      │   │
│  │  Includes event_id (client-generated UUID) for idempotency          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Tier 2/3 only)
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   ANNOTATION SERVICE        │    │   COMPLIANCE SERVICE        │
│   (Tier 2)                  │    │   (Tier 3)                  │
│                             │    │                             │
│   PostgreSQL                │    │   Audit log sink            │
│   Event-sourced             │    │   Minimal schema            │
└─────────────────────────────┘    └─────────────────────────────┘
```

## 5. Design Decisions

### 5.1 No Server Endpoint for Tier 1

**Decision**: There is NO API endpoint that accepts Tier 1 data.

**Rationale**:
- Technical control stronger than policy control
- Impossible to accidentally transmit navigation data
- Data cannot exist on server because there's nowhere to send it

### 5.2 Session-Only "In Progress" State

**Decision**: "Opened" / "In Progress" is Tier 1 (ephemeral, session-only).

**Rationale**:
- Opening a slide is a navigation event, not a clinical declaration
- Persisting "opened" timestamps creates discoverable "Dr. X opened slide Y at 09:15"
- This would be used as evidence regardless of disclaimers

### 5.3 Duration Never Calculated

**Decision**: Server code does NOT calculate time between events.

**Rationale**:
- Prevents inference of "viewing duration"
- Code review can verify absence of duration calculations
- Audit events have timestamps but no duration fields

## 6. Data Schemas

### 6.1 Tier 1 — Ephemeral Store (Client-Only)

```typescript
// In-memory only — never serialized to disk, never transmitted
interface Tier1Store {
  navigation: NavigationEvent[];  // Circular buffer, max 1000 events
  voiceTranscripts: string[];     // Cleared after processing
  sessionState: {
    openedSlides: Map<string, Date>;  // slide_id → opened_at (session only)
  };
}

interface NavigationEvent {
  timestamp: number;
  viewport: { x: number; y: number; zoom: number };
  action: 'pan' | 'zoom' | 'rotate';
}
```

### 6.2 Tier 2 — Declaration Events

```typescript
interface Tier2Event {
  event_id: string;        // Client-generated UUID
  timestamp: string;       // ISO 8601
  user_id: string;
  case_id: string;
  event_type: Tier2EventType;
  payload: Record<string, unknown>;
}

type Tier2EventType =
  | 'review_state_change'
  | 'annotation_persisted'
  | 'share_requested'
  | 'dx_mode_opt_out'
  | 'measurement_recorded';

// Example: review_state_change
{
  event_id: "uuid",
  timestamp: "2026-01-21T10:00:00Z",
  user_id: "user-123",
  case_id: "UPMC:S26-12345",
  event_type: "review_state_change",
  payload: {
    slide_id: "slide-uuid",
    new_state: "Reviewed"
  }
}
```

### 6.3 Tier 3 — Audit Schema

```typescript
interface Tier3AuditEvent {
  timestamp: string;       // ISO 8601
  event_id: string;        // Client-generated UUID
  user_id: string;
  lab_code: string;
  accession: string;
  action: 'session_start' | 'session_end' | 'case_access' | 'sign_out';
  outcome: 'success' | 'failure' | 'timeout';
  metadata: {
    session_id: string;
    client_info?: string;  // Browser/version (optional)
  };
}

// EXCLUDED from Tier 3 schema:
// - slide_id (except when required for Tier 2 clinical artifacts)
// - tile_coordinates
// - viewport_state
// - duration
// - annotation_count
// - any field enabling viewing behavior reconstruction
```

## 7. Implementation Controls

### 7.1 Client-Side Enforcement

```typescript
// Tier 1 purge on session end
window.addEventListener('beforeunload', () => {
  tier1Store.clear();
});

// Session timeout purge
setInterval(() => {
  if (sessionExpired()) {
    tier1Store.clear();
  }
}, 60000);

// NO transmission of Tier 1 data
// There is no API call that sends navigation data
// This is enforced by code review
```

### 7.2 Server-Side Enforcement

```typescript
// API does NOT accept:
// - Tile coordinates
// - Viewport positions
// - Navigation traces
// - Duration fields

// Schema validation rejects unknown fields
// No endpoint exists for bulk telemetry upload
```

### 7.3 Verification Checklist

| Control | Verification Method | Phase |
|:--------|:--------------------|:------|
| No server endpoint accepts Tier 1 data | API audit; network traffic analysis | 1 |
| Tier 1 data purged on session close | Browser storage inspection after close | 1 |
| Tier 3 schema rejects slide-level fields | API contract test; schema validation | 1 |
| No duration calculation in server code | Code review; grep for time calculations | 1 |
| No tile coordinates in audit logs | Log inspection; schema enforcement | 1 |
| Review state requires explicit action | UI audit; no auto-transition | 1 |
| "Opened/In Progress" not persisted | Database inspection after session | 1 |
| Voice transcripts not retained | Server storage audit | 2 |

## 8. Security Controls

| Control | Implementation |
|:--------|:---------------|
| Tier 1 isolation | In-memory only; no localStorage/IndexedDB persistence |
| Idempotency | Client-generated event_id prevents duplicate processing |
| Schema enforcement | Server rejects events with prohibited fields |
| Audit immutability | Tier 3 events append-only; no deletion |

## 9. Traceability Table

| Design Element | System Requirement | Risk Control |
|:---------------|:-------------------|:-------------|
| Three-tier model | SYS-TEL-001 | RC-004 |
| No Tier 1 transmission | SYS-TEL-002 | RC-004 |
| Session-close purge | SYS-TEL-003, SYS-RVW-005 | RC-004 |
| Tier 3 schema exclusions | SYS-TEL-004 | RC-004 |
| No duration calculation | SYS-TEL-005 | RC-004 |
| Session-only In_Progress | SYS-RVW-004 | RC-004 |

## 10. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial telemetry architecture |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
