# Software Design Specification — Annotation System Architecture

---
document_id: SDS-ANN-001
title: Digital Viewer Module — Annotation System Architecture
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements SYS-ANN-*, SYS-RVW-*)
trace_destination: VVP-001 (Verification Tests TEST-ANN-*, TEST-RVW-*)
references:
  - Digital Viewer Module Specification v2.1 (Sections 8, 9)
  - IEC 62304:2006+A1:2015 (Section 5.4)
---

## 1. Purpose

This document specifies the software architecture for the Annotation System, including annotation creation, persistence, visibility management, and review state tracking.

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANNOTATION MANAGER (Client)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ Annotation      │───▶│ Visibility      │───▶│ Renderer        │        │
│  │ Editor          │    │ Filter          │    │ (WebGL Overlay) │        │
│  │                 │    │                 │    │                 │        │
│  │ Point, Line,    │    │ private, team,  │    │ GeoJSON →       │        │
│  │ Rect, Polygon   │    │ department...   │    │ Canvas paths    │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                                │
│  │ Review State    │    │ Persistence     │                                │
│  │ Manager         │    │ Client          │                                │
│  │                 │    │                 │                                │
│  │ Declaration-    │    │ Event-sourced   │                                │
│  │ based states    │    │ API calls       │                                │
│  └─────────────────┘    └─────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Tier 2 events)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANNOTATION SERVICE (Server)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ Event Store     │    │ Current State   │    │ Visibility      │        │
│  │                 │    │ Materializer    │    │ Enforcer        │        │
│  │ Immutable       │    │                 │    │                 │        │
│  │ append-only     │    │ PostgreSQL      │    │ Access control  │        │
│  │ log             │    │ + PostGIS       │    │ per visibility  │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Design Decisions

### 3.1 Event-Sourced Storage

**Decision**: Use event sourcing for annotation persistence.

**Rationale**:
- Complete audit trail of all changes
- Tamper-evident (append-only log)
- Supports undo/history features
- Regulatory compliance (who changed what, when)

### 3.2 Visibility Model

**Decision**: Six-level visibility hierarchy with default to private.

**Rationale**:
- Private default protects personal annotations
- Graduated sharing supports clinical workflows (case team, department, conference)
- Explicit sharing prevents accidental disclosure

### 3.3 Coordinate Space

**Decision**: All coordinates in full-resolution pixel space (level 0).

**Rationale**:
- Resolution-independent storage
- Consistent across different pyramid levels
- Simplifies coordinate transforms on client

### 3.4 Declaration-Based Review States

**Decision**: Review states (Reviewed, Flagged, Needs_Attending) are explicit user declarations, not inferred.

**Rationale**:
- Navigation behavior does not indicate review completeness
- Protects against litigation risk from "diligence metrics"
- "Opened/In_Progress" is session-only (Tier 1)

## 4. Data Model

### 4.1 Annotation Entity

```typescript
interface Annotation {
  annotation_id: string;       // UUID
  case_id: string;             // lab_code:accession
  slide_id: string;            // Slide identifier
  scan_id: string;             // Immutable link to specific scan
  author_id: string;           // User who created
  type: AnnotationType;
  geometry: GeoJSON.Geometry;  // Level 0 coordinates
  properties: AnnotationProperties;
  visibility: VisibilityLevel;
  created_at: Date;
  modified_at: Date;
  is_deleted: boolean;         // Soft delete flag
}

type AnnotationType =
  | 'point'
  | 'line'
  | 'rectangle'
  | 'polygon'
  | 'text'
  | 'measurement';

type VisibilityLevel =
  | 'private'      // Only author can see
  | 'case_team'    // Users assigned to case
  | 'department'   // Department members
  | 'conference'   // Tumor board, case conference
  | 'external'     // External consultants
  | 'published';   // Public/report inclusion

interface AnnotationProperties {
  label?: string;
  color?: string;
  notes?: string;
  measurement?: {
    value: number;
    unit: 'um' | 'mm';
    mpp: number;
    calibrationState: string;
  };
}
```

### 4.2 Annotation Event

```typescript
interface AnnotationEvent {
  event_id: string;            // Client-generated UUID
  annotation_id: string;
  event_type: 'created' | 'modified' | 'deleted' | 'visibility_changed';
  user_id: string;
  timestamp: Date;
  geometry?: GeoJSON.Geometry;
  properties?: AnnotationProperties;
  visibility?: VisibilityLevel;
}
```

### 4.3 Review State

```typescript
// Persisted states (Tier 2)
type PersistedReviewState = 'Reviewed' | 'Flagged' | 'Needs_Attending';

// Session-only states (Tier 1)
type SessionReviewState = 'Opened' | 'In_Progress';

interface ReviewStateChange {
  event_id: string;
  case_id: string;
  slide_id: string;
  user_id: string;
  new_state: PersistedReviewState;
  timestamp: Date;
}
```

## 5. Database Schema

```sql
-- Annotation events (immutable log)
CREATE TABLE annotation_events (
  event_id UUID PRIMARY KEY,
  annotation_id UUID NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  geometry GEOMETRY,
  properties JSONB,
  visibility VARCHAR(50)
);

CREATE INDEX idx_annotation_events_annotation ON annotation_events (annotation_id);
CREATE INDEX idx_annotation_events_timestamp ON annotation_events (timestamp);

-- Current annotation state (materialized)
CREATE TABLE annotations_current (
  annotation_id UUID PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL,
  slide_id UUID NOT NULL,
  scan_id UUID NOT NULL,
  annotation_type VARCHAR(50) NOT NULL,
  geometry GEOMETRY NOT NULL,
  properties JSONB,
  visibility VARCHAR(50) NOT NULL DEFAULT 'private',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  modified_by VARCHAR(255),
  modified_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_annotations_spatial ON annotations_current USING GIST (geometry);
CREATE INDEX idx_annotations_slide ON annotations_current (slide_id, scan_id);
CREATE INDEX idx_annotations_visibility ON annotations_current (visibility);
CREATE INDEX idx_annotations_case ON annotations_current (case_id);

-- Review states (Tier 2 declarations)
CREATE TABLE review_states (
  event_id UUID PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL,
  slide_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  state VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_review_states_slide ON review_states (case_id, slide_id, user_id);
```

## 6. Interface Contracts

### 6.1 Annotation CRUD API

```typescript
// Create annotation
POST /api/annotations
{
  event_id: string;     // Client-generated UUID
  case_id: string;
  slide_id: string;
  scan_id: string;
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
  properties?: AnnotationProperties;
  visibility?: VisibilityLevel;  // Defaults to 'private'
}

// Update annotation
PATCH /api/annotations/{annotation_id}
{
  event_id: string;
  geometry?: GeoJSON.Geometry;
  properties?: AnnotationProperties;
}

// Delete annotation (soft delete)
DELETE /api/annotations/{annotation_id}
{
  event_id: string;
}

// Change visibility
PATCH /api/annotations/{annotation_id}/visibility
{
  event_id: string;
  visibility: VisibilityLevel;
}

// Query annotations for viewport
GET /api/annotations?slide_id={slide_id}&scan_id={scan_id}&bbox={x1,y1,x2,y2}
```

### 6.2 Review State API

```typescript
// Set review state
POST /api/review-states
{
  event_id: string;
  case_id: string;
  slide_id: string;
  state: PersistedReviewState;
}

// Get review states for case
GET /api/review-states?case_id={case_id}&user_id={user_id}
```

## 7. Behavioral Specifications

### 7.1 Annotation Creation Flow

```
User draws annotation
         │
         ▼
┌────────────────────────┐
│ Generate client-side   │
│ event_id (UUID)        │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Display annotation     │
│ immediately (optimistic│
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ POST to Annotation API │
│ with event_id          │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Server deduplicates    │
│ via event_id           │
└───────────┬────────────┘
            │
      ┌─────┴─────┐
      ▼           ▼
  Success      Failure
      │           │
      │           ▼
      │   Show error; retain
      │   local annotation for
      │   retry
      │
      ▼
  Confirm persistence
```

### 7.2 Visibility Filter Logic

```typescript
function canViewAnnotation(
  annotation: Annotation,
  user: User,
  context: CaseContext
): boolean {
  if (annotation.author_id === user.id) return true;  // Author always sees own
  if (annotation.is_deleted) return false;

  switch (annotation.visibility) {
    case 'private':
      return false;  // Only author
    case 'case_team':
      return context.teamMembers.includes(user.id);
    case 'department':
      return context.department === user.department;
    case 'conference':
      return context.conferenceMembers.includes(user.id);
    case 'external':
      return context.externalConsultants.includes(user.id);
    case 'published':
      return true;  // Anyone with case access
    default:
      return false;
  }
}
```

### 7.3 Soft Delete Behavior

- User requests delete → Set `is_deleted = true`
- Annotation hidden from UI and API queries
- Annotation remains in event log
- Hard delete only via compliance process with audit trail

## 8. Security Controls

| Control | Implementation |
|:--------|:---------------|
| Owner-only delete | API enforces author_id match for delete |
| Visibility enforcement | API filters by visibility on all queries |
| Event idempotency | Server deduplicates by event_id |
| No client-side visibility bypass | All visibility filtering on server |

## 9. Traceability Table

| Design Element | System Requirement | Risk Control |
|:---------------|:-------------------|:-------------|
| Annotation editor | SYS-ANN-001 | — |
| Event-sourced storage | SYS-ANN-002 | — |
| Scan binding | SYS-ANN-003 | — |
| Visibility levels | SYS-ANN-004, SYS-ANN-005 | — |
| No involuntary display | SYS-ANN-006 | — |
| Owner-only delete | SYS-ANN-007 | — |
| Soft delete | SYS-ANN-008 | — |
| Level 0 coordinates | SYS-ANN-009 | — |
| Viewport rendering | SYS-ANN-010 | — |
| Review state declarations | SYS-RVW-001, SYS-RVW-002 | — |
| No auto-review | SYS-RVW-003 | RC-004 |
| Session-only In_Progress | SYS-RVW-004, SYS-RVW-005 | RC-004 |

## 10. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial annotation architecture |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
