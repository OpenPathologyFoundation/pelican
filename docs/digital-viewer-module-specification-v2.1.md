# Digital Viewer Module — Narrative Specification

**Pathology Portal Platform**
**Document Version:** 2.1
**Date:** January 2026
**Status:** Development Ready — Phase 0 Gates Defined

---

## Executive Summary

The Digital Viewer Module represents a fundamental rethinking of how pathologists interact with whole slide images in a digital workflow. Rather than replicating the traditional toolbar-heavy interface paradigm, this module embraces four core innovations:

1. **Conversational Interaction** — Voice and natural language as the primary interface for image analysis, replacing static tool palettes with intent-driven commands.

2. **Dual-Context Architecture** — Explicit separation of case management (Case Context) and image examination (Viewer Context) across two display surfaces, optimized for the dual-monitor workstation environment.

3. **Focus Declaration Protocol (FDP)** — A novel safety mechanism ensuring pathologists always know which case they are examining, designed as an open standard suitable for industry-wide adoption.

4. **Clinical-First Data Governance** — Explicit separation of ephemeral wayfinding telemetry from clinical declarations, ensuring that navigation patterns never become discoverable artifacts while preserving meaningful audit trails.

This specification documents the design decisions, technical architecture, and implementation approach derived from facilitated design sessions with practicing pathologists, UX specialists, technical architects, and industry review feedback.

---

## Table of Contents

0. [Pre-Build Clarifications](#0-pre-build-clarifications)
1. [Design Philosophy](#1-design-philosophy)
2. [Stakeholder Requirements Summary](#2-stakeholder-requirements-summary)
3. [Architectural Overview](#3-architectural-overview)
4. [Dual-Context Window Architecture](#4-dual-context-window-architecture)
5. [Focus Declaration Protocol Specification](#5-focus-declaration-protocol-specification)
6. [Viewer Interface Design](#6-viewer-interface-design)
7. [Conversational Interaction Model](#7-conversational-interaction-model)
8. [Annotation Ontology and Governance](#8-annotation-ontology-and-governance)
9. [Slide Review State Management](#9-slide-review-state-management)
10. [Telemetry and Audit Data Governance](#10-telemetry-and-audit-data-governance)
11. [Session Management and Security](#11-session-management-and-security)
12. [Image Management Service Conformance Profile](#12-image-management-service-conformance-profile)
13. [Image Provenance and Versioning](#13-image-provenance-and-versioning)
14. [Integration Architecture](#14-integration-architecture)
15. [Technical Components](#15-technical-components)
16. [Phased Implementation Plan](#16-phased-implementation-plan)
17. [Risk Analysis and Mitigations](#17-risk-analysis-and-mitigations)
18. [Appendices](#18-appendices)

---

## 0. Pre-Build Clarifications

This section documents architectural decisions and interface contracts required before implementation begins. These clarifications were developed through engineering review to ensure the specification is buildable.

### 0.1 Identity and Identifiers

**Q1. What is the user-visible case identifier?**

A lab-qualified accession number: `{lab_code}:{accession_number}`. Internal LIS numeric IDs MUST NOT be shown in the UI or exposed via public identifiers.

Example: `UPMC:S26-12345` (not `case_id: 847293`)

**Q2. What is the barcode/slide identifier format?**

A scannable barcode string encoding year + accession + optional part/block/slide (e.g., `S26-12345-A1-1`). The viewer treats this string as an opaque slide key; parsing is optional and only for display convenience.

**Q3. What is the system of record for case identity and slide membership?**

The **LIS is the system of record**. The Portal maintains transient assembled state and provides the authoritative resolution API to the viewer. The IMS stores images and tiles but does not define case identity.

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│     LIS     │ ───▶ │   Portal    │ ───▶ │   Viewer    │
│  (System of │      │ (Resolution │      │ (Consumer)  │
│   Record)   │      │    API)     │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │     IMS     │
                     │  (Tiles,    │
                     │   Images)   │
                     └─────────────┘
```

### 0.2 Authentication and Authorization

**Q4. Does the viewer handle authentication?**

**No.** Authentication is external (institutional SSO/Keycloak) and assumed functional. The viewer receives an authenticated user context; it does not manage login flows.

**Q5. How does the viewer enforce authorization?**

The viewer uses a **Portal-issued JWT** (case-scoped access token) and/or Portal authorization API to determine allowed actions:

| Capability | Description |
|------------|-------------|
| `view` | Can view slides in case |
| `annotate` | Can create/edit own annotations |
| `share` | Can share annotations with others |
| `export` | Can export annotations/snapshots |
| `dx_mode_override` | Can disable Diagnostic Mode |
| `admin` | Administrative actions |

The viewer does not contain its own RBAC source of truth.

**Q6. Can the viewer run without the Portal?**

**Not for clinical operation.** The viewer may be deployable as a separate service (for development/testing), but it is operationally dependent on the Portal for case context and authorization.

### 0.3 Core Service Contracts

**Q7. What are the minimum required APIs/events to start implementation?**

The following versioned contracts are required before Phase 1 development begins:

**Portal → Viewer APIs:**

```
ResolveCase(lab_code, accession) → case_context
IssueViewerToken(case_context, user) → JWT
ListSlides(case_context) → slide_refs[]
GetPermissions(user, case_context) → capability_set
GetSlideProvenance(slide_id) → provenance_record
```

**Viewer → Portal Events (Tier 2):**

```
review_state_change(case_id, slide_id, user, new_state, timestamp, event_id)
annotation_persisted(case_id, slide_id, annotation_id, action, timestamp, event_id)
share_requested(case_id, annotation_ids[], target_visibility, timestamp, event_id)
dx_mode_opt_out(case_id, user, reason, timestamp, event_id)
measurement_recorded(case_id, slide_id, measurement_id, value, calibration_state, event_id)
```

**Q8. What is the idempotency/consistency rule for events?**

All persisted actions (Tier 2/Tier 3) MUST be idempotent using a **client-generated `event_id`** and server-side deduplication. Duplicate events with the same `event_id` are acknowledged but not re-processed.

### 0.4 Error Handling and Degraded Modes

**Q9. What are the minimum error states and UI behavior?**

The viewer MUST detect and surface the following error conditions:

| Condition | Detection | UI Behavior |
|-----------|-----------|-------------|
| Tiles unavailable / excessive failures | >50% tile requests failing | Stop rendering viewport; show "Image temporarily unavailable" banner; retry button |
| Backend unreachable | Health check fails; API timeout | Stop requests; show "Service unavailable" overlay; auto-retry with backoff |
| Slide not found | 404 from IMS | Show "Slide unavailable" message; return to slide list |
| Permission revoked / unauthorized | 401/403 from Portal | Block interaction; prompt "Session expired or access revoked. Return to Portal." |
| Network outage | No connectivity | Show network error banner; retry controls; preserve unsaved work locally |
| Case mismatch detected | FDP Layer 2 warning | Modal overlay (see Section 5.3.3) |

**Q10. What is "superseded scan," and how should the viewer behave?**

A scan is superseded when the IMS marks a newer scan as authoritative for the same slide key.

| Scenario | Viewer Behavior |
|----------|-----------------|
| User opens slide with superseded scan | Warning: "A newer scan is available. [View newest] [Continue with this scan]" |
| User has annotations on superseded scan | Warning: "This scan has been superseded. Your annotations remain on this version." |
| Deep link to superseded scan | Honor the link; display supersession notice; offer navigation to current |

Annotations are NOT automatically migrated. They remain bound to their original `scan_id`.

### 0.5 Telemetry and Logging Rules

**Q11. Are tile coordinates/paths (z/x/y) allowed in retained logs?**

**No, by default.** Retained logs (Tier 3) MUST NOT contain:
- Tile coordinates (z, x, y)
- Viewport center/bounds
- Navigation traces
- Zoom level history
- Any data that could reconstruct viewing patterns

**Q12. How do we troubleshoot tile failures without retaining navigation traces?**

Use **aggregated operational metrics only**:

| Allowed | Not Allowed |
|---------|-------------|
| Error rate (% failed requests) | Which tiles failed |
| Latency percentiles (p50, p95, p99) | Latency per tile coordinate |
| Cache hit rate | Which tiles were cached |
| Bytes/sec throughput | Bytes per viewport |
| Service health status | User-specific tile access patterns |

For rare deep debugging, a **time-bounded debug capture** may be enabled:
- Explicitly enabled by administrator
- Maximum TTL (e.g., 24 hours)
- Restricted access (ops team only)
- Documented in incident record
- Auto-purged after TTL

**Q13. Who owns retention/audit infrastructure?**

The viewer does not ship its own SIEM/audit UI. The system emits a defined set of audit events and integrates with institutional logging infrastructure (e.g., Elastic, Splunk). Retention duration and access policies are institutional—but the application-level schema MUST follow the tier model.

**Q14. What is the minimum "allowed fields" audit schema (Tier 3)?**

```json
{
  "timestamp": "ISO 8601",
  "event_id": "UUID (client-generated)",
  "user_id": "string",
  "lab_code": "string",
  "accession": "string",
  "action": "session_start | session_end | case_access | sign_out",
  "outcome": "success | failure | timeout",
  "metadata": {
    "session_id": "UUID",
    "client_info": "browser/version (optional)"
  }
}
```

**Excluded from Tier 3 schema:** `slide_id`, `tile_coordinates`, `viewport_state`, `duration`, `annotation_count`, or any field that could be used to reconstruct viewing behavior.

Include `slide_id` only when required for a clinical artifact (e.g., in the `annotation_persisted` Tier 2 event), not for access telemetry.

### 0.6 Review State Semantics

**Q15. Should "In Progress" be persisted when a slide is opened?**

**Decision: Option B (strict governance).**

"Opened" / "In Progress" is a **session-only state (Tier 1)**. It is not persisted to any durable store.

**Rationale:** "Opened" is a navigation event, not a clinical declaration. Persisting it—even with disclaimers—makes it discoverable. A timestamp showing "Dr. X opened slide Y at 09:15" will be used as evidence in litigation regardless of any disclaimer that it "does not imply review completeness."

**Persisted review states (Tier 2):**
- `Reviewed` — User explicitly declares examination complete
- `Flagged` — User explicitly flags for attention
- `Needs_Attending` — Resident explicitly requests attending review

**Session-only states (Tier 1):**
- `Opened` / `In_Progress` — Slide has been opened in current session

The viewer MAY display "In Progress" in the UI during the session, but this state is purged on session close and never transmitted to the Portal or audit log.

### 0.7 Diagnostic Mode Scope

**Q16. Is Diagnostic Mode required in Phase 1?**

**Decision: Yes, required in Phase 1 with minimal definition.**

Diagnostic Mode is a constrained UI profile for clinical sign-out contexts. Phase 1 implementation includes:

| Constraint | Phase 1 Requirement |
|------------|---------------------|
| Persistent header | Cannot be collapsed; case ID always visible |
| Calibration display | MPP source and validation state shown on measurements |
| Default activation | ON by default for cases from clinical worklist |
| Opt-out logging | Disabling DX Mode requires attestation; logged as Tier 2 event |

**Deferred to Phase 2:**
- AI confidence indicator requirements
- Color management / ICC profile enforcement
- Browser zoom detection and warning
- Extended workstation context capture

**Q17. What does Diagnostic Mode mean operationally?**

Diagnostic Mode signals: "This viewing session is part of clinical sign-out." It enforces constraints that support accurate diagnosis and creates an audit trail when those constraints are relaxed.

### 0.8 Calibration and Measurements

**Q18. Where does microns-per-pixel (MPP) come from?**

From scanner metadata via the IMS. The viewer consumes MPP as authoritative and displays its source/validation state.

```
Scanner → IMS (extracts MPP) → Viewer (displays + validates)
```

**Q19. Are manual MPP overrides permitted?**

**Default: No for Phase 1.** All measurements use IMS-provided MPP.

If needed in future phases:
- Overrides MUST be role-restricted (e.g., lab director only)
- Overrides MUST be audited (Tier 2 event)
- Overridden measurements MUST display "Manual calibration" indicator

**Q20. What is the viewer responsibility for monitor/scanner calibration?**

The viewer **surfaces available calibration metadata** (if present) but **does not manage calibration workflows**. Calibration governance (when to recalibrate, who approves, etc.) is handled institutionally.

The viewer displays:
- MPP value and source
- Calibration date (if available)
- Validation state (site-calibrated / factory / unvalidated / unknown)

The viewer does NOT:
- Manage calibration slide workflows
- Store calibration certificates
- Enforce recalibration schedules

### 0.9 Annotations: Persistence, Editing, Deletion

**Q21. Where are annotations stored and what metadata is required?**

Persisted annotations (Tier 2) are stored in the **Portal-managed annotation database**.

Required metadata:
```json
{
  "annotation_id": "UUID",
  "case_id": "lab_code:accession",
  "slide_id": "barcode string",
  "scan_id": "UUID (immutable link to specific scan)",
  "author_id": "user_id",
  "created_at": "ISO 8601",
  "modified_at": "ISO 8601",
  "type": "point | line | rectangle | polygon | text | measurement",
  "visibility": "private | case_team | department | conference | external | published",
  "geometry": "GeoJSON",
  "properties": "JSON (label, color, notes, etc.)",
  "is_deleted": "boolean (soft delete flag)"
}
```

**Q22. Do we require tamper-evidence?**

**Minimum requirement:** Immutable audit log of create/edit/delete actions with who/when/what changed (event-sourced storage as specified in Section 8.4).

**Stronger cryptographic tamper-evidence** (hash chains, signed commits) is deferred unless explicitly required by regulatory or institutional policy.

**Q23. How does deletion work?**

- **Soft-delete by default** (tombstone). Annotation is hidden from UI but retained in storage.
- **Users may delete only their own annotations** (unless admin).
- **Hard-delete is reserved** for administrative/compliance processes with explicit audit trail.
- **Soft-deleted annotations** are excluded from exports and normal queries but remain in event history.

### 0.10 Tile Access Security and Caching

**Q24. How is tile access authorized?**

The tile service requires a **Portal-issued JWT** scoped to the case/slide set.

```
User authenticates → Portal issues case-scoped JWT → Viewer includes JWT in tile requests → IMS validates JWT
```

If the user can open the case in the Portal, the token permits tile access for slides in that case. Token expiration and refresh follow Portal session policy.

**Q25. What are default caching rules?**

| Cache Layer | Policy |
|-------------|--------|
| Browser cache | `Cache-Control: private, max-age=86400` (tiles are immutable per scan_id) |
| CDN (if used) | Allowed only with signed URLs scoped to user/session |
| Shared cache | **Prohibited** — risk of cross-user contamination |

Tiles are immutable for a given `(scan_id, z, x, y)`. Aggressive caching is safe as long as URLs/tokens are properly scoped.

### 0.11 Voice and AI Features

**Q26. Is voice required in Phase 1?**

**Optional.** Voice interaction is not a Phase 1 requirement.

If enabled:
- MUST use a HIPAA-compliant transcription service under BAA
- MUST pass institutional security review
- Transcripts are Tier 1 (ephemeral, session-only)

**Q27. What happens if voice/AI endpoints are unavailable?**

Features are automatically disabled after health-check failure. The viewer remains fully functional without them.

UI behavior:
- Voice button grayed out with tooltip: "Voice input unavailable"
- AI features show: "AI assistance not configured" or "Service temporarily unavailable"
- No error modals; non-blocking notices only

### 0.12 Phase 0 Readiness Gates

**Q28. What must exist before Phase 1 viewer build starts?**

| Dependency | Owner | Status Required |
|------------|-------|-----------------|
| Portal case/slide resolution API | Portal Team | Stable, documented |
| Portal-issued case-scoped JWT | Portal Team | Working end-to-end |
| Tile service endpoints | IMS Team | Secured, stable |
| Basic permission model | Portal Team | Exposed via API |
| Audit event sink | Platform Team | Endpoint defined (even if external SIEM not integrated) |
| Slide provenance API | IMS Team | Returns scan_id, MPP, supersession status |

**Phase 1 cannot begin until all Phase 0 gates are green.**

### 0.13 Decision Summary

| ID | Decision | Resolution | Rationale |
|----|----------|------------|-----------|
| Q15 | "In Progress" persistence | Option B: Session-only (Tier 1) | Navigation events are not clinical declarations; persistence creates discoverable artifacts |
| Q16 | Diagnostic Mode in Phase 1 | Required (minimal definition) | Establishes correct patterns early; core constraints are low-complexity |
| Q19 | Manual MPP override | No (Phase 1) | Simplifies calibration trust model; defer to future phase if needed |
| Q26 | Voice in Phase 1 | Optional | Not blocking; security review required if enabled |

---

## 1. Design Philosophy

### 1.1 Core Principles

The Digital Viewer Module is governed by twelve design principles established through collaborative design sessions and industry review:

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Image Primacy** | The slide image is the focus. Everything else is secondary or hidden. The viewer should feel like looking through a microscope. |
| 2 | **Contextual Tools** | Show tools when needed, hide when not. Behavioral learning and explicit preferences determine visibility. |
| 3 | **Conversational Interaction** | Voice and natural language serve as the primary interface for actions and queries on the image. |
| 4 | **Ephemeral vs. Persistent** | Clear distinction between transient visual feedback and saved annotations. Users explicitly promote content from ephemeral to persistent. |
| 5 | **Multi-Monitor Awareness** | Designed for dual-display environments with flexible layout options. Single-monitor use is supported but not optimized. |
| 6 | **Review State as Declaration** | Review states are user-declared attestations, never inferred from viewing behavior. Navigation telemetry does not indicate completeness or diligence. |
| 7 | **Measurement as Validated Data** | Structured capture of measurements with explicit calibration context. Unknown-scale measurements are flagged and restricted. |
| 8 | **Physical Slide Bridge** | Ability to request glass slides from within the digital viewer when digital examination is insufficient. |
| 9 | **Progressive Disclosure** | Minimal default interface, expandable to full capability for users who need it. |
| 10 | **Speed and Responsiveness** | Interaction latency is a critical UX factor. The viewer must feel instantaneous. |
| 11 | **User Sovereignty** | The system learns from the user but never overrides explicit preferences. Users remain in control. |
| 12 | **Clinical-First Governance** | Navigation telemetry is ephemeral and protected; only explicit clinical declarations become part of the record. |

### 1.2 The Toolbar Paradox

Traditional digital pathology viewers suffer from a fundamental tension: they provide extensive toolsets that most pathologists rarely use, yet these tools consume screen space and cognitive attention constantly. Simultaneously, the minority of users who need advanced features (particularly trainees and researchers) find these tools essential.

The resolution is not to eliminate tools but to transform how they are accessed:

- **Default state**: No visible tools. Pure image.
- **Access method**: Voice commands, gestures, or a single universal entry point.
- **Tool visibility**: Determined by individual user behavior and explicit configuration.
- **Principle**: "If you don't use it, don't show it to you."

### 1.3 The Safety Imperative

Digital pathology introduces a category of error that does not exist with physical microscopy: case-image mismatch. When a pathologist examines a glass slide, the slide itself contains identifying information. In digital workflows, the image on screen has no inherent physical connection to the case being documented.

This specification treats case-image synchronization as a patient safety issue of the highest priority. The Focus Declaration Protocol is designed to make mismatch errors detectable and preventable, not through restrictive system controls but through persistent contextual awareness.

### 1.4 The Telemetry Governance Imperative

A critical design principle distinguishes this system from traditional digital pathology viewers: **navigation behavior is not evidence of clinical diligence.**

The time a pathologist spends viewing a slide, the regions they examine, and the zoom levels they use are **wayfinding behaviors**, not measures of competence or completeness. A senior pathologist who examines a slide in 30 seconds may be exercising pattern-refined expertise; a resident who spends 10 minutes may be learning appropriate thoroughness. Neither duration indicates correctness.

Therefore, this specification establishes an explicit **telemetry governance wall**:

- **Ephemeral data** (navigation traces, tile requests, viewport history) is never retained beyond the session and is protected as quality assurance work product.
- **Declaration data** (user-initiated state changes, explicit attestations) forms the clinical record.
- **Audit data** (session boundaries, access events) provides minimal compliance logging without behavioral inference.

This separation ensures that navigation patterns cannot become discoverable artifacts in malpractice litigation, cannot be used to construct "diligence metrics," and cannot create perverse incentives for performative viewing behavior.

---

## 2. Stakeholder Requirements Summary

### 2.1 Senior Attending Pathologists

**Representative:** Dr. Richard Okonkwo (GU Pathology, Director of Surgical Pathology)

**Primary needs:**
- Minimal interface distraction during examination
- Speed equivalent to or better than glass microscopy
- No involuntary annotations or artifacts on images
- Absolute clarity about which case is being examined
- Ability to request physical slides when digital is insufficient
- Assurance that viewing patterns are not being tracked as "performance metrics"

**Key quote:** "Whatever you build—make sure I can still feel the glass. That connection to the material. Don't let the technology get in the way of the pathology."

### 2.2 Subspecialty Attending Pathologists

**Representatives:** Dr. Margaret Chen (GI Pathology), Dr. Kwame Asante (Dermatopathology)

**Primary needs:**
- Measurement tools readily accessible (tumor depth, margin distance)
- Clear indication of measurement calibration status
- Side-by-side comparison of current and prior specimens
- Image capture for reports and presentations
- Polarized light and special stain correlation (future)

**Key quote:** "I use the measurement tool constantly. But I'm not using the polygon annotation tool."

### 2.3 Resident/Fellow Pathologists

**Representative:** Dr. Priya Sharma (Junior Surgical Pathology Attending, recent residency graduate)

**Primary needs:**
- Annotation tools for marking teaching points
- Ability to flag regions for attending review
- Explainable AI assistance for learning morphologic features
- Persistent annotations that survive session closure
- Private annotation space for learning without scrutiny

**Key quote:** "When I was learning, I needed to *find* the features. Discoverability matters for new users."

### 2.4 Technical/Informatics Specialists

**Representative:** Dr. Samuel Adeyemi (Pathology Informatics, external consultant)

**Primary needs:**
- Standards-based integration with existing systems
- Open protocols that third-party viewers can implement
- Audit logging that meets compliance without overreach
- Clear data governance boundaries
- Regulatory pathway clarity (FDA, CAP, HIPAA)

**Key quote:** "For this to become an industry pattern, it needs to be simple to implement, non-proprietary, and clearly beneficial."

---

## 3. Architectural Overview

### 3.1 System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PATHOLOGY PORTAL PLATFORM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Work List     │    │     Case        │    │    Report       │        │
│  │    Module       │───▶│    Context      │───▶│   Authoring     │        │
│  │                 │    │    Module       │    │    Module       │        │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘        │
│                                  │                                         │
│                                  │ Opens / Controls                        │
│                                  ▼                                         │
│                         ┌─────────────────┐                               │
│                         │    Digital      │                               │
│                         │    Viewer       │◀──── This Specification       │
│                         │    Module       │                               │
│                         └────────┬────────┘                               │
│                                  │                                         │
│                                  │ WebSocket                               │
│                                  ▼                                         │
│                         ┌─────────────────┐                               │
│                         │    Session      │                               │
│                         │   Awareness     │                               │
│                         │    Service      │                               │
│                         └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HL7 / API
                                    ▼
                    ┌───────────────────────────────┐
                    │   Laboratory Information      │
                    │   System (LIS)                │
                    │   - Case data                 │
                    │   - Slide metadata            │
                    │   - Image storage references  │
                    └───────────────────────────────┘
```

### 3.2 Module Boundaries

The Digital Viewer Module is responsible for:
- Whole slide image display and navigation
- Slide gallery management within a case
- Annotation creation, display, and persistence
- Voice/conversational interaction for image analysis
- Focus declaration and synchronization signaling
- Review state tracking per slide (declaration-based)
- Diagnostic Mode enforcement
- Telemetry governance (ephemeral vs. persistent data separation)

The Digital Viewer Module is NOT responsible for:
- Case selection (handled by Work List Module)
- Case metadata display (handled by Case Context Module)
- Report creation (handled by Report Authoring Module)
- Image storage or retrieval (handled by Image Management Service)
- User authentication (handled by Platform Authentication)
- Long-term audit log storage (handled by Compliance Service)

### 3.3 Deployment Model

**Target Environment:**
- Standards-compliant modern browser (Chrome, Edge, Firefox, Safari)
- Recommended: Dual-monitor workstation (minimum 1920×1080 per display)
- Supported: Single-monitor operation with reduced functionality
- Network: Institutional LAN with low-latency access to image servers

**Client-Side Technologies:**
- HTML5 Canvas / WebGL for image rendering
- Web Audio API for voice interaction
- WebSocket for real-time session communication
- Service Worker for offline-capable slide caching (Phase 2)

**Server-Side Technologies:**
- Session Awareness Service (Node.js / WebSocket hub)
- Image tile server (conformant to Level 1+ Tile Interface — see Section 12)
- Annotation persistence service (PostgreSQL with spatial indexing)
- Voice transcription (Azure AI Studio / Whisper)

---

## 4. Dual-Context Window Architecture

### 4.1 Conceptual Model

The pathologist's workstation presents two distinct contexts:

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│         MONITOR 1               │  │         MONITOR 2               │
│         (Case Context)          │  │         (Viewer Context)        │
├─────────────────────────────────┤  ├─────────────────────────────────┤
│                                 │  │                                 │
│  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │
│  │ Case: 24-GI-01234         │  │  │  │ CASE 24-GI-01234 | SMITH  │  │
│  │ Patient: Smith, John      │  │  │  └───────────────────────────┘  │
│  │ DOB: 01/15/1960           │  │  │                                 │
│  ├───────────────────────────┤  │  │  ┌───────────────────────────┐  │
│  │ Clinical History:         │  │  │  │                           │  │
│  │ 68 yo male with...        │  │  │  │                           │  │
│  ├───────────────────────────┤  │  │  │                           │  │
│  │ Specimens:                │  │  │  │    WHOLE SLIDE IMAGE      │  │
│  │ A: Colon, right           │  │  │  │                           │  │
│  │ B: Colon, left            │  │  │  │                           │  │
│  ├───────────────────────────┤  │  │  │                           │  │
│  │ [View Slides]             │  │  │  │                           │  │
│  ├───────────────────────────┤  │  │  └───────────────────────────┘  │
│  │ Report Draft:             │  │  │                                 │
│  │ ...                       │  │  │  ┌─┬─┬─┬─┬─┬─┬─┐ Slide Gallery │
│  │                           │  │  │  │1│2│3│4│5│6│7│ (collapsible) │
│  └───────────────────────────┘  │  │  └─┴─┴─┴─┴─┴─┴─┘               │
│                                 │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

**Case Context (Left Monitor):**
- Primary orchestration interface
- Case selection, clinical information, specimen details
- Report authoring workspace
- Controls the Viewer Context lifecycle

**Viewer Context (Right Monitor):**
- Pure image examination interface
- Minimal chrome, maximum image area
- Independent window for full-screen capability
- Self-declaring identity via Focus Declaration Protocol

### 4.2 Window Relationship Models

Three technical approaches were evaluated for maintaining synchronization between the Case Context and Viewer Context:

#### Option A: Single Window Split View
- Both contexts within one browser window, using CSS layout
- **Advantages:** Simplest synchronization; single page state
- **Disadvantages:** Cannot achieve true full-screen on viewer; spanning windows across monitors is ergonomically poor
- **Decision:** Rejected for primary use case; may be offered as fallback for single-monitor users

#### Option B: Parent-Child Windows (window.open)
- Case Context opens Viewer Context via JavaScript `window.open()`
- Parent retains reference to child; can communicate via `postMessage()`
- **Advantages:** Direct control; parent can close/update child; synchronization is deterministic
- **Disadvantages:** Only works within same browser instance; third-party viewers cannot participate
- **Decision:** Adopted as primary mechanism for internal viewer

#### Option C: Backend-Mediated Synchronization
- Both contexts communicate through Session Awareness Service
- Backend maintains authoritative state; broadcasts changes via WebSocket
- **Advantages:** Works across browsers, devices, and third-party viewers
- **Disadvantages:** Latency; cannot directly control windows; advisory rather than deterministic
- **Decision:** Adopted as secondary mechanism for cross-context awareness

#### Hybrid Architecture (Selected Approach)

The selected architecture combines Options B and C:

```
┌──────────────────┐         window.open()          ┌──────────────────┐
│   Case Context   │ ─────────────────────────────▶ │  Viewer Context  │
│   (Parent)       │ ◀───────── postMessage() ───── │  (Child)         │
└────────┬─────────┘                                └────────┬─────────┘
         │                                                   │
         │ WebSocket                                         │ WebSocket
         │                                                   │
         └───────────────────┬───────────────────────────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │  Session Awareness    │
                 │  Service              │
                 │  - User session state │
                 │  - Open case registry │
                 │  - Warning broadcast  │
                 └───────────────────────┘
```

**Synchronization Protocol:**

| Event | Primary Mechanism | Fallback Mechanism |
|-------|-------------------|-------------------|
| Open viewer | `window.open()` with case ID parameter | Service registration |
| Switch case | `postMessage()` to child with prompt | WebSocket broadcast |
| Close viewer | Parent calls `window.close()` on child | Service heartbeat timeout |
| Detect mismatch | N/A (prevented by parent control) | Service state comparison |
| Multi-browser scenario | N/A (no parent reference) | Service warning broadcast |

### 4.3 Case Switching Behavior

When the user attempts to switch cases while the Viewer Context is open:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Case Switch Decision Flow                        │
└─────────────────────────────────────────────────────────────────────┘

User clicks different case in Case Context
                │
                ▼
    ┌───────────────────────┐
    │ Is Viewer open?       │
    └───────────┬───────────┘
                │
       ┌────────┴────────┐
       │ No              │ Yes
       ▼                 ▼
  Switch normally   ┌───────────────────────────┐
                    │ Display prompt:           │
                    │ "You have slides open     │
                    │  from Case [ID].          │
                    │                           │
                    │  [Switch to new slides]   │
                    │  [Keep current, work new] │
                    │  [Cancel]"                │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
    Switch slides           Keep + Warn              Cancel
    - Close old viewer      - Leave viewer open      - No action
    - Open new viewer       - Register warning       - Stay on current
    - Update case context   - Update case context      case
                            - Display multi-case
                              indicator
```

**Rationale:** The prompt-before-switch pattern prevents inadvertent context loss. Users explicitly choose their workflow rather than having the system make assumptions.

### 4.4 Multi-Browser and Multi-Device Scenarios

When the system detects the same user has multiple cases open across different browsers or devices:

**Detection mechanism:** The Session Awareness Service maintains a registry of all open cases per user. When a new case is opened, the service checks for existing entries.

**Response:** All connected contexts receive a warning broadcast:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ MULTIPLE CASES OPEN                                              │
│                                                                     │
│  Your account has the following cases currently open:               │
│  • Case 24-GI-01234 (Smith, John) — Browser 1, Viewer               │
│  • Case 24-GU-05678 (Jones, Mary) — Browser 2, Case Context         │
│                                                                     │
│  Please verify you are working on the correct case.                 │
│                                                                     │
│  [Acknowledge]                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Persistence:** After acknowledgment, a persistent indicator remains visible in all contexts showing the multi-case state. This indicator cannot be permanently dismissed while the state persists.

---

## 5. Focus Declaration Protocol Specification

### 5.1 Overview and Rationale

The Focus Declaration Protocol (FDP) addresses a fundamental challenge in digital pathology: ensuring that pathologists always know which case they are examining, regardless of how many windows, applications, or viewers they have open.

Unlike synchronization-based approaches that attempt to control or coordinate multiple windows, FDP takes a declaration-based approach: each window independently announces its identity when it receives user attention. This design is:

- **Decoupled:** No coordination required between applications
- **Universally implementable:** Any viewer can adopt FDP regardless of its architecture
- **Fail-safe:** Each context is self-sufficient; no single point of failure
- **Standardizable:** Simple enough to become an industry convention

### 5.2 Protocol Specification

#### 5.2.1 Conformance Levels

**Layer 1 — Local Focus Declaration (REQUIRED for conformance)**

Any application displaying patient case data MUST implement local focus declaration. This layer has no external dependencies.

**Layer 2 — Session Awareness Integration (OPTIONAL enhancement)**

Applications MAY additionally integrate with a Session Awareness Service for cross-context coordination. This layer requires network connectivity and service availability.

#### 5.2.2 Layer 1 Requirements

**5.2.2.1 Focus Event Detection**

The application MUST detect when it receives user focus. In browser-based applications, this corresponds to the `focus` event on the window object.

```javascript
window.addEventListener('focus', handleFocusDeclaration);
```

**5.2.2.2 Announcement Display**

Upon receiving focus, the application MUST display a focus announcement containing case identification information.

**Required information elements:**
- Case identifier (e.g., accession number)
- Patient identifier (e.g., name or MRN, configurable for privacy)

**Optional information elements:**
- Patient date of birth
- Specimen/part designation
- Institution identifier

**Display requirements:**

| Attribute | Requirement |
|-----------|-------------|
| Position | Top of viewport, spanning full width |
| Minimum height | 48 pixels |
| Minimum duration | 1.5 seconds |
| Contrast ratio | ≥ 4.5:1 (WCAG AA compliance) |
| Animation | SHOULD animate in (e.g., slide down); MUST NOT be jarring |

**5.2.2.3 Persistent Indicator**

After the announcement display period, the application MUST maintain a persistent visible indicator showing case identification.

**Persistent indicator requirements:**

| Attribute | Requirement |
|-----------|-------------|
| Position | Top of viewport |
| Minimum height | 24 pixels |
| Visibility | MUST be visible at all times during case viewing |
| Collapsibility | MAY be collapsible by user action in non-Diagnostic Mode; MUST NOT be collapsible in Diagnostic Mode; MUST auto-reveal on warnings |

**5.2.2.4 Audio Announcement (OPTIONAL)**

Applications MAY provide audio announcement of case information on focus.

**Audio modes (if implemented):**

| Mode | Behavior |
|------|----------|
| Off | No audio |
| Chime | Distinctive non-verbal tone indicating context switch |
| Brief | Text-to-speech of case identifier only |
| Full | Text-to-speech of case identifier and patient identifier |

Audio MUST be user-configurable and SHOULD default to Off.

**5.2.2.5 Time-Decay Extended Announcement (RECOMMENDED)**

Applications SHOULD extend the announcement duration based on time elapsed since last focus:

```
announcement_duration = base_duration + (minutes_since_last_focus / 5) * 0.5
maximum_duration = 5 seconds
```

Example: Base duration 2 seconds. User returns after 15 minutes. Announcement displays for 2 + (15/5 × 0.5) = 3.5 seconds.

**5.2.2.6 Privacy Mode**

Applications MUST support a privacy mode that displays abbreviated patient identification:
- Full name → Initials (e.g., "SMITH, JOHN" → "S.J.")
- Full DOB → Year only (e.g., "01/15/1960" → "1960")

Privacy mode MUST be user-configurable.

#### 5.2.3 Layer 2 Requirements

**5.2.3.1 Service Registration**

Upon opening a case, the application SHOULD register with the Session Awareness Service:

```json
POST /api/session/register
{
  "user_id": "user-12345",
  "case_id": "24-GI-01234",
  "patient_identifier": "SMITH, JOHN",
  "viewer_type": "internal-wsi",
  "window_id": "uuid-generated-per-window",
  "opened_at": "2026-01-18T09:02:00Z"
}
```

**5.2.3.2 Heartbeat Protocol**

While a case is open, the application SHOULD send periodic heartbeats:

```json
POST /api/session/heartbeat
{
  "window_id": "uuid-generated-per-window",
  "focused_at": "2026-01-18T09:07:00Z"
}
```

**Heartbeat interval:** 30 seconds
**Timeout threshold:** 90 seconds (3 missed heartbeats)

**5.2.3.3 Deregistration**

Upon closing a case view, the application SHOULD deregister:

```json
POST /api/session/deregister
{
  "window_id": "uuid-generated-per-window"
}
```

The `beforeunload` event SHOULD trigger deregistration. The service MUST also handle ungraceful disconnection via heartbeat timeout.

**5.2.3.4 Warning Subscription**

Applications SHOULD subscribe to warning broadcasts via WebSocket:

```javascript
const ws = new WebSocket('wss://session-service/subscribe');
ws.onmessage = (event) => {
  const warning = JSON.parse(event.data);
  if (warning.type === 'multi-case') {
    displayMultiCaseWarning(warning.cases);
  }
};
```

**5.2.3.5 Focus Announcement Enhancement**

When integrated with Session Awareness Service, the focus announcement SHOULD include multi-case awareness:

```
┌─────────────────────────────────────────────────────────────────────┐
│  CASE 24-GI-01234  │  SMITH, JOHN  │  DOB: 01/15/1960              │
│  ⚠ You have 2 cases open on this workstation                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Visual Design Specification

#### 5.3.1 Focus Announcement Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░  CASE 24-GI-01234  │  SMITH, JOHN  │  DOB: 01/15/1960          ░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                                                                     │
│                         [SLIDE IMAGE]                               │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

State: Focus announcement (2-5 seconds after focus event)
- Banner height: 64-80 pixels
- Background: Institution primary color or neutral dark (#1a365d)
- Text: White, high contrast
- Animation: Slide down from top, 200ms ease-out
```

#### 5.3.2 Persistent Indicator Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ 24-GI-01234 │ SMITH, JOHN │ [DX]                       [─] [🔊] [⚙]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
│                         [SLIDE IMAGE]                               │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

State: Normal viewing (after announcement completes)
- Header height: 28 pixels
- Background: Semi-transparent dark (#1a365d, 90% opacity)
- [DX] indicator: Diagnostic Mode active (green) / inactive (gray)
- Icons: Collapse [─] (disabled in Diagnostic Mode), Audio toggle [🔊], Settings [⚙]
- Sync status: Green dot (not shown) = in sync; appears only on warning
```

#### 5.3.3 Warning States

**Multi-case warning (persistent indicator):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 24-GI-01234 │ SMITH, JOHN │ [DX]             ⚠ 2 cases open  [─][⚙]│
├─────────────────────────────────────────────────────────────────────┤
```

**Case mismatch warning (modal overlay):**

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  ⚠ CASE MISMATCH DETECTED                                 │     │
│   │                                                           │     │
│   │  This viewer is showing:                                  │     │
│   │  Case 24-GI-01234 (SMITH, JOHN)                          │     │
│   │                                                           │     │
│   │  Your Case Context is now working on:                     │     │
│   │  Case 24-GU-05678 (JONES, MARY)                          │     │
│   │                                                           │     │
│   │  ┌─────────────────┐  ┌─────────────────┐                │     │
│   │  │ View New Case   │  │ Stay on Current │                │     │
│   │  └─────────────────┘  └─────────────────┘                │     │
│   └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│                    [SLIDE IMAGE - GRAYED OUT]                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

State: Case mismatch detected
- Modal overlay prevents interaction with slide
- Clear identification of both cases
- Explicit user action required to proceed
```

### 5.4 Reference Implementation

A JavaScript library implementing Layer 1 of FDP will be provided for third-party viewer integration:

```html
<!-- Minimal integration: single script tag -->
<script
  src="https://pathology-portal.example/fdp/fdp-1.0.min.js"
  data-case-id="24-GI-01234"
  data-patient-name="SMITH, JOHN"
  data-patient-dob="01/15/1960">
</script>
```

The library handles:
- Focus event detection
- Announcement display with configurable styling
- Persistent indicator rendering
- Audio announcement (if enabled)
- Local storage of user preferences

For Layer 2 integration, additional configuration specifies the Session Awareness Service endpoint:

```html
<script
  src="https://pathology-portal.example/fdp/fdp-1.0.min.js"
  data-case-id="24-GI-01234"
  data-patient-name="SMITH, JOHN"
  data-patient-dob="01/15/1960"
  data-session-service="wss://pathology-portal.example/session"
  data-user-id="user-12345">
</script>
```

---

## 6. Viewer Interface Design

### 6.1 Layout Regions

The Viewer Context is organized into distinct regions with clear hierarchy:

```
┌─────────────────────────────────────────────────────────────────────┐
│ PERSISTENT HEADER (Region A)                                        │
│ Case ID │ Patient │ Slide Info │ DX Mode │ Sync Status │ Controls   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
│                     PRIMARY IMAGE CANVAS (Region B)                 │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                        ┌───────────┤
│                                                        │ ASSISTANT │
│                                                        │  PANEL    │
│                                                        │ (Region D)│
│                                                        │           │
│                                                        │ Optional, │
│                                                        │ slides in │
├────────────────────────────────────────────────────────┴───────────┤
│ SLIDE GALLERY (Region C) - Collapsible                              │
│ [Part A: █ █ █ █] [Part B: █ █] [Part C: █ █ █]                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Region A: Persistent Header

**Default state:** Visible, 28px height
**In Diagnostic Mode:** Always visible, cannot be collapsed
**Outside Diagnostic Mode:** Collapsible by user preference; auto-reveals on warnings

**Contents:**
- Case identifier (left-aligned, primary prominence)
- Patient identifier (secondary prominence)
- Current slide designation (e.g., "Part A, Block 2, Level 1, H&E")
- Diagnostic Mode indicator [DX] (green when active, gray when inactive)
- Synchronization status icon (green/yellow/red)
- Collapse toggle (disabled in Diagnostic Mode), audio toggle, settings menu

#### Region B: Primary Image Canvas

**Purpose:** Whole slide image display and interaction
**Default state:** Fills all available space not occupied by other regions
**Interaction:** Pan, zoom, voice commands, gesture input

#### Region C: Slide Gallery

**Default state:** Visible as filmstrip (80px height); collapsible
**Collapsed state:** Hidden, small toggle affordance visible at edge
**Contents:**
- Thumbnail for each slide in case
- Grouped by part/specimen
- Visual indicators for review state (see Section 9)

**Opening behavior (configurable):**

| Case Complexity | Default Behavior |
|-----------------|------------------|
| Single part, ≤3 slides | Open directly to first slide; gallery collapsed |
| Multi-part OR >3 slides | Open to gallery view; user selects slide |
| Amended case | Open to most recently added slide |

#### Region D: Assistant Panel

**Default state:** Hidden
**Activation:** Voice command ("Open assistant"), click on edge affordance, keyboard shortcut
**Collapsed state:** Thin affordance line at right edge (4px)
**Expanded state:** Panel slides in from right (300-400px width)
**Contents:**
- Conversational interface for AI assistant
- Query history for current session (ephemeral; not retained — see Section 10)
- Action results and explanations

### 6.2 Diagnostic Mode

Diagnostic Mode is a viewer state that enforces clinical use constraints. It is the **mandatory default** for cases originating from the clinical worklist.

#### 6.2.1 Diagnostic Mode Activation

| Case Source | Default Mode | Can Disable? |
|-------------|--------------|--------------|
| Clinical worklist | Diagnostic Mode ON | Yes, with logged attestation |
| Teaching collection | Diagnostic Mode OFF | Yes, can enable |
| Research project | Diagnostic Mode OFF | Yes, can enable |
| External consultation | Diagnostic Mode ON | Yes, with logged attestation |

**Disabling Diagnostic Mode requires explicit action:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Disable Diagnostic Mode?                                           │
│                                                                     │
│  Diagnostic Mode enforces clinical viewing constraints:             │
│  • Persistent case identification                                   │
│  • Measurement calibration validation                               │
│  • AI confidence indicators                                         │
│                                                                     │
│  Disabling is appropriate for teaching review or research.          │
│  This action will be logged.                                        │
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │ Keep Diagnostic Mode│  │ Disable (Log Action)│                  │
│  └─────────────────────┘  └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 Diagnostic Mode Constraints

**When Diagnostic Mode is ACTIVE:**

| Feature | Constraint |
|---------|------------|
| Persistent header | CANNOT be collapsed; case ID always visible |
| AI annotations | MUST display confidence indicators; unmarked AI output prohibited |
| Measurements | MUST display calibration status; unknown-scale measurements blocked from report auto-population |
| Browser zoom | Detected and reported; warning displayed if ≠ 100% |
| Color management | ICC profile respected if available; logged if not |

**When Diagnostic Mode is INACTIVE:**

| Feature | Behavior |
|---------|----------|
| Persistent header | Can be collapsed |
| AI annotations | May be shown without confidence indicators |
| Measurements | Allowed without calibration validation |
| Browser zoom | Not monitored |
| Color management | Best-effort |

#### 6.2.3 Workstation Context Capture

At session start, the viewer captures workstation context (Tier 2 data — see Section 10):

```json
{
  "session_id": "uuid",
  "workstation_context": {
    "display_resolution": "1920x1080",
    "display_scaling": 1.0,
    "browser": "Chrome 120",
    "browser_zoom": 100,
    "color_profile": "sRGB IEC61966-2.1",
    "dual_monitor": true,
    "diagnostic_mode": true
  },
  "captured_at": "2026-01-18T09:00:00Z"
}
```

This context is attached to the session for troubleshooting and QA review. It is **not** retained in long-term audit logs (see Section 10 for retention policy).

### 6.3 Navigation and Interaction

#### 6.3.1 Image Navigation

| Input | Action |
|-------|--------|
| Mouse drag | Pan image |
| Mouse wheel | Zoom in/out (centered on cursor) |
| Double-click | Zoom in one level (centered on click) |
| Shift + double-click | Zoom out one level |
| Keyboard arrows | Pan in direction |
| Keyboard +/- | Zoom in/out (centered on viewport) |
| Keyboard Home | Return to overview (fit slide in viewport) |
| Touch: pinch | Zoom in/out |
| Touch: two-finger drag | Pan image |

**Navigation telemetry:** All navigation events (pan, zoom, tile requests) are Tier 1 ephemeral data. They are used for tile prefetching and performance optimization only. They are **never** transmitted to audit logs and are purged at session close.

#### 6.3.2 Voice Commands

Voice interaction is processed through the conversational interface. The system distinguishes between **actions** (imperative commands expecting immediate execution) and **consultations** (queries expecting explanatory responses).

**Action commands:**

| Command | Behavior |
|---------|----------|
| "Count mitoses" / "Count mitotic figures" | AI identifies mitoses, displays count, overlays markers (with confidence in DX Mode) |
| "Measure this" | Activates measurement tool; displays calibration status; spoken distance on completion |
| "Navigate to tumor" / "Show me the tumor" | AI locates tumor region, navigates viewport |
| "Navigate to margin" / "Show me the closest margin" | AI identifies nearest margin, navigates |
| "Clear" / "Clear annotations" | Removes ephemeral annotations from view |
| "Save these annotations" | Promotes current ephemeral annotations to persistent (requires visibility level selection) |
| "Next slide" / "Previous slide" | Gallery navigation |
| "Open assistant" / "Close assistant" | Toggle assistant panel |
| "Request glass" | Initiates physical slide request workflow |
| "Mark as reviewed" | Sets slide review state to Reviewed (explicit declaration) |

**Consultation commands:**

| Command | Behavior |
|---------|----------|
| "What am I looking at?" | AI describes visible morphologic features |
| "Is this high-grade?" | AI provides assessment with reasoning (with confidence in DX Mode) |
| "What features suggest [diagnosis]?" | AI highlights and explains relevant features |
| "Compare with prior" | Locates prior specimen, opens side-by-side view |

**Voice query telemetry:** AI query logs are Tier 1 ephemeral data. Query text, results, and interaction history are purged at session close. They are not part of the clinical record unless the user explicitly saves an annotation or measurement derived from the query.

### 6.4 Toolbar Philosophy

The default viewer presents no visible toolbar. Advanced tools are accessible through:

1. **Voice commands** (primary method)
2. **Single universal entry point** — A small icon (⋮ or similar) that expands to reveal available tools
3. **Keyboard shortcuts** — For power users who prefer keyboard

**Progressive disclosure levels:**

| Level | Tools Visible |
|-------|---------------|
| Default | None (voice-driven) |
| Quick access | Universal entry point icon only |
| Basic tools | Zoom controls, navigation map, screenshot |
| Measurement tools | Ruler, area, perimeter (with calibration status) |
| Annotation tools | Point, circle, rectangle, freehand, text |
| Full palette | All available tools including experimental |

User preference determines which level is default. Behavioral learning adjusts defaults over time (with explicit user consent).

---

## 7. Conversational Interaction Model

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VIEWER CONTEXT (Browser)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │
│  │ Audio Input   │───▶│ Speech-to-    │───▶│ Intent        │       │
│  │ (Microphone)  │    │ Text Engine   │    │ Classifier    │       │
│  └───────────────┘    └───────────────┘    └───────┬───────┘       │
│                                                    │               │
│                         ┌──────────────────────────┼───────┐       │
│                         │                          │       │       │
│                         ▼                          ▼       ▼       │
│                 ┌───────────────┐          ┌───────────────┐       │
│                 │ Action        │          │ Consultation  │       │
│                 │ Executor      │          │ Engine        │       │
│                 │ (local)       │          │ (AI service)  │       │
│                 └───────┬───────┘          └───────┬───────┘       │
│                         │                          │               │
│                         ▼                          ▼               │
│                 ┌───────────────────────────────────────────┐      │
│                 │           Visual Feedback Layer            │      │
│                 │  - Ephemeral annotations (Tier 1)          │      │
│                 │  - Result overlays                         │      │
│                 │  - Navigation                              │      │
│                 └───────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Intent Classification

The system classifies voice input into categories:

| Category | Characteristics | Processing |
|----------|-----------------|------------|
| Navigation | Contains direction/location words | Local execution, immediate |
| Measurement | Contains "measure", "distance", "depth" | Local tool activation with calibration check |
| Counting | Contains "count", "how many" | AI service + local annotation (with confidence) |
| Identification | Contains "what is", "show me", "find" | AI service + navigation |
| Assessment | Contains "is this", "does this", "grade" | AI service + explanation (with confidence) |
| Annotation | Contains "mark", "circle", "note" | Local tool activation |
| Declaration | Contains "reviewed", "flagged", "needs attending" | Review state update (Tier 2) |
| System | Contains "open", "close", "save", "clear" | Local execution |

### 7.3 Response Modes

**Terse mode** (for actions):
- Minimal verbal response
- Immediate visual feedback
- Example: "Count mitoses" → Screen overlay: "23 mitoses identified (19 high confidence, 4 uncertain)" + markers on image

**Explanatory mode** (for consultations):
- Detailed verbal/text response
- Visual highlighting of relevant features
- Example: "What features suggest high grade?" → Assistant panel opens with explanation; features highlighted on image

### 7.4 Confidence and Verification

AI-assisted analysis provides confidence indicators (required in Diagnostic Mode):

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mitosis Count Results                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Total identified: 23                                               │
│  Per 10 HPF: 4.6                                                    │
│                                                                     │
│  Confidence breakdown:                                              │
│  ● High confidence (green): 19                                      │
│  ● Moderate confidence (yellow): 3                                  │
│  ● Low confidence (orange): 1                                       │
│                                                                     │
│  [Show uncertain]  [Accept all]  [Review individually]              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The pathologist can review uncertain identifications, accepting or rejecting each, which provides training feedback to improve future accuracy.

---

## 8. Annotation Ontology and Governance

### 8.1 Annotation Categories

Annotations are classified into four categories with distinct persistence, visibility, and governance characteristics:

| Category | Persistence | Default Visibility | Governance | Use Case |
|----------|-------------|-------------------|------------|----------|
| **Transient Markers** | Session only; purged on close | Creator only | Tier 1 (ephemeral) | Mental bookmarks, cursor placement, AI overlays |
| **Session Annotations** | Until session close | Creator only | Tier 1 (ephemeral) | Working notes during examination |
| **Case Annotations** | Permanent (case record) | Configurable (default: Private) | Tier 2 (declaration) | Documentation, teaching points |
| **Structured Measurements** | Permanent (case record) | Case Team | Tier 2 (declaration) | Diagnostic data (tumor depth, margins) |

### 8.2 Annotation Types

| Type | Description | Categories Applicable |
|------|-------------|----------------------|
| Point | Single coordinate marker | All |
| Line | Two-point measurement | Session, Case, Structured |
| Rectangle | Bounding box region | Session, Case |
| Circle/Ellipse | Circular region | Session, Case |
| Freehand | User-drawn boundary | Session, Case |
| Polygon | Multi-point closed region | Session, Case |
| Text Note | Text attached to location | Session, Case |
| AI Marker | System-generated identification | Transient, Session |

### 8.3 Visibility Levels and Access Control

**Visibility is explicitly assigned when promoting annotations from Session to Case:**

| Visibility Level | Who Can See | Use Case | Export Behavior |
|------------------|-------------|----------|-----------------|
| **Private** | Creator only | Working notes, drafts | Never exported |
| **Case Team** | All users assigned to case | Collaborative diagnosis | Included in case export |
| **Department** | All users in subspecialty | Teaching, quality review | Included with permission |
| **Conference** | Designated conference attendees | Tumor board presentation | Included for conference |
| **External Consult** | Named external pathologist | Second opinion | Explicitly shared subset only |
| **Published** | Anonymized, research access | Research, training sets | Anonymized export only |

**Critical governance rules:**

1. **Default = Private.** Annotations never auto-escalate visibility.
2. **Promotion requires explicit action.** Moving from Session to Case requires selecting visibility level.
3. **Export filtering is mandatory.** Export operations strip annotations above the requester's access level.
4. **Private annotations are never shared.** Even case exports to the same user on a different device exclude Private annotations created by others.

### 8.4 Edit History and Non-Repudiation

All Case Annotations use event-sourced storage:

```json
{
  "annotation_id": "uuid",
  "case_id": "24-GI-01234",
  "slide_id": "slide-uuid",
  "scan_id": "scan-uuid (immutable link to specific scan version)",
  "category": "case",
  "type": "rectangle",
  "visibility": "case_team",
  "created_by": "user-12345",
  "events": [
    {
      "event_type": "created",
      "timestamp": "2026-01-18T09:15:00Z",
      "user": "user-12345",
      "geometry": {
        "type": "rectangle",
        "coordinates": { "x": 10240, "y": 8192, "width": 512, "height": 384 },
        "coordinate_space": "full_resolution_pixels"
      },
      "properties": {
        "label": "Area of dysplasia",
        "color": "#FF6B6B"
      }
    },
    {
      "event_type": "modified",
      "timestamp": "2026-01-18T09:20:00Z",
      "user": "user-12345",
      "geometry": { "...updated geometry..." },
      "properties": {
        "label": "Area of high-grade dysplasia",
        "notes": "Architectural complexity noted"
      }
    }
  ]
}
```

**Delete semantics:**
- "Delete" = soft delete (tombstone). Annotation is hidden from UI but retained in storage.
- Hard purge requires compliance process with audit trail and is only permitted for legal/regulatory reasons.

### 8.5 Annotation Interchange Format

**Primary format: GeoJSON** (aligns with industry practice for spatial data)

```json
{
  "type": "Feature",
  "id": "annotation-uuid",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[10240, 8192], [10752, 8192], [10752, 8576], [10240, 8576], [10240, 8192]]]
  },
  "properties": {
    "annotation_type": "rectangle",
    "label": "Area of dysplasia",
    "color": "#FF6B6B",
    "created_by": "user-12345",
    "created_at": "2026-01-18T09:15:00Z",
    "visibility": "case_team",
    "slide_id": "slide-uuid",
    "scan_id": "scan-uuid",
    "coordinate_space": "full_resolution_pixels",
    "mpp_at_creation": 0.25
  }
}
```

**Export formats supported:**
- GeoJSON (geometry + metadata, no pixel data) — for interoperability and backup
- SVG (rendered output) — for presentation and publication
- Snapshot (rendered image region with visible annotations burned in) — for reports

### 8.6 Structured Measurement Integration

Measurements are a special annotation type with additional validation and reporting requirements.

#### 8.6.1 Measurement Calibration States

| State | Condition | UI Indication | Report Behavior |
|-------|-----------|---------------|-----------------|
| **Validated** | MPP from site-calibrated scanner | Green indicator ✓ | Value flows to report |
| **Factory** | MPP from factory calibration (not site-validated) | Blue indicator | Value flows with "factory calibration" note |
| **Unvalidated** | MPP from scanner metadata but not validated | Yellow indicator ⚠ | Value flows with warning text |
| **Estimated** | MPP estimated from objective metadata | Orange indicator | Value flows with explicit caveat |
| **Unknown** | No MPP available | Red indicator ✗ | **Blocked from report auto-population** |

#### 8.6.2 Diagnostic Mode Measurement Rules

In Diagnostic Mode:
- Measurements with Unknown calibration display warning: "Scale unknown — measurement may not be accurate"
- Unknown-scale measurements are **blocked** from automatic population of structured report fields
- User can override with explicit attestation: "I accept this measurement is approximate" (logged as Tier 2 declaration)

#### 8.6.3 Measurement Data Model

```json
{
  "measurement_id": "uuid",
  "annotation_id": "uuid (link to underlying line/area annotation)",
  "case_id": "24-GI-01234",
  "slide_id": "slide-uuid",
  "scan_id": "scan-uuid",
  "measurement_type": "linear_distance",
  "value": 6.2,
  "unit": "mm",
  "calibration": {
    "state": "validated",
    "mpp": 0.25,
    "mpp_source": "site_calibration",
    "calibration_date": "2025-12-01",
    "scanner_id": "scanner-001"
  },
  "created_by": "user-12345",
  "created_at": "2026-01-18T09:25:00Z",
  "report_eligible": true
}
```

#### 8.6.4 Report Integration Flow

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ Viewer Module   │         │ Annotation      │         │ Report Module   │
│                 │         │ Service         │         │                 │
│ User measures   │────────▶│                 │────────▶│ Measurement     │
│ tumor depth     │         │ Validates:      │         │ field shows:    │
│                 │         │ - Calibration   │         │                 │
│ Raw: 24,800 px  │         │ - Coordinates   │         │ "6.2 mm"        │
│                 │         │ - MPP source    │         │ [✓ Validated]   │
│                 │         │                 │         │                 │
│                 │         │ Stores as:      │         │ Auto-populated  │
│                 │         │ 6.2 mm          │         │ if eligible     │
│                 │         │ (validated)     │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### 8.7 Algorithmic Annotation Scaling

For AI-generated annotations (e.g., cell detection, region classification), the system must handle large volumes efficiently:

**Performance requirements:**
- Must render up to 10⁶ annotation objects per slide
- Progressive disclosure: show density heatmap at low zoom, individual markers at high zoom
- Spatial indexing: R-tree or equivalent for efficient viewport queries
- Clustering: aggregate nearby markers at overview zoom levels

**Storage pattern:**
- AI annotations stored in partitioned tables (by slide_id, layer_type)
- Tile-aligned chunks for efficient retrieval
- Separate from human annotations for governance purposes

---

## 9. Slide Review State Management

### 9.1 Review States

Each slide maintains review state per user. Review states are **user-declared attestations**, never inferred from viewing behavior.

| State | Icon | Description | Trigger |
|-------|------|-------------|---------|
| Unreviewed | ○ (empty circle) | Slide has not been examined by this user | Default state |
| In Progress | ◐ (half circle) | User has opened slide for examination | User opens slide (automatic) |
| Reviewed | ● (filled circle) | User attests examination is complete | **Explicit user action required** |
| Flagged | ⚑ (flag) | User flagged for specific attention | Explicit user action |
| Needs Attending | ▲ (triangle) | Resident flagged for attending review | Explicit user action |

### 9.2 Declaration-Only State Transitions

**Critical governance principle:** Review states beyond "In Progress" are set ONLY by explicit user action.

```
          ┌─────────────────────────────────────────────────────┐
          │                                                     │
          ▼                                                     │
     ┌─────────┐     Open slide     ┌─────────────┐            │
     │Unreviewed│─────────────────▶│ In Progress │            │
     └─────────┘   (automatic)      └──────┬──────┘            │
                                          │                    │
                    ┌─────────────────────┼─────────────────┐  │
                    │ EXPLICIT            │ EXPLICIT        │  │
                    │ USER ACTION         │ USER ACTION     │  │
                    ▼                     ▼                 ▼  │
              ┌──────────┐         ┌───────────┐    ┌─────────┐│
              │ Reviewed │         │  Flagged  │    │ Needs   ││
              │          │         │           │    │Attending││
              └────┬─────┘         └─────┬─────┘    └────┬────┘│
                   │                     │               │     │
                   └─────────────────────┴───────────────┴─────┘
                            (Any state can return to In Progress
                             if user re-opens for further review)
```

**What is NOT used to determine review state:**
- Time spent viewing the slide
- Percentage of slide area visited
- Zoom levels used
- Number of tile requests
- Viewport coverage heatmaps
- Any behavioral telemetry

**The "Reviewed" declaration is an attestation:** The user is declaring "I have examined this slide to my professional satisfaction." The system does not (and cannot) verify completeness.

### 9.3 Multi-User Review Tracking

For multi-author workflows (e.g., resident draft with attending review), the system tracks review state per user:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Slide Review Summary: Case 24-GI-01234                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Part A - Colon, right                                               │
│ ┌─────────┬───────────────────┬───────────────────┐                │
│ │ Slide   │ Dr. Sharma        │ Dr. Okonkwo       │                │
│ │         │ (Resident)        │ (Attending)       │                │
│ ├─────────┼───────────────────┼───────────────────┤                │
│ │ A1 H&E  │ ● Reviewed 09:15  │ ○ Unreviewed      │                │
│ │ A2 H&E  │ ● Reviewed 09:18  │ ○ Unreviewed      │                │
│ │ A3 H&E  │ ▲ Needs Attending │ ○ Unreviewed      │                │
│ │ A4 IHC  │ ◐ In Progress     │ ○ Unreviewed      │                │
│ └─────────┴───────────────────┴───────────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Review State Data Model

```json
{
  "slide_id": "slide-uuid",
  "scan_id": "scan-uuid",
  "user_id": "user-12345",
  "state": "reviewed",
  "declared_at": "2026-01-18T09:30:00Z",
  "context": "clinical",
  "notes": null
}
```

**Tier classification:** Review state declarations are Tier 2 (workflow declarations). They are retained for case lifecycle and are part of the clinical workflow record.

### 9.5 Context-Aware Review (Phase 2)

For cases enrolled in multiple contexts (e.g., clinical diagnosis AND research study), review state can be tracked independently:

```json
{
  "slide_id": "slide-uuid",
  "user_id": "user-12345",
  "review_states": {
    "clinical": {
      "state": "reviewed",
      "declared_at": "2026-01-18T09:30:00Z"
    },
    "research-study-XYZ": {
      "state": "unreviewed",
      "declared_at": null
    }
  }
}
```

---

## 10. Telemetry and Audit Data Governance

### 10.1 Data Classification Framework

All data generated by the Digital Viewer Module is classified into one of three tiers with explicit governance rules:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TELEMETRY GOVERNANCE WALL                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TIER 1: EPHEMERAL WAYFINDING                                │   │
│  │                                                             │   │
│  │ • Tile requests, viewport coordinates                       │   │
│  │ • Pan/zoom traces, navigation history                       │   │
│  │ • AI query text and results                                 │   │
│  │ • Transient/session annotations                             │   │
│  │ • Voice command transcripts                                 │   │
│  │                                                             │   │
│  │ Retention: SESSION ONLY — purged on close                   │   │
│  │ Access: System only (prefetch, performance)                 │   │
│  │ Legal status: QA work product, NOT discoverable             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ EXPLICIT USER ACTION                 │
│                              ▼ (promotion, declaration)             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TIER 2: WORKFLOW DECLARATIONS                               │   │
│  │                                                             │   │
│  │ • Review state changes (Reviewed, Flagged, etc.)            │   │
│  │ • Persistent annotations (promoted from session)            │   │
│  │ • Structured measurements                                   │   │
│  │ • Glass slide requests                                      │   │
│  │ • Diagnostic Mode opt-out attestations                      │   │
│  │ • Workstation context (for QA, not audit)                   │   │
│  │                                                             │   │
│  │ Retention: CASE LIFECYCLE — until case archived             │   │
│  │ Access: Case participants, department QA                    │   │
│  │ Legal status: Clinical record                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ COMPLIANCE EXTRACT                   │
│                              ▼ (minimal, coarse-grained)            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TIER 3: MINIMAL AUDIT                                       │   │
│  │                                                             │   │
│  │ • Session start timestamp                                   │   │
│  │ • Session end timestamp                                     │   │
│  │ • Case access (yes/no per case, not per slide)              │   │
│  │ • Sign-out attestation                                      │   │
│  │ • Authentication events                                     │   │
│  │                                                             │   │
│  │ Retention: 7 YEARS (regulatory compliance)                  │   │
│  │ Access: Compliance/audit only                               │   │
│  │ Legal status: Discoverable                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 Tier 1: Ephemeral Wayfinding

**Definition:** Data generated by the system during normal viewing operation that reflects navigation behavior, not clinical decisions.

**Included data:**
- Tile requests (x, y, z coordinates)
- Viewport state (center point, zoom level, timestamp)
- Pan/zoom event traces
- AI query text and response content
- Voice command transcripts (raw and processed)
- Transient and session annotations
- Performance metrics (load times, render times)
- Prefetch predictions

**Governance rules:**
- **Retention:** Purged at session close. No archival.
- **Transmission:** Never sent to audit log service. Never sent to LIS.
- **Access:** System processes only (tile prefetching, performance optimization).
- **Legal status:** Designated as quality assurance work product. Protected from discovery under applicable QA privilege.

**Technical implementation:**
- Stored in browser memory / IndexedDB only
- Explicit purge on `beforeunload` event
- No server-side persistence of Tier 1 data
- Audit log service has no endpoint for Tier 1 data

### 10.3 Tier 2: Workflow Declarations

**Definition:** Data explicitly created by user action that reflects clinical workflow decisions.

**Included data:**
- Review state declarations (with timestamp and user)
- Persistent annotations (promoted from session)
- Structured measurements (with calibration context)
- Glass slide requests
- Diagnostic Mode opt-out attestations
- Case-level notes and comments
- Workstation context at session start (for QA troubleshooting)

**Governance rules:**
- **Retention:** Case lifecycle. Archived when case is archived. May be retained longer per institutional policy.
- **Transmission:** Sent to Annotation Service and/or LIS as appropriate.
- **Access:** Case participants, department QA, supervising physicians.
- **Legal status:** Part of clinical record. Discoverable as medical record.

**What is NOT included:**
- Time spent viewing (duration calculations)
- Slide-level access granularity beyond declaration
- Viewport coverage percentages
- Navigation patterns

### 10.4 Tier 3: Minimal Audit

**Definition:** The minimum data required for regulatory compliance and access auditing.

**Included data:**
- Session start timestamp
- Session end timestamp
- User identifier
- Case identifier (yes/no access, not slide-level)
- Sign-out attestation (when user finalizes report)
- Authentication events (login, logout, timeout)

**Explicitly excluded from Tier 3:**
- Slide-level access tracking
- Time spent per slide or per case
- Viewport telemetry
- Navigation patterns
- AI query history

**Governance rules:**
- **Retention:** 7 years (or per regulatory requirement).
- **Transmission:** Sent to Compliance Service.
- **Access:** Compliance officers, legal (with appropriate authorization), external auditors.
- **Legal status:** Discoverable.

### 10.5 Governance Enforcement

**Technical controls:**

| Control | Implementation |
|---------|----------------|
| Tier 1 isolation | Browser-only storage; no server endpoint accepts Tier 1 data |
| Tier 2 explicit promotion | User action required to move data from Tier 1 to Tier 2 |
| Tier 3 minimization | Audit log API accepts only defined Tier 3 schema; rejects additional fields |
| No duration calculation | Server never calculates or stores (end_time - start_time) as "time spent" |
| No slide-level audit | Audit log schema has no field for slide_id; only case_id |

**Policy controls:**

| Policy | Enforcement |
|--------|-------------|
| QA privilege designation | Tier 1 data explicitly designated as QA work product in system documentation |
| No behavioral inference | Prohibited: using any data to calculate "diligence scores," "coverage metrics," or similar |
| Secondary use restriction | Tier 1 and Tier 2 data may not be used for performance evaluation without explicit consent |

### 10.6 Rationale

This governance framework exists because:

1. **Navigation is not competence.** The time a pathologist spends viewing a slide does not indicate thoroughness, correctness, or diligence. A senior pathologist may correctly diagnose in 30 seconds what takes a resident 10 minutes.

2. **Discoverable telemetry creates perverse incentives.** If viewing behavior is legally discoverable, pathologists may engage in "performative viewing"—spending time to create a defensible record rather than to improve diagnosis.

3. **Clinical declarations are meaningful.** When a pathologist explicitly declares "I have reviewed this slide," that attestation is meaningful and appropriately part of the record. Inferring review from behavior is not.

4. **Regulatory compliance requires minimal audit.** The system must demonstrate who accessed what cases. It does not need to demonstrate how they navigated within those cases.

---

## 11. Session Management and Security

### 11.1 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Session Lifecycle                             │
└─────────────────────────────────────────────────────────────────────┘

User logs in ──▶ Platform session created
                           │
                           ▼
User opens case ──▶ Case Context session registered
                    Tier 3 audit: "User X accessed Case Y"
                           │
                           ▼
User opens viewer ──▶ Viewer session registered
                      Tier 2: Workstation context captured
                      Diagnostic Mode activated (if clinical)
                           │
                           │◀──── Tier 1: Navigation telemetry (ephemeral)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  User closes         User idle >15       User logs out
    viewer              minutes
        │                  │                  │
        ▼                  ▼                  ▼
  Tier 1 purged       Prompt: "Still     All sessions
  Viewer session      viewing?"          terminated
  deregistered                           Tier 1 purged
                           │              Tier 3: logout event
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
           User responds           No response
           Session continues       Session terminated
                                   Tier 1 purged
```

### 11.2 Idle Timeout Configuration

| Context | Default Timeout | Configurable Range | Behavior on Timeout |
|---------|-----------------|-------------------|---------------------|
| Viewer Context | 15 minutes | 5-60 minutes | Prompt, then close/lock; Tier 1 purged |
| Case Context | 30 minutes | 10-120 minutes | Prompt, then return to worklist |
| Platform Session | 8 hours | Institution policy | Require re-authentication |

### 11.3 HIPAA Considerations

- All patient data in transit encrypted (TLS 1.3)
- Patient data at rest encrypted (AES-256)
- Minimum necessary access principle: users see only cases assigned to them
- Privacy mode available for announcement display
- Tier 3 audit trail for case-level access to PHI
- Session timeout enforced to prevent unauthorized access from unattended workstations
- Tier 1 data never transmitted or stored server-side

---

## 12. Image Management Service Conformance Profile

### 12.1 Overview

The Digital Viewer Module does not directly access image storage. It requests tiles and metadata from an Image Management Service that conforms to this specification. This abstraction enables:

- Support for multiple image formats (DICOM, SVS, NDPI, OME-TIFF, etc.)
- Vendor-neutral viewer implementation
- Centralized access control and caching
- Future format evolution without viewer changes

### 12.2 Conformance Levels

Parallel to the Focus Declaration Protocol, the Image Management Service defines conformance levels:

#### Level 1 — Minimal Tile Conformance (REQUIRED)

Any image source integrated with the platform MUST implement Level 1.

**Required endpoints:**

```
GET /slides/{slide_id}/info
GET /slides/{slide_id}/tiles/{z}/{x}/{y}.{format}
```

**Info response schema (Level 1):**

```json
{
  "slide_id": "string (immutable identifier)",
  "scan_id": "string (immutable, unique per scan event)",
  "dimensions": {
    "width": "integer (full resolution pixels)",
    "height": "integer (full resolution pixels)"
  },
  "tile_size": "integer (pixels, typically 256 or 512)",
  "levels": "integer (number of pyramid levels)",
  "mpp": "float | null (microns per pixel at level 0)",
  "mpp_source": "scanner | factory | estimated | unknown",
  "mpp_validation": "site_calibrated | factory | unvalidated | null",
  "format": "jpeg | png | webp",
  "scan_timestamp": "ISO 8601 datetime",
  "scanner_id": "string | null"
}
```

**Tile addressing:**
- `z`: Pyramid level (0 = full resolution, higher = downsampled)
- `x`: Tile column index
- `y`: Tile row index
- `format`: Response image format (jpeg, png, webp)

**Coordinate reference model:**
- All coordinates in annotation systems use **full-resolution pixel space** (level 0).
- Transforms to pyramid levels are handled by the viewer.
- Annotations store coordinates relative to level 0, with `mpp` available for physical unit conversion.

**Caching semantics:**
- Tiles MUST be immutable for a given (slide_id, scan_id, z, x, y).
- Response SHOULD include `ETag` header for cache validation.
- Response SHOULD include `Cache-Control: max-age=31536000` (1 year) for immutable tiles.

#### Level 2 — Extended Conformance (RECOMMENDED)

For advanced visualization features:

**Additional endpoints:**

```
GET /slides/{slide_id}/channels
GET /slides/{slide_id}/tiles/{z}/{x}/{y}/{channel}.{format}
GET /slides/{slide_id}/zstack/{z_position}/tiles/{z}/{x}/{y}.{format}
GET /slides/{slide_id}/label
GET /slides/{slide_id}/macro
GET /slides/{slide_id}/thumbnail?max_size={pixels}
```

**Extended info response fields:**

```json
{
  "...Level 1 fields...",
  "channels": [
    { "index": 0, "name": "DAPI", "color": "#0000FF" },
    { "index": 1, "name": "FITC", "color": "#00FF00" }
  ],
  "z_stack": {
    "planes": 20,
    "spacing_um": 0.5
  },
  "color_profile": "sRGB | AdobeRGB | ICC profile name | null",
  "objective": "20x | 40x | etc.",
  "has_label": true,
  "has_macro": true
}
```

**Prefetch hints:**

```
GET /slides/{slide_id}/prefetch?viewport={x},{y},{w},{h}&zoom={z}
```

Returns list of tile URLs likely to be needed, enabling client-side prefetch.

#### Level 3 — Enterprise Adapter Conformance (ROADMAP)

For institutional deployment with existing enterprise imaging infrastructure:

**Adapter patterns (future implementation):**
- DICOMweb bridge: Translate WADO-RS requests to internal tile format
- IIIF bridge: Expose tiles via IIIF Image API
- Federated discovery: Query across multiple image repositories

**Authorization patterns:**
- Signed URLs with time-limited access
- Token-bound tile access (JWT with slide permissions)
- Institutional SSO integration

**Level 3 is documented for architectural compatibility but is not required for Phases 1-3.** Institutional DICOM integration is treated as deployment customization.

### 12.3 DICOM Handling

**Position:** DICOM is treated as a container format for ingest, not as a runtime dependency.

- DICOM images are ingested and converted to internal tile format
- DICOM metadata (patient, study, series) is extracted and mapped to platform data model
- DICOM-specific tags beyond standard pathology fields are preserved in metadata store
- The viewer never directly requests DICOM objects; it requests tiles from the Image Management Service

This approach enables:
- Consistent tile serving regardless of original format
- No viewer dependency on DICOM libraries
- Institutional flexibility in DICOM workflow integration

### 12.4 Format Support Matrix

| Format | Level 1 Support | Notes |
|--------|-----------------|-------|
| SVS (Aperio) | Required | Primary format for many scanners |
| NDPI (Hamamatsu) | Required | |
| MRXS (3DHistech) | Required | |
| SCN (Leica) | Required | |
| OME-TIFF | Required | Open format, research standard |
| DICOM WSI | Required (via ingest) | Converted to internal tiles |
| Generic TIFF | Best effort | May require manual MPP entry |
| Zarr | Phase 2 | Emerging cloud-native format |

---

## 13. Image Provenance and Versioning

### 13.1 Provenance Model

Every slide image has immutable provenance metadata that is surfaced in the viewer UI and available via API:

```json
{
  "slide_id": "uuid (immutable, assigned at accessioning)",
  "scan_id": "uuid (immutable, unique per scan event)",
  "scan_timestamp": "2026-01-15T14:30:00Z",
  "scanner_id": "scanner-001",
  "scanner_model": "Aperio GT450",
  "scanner_serial": "GT450-12345",
  "pipeline_version": "2.1.0",
  "pixel_checksum": "sha256:abc123...",
  "mpp": 0.25,
  "mpp_source": "scanner",
  "mpp_validation": {
    "state": "site_calibrated",
    "calibration_date": "2025-12-01",
    "calibration_slide_id": "cal-slide-001"
  },
  "supersedes": "previous-scan-id | null",
  "superseded_by": "newer-scan-id | null",
  "status": "current | superseded | archived"
}
```

### 13.2 Rescan Semantics

When a slide is rescanned (due to quality issues, focus problems, or updated scanning protocol):

**Rule 1: New scan = new scan_id.**
- Pixel data is never overwritten.
- Each scan is a distinct, immutable artifact.

**Rule 2: Supersession is explicit.**
- When a rescan is linked to a previous scan, both remain accessible.
- The new scan's `supersedes` field points to the old scan_id.
- The old scan's `superseded_by` field is updated to point to the new scan_id.
- The old scan's `status` changes to "superseded" but it remains accessible.

**Rule 3: Annotations are bound to scan_id, not slide_id.**
- Annotations created on scan A remain on scan A.
- They are NOT automatically migrated to scan B.
- If geometric correspondence exists (same tissue, similar alignment), user MAY explicitly copy/migrate annotations.
- UI indicates when viewing a slide with superseded annotations: "This slide was rescanned. Annotations from previous scan are available. [View previous scan]"

**Rule 4: Deep links include scan_id.**
- A link to a specific finding includes the scan_id, not just slide_id.
- Links remain valid even if the slide is later rescanned.
- Links to superseded scans display notice: "This links to a previous scan. Current scan is available."

### 13.3 Viewer Provenance Display

In Diagnostic Mode, the viewer displays provenance information:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 24-GI-01234 │ SMITH, JOHN │ Part A, Block 2, H&E │ [DX]      [⚙]   │
│ Scanned: 2026-01-15 │ Scanner: GT450-001 │ MPP: 0.25 [✓ Cal]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         [SLIDE IMAGE]                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

If viewing a superseded scan:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 24-GI-01234 │ SMITH, JOHN │ Part A, Block 2, H&E │ [DX]      [⚙]   │
│ ⚠ SUPERSEDED SCAN — Newer scan available │ [View Current Scan]     │
├─────────────────────────────────────────────────────────────────────┤
```

### 13.4 Link Stability

**URL structure:**

```
https://portal.example/viewer/{case_id}/{slide_id}/{scan_id}?x={x}&y={y}&z={z}
```

- `case_id`: Stable case reference
- `slide_id`: Stable slide reference (survives rescans)
- `scan_id`: Specific scan version (required for annotation precision)
- Query parameters: Viewport position (optional)

**Omitting scan_id:** If `scan_id` is omitted from URL, viewer opens the current (non-superseded) scan and logs a Tier 2 declaration noting the navigation.

---

## 14. Integration Architecture

### 14.1 Laboratory Information System (LIS)

The Digital Viewer Module receives case and slide metadata from the LIS via the platform's HL7 integration layer:

**Inbound data (LIS → Platform):**
- Case identifiers (accession number, MRN)
- Patient demographics
- Specimen/part information
- Slide inventory and labels
- Image file references

**Outbound data (Platform → LIS):**
- Review state declarations (user-declared only)
- Physical slide requests
- Structured measurements (if configured)

**NOT sent to LIS:**
- Navigation telemetry
- Time spent viewing
- Viewport coverage
- AI query history

### 14.2 Report Authoring Module

Bidirectional integration supports workflow continuity:

**Viewer → Report Authoring:**
- Structured measurements auto-populate report fields (if calibration validated)
- Image captures embed in report (as snapshots, not live links)
- "Navigate to finding" links in report (with scan_id for precision)

**Report Authoring → Viewer:**
- "View slide" action from report opens viewer to relevant slide/scan
- Diagnostic text can trigger slide navigation suggestions

### 14.3 Third-Party Viewer Integration

Third-party viewers can integrate at multiple levels:

**FDP Integration (Focus Declaration Protocol):**
- Layer 1: Include FDP JavaScript library for focus announcements
- Layer 2: Register with Session Awareness Service for multi-case warnings

**Tile Interface Integration:**
- Level 1: Consume tiles from Image Management Service
- Level 2: Access extended metadata (channels, z-stacks, etc.)

**Annotation Interoperability:**
- GeoJSON export/import for annotation data
- Coordinate space alignment (full-resolution pixels)

**Integration effort estimates:**
- FDP Layer 1: 1-2 hours (single script tag)
- FDP Layer 2: 2-4 days (API integration, WebSocket)
- Tile Level 1: 1-2 days (standard tile client)
- Annotation interop: 1-2 weeks (coordinate transforms, visibility mapping)

---

## 15. Technical Components

### 15.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Image       │  │ Voice       │  │ Annotation  │  │ FDP       │  │
│  │ Renderer    │  │ Processor   │  │ Manager     │  │ Controller│  │
│  │ (WebGL)     │  │ (Web Audio) │  │             │  │           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│         │                │                │               │        │
│         └────────────────┴────────────────┴───────────────┘        │
│                                   │                                 │
│                          ┌───────┴───────┐                         │
│                          │ Viewer Core   │                         │
│                          │ Controller    │                         │
│                          └───────┬───────┘                         │
│                                  │                                  │
│  ┌───────────────────────────────┴───────────────────────────────┐ │
│  │ TIER 1 EPHEMERAL STORE (Browser only — purged on close)       │ │
│  │ • Navigation telemetry  • AI query history  • Session annot.  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                  │                                  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                                   │ HTTPS / WebSocket
                                   │ (Tier 2 declarations only)
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                         SERVER TIER                                 │
├──────────────────────────────────┼──────────────────────────────────┤
│                                  │                                  │
│    ┌─────────────┐    ┌──────────┴─────────┐    ┌─────────────┐    │
│    │ Tile        │    │ Session Awareness  │    │ AI Analysis │    │
│    │ Server      │    │ Service            │    │ Service     │    │
│    │ (Level 1+)  │    │ (WebSocket Hub)    │    │             │    │
│    └─────────────┘    └────────────────────┘    └─────────────┘    │
│                                                                     │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│    │ Annotation  │    │ Voice       │    │ Compliance  │           │
│    │ Service     │    │ Transcription│   │ Service     │           │
│    │ (Tier 2)    │    │ (Whisper)   │    │ (Tier 3)    │           │
│    └─────────────┘    └─────────────┘    └─────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.2 Session Awareness Service — Detailed Design

**Technology:** Node.js with ws (WebSocket) library
**Scaling:** Horizontal via Redis pub/sub for multi-instance coordination
**State storage:** Redis for session state (ephemeral); PostgreSQL for Tier 3 audit only

**API Endpoints:**

| Endpoint | Method | Purpose | Tier |
|----------|--------|---------|------|
| `/api/session/register` | POST | Register new viewer session | 2 |
| `/api/session/heartbeat` | POST | Update session activity | 1 (not persisted) |
| `/api/session/deregister` | POST | Remove session | 2 |
| `/api/session/state` | GET | Get current user session state | — |
| `/ws/subscribe` | WebSocket | Real-time warning subscription | — |

**No endpoint exists for Tier 1 telemetry submission.** This is intentional—Tier 1 data stays in browser.

### 15.3 Annotation Service — Detailed Design

**Technology:** PostgreSQL with PostGIS extension for spatial indexing
**Storage pattern:** Event-sourced with materialized current state

**Schema:**

```sql
-- Annotation events (immutable log)
CREATE TABLE annotation_events (
  event_id UUID PRIMARY KEY,
  annotation_id UUID NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- created, modified, deleted, visibility_changed
  user_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  geometry GEOMETRY, -- PostGIS geometry
  properties JSONB,
  visibility VARCHAR(50)
);

-- Current annotation state (materialized view, updated on events)
CREATE TABLE annotations_current (
  annotation_id UUID PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL,
  slide_id UUID NOT NULL,
  scan_id UUID NOT NULL,
  annotation_type VARCHAR(50) NOT NULL,
  geometry GEOMETRY NOT NULL,
  properties JSONB,
  visibility VARCHAR(50) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  modified_by VARCHAR(255),
  modified_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Spatial index for viewport queries
CREATE INDEX idx_annotations_spatial ON annotations_current USING GIST (geometry);
CREATE INDEX idx_annotations_slide ON annotations_current (slide_id, scan_id);
CREATE INDEX idx_annotations_visibility ON annotations_current (visibility);
```

### 15.4 Image Renderer — Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Initial load time | < 2 seconds | Time from viewer open to first tile visible |
| Tile load latency | < 100ms | P95 for cached tiles; < 300ms for uncached |
| Pan response | < 16ms | Frame time during continuous pan (60fps) |
| Zoom response | < 50ms | Time from input to zoom level change visible |
| Memory usage | < 2GB | Browser heap for large slide (100k × 100k pixels) |
| Annotation rendering | < 100ms | Time to render 10,000 annotations in viewport |

### 15.5 Voice Processing Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Microphone  │───▶│ VAD         │───▶│ Audio       │───▶│ Whisper     │
│ Input       │    │ (Voice      │    │ Encoding    │    │ (Azure AI)  │
│             │    │ Activity)   │    │ (Opus)      │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                │
                                                         Transcript
                                                         (Tier 1 only)
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Action      │◀───│ Command     │◀───│ Intent      │◀───│ NLU         │
│ Execution   │    │ Mapping     │    │ Classification   │ Processing  │
│             │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**Latency budget:**
- VAD + encoding: 50ms
- Network to Whisper: 100ms
- Transcription: 500ms
- NLU + intent: 100ms
- Action execution: variable
- **Total target (voice → response):** < 1 second for simple commands

**Tier 1 classification:** All voice transcripts, queries, and results are Tier 1 ephemeral data. They are processed for action execution only and are not retained.

---

## 16. Phased Implementation Plan

### 16.1 Phase 1: Core Viewer with Focus Declaration and Governance

**Timeline:** 14 weeks
**Objective:** Functional dual-context viewer with FDP Layer 1, Diagnostic Mode, and telemetry governance

**Deliverables:**
1. Image renderer with pan/zoom navigation (Level 1 tile conformance)
2. Slide gallery with part grouping
3. Basic annotation tools (point, rectangle, line)
4. Focus Declaration Protocol (Layer 1)
5. Parent-child window synchronization
6. Case switching with confirmation prompt
7. Persistent header with case identification
8. Diagnostic Mode with workstation context capture
9. Telemetry governance wall (Tier 1/2/3 separation)
10. Review state tracking (declaration-only)
11. Measurement tools with calibration display

**Success criteria:**
- Pathologist can examine all slides in a case
- Case identity is always visible and announced on focus
- Switching cases requires explicit confirmation
- Navigation telemetry is demonstrably not persisted
- Diagnostic Mode enforced for clinical cases
- Measurements display calibration status

### 16.2 Phase 2: Conversational Interface and Session Awareness

**Timeline:** 16 weeks
**Objective:** Voice interaction, FDP Layer 2, and AI-assisted analysis

**Deliverables:**
1. Voice command processing pipeline
2. Intent classification for actions and consultations
3. Session Awareness Service (FDP Layer 2)
4. Multi-browser/multi-device warning
5. AI-assisted counting (mitoses) with confidence scoring
6. AI-assisted navigation (find tumor)
7. Ephemeral vs. persistent annotation distinction with visibility levels
8. Multi-user review state tracking
9. Structured measurement integration with Report Authoring
10. Image provenance display

**Success criteria:**
- Pathologist can navigate and measure using voice
- Multi-case warnings display when appropriate
- AI outputs include confidence indicators in Diagnostic Mode
- Measurements flow to reports with calibration context
- Voice transcripts demonstrably not retained

### 16.3 Phase 3: Advanced Features and Third-Party Integration

**Timeline:** 20 weeks
**Objective:** Full feature set, ecosystem enablement, and production hardening

**Deliverables:**
1. Side-by-side comparison view
2. Physical slide request workflow
3. FDP JavaScript library for third-party viewers
4. Tile interface conformance testing tools
5. Consultation mode with explainability
6. Context-aware review tracking
7. Session timeout and idle handling
8. Annotation export (GeoJSON, SVG, snapshots)
9. Scan versioning UI (superseded scan handling)
10. Comprehensive Tier 3 audit logging
11. AI annotation scaling (10⁶ objects per slide)

**Success criteria:**
- Third-party viewer successfully integrates FDP
- Measurements flow automatically to reports (validated only)
- All safety features operational
- Telemetry governance verified by independent review
- Scan versioning handles rescan scenarios gracefully

### 16.4 Resource Requirements

| Role | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| Frontend Engineer (WebGL/Canvas) | 1.0 FTE | 0.5 FTE | 0.5 FTE |
| Frontend Engineer (React/UI) | 1.0 FTE | 1.0 FTE | 1.0 FTE |
| Backend Engineer (Node.js) | 0.5 FTE | 1.0 FTE | 1.0 FTE |
| Backend Engineer (PostgreSQL/PostGIS) | 0.5 FTE | 0.5 FTE | 0.5 FTE |
| ML Engineer (Vision/NLP) | 0 | 1.0 FTE | 1.0 FTE |
| UX Designer | 0.5 FTE | 0.5 FTE | 0.25 FTE |
| QA Engineer | 0.5 FTE | 0.5 FTE | 0.5 FTE |
| Security/Compliance Review | 0.25 FTE | 0.25 FTE | 0.5 FTE |

---

## 17. Risk Analysis and Mitigations

### 17.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Image rendering performance insufficient for large slides | Medium | High | Early prototype with target hardware; WebGL optimization; tile prefetching |
| Voice recognition accuracy in clinical environment | Medium | Medium | Noise cancellation; command confirmation for critical actions; fallback to manual input |
| Third-party viewer adoption of FDP | Medium | Medium | Minimize implementation effort; publish as open standard; demonstrate clear safety benefit |
| WebSocket reliability in institutional networks | Low | Medium | Graceful degradation to polling; connection loss detection and recovery |
| Telemetry governance implementation leakage | Low | High | Code review focus on data flow; no server endpoints for Tier 1; automated testing of purge |

### 17.2 Clinical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Case-image mismatch despite safety features | Low | Critical | Multiple redundant indicators; prominent case ID; user training; audit logging for near-miss analysis |
| Over-reliance on AI assistance | Medium | High | Confidence scoring required in DX Mode; require human verification; document as decision support |
| Measurement error due to uncalibrated MPP | Medium | High | Calibration status display; unknown-scale blocking in DX Mode; attestation for override |
| Workflow disruption during adoption | Medium | Medium | Parallel operation with existing viewers; phased rollout; extensive training |

### 17.3 Governance Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Telemetry retained despite governance rules | Low | High | Technical controls (no server endpoints); regular audit; QA privilege legal designation |
| Navigation data subpoenaed in litigation | Low | Critical | Pre-litigation: data doesn't exist. Governance documented in system design. |
| Annotation visibility leak (private → shared) | Medium | Medium | Visibility filtering at export; access control at API layer; audit of sharing events |

### 17.4 Organizational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Pathologist resistance to voice interface | Medium | Medium | Optional feature; progressive disclosure; demonstrate efficiency gains |
| IT infrastructure unable to support tile server performance | Low | High | Early infrastructure assessment; cloud-based tile serving option |
| Regulatory uncertainty for AI-assisted features | Medium | Medium | Engage with FDA early; document as CDSS; maintain human-in-loop |

---

## 18. Appendices

### 18.1 Glossary

| Term | Definition |
|------|------------|
| Case Context | The browser window/module displaying case information, clinical history, and report authoring interface |
| Diagnostic Mode | Viewer state enforcing clinical use constraints (persistent header, calibration validation, AI confidence display) |
| Ephemeral Annotation | A visual marker that exists only during the current viewing session (Tier 1) |
| Focus Declaration | The act of a window announcing its case identity when receiving user focus |
| FDP | Focus Declaration Protocol — the standardized mechanism for case identity announcement |
| HPF | High Power Field — a standard unit of area for counting features like mitoses |
| Layer 1 (FDP) | Local focus declaration without backend integration |
| Layer 2 (FDP) | Full FDP with Session Awareness Service integration |
| Level 1 (Tile) | Minimal tile interface conformance (required endpoints and metadata) |
| Level 2 (Tile) | Extended tile interface (channels, z-stacks, prefetch) |
| MPP | Microns Per Pixel — the physical scale of the image |
| Persistent Annotation | An annotation saved to the case record (Tier 2) |
| scan_id | Immutable identifier for a specific scan event; survives rescans |
| Session Awareness Service | Backend component tracking open cases per user for multi-context coordination |
| slide_id | Immutable identifier for a slide; stable across rescans |
| Tier 1 | Ephemeral wayfinding data — session-only, purged on close, not discoverable |
| Tier 2 | Workflow declaration data — case lifecycle retention, clinical record |
| Tier 3 | Minimal audit data — 7-year retention, compliance only |
| Transient Marker | A temporary visual indicator that auto-clears on navigation (Tier 1) |
| Viewer Context | The browser window/module displaying the whole slide image for examination |
| WSI | Whole Slide Image — a high-resolution scan of a complete glass slide |

### 18.2 Reference Documents

- Report Authoring Module Narrative Specification
- Work List Module Narrative Specification
- Pathology Portal Platform Architecture Overview
- HL7 Integration Specification
- Azure AI Studio Voice Services Integration Guide
- Focus Declaration Protocol v1.0 Specification (standalone)
- Tile Interface Conformance Testing Guide

### 18.3 Design Session Participants

| Name | Role | Contribution Area |
|------|------|-------------------|
| Dr. Richard Okonkwo | Director of Surgical Pathology | Senior pathologist workflow, safety requirements |
| Dr. Margaret Chen | GI Pathology Attending | Subspecialty workflows, measurement needs |
| Dr. Kwame Asante | Dermatopathology Attending | Image capture, special stain requirements |
| Dr. Priya Sharma | Junior Surgical Pathology Attending | Training workflows, annotation needs |
| Dr. Samuel Adeyemi | Pathology Informatics (External) | Standards, regulatory, industry adoption, governance review |
| Elena Vasquez | Senior UX Designer | Interface design, interaction patterns |
| Marcus Thompson | Lead Developer | Technical architecture, feasibility assessment |

### 18.4 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 Draft | January 2026 | Design Team | Initial specification |
| 2.0 | January 2026 | Design Team | Added telemetry governance (Section 10), tile conformance profile (Section 12), image provenance (Section 13), Diagnostic Mode (Section 6.2), measurement calibration (Section 8.6), declaration-only review states (Section 9.2). Addressed industry review feedback. |
| 2.1 | January 2026 | Design Team | Added Pre-Build Clarifications (Section 0) with API contracts, error handling, Phase 0 gates. Resolved "In Progress" persistence (Option B: session-only). Confirmed Diagnostic Mode required in Phase 1. Ready for development. |

---

## Appendix A: Verification Checklists

### A.1 Phase 0 Readiness Checklist

Before Phase 1 development begins, verify:

| Gate | Verification Method | Owner | Status |
|------|---------------------|-------|--------|
| Portal case/slide resolution API available | API call returns valid case_context | Portal Team | ☐ |
| Portal-issued case-scoped JWT working | JWT validates against IMS tile endpoint | Portal Team | ☐ |
| Tile service endpoints stable and secured | Load test passes; auth required | IMS Team | ☐ |
| Basic permission model exposed | GetPermissions returns capability_set | Portal Team | ☐ |
| Audit event sink defined | Event schema documented; endpoint accepts test event | Platform Team | ☐ |
| Slide provenance API returns required fields | scan_id, MPP, supersession status present | IMS Team | ☐ |

### A.2 Telemetry Governance Verification Checklist

For QA and compliance review, verify the following controls are implemented:

| Control | Verification Method | Phase |
|---------|---------------------|-------|
| No server endpoint accepts Tier 1 data | API audit; network traffic analysis | 1 |
| Tier 1 data purged on session close | Browser storage inspection after close | 1 |
| Tier 3 schema rejects slide-level fields | API contract test; schema validation | 1 |
| No duration calculation in server code | Code review; grep for time calculations | 1 |
| No tile coordinates in audit logs | Log inspection; schema enforcement | 1 |
| Review state requires explicit action | UI audit; no auto-transition to "Reviewed" | 1 |
| "Opened/In Progress" not persisted | Database inspection after session; no record | 1 |
| Diagnostic Mode default for clinical cases | Case source → mode mapping test | 1 |
| DX Mode opt-out logged as Tier 2 | Audit log inspection after opt-out | 1 |
| Voice transcripts not retained | Server storage audit; no transcript tables | 2 |
| Annotation export filters by visibility | Export with different user roles; verify filtering | 2 |
| AI confidence required in DX Mode | UI audit; no unmarked AI output | 2 |
| Client-generated event_id for all Tier 2 events | API contract test; idempotency test | 1 |
| Soft-delete only (no hard delete without compliance process) | Attempt delete; verify tombstone | 1 |

### A.3 Error Handling Verification Checklist

| Error Condition | Test Method | Expected Behavior | Phase |
|-----------------|-------------|-------------------|-------|
| Tile service returns 500 | Mock 50%+ failures | "Image unavailable" banner; retry button | 1 |
| Portal API unreachable | Block Portal endpoint | "Service unavailable" overlay; auto-retry | 1 |
| Slide not found (404) | Request invalid slide_id | "Slide unavailable"; return to gallery | 1 |
| JWT expired/invalid (401) | Use expired token | Block interaction; prompt re-auth | 1 |
| Permission revoked (403) | Revoke mid-session | Block interaction; prompt return to Portal | 1 |
| Network offline | Disable network | Network error banner; preserve local work | 1 |
| Superseded scan | Open slide with newer scan available | Warning with option to switch | 1 |
| Voice service unavailable | Block transcription endpoint | Button grayed; tooltip shows status | 2 |

---

*End of Document*


### Architectural Review and Recommendations

#### Is the Specification Sufficient?

**Yes, the specification is comprehensive and development-ready.** The document (v2.1) provides:

- Clear module boundaries and responsibilities
- Defined API contracts (tile server conformance levels, annotation schemas)
- Data governance tiers (Tier 1 ephemeral, Tier 2 persistent, Tier 3 audit)
- Phased implementation plan with timelines
- Technical component architecture

---

#### Your Proposed Architecture: SvelteKit + Spring Boot + Python Tile Server

Your proposed architecture is **sound and aligns well** with the specification's design. Here's the analysis:

##### ✅ **Python Tile Server (large_image) as Isolated Service**

This is an **excellent choice**. The specification explicitly defines:
- **Image Management Service Conformance Profile** (Section 12) with clear REST endpoints
- Level 1 required: `GET /slides/{slide_id}/info` and `GET /slides/{slide_id}/tiles/{z}/{x}/{y}.{format}`
- The viewer "does not directly access image storage" — it requests tiles from a conformant service

`large_image` already provides tile serving capabilities and supports SVS, NDPI, DICOM, OME-TIFF, and more. Wrapping it as a Lambda/serverless function or containerized microservice is ideal.

##### ✅ **Spring Boot Backend for Business Logic**

Spring Boot is well-suited for:
- **LIS Integration** (HL7/FHIR APIs)
- **Annotation Service** (PostgreSQL/PostGIS as specified)
- **Session Awareness Service** (though spec suggests Node.js/WebSocket)
- **Voice transcription orchestration** (Azure AI/Whisper)
- **Compliance/Audit logging** (Tier 3)
- **Authorization** (JWT validation, capability checks)

##### ✅ **SvelteKit Frontend**

SvelteKit works well for the viewer. The spec requires:
- WebGL/Canvas for image rendering (OpenLayers, OpenSeadragon, or custom)
- WebSocket for real-time session awareness
- Web Audio API for voice
- Dual-window architecture (Case Context + Viewer Context)

---

#### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   SvelteKit Frontend                     │
│  • WebGL Image Renderer (OpenSeadragon/custom)          │
│  • Annotation UI, Voice UI, FDP Controller              │
│  • Tier 1 ephemeral store (browser-only)                │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS / WebSocket
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Spring Boot API Gateway                     │
│  • Auth/JWT validation                                   │
│  • Annotation CRUD (PostgreSQL/PostGIS)                 │
│  • LIS integration (HL7/FHIR)                           │
│  • Session Awareness (WebSocket hub)                    │
│  • Voice transcription orchestration                    │
│  • Compliance/Audit (Tier 3)                            │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────────┐      ┌──────────────────────┐
│ Python Tile  │      │ External Services    │
│ Server       │      │ • LIS                │
│ (large_image)│      │ • Azure AI/Whisper   │
│ Lambda/ECS   │      │ • Keycloak SSO       │
└──────────────┘      └──────────────────────┘
```

---

#### Key Considerations

1. **Tile Server Isolation**: Keep `large_image` stateless. It only serves tiles — no auth logic, no annotations. Spring Boot proxies or the frontend calls it directly with signed URLs.

2. **WebSocket Choice**: The spec suggests Node.js for Session Awareness. You can use Spring WebSocket instead, but ensure low-latency for FDP Layer 2 warnings.

3. **Annotation Coordinates**: All annotations use **full-resolution pixel space** (level 0). The tile server handles pyramid math; annotations are resolution-independent.

4. **Telemetry Governance**: Tier 1 data (navigation, AI queries) **never leaves the browser**. Spring Boot only receives Tier 2 declarations.

5. **Cloud Deployment**: Python tile server as Lambda/ECS with CloudFront caching works well since tiles are immutable per `(slide_id, scan_id, z, x, y)`.

---

#### Summary

Your architecture is **well-aligned** with the specification. The separation of concerns is correct:

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Frontend | SvelteKit | UI, WebGL rendering, Tier 1 store |
| Backend | Spring Boot | Business logic, LIS, annotations, auth |
| Tile Server | Python/large_image | Image tiles only (stateless) |

The specification provides sufficient detail to begin implementation. Start with **Phase 1** (14 weeks): core viewer, FDP Layer 1, basic annotations, and telemetry governance.
