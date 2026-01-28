# Digital Viewer Development Plan

**Document ID**: DEV-PLAN-001
**Date**: 2026-01-21
**Status**: ACTIVE

---

## 1. Executive Summary

This document outlines the development plan to complete the Digital Viewer module based on comprehensive analysis of:
- Design History File (DHF) requirements
- System Requirements Specification (SRS-001)
- Verification & Validation Plan (VVP-001)
- Current implementation status

### Implementation Status Summary

| Package | Status | Completion |
|---------|--------|------------|
| viewer-core | Complete | 95% |
| fdp-lib | Complete | 100% |
| annotations | Complete | 95% |
| session-service | Complete | 100% |
| review-state | Complete | 100% |
| telemetry | Complete | 100% |
| voice | Complete | 100% |
| viewer-ui | Not Started | 0% |
| voice-service | Not Started | 0% |

---

## 2. Gap Analysis

### 2.1 Missing Components (Critical)

#### Measurement System (SYS-MSR-001 through SYS-MSR-007)

**Current State**: Basic annotation tools exist without measurement-specific functionality.

**Required**:
- [ ] Linear measurement tool (ruler) with distance display
- [ ] Area measurement tool (rectangle/polygon area)
- [ ] MPP (microns-per-pixel) display in UI
- [ ] MPP source indicator (scanner/manual)
- [ ] Calibration state display (site_calibrated, factory, unvalidated, unknown)
- [ ] Measurement blocking in Diagnostic Mode when calibration unknown

**VVP Test Cases**:
- TEST-MSR-001: Line measurement tool
- TEST-MSR-002: Area measurement tool
- TEST-MSR-003: Units in um/mm
- TEST-MSR-004: MPP display
- TEST-MSR-005: Calibration state visible
- TEST-MSR-006: MPP from IMS
- TEST-MSR-007: Block unknown-scale in DX

---

#### Error Handling Components (SYS-ERR-001 through SYS-ERR-004)

**Current State**: Basic error state in stores, no dedicated UI components.

**Required**:
- [ ] ErrorOverlay component for "Image temporarily unavailable"
- [ ] ServiceUnavailable overlay for portal failures
- [ ] ReauthPrompt for expired JWT
- [ ] SupersessionNotice for viewing superseded scans

**VVP Test Cases**:
- TEST-ERR-001: >50% tile failures shows "Image unavailable"
- TEST-ERR-002: Portal endpoint blocked shows "Service unavailable"
- TEST-ERR-003: Expired JWT shows re-auth prompt
- TEST-ERR-004: Superseded scan shows notice

---

### 2.2 Type Definition Enhancements

**SlideMetadata** needs:
```typescript
export interface SlideMetadata {
  // ... existing fields ...
  mppSource?: 'scanner' | 'manual';
  calibrationState?: 'site_calibrated' | 'factory' | 'unvalidated' | 'unknown';
  scanId?: string;
  supersededBy?: string;
}
```

**Measurement** type needed:
```typescript
export interface Measurement {
  id: string;
  slideId: string;
  scanId: string;
  type: 'line' | 'rectangle' | 'polygon';
  geometry: GeoJSON.Geometry;
  value: number;
  unit: 'um' | 'mm';
  mpp: number;
  mppSource: 'scanner' | 'manual';
  calibrationState: CalibrationState;
  createdAt: string;
  createdBy?: string;
}
```

---

### 2.3 VVP Test Coverage Gaps

The following test categories need automated test implementations:

| Category | Test Count | Coverage |
|----------|------------|----------|
| Image Rendering (VWR) | 8 | Partial |
| User Interface (UI) | 7 | Partial |
| Focus Declaration (FDP) | 10 | Good |
| Session Awareness (SES) | 5 | Good |
| Measurements (MSR) | 7 | None |
| Annotations (ANN) | 10 | Partial |
| Review States (RVW) | 5 | Good |
| Telemetry (TEL) | 5 | Good |
| Diagnostic Mode (DXM) | 5 | Partial |
| Error Handling (ERR) | 4 | None |

---

## 3. Development Tasks

### Phase 1: Measurement System (Priority: CRITICAL)

**Rationale**: Required for patient safety (accurate tumor measurements) and regulatory compliance.

#### Task 1.1: Extend Type Definitions
- Add `CalibrationState` type
- Add `Measurement` interface
- Extend `SlideMetadata` with calibration fields

#### Task 1.2: Create MeasurementToolbar Component
- Ruler tool button
- Area tool button
- MPP display badge
- Calibration state indicator
- Unit toggle (um/mm)

#### Task 1.3: Create MeasurementOverlay Component
- Render active measurement during drawing
- Display value with units
- Show distance/area result

#### Task 1.4: Implement Measurement Store
- Active measurement state
- Measurement history
- Unit preferences
- Calibration-aware calculations

#### Task 1.5: Add Diagnostic Mode Blocking
- Check calibration state before measurement
- Show warning modal if unknown/unvalidated
- Require attestation to proceed

---

### Phase 2: Error Handling System (Priority: HIGH)

#### Task 2.1: Create ErrorOverlay Component
```
ErrorOverlay.svelte
- Props: type, message, retryAction
- Types: 'tile-failure', 'service-unavailable', 'auth-expired', 'superseded'
- Styled per design system
```

#### Task 2.2: Implement Tile Failure Detection
- Track tile load failures in viewer
- Calculate failure rate
- Trigger overlay at >50% failure threshold

#### Task 2.3: Create ReauthPrompt Component
- Modal with login redirect
- Preserve current case context
- Handle successful re-auth

#### Task 2.4: Create SupersessionNotice Component
- Non-blocking notice
- Link to current scan
- Explain why viewing old scan

---

### Phase 3: VVP Test Suite (Priority: HIGH)

#### Task 3.1: Create E2E Test Framework
- Set up Playwright or Cypress
- Configure test cases directory integration
- Create test data fixtures from cases.json

#### Task 3.2: Implement Image Rendering Tests
- TEST-VWR-001: Pyramid tile rendering
- TEST-VWR-002: Initial load <2s
- TEST-VWR-003: Pan frame time <16ms
- TEST-VWR-004: Zoom response <50ms
- TEST-VWR-005: Smooth navigation
- TEST-VWR-006: Memory <2GB
- TEST-VWR-007: Tile prefetch
- TEST-VWR-008: Cache-Control headers

#### Task 3.3: Implement Measurement Tests
- All TEST-MSR-* cases

#### Task 3.4: Implement Error Handling Tests
- All TEST-ERR-* cases

---

### Phase 4: Package Scaffolding (Priority: MEDIUM)

#### Task 4.1: viewer-ui Package
Create shared UI components:
- Button
- Modal
- Badge
- Toast
- Tooltip
- Icon system

#### Task 4.2: voice-service Package (Phase 2)
Server-side voice processing stub:
- Whisper integration interface
- Transcription API
- HIPAA-compliant ephemeral storage

---

## 4. Implementation Order

```
Week 1: Phase 1 - Measurement System
├── Day 1-2: Type definitions + stores
├── Day 3-4: MeasurementToolbar + MeasurementOverlay
└── Day 5: DX Mode blocking + testing

Week 2: Phase 2 - Error Handling
├── Day 1-2: ErrorOverlay component
├── Day 3: Tile failure detection
└── Day 4-5: ReauthPrompt + SupersessionNotice

Week 3: Phase 3 - VVP Tests
├── Day 1: E2E framework setup
├── Day 2-3: Rendering + UI tests
└── Day 4-5: Measurement + Error tests

Week 4: Phase 4 - Polish
├── Day 1-2: viewer-ui scaffolding
├── Day 3-4: Integration testing
└── Day 5: Documentation
```

---

## 5. Files to Create/Modify

### New Files

```
packages/viewer-core/src/types/measurement.ts
packages/viewer-core/src/stores/measurement.ts
packages/viewer-core/src/components/MeasurementToolbar.svelte
packages/viewer-core/src/components/MeasurementOverlay.svelte
packages/viewer-core/src/components/MeasurementResult.svelte
packages/viewer-core/src/components/ErrorOverlay.svelte
packages/viewer-core/src/components/ReauthPrompt.svelte
packages/viewer-core/src/components/SupersessionNotice.svelte
packages/viewer-core/src/components/CalibrationBadge.svelte

packages/viewer-core/src/__tests__/e2e/
├── vwr.spec.ts      # Image rendering tests
├── msr.spec.ts      # Measurement tests
├── err.spec.ts      # Error handling tests
└── fixtures/        # Test data

packages/viewer-ui/
├── package.json
├── src/
│   ├── index.ts
│   ├── Button.svelte
│   ├── Modal.svelte
│   ├── Badge.svelte
│   └── Toast.svelte
└── tsconfig.json
```

### Modified Files

```
packages/viewer-core/src/types.ts
  - Add CalibrationState, Measurement, extend SlideMetadata

packages/viewer-core/src/stores.ts
  - Add measurement stores
  - Add error tracking stores

packages/viewer-core/src/components/Viewer.svelte
  - Add tile failure tracking
  - Integrate error overlays

packages/viewer-core/src/components/PathologyViewer.svelte
  - Integrate measurement toolbar
  - Add calibration display
```

---

## 6. Acceptance Criteria

All work must satisfy:

1. **VVP Test Cases**: All 60+ tests in VVP-001 must pass
2. **Type Safety**: Full TypeScript coverage with no `any` types
3. **Accessibility**: WCAG AA compliance (4.5:1 contrast)
4. **Performance**: Meet SRS performance requirements
5. **Risk Controls**: Verify all RISK-* mitigations are implemented

---

## 7. Risk Mitigation Verification

| Risk ID | Control | Implementation Location |
|---------|---------|------------------------|
| RISK-003 | MPP display | MeasurementToolbar, CalibrationBadge |
| RISK-003 | Block unknown-scale | MeasurementStore.canMeasure() |
| RISK-001 | FDP banner | CaseBanner.svelte (existing) |
| RISK-001 | Persistent header | CaseIndicator.svelte (existing) |
| RISK-005 | No Tier 1 transmission | telemetry package (existing) |

---

## 8. Next Steps

Begin implementation with Phase 1, Task 1.1: Extend type definitions for the measurement system.
