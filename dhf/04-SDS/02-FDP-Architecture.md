# Software Design Specification — Focus Declaration Protocol Architecture

---
document_id: SDS-FDP-001
title: Digital Viewer Module — Focus Declaration Protocol Architecture
version: 1.0
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements SYS-FDP-*, SYS-SES-*)
trace_destination: VVP-001 (Verification Tests TEST-FDP-*, TEST-SES-*)
references:
  - Digital Viewer Module Specification v2.1 (Section 5)
  - IEC 62304:2006+A1:2015 (Section 5.4)
---

## 1. Purpose

This document specifies the software architecture for the Focus Declaration Protocol (FDP), which ensures pathologists always know which case they are examining when the viewer receives focus.

## 2. Protocol Overview

FDP addresses a fundamental patient safety challenge: case-image mismatch in digital pathology workflows. Unlike physical microscopy where the slide itself contains identifying information, digital viewers can display any image without inherent physical verification.

### 2.1 Conformance Levels

| Layer | Scope | Dependencies | Required? |
|:------|:------|:-------------|:----------|
| Layer 1 | Local focus declaration | None (browser-only) | YES |
| Layer 2 | Session awareness integration | Session Awareness Service | OPTIONAL |

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FDP CONTROLLER (Client)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ Focus Detector  │───▶│ Announcement    │───▶│ Persistent      │        │
│  │                 │    │ Manager         │    │ Header Manager  │        │
│  │ window.focus    │    │                 │    │                 │        │
│  │ event handler   │    │ Timer-based     │    │ DX Mode aware   │        │
│  └─────────────────┘    │ display control │    └─────────────────┘        │
│                         └─────────────────┘                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Layer 2 Integration (Optional)                    │   │
│  │  ┌─────────────────┐    ┌─────────────────┐                         │   │
│  │  │ Session         │───▶│ Warning         │                         │   │
│  │  │ Registrar       │    │ Display         │                         │   │
│  │  │                 │    │                 │                         │   │
│  │  │ WebSocket       │    │ Multi-case      │                         │   │
│  │  │ heartbeat       │    │ indicators      │                         │   │
│  │  └─────────────────┘    └─────────────────┘                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (Layer 2 only)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SESSION AWARENESS SERVICE (Server)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ Session         │    │ Multi-Case      │    │ Warning         │        │
│  │ Registry        │    │ Detector        │    │ Broadcaster     │        │
│  │                 │    │                 │    │                 │        │
│  │ Redis-backed    │    │ Per-user case   │    │ WebSocket       │        │
│  │ session store   │    │ tracking        │    │ pub/sub         │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Design Decisions

### 4.1 Declaration-Based Approach

**Decision**: Each window independently announces its identity on focus, rather than relying on synchronized state.

**Rationale**:
- Decoupled: No coordination required between applications
- Universally implementable: Any viewer can adopt FDP
- Fail-safe: Each context is self-sufficient
- Standardizable: Simple enough for industry-wide adoption

### 4.2 Time-Decay Announcement Duration

**Decision**: Extend announcement duration based on time since last focus.

**Formula**:
```
announcement_duration = base_duration + (minutes_since_last_focus / 5) * 0.5
maximum_duration = 5 seconds
base_duration = 2 seconds
```

**Rationale**: Longer absences increase mismatch risk; extended announcement provides proportional attention capture.

## 5. Data Model

### 5.1 FDP State

```typescript
interface FDPState {
  // Case identity
  caseId: string;
  patientIdentifier: string;
  patientDOB?: string;

  // Focus tracking
  lastFocusTime: Date | null;
  announcementVisible: boolean;

  // Display settings
  privacyMode: boolean;
  audioMode: 'off' | 'chime' | 'brief' | 'full';

  // Diagnostic Mode
  diagnosticMode: boolean;
  headerCollapsed: boolean;  // Always false in DX Mode

  // Layer 2 state
  sessionRegistered: boolean;
  multiCaseWarning: boolean;
  openCases: CaseRef[];
}

interface CaseRef {
  caseId: string;
  patientIdentifier: string;
  viewerType: string;
  openedAt: Date;
}
```

## 6. Interface Contracts

### 6.1 Layer 1 — Focus Declaration

```typescript
// Focus event handler
window.addEventListener('focus', () => {
  fdpController.handleFocus();
});

// Announcement display
interface AnnouncementConfig {
  caseId: string;
  patientIdentifier: string;
  patientDOB?: string;
  duration: number;        // Computed from time-decay formula
  multiCaseWarning: boolean;
}
```

### 6.2 Layer 2 — Session Awareness Service API

```typescript
// Registration
POST /api/session/register
{
  user_id: string;
  case_id: string;
  patient_identifier: string;
  viewer_type: string;
  window_id: string;
  opened_at: string;  // ISO 8601
}

// Heartbeat
POST /api/session/heartbeat
{
  window_id: string;
  focused_at: string;  // ISO 8601
}

// Deregistration
POST /api/session/deregister
{
  window_id: string;
}

// WebSocket subscription
wss://session-service/subscribe
// Receives: { type: 'multi-case', cases: CaseRef[] }
```

## 7. Behavioral Specifications

### 7.1 Layer 1 Focus Declaration Sequence

```
Window receives focus event
         │
         ▼
┌────────────────────────┐
│ Calculate duration     │
│ based on time-decay    │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Display announcement   │
│ banner (min 48px)      │
│ • Case ID              │
│ • Patient identifier   │
│ • Multi-case warning   │
└───────────┬────────────┘
            │
            │ After duration
            ▼
┌────────────────────────┐
│ Collapse to persistent │
│ header (min 24px)      │
│ (Not collapsible in    │
│  Diagnostic Mode)      │
└────────────────────────┘
```

### 7.2 Layer 2 Multi-Case Detection

```
Session opens case
         │
         ▼
┌────────────────────────┐
│ Register with Session  │
│ Awareness Service      │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Service checks for     │
│ existing cases by user │
└───────────┬────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
  No other    Other cases
  cases       open
      │           │
      │           ▼
      │   ┌────────────────────────┐
      │   │ Broadcast multi-case   │
      │   │ warning to all clients │
      │   └────────────────────────┘
      │           │
      └─────┬─────┘
            │
            ▼
┌────────────────────────┐
│ Clients display        │
│ multi-case indicator   │
└────────────────────────┘
```

## 8. Visual Specifications

### 8.1 Announcement Banner

| Attribute | Requirement |
|:----------|:------------|
| Position | Top of viewport, full width |
| Minimum height | 48 pixels |
| Background | Institution primary color or #1a365d |
| Text color | White |
| Contrast ratio | ≥ 4.5:1 (WCAG AA) |
| Animation | Slide down, 200ms ease-out |
| Content | Case ID, Patient name, optional DOB |

### 8.2 Persistent Header

| Attribute | Requirement |
|:----------|:------------|
| Position | Top of viewport |
| Minimum height | 24 pixels |
| Background | Semi-transparent dark (#1a365d, 90%) |
| Collapsibility | Collapsible (non-DX) / Fixed (DX Mode) |
| Content | Case ID, Patient name, [DX] badge, controls |

### 8.3 Multi-Case Warning

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

## 9. Security Controls

| Control | Implementation |
|:--------|:---------------|
| Privacy mode | Abbreviated patient info (initials, year only) |
| Session isolation | window_id is UUID; no cross-session data leak |
| Heartbeat timeout | 90 seconds (3 missed heartbeats) auto-deregister |

## 10. Traceability Table

| Design Element | System Requirement | Risk Control |
|:---------------|:-------------------|:-------------|
| Focus event handler | SYS-FDP-001 | RC-001 |
| Announcement banner | SYS-FDP-002, SYS-FDP-003, SYS-FDP-004, SYS-FDP-005 | RC-001 |
| Persistent header | SYS-FDP-006, SYS-FDP-007, SYS-FDP-008 | RC-001 |
| Time-decay duration | SYS-FDP-009 | RC-001 |
| Privacy mode | SYS-FDP-010 | — |
| Session registration | SYS-SES-001 | RC-002 |
| Heartbeat protocol | SYS-SES-002 | RC-002 |
| Deregistration | SYS-SES-003 | RC-002 |
| Multi-case warning | SYS-SES-004 | RC-002 |
| Case switch confirmation | SYS-SES-005 | RC-001 |

## 11. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial FDP architecture |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
