# Software Design Specification — Overview

---
document_id: SDS-OVR-001
title: Digital Viewer Module — Software Design Overview
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements Specification)
trace_destination: SDS-VWR-001, SDS-FDP-001, SDS-ANN-001, SDS-TEL-001
references:
  - Digital Viewer Module Specification v2.1
  - IEC 62304:2006+A1:2015 (Section 5.4 — Software Architectural Design)
---

## 1. Purpose

This document provides the high-level architectural overview of the Digital Viewer Module software design. It establishes component boundaries, interfaces, and cross-cutting concerns that apply to all module-specific designs.

## 2. Architectural Overview

### 2.1 System Context

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
                                    │ HTTPS / API
                                    ▼
                    ┌───────────────────────────────┐
                    │   Image Management Service    │
                    │   (Tile Server)               │
                    └───────────────────────────────┘
```

### 2.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐         │
│  │ Image       │  │ Voice       │  │ Annotation  │  │ FDP       │         │
│  │ Renderer    │  │ Processor   │  │ Manager     │  │ Controller│         │
│  │ (WebGL)     │  │ (Web Audio) │  │             │  │           │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘         │
│         │                │                │               │                │
│         └────────────────┴────────────────┴───────────────┘                │
│                                   │                                         │
│                          ┌───────┴───────┐                                 │
│                          │ Viewer Core   │                                 │
│                          │ Controller    │                                 │
│                          └───────┬───────┘                                 │
│                                  │                                          │
│  ┌───────────────────────────────┴───────────────────────────────┐         │
│  │ TIER 1 EPHEMERAL STORE (Browser only — purged on close)       │         │
│  │ • Navigation telemetry  • AI query history  • Session state   │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ HTTPS / WebSocket
                                   │ (Tier 2 declarations only)
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                         SERVER TIER                                         │
├──────────────────────────────────┼──────────────────────────────────────────┤
│                                  │                                          │
│    ┌─────────────┐    ┌──────────┴─────────┐    ┌─────────────┐            │
│    │ Tile        │    │ Session Awareness  │    │ AI Analysis │            │
│    │ Server      │    │ Service            │    │ Service     │            │
│    │ (large_image│    │ (WebSocket Hub)    │    │             │            │
│    └─────────────┘    └────────────────────┘    └─────────────┘            │
│                                                                             │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                   │
│    │ Annotation  │    │ Voice       │    │ Compliance  │                   │
│    │ Service     │    │ Transcription│   │ Service     │                   │
│    │ (Tier 2)    │    │ (Whisper)   │    │ (Tier 3)    │                   │
│    └─────────────┘    └─────────────┘    └─────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Component Summary

| Component | Technology | Responsibility | SDS Document |
|:----------|:-----------|:---------------|:-------------|
| Viewer Core Controller | TypeScript/SvelteKit | Coordination, state management | SDS-VWR-001 |
| Image Renderer | WebGL/OpenSeadragon | Tile rendering, viewport control | SDS-VWR-001 |
| FDP Controller | TypeScript | Focus detection, announcement | SDS-FDP-001 |
| Annotation Manager | TypeScript | CRUD, visibility, persistence | SDS-ANN-001 |
| Voice Processor | Web Audio API | Voice capture, transcription | Phase 2 |
| Tier 1 Store | IndexedDB/Memory | Ephemeral session data | SDS-TEL-001 |
| Session Awareness Service | Node.js/WebSocket | Multi-context coordination | SDS-FDP-001 |
| Tile Server | Python/large_image | Image tile serving | External |
| Annotation Service | PostgreSQL/PostGIS | Annotation persistence | SDS-ANN-001 |

## 4. Interface Contracts

### 4.1 Portal → Viewer APIs

| API | Method | Purpose |
|:----|:-------|:--------|
| `ResolveCase(lab_code, accession)` | GET | Returns case_context with metadata |
| `IssueViewerToken(case_context, user)` | POST | Returns case-scoped JWT |
| `ListSlides(case_context)` | GET | Returns slide_refs[] for case |
| `GetPermissions(user, case_context)` | GET | Returns capability_set |
| `GetSlideProvenance(slide_id)` | GET | Returns provenance_record |

### 4.2 Viewer → Portal Events (Tier 2)

| Event | Payload | Purpose |
|:------|:--------|:--------|
| `review_state_change` | case_id, slide_id, user, new_state, timestamp, event_id | Review declaration |
| `annotation_persisted` | case_id, slide_id, annotation_id, action, timestamp, event_id | Annotation change |
| `share_requested` | case_id, annotation_ids[], target_visibility, timestamp, event_id | Sharing request |
| `dx_mode_opt_out` | case_id, user, reason, timestamp, event_id | Diagnostic mode change |
| `measurement_recorded` | case_id, slide_id, measurement_id, value, calibration_state, event_id | Measurement |

### 4.3 Tile Server Interface (Level 1)

| Endpoint | Response | Purpose |
|:---------|:---------|:--------|
| `GET /slides/{slide_id}/info` | JSON metadata | Slide dimensions, MPP, pyramid info |
| `GET /slides/{slide_id}/tiles/{z}/{x}/{y}.{format}` | Image tile | Tile at pyramid level z, position x,y |

## 5. Cross-Cutting Concerns

### 5.1 Telemetry Governance

All components MUST respect the three-tier telemetry model:

| Tier | Data Type | Retention | Server Transmission |
|:-----|:----------|:----------|:--------------------|
| Tier 1 | Navigation, viewport, AI queries | Session only | PROHIBITED |
| Tier 2 | Declarations (annotations, review states) | Case lifecycle | REQUIRED |
| Tier 3 | Minimal audit (session start/end, access) | 7 years | REQUIRED |

### 5.2 Error Handling

All components MUST implement graceful degradation:
- Service unavailability → User notification + fallback
- No silent failures for Tier 2 operations
- Error states must be surfaced in UI

### 5.3 Security

All components MUST:
- Validate JWT on every API call
- Never store credentials locally
- Use HTTPS/WSS exclusively
- Sanitize all user inputs

## 6. Module Architecture Documents

| ID | Document | Scope |
|:---|:---------|:------|
| SDS-VWR-001 | [01-Viewer-Architecture.md](./01-Viewer-Architecture.md) | Core viewer, image rendering, UI |
| SDS-FDP-001 | [02-FDP-Architecture.md](./02-FDP-Architecture.md) | Focus Declaration Protocol |
| SDS-ANN-001 | [03-Annotation-Architecture.md](./03-Annotation-Architecture.md) | Annotation system |
| SDS-TEL-001 | [04-Telemetry-Architecture.md](./04-Telemetry-Architecture.md) | Telemetry governance |

## 7. Traceability to Requirements

| Design Component | System Requirements |
|:-----------------|:--------------------|
| Image Renderer | SYS-VWR-001 through SYS-VWR-008 |
| Viewer UI | SYS-UI-001 through SYS-UI-007 |
| FDP Controller | SYS-FDP-001 through SYS-FDP-010 |
| Session Service | SYS-SES-001 through SYS-SES-005 |
| Annotation Manager | SYS-ANN-001 through SYS-ANN-010 |
| Tier 1 Store | SYS-TEL-001 through SYS-TEL-005, SYS-RVW-003 through SYS-RVW-005 |

## 8. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial SDS overview |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
