# Verification & Validation Plan

---
document_id: VVP-001
title: Digital Viewer Module — Verification & Validation Plan
version: 1.1
status: ACTIVE
owner: Quality Assurance
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements), RMF-001 (Hazard Analysis)
trace_destination: Test results (per release)
references:
  - IEC 62304:2006+A1:2015 (Section 5.7 — Software Verification)
  - ISO 13485:2016 (Section 7.3.6 — Design Verification)
  - Digital Viewer Module Specification v2.1 (Appendix A)
---

## 1. Purpose

This document defines the verification and validation strategy for the Digital Viewer Module, including test cases, pass/fail criteria, and traceability to requirements and risk controls.

## 2. Verification Strategy

### 2.1 Verification Methods

| Method | Description | Used For |
|:-------|:------------|:---------|
| **Test** | Automated or manual functional testing | Behavioral requirements |
| **Analysis** | Design review, code review, calculations | Performance, security |
| **Inspection** | Visual review of output | UI requirements, compliance |
| **Demonstration** | Observed operation | Workflow requirements |

### 2.2 Test Levels

| Level | Scope | Responsibility |
|:------|:------|:---------------|
| Unit | Individual functions/components | Developer |
| Integration | Component interactions | Developer/QA |
| System | End-to-end workflows | QA |
| Acceptance | User scenarios | QA/Clinical |

## 3. Test Environment

| Component | Specification |
|:----------|:--------------|
| Browser | Chrome 120+, Edge 120+, Firefox 120+, Safari 17+ |
| Display | Dual monitor (1920×1080 each minimum) |
| Network | Institutional LAN (< 50ms latency to tile server) |
| Test Data | Anonymized slides from test-cases directory |

## 4. Verification Test Cases

### 4.1 Image Rendering (SYS-VWR-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-VWR-001 | SYS-VWR-001 | Verify tiles render via pyramid architecture | Tiles visible at multiple zoom levels | ☐ |
| TEST-VWR-002 | SYS-VWR-002 | Measure time from viewer open to first tile | < 2 seconds | ☐ |
| TEST-VWR-003 | SYS-VWR-003 | Measure frame time during continuous pan | < 16ms (60fps) | ☐ |
| TEST-VWR-004 | SYS-VWR-004 | Measure time from zoom input to visible change | < 50ms | ☐ |
| TEST-VWR-005 | SYS-VWR-005 | Pan and zoom through entire slide | Smooth navigation at all levels | ☐ |
| TEST-VWR-006 | SYS-VWR-006 | Load 100k×100k slide; monitor memory | < 2GB heap | ☐ |
| TEST-VWR-007 | SYS-VWR-007 | Verify tiles prefetch on viewport movement | Network requests precede viewport | ☐ |
| TEST-VWR-008 | SYS-VWR-008 | Verify Cache-Control headers on tile responses | `max-age=86400` present | ☐ |

### 4.2 User Interface (SYS-UI-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-UI-001 | SYS-UI-001 | Inspect default viewer state | No visible tool palettes | ☐ |
| TEST-UI-002 | SYS-UI-002 | Invoke tools via menu/gesture | Tools appear only when invoked | ☐ |
| TEST-UI-003 | SYS-UI-003 | Open case with multiple slides | Gallery visible with all slides | ☐ |
| TEST-UI-004 | SYS-UI-004 | Verify slides grouped by part | Part labels visible; slides grouped | ☐ |
| TEST-UI-005 | SYS-UI-005 | Open side-by-side comparison (Phase 3) | Two slides visible simultaneously | ☐ |
| TEST-UI-006 | SYS-UI-006 | Open viewer on dual-monitor setup | Case Context on M1, Viewer on M2 | ☐ |
| TEST-UI-007 | SYS-UI-007 | Open viewer on single monitor | Reduced-functionality mode works | ☐ |

### 4.3 Focus Declaration Protocol (SYS-FDP-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-FDP-001 | SYS-FDP-001 | Click outside viewer, then click viewer | Focus banner appears | ☐ |
| TEST-FDP-002 | SYS-FDP-002 | Inspect focus banner content | Case ID and patient ID present | ☐ |
| TEST-FDP-003 | SYS-FDP-003 | Time banner display duration | ≥ 1.5 seconds | ☐ |
| TEST-FDP-004 | SYS-FDP-004 | Measure banner height | ≥ 48 pixels | ☐ |
| TEST-FDP-005 | SYS-FDP-005 | Analyze banner contrast | ≥ 4.5:1 ratio | ☐ |
| TEST-FDP-006 | SYS-FDP-006 | Wait for banner to collapse | Persistent header visible | ☐ |
| TEST-FDP-007 | SYS-FDP-007 | Measure persistent header height | ≥ 24 pixels | ☐ |
| TEST-FDP-008 | SYS-FDP-008 | Attempt to collapse header in DX Mode | Header remains visible | ☐ |
| TEST-FDP-009 | SYS-FDP-009 | Focus after 15 minutes absence | Banner extended (> 2 seconds) | ☐ |
| TEST-FDP-010 | SYS-FDP-010 | Enable privacy mode; verify display | Initials and year only | ☐ |

### 4.4 Session Awareness (SYS-SES-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-SES-001 | SYS-SES-001 | Open case; check service registration | API call to /register observed | ☐ |
| TEST-SES-002 | SYS-SES-002 | Monitor heartbeat traffic | POST to /heartbeat every 30s | ☐ |
| TEST-SES-003 | SYS-SES-003 | Close viewer; verify deregistration | API call to /deregister observed | ☐ |
| TEST-SES-004 | SYS-SES-004 | Open two cases (different browsers) | Multi-case warning displayed | ☐ |
| TEST-SES-005 | SYS-SES-005 | Attempt case switch while viewer open | Confirmation prompt appears | ☐ |

### 4.5 Measurements (SYS-MSR-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-MSR-001 | SYS-MSR-001 | Use line measurement tool | Line drawn; length displayed | ☐ |
| TEST-MSR-002 | SYS-MSR-002 | Use area measurement tool | Area drawn; size displayed | ☐ |
| TEST-MSR-003 | SYS-MSR-003 | Inspect measurement units | Displayed in um or mm | ☐ |
| TEST-MSR-004 | SYS-MSR-004 | Inspect MPP display | MPP value and source visible | ☐ |
| TEST-MSR-005 | SYS-MSR-005 | Inspect calibration state | Validation state visible | ☐ |
| TEST-MSR-006 | SYS-MSR-006 | Verify MPP comes from IMS | Compare displayed MPP to /info response | ☐ |
| TEST-MSR-007 | SYS-MSR-007 | Attempt measurement on unknown-scale (DX) | Measurement blocked; warning shown | ☐ |

### 4.6 Annotations (SYS-ANN-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-ANN-001 | SYS-ANN-001 | Create point, line, rect, polygon | All annotation types work | ☐ |
| TEST-ANN-002 | SYS-ANN-002 | Create annotation; close and reopen | Annotation persists | ☐ |
| TEST-ANN-003 | SYS-ANN-003 | Rescan slide; check annotation binding | Annotation on original scan_id | ☐ |
| TEST-ANN-004 | SYS-ANN-004 | Change annotation visibility | Visibility options available | ☐ |
| TEST-ANN-005 | SYS-ANN-005 | Create new annotation; check default | Visibility = private | ☐ |
| TEST-ANN-006 | SYS-ANN-006 | Open slide; verify no auto-annotations | No annotations without user action | ☐ |
| TEST-ANN-007 | SYS-ANN-007 | Delete own annotation | Deletion succeeds | ☐ |
| TEST-ANN-008 | SYS-ANN-007 | Attempt to delete other's annotation | Deletion blocked | ☐ |
| TEST-ANN-009 | SYS-ANN-008 | Delete annotation; check database | is_deleted = true; record exists | ☐ |
| TEST-ANN-010 | SYS-ANN-010 | Render 10,000 annotations | Render time < 100ms | ☐ |

### 4.7 Review States (SYS-RVW-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-RVW-001 | SYS-RVW-001 | Set slide to Reviewed, Flagged, Needs_Attending | All states selectable | ☐ |
| TEST-RVW-002 | SYS-RVW-002 | Set review state; check database | Event persisted with timestamp | ☐ |
| TEST-RVW-003 | SYS-RVW-003 | Open slide; check auto-state | No auto "Reviewed" on open | ☐ |
| TEST-RVW-004 | SYS-RVW-004 | Open slide; check "In Progress" persistence | Not in database; session only | ☐ |
| TEST-RVW-005 | SYS-RVW-005 | Close session; check "In Progress" | No record in database | ☐ |

### 4.8 Telemetry Governance (SYS-TEL-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-TEL-001 | SYS-TEL-001 | Code review: tier classification | Three tiers defined; data classified | ☐ |
| TEST-TEL-002 | SYS-TEL-002 | Network traffic analysis | No navigation/tile data sent to server | ☐ |
| TEST-TEL-003 | SYS-TEL-003 | Close session; inspect browser storage | Tier 1 data purged | ☐ |
| TEST-TEL-004 | SYS-TEL-004 | Inspect Tier 3 audit events | No tile_coordinates, viewport, slide_id | ☐ |
| TEST-TEL-005 | SYS-TEL-005 | Code review: duration calculation | No time delta calculations in server | ☐ |

### 4.9 Diagnostic Mode (SYS-DXM-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-DXM-001 | SYS-DXM-001 | Open clinical worklist case | DX Mode active by default | ☐ |
| TEST-DXM-002 | SYS-DXM-002 | Attempt header collapse in DX Mode | Header remains visible | ☐ |
| TEST-DXM-003 | SYS-DXM-003 | Make measurement in DX Mode | MPP/calibration displayed | ☐ |
| TEST-DXM-004 | SYS-DXM-004 | Disable DX Mode | Attestation prompt appears | ☐ |
| TEST-DXM-005 | SYS-DXM-005 | Disable DX Mode; check audit | Tier 2 event logged | ☐ |

### 4.10 Error Handling (SYS-ERR-*)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-ERR-001 | SYS-ERR-001 | Simulate >50% tile failures | "Image unavailable" banner | ☐ |
| TEST-ERR-002 | SYS-ERR-002 | Block Portal endpoint | "Service unavailable" overlay | ☐ |
| TEST-ERR-003 | SYS-ERR-003 | Use expired JWT | Re-authentication prompt | ☐ |
| TEST-ERR-004 | SYS-ERR-004 | Open superseded scan | Supersession notice displayed | ☐ |

### 4.11 Image Management Service — Format Support (SYS-IMS-001 to SYS-IMS-009)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-001 | SYS-IMS-001 | Open and tile Aperio SVS file | Tiles render correctly | ☐ |
| TEST-IMS-002 | SYS-IMS-002 | Open and tile Hamamatsu NDPI file | Tiles render correctly | ☐ |
| TEST-IMS-003 | SYS-IMS-003 | Open and tile Leica SCN file | Tiles render correctly | ☐ |
| TEST-IMS-004 | SYS-IMS-004 | Open and tile 3DHISTECH MRXS file | Tiles render correctly | ☐ |
| TEST-IMS-005 | SYS-IMS-005 | Open and tile Zeiss CZI file | Tiles render correctly | ☐ |
| TEST-IMS-006 | SYS-IMS-006 | Open and tile Pyramidal TIFF file | Tiles render correctly | ☐ |
| TEST-IMS-007 | SYS-IMS-007 | Open and tile OME-TIFF file | Tiles render correctly | ☐ |
| TEST-IMS-008 | SYS-IMS-008 | Open and tile DICOM WSI file | Tiles render correctly | ☐ |
| TEST-IMS-009 | SYS-IMS-009 | Open and tile JPEG2000 file | Tiles render correctly | ☐ |

### 4.12 Image Management Service — REST API (SYS-IMS-010 to SYS-IMS-018)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-010 | SYS-IMS-010 | Request tile via XYZ endpoint | Valid tile image returned | ☐ |
| TEST-IMS-011 | SYS-IMS-011 | Request DeepZoom descriptor | Valid .dzi XML returned | ☐ |
| TEST-IMS-012 | SYS-IMS-012 | Request DeepZoom tile | Valid tile image returned | ☐ |
| TEST-IMS-013 | SYS-IMS-013 | Request metadata endpoint | JSON with sizeX, sizeY, MPP | ☐ |
| TEST-IMS-014 | SYS-IMS-014 | Request associated image (label) | Label image returned | ☐ |
| TEST-IMS-015 | SYS-IMS-015 | Request thumbnail | Thumbnail image returned | ☐ |
| TEST-IMS-016 | SYS-IMS-016 | Request region extraction | Region image returned | ☐ |
| TEST-IMS-017 | SYS-IMS-017 | Request image list | JSON array of images | ☐ |
| TEST-IMS-018 | SYS-IMS-018 | Request health endpoint | 200 OK response | ☐ |

### 4.13 Image Management Service — Encoding and Generation (SYS-IMS-019 to SYS-IMS-022)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-019 | SYS-IMS-019 | Request JPEG encoded tile | Valid JPEG returned | ☐ |
| TEST-IMS-020 | SYS-IMS-020 | Request PNG encoded tile | Valid PNG returned | ☐ |
| TEST-IMS-021 | SYS-IMS-021 | Verify no .dzi files created | No files in storage | ☐ |
| TEST-IMS-022 | SYS-IMS-022 | Verify tiles generated on demand | No pre-generated tile files | ☐ |

### 4.14 Image Management Service — Metadata (SYS-IMS-023 to SYS-IMS-026)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-023 | SYS-IMS-023 | Verify MPP in metadata | mm_x and mm_y present | ☐ |
| TEST-IMS-024 | SYS-IMS-024 | Verify dimensions in metadata | sizeX and sizeY present | ☐ |
| TEST-IMS-025 | SYS-IMS-025 | Verify tile size in metadata | tileWidth and tileHeight present | ☐ |
| TEST-IMS-026 | SYS-IMS-026 | Verify level count in metadata | levels property present | ☐ |

### 4.15 Image Management Service — Multi-Channel (SYS-IMS-027 to SYS-IMS-030)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-027 | SYS-IMS-027 | Request specific channel with frame param | Channel-specific tile returned | ☐ |
| TEST-IMS-028 | SYS-IMS-028 | Request specific Z-plane with frame param | Z-plane-specific tile returned | ☐ |
| TEST-IMS-029 | SYS-IMS-029 | Request false-color composite with style | Composited tile returned | ☐ |
| TEST-IMS-030 | SYS-IMS-030 | Request with min/max remapping style | Remapped tile returned | ☐ |

### 4.16 Image Management Service — Caching (SYS-IMS-031 to SYS-IMS-034)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-031 | SYS-IMS-031 | Request same image multiple times | Second request uses cached source | ☐ |
| TEST-IMS-032 | SYS-IMS-032 | Verify tile caching (if Redis configured) | Cached tiles served faster | ☐ |
| TEST-IMS-033 | SYS-IMS-033 | Inspect Cache-Control headers | max-age header present | ☐ |
| TEST-IMS-034 | SYS-IMS-034 | Verify random access (memory analysis) | No full image loaded in memory | ☐ |

### 4.17 Image Management Service — Integration (SYS-IMS-035 to SYS-IMS-038)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-IMS-035 | SYS-IMS-035 | Cross-origin request from browser | CORS headers present; request succeeds | ☐ |
| TEST-IMS-036 | SYS-IMS-036 | Request without JWT | 401 Unauthorized | ☐ |
| TEST-IMS-037 | SYS-IMS-037 | Access /docs endpoint | OpenAPI documentation rendered | ☐ |
| TEST-IMS-038 | SYS-IMS-038 | Deploy container and verify | Server starts; health check passes | ☐ |

### 4.18 Image Management Service — Security (SC-023 to SC-030)

| Test ID | Requirement | Test Description | Pass Criteria | Status |
|:--------|:------------|:-----------------|:--------------|:-------|
| TEST-SEC-023 | SC-023 | Request with path traversal in image_id | 400 Bad Request | ☐ |
| TEST-SEC-024 | SC-024 | Request with "../" in image_id | 400 Bad Request; path traversal blocked | ☐ |
| TEST-SEC-025 | SC-025 | Request excessively large region | Region size limit enforced | ☐ |
| TEST-SEC-026 | SC-026 | Exceed source cache limit | LRU eviction occurs | ☐ |
| TEST-SEC-028 | SC-028 | Request via HTTP | Redirect to HTTPS or rejected | ☐ |
| TEST-SEC-030 | SC-030 | Request from disallowed origin | CORS blocked | ☐ |

## 5. Risk Control Verification

| Risk Control | Verification Test | Status |
|:-------------|:------------------|:-------|
| RC-001-A (FDP banner) | TEST-FDP-001, TEST-FDP-002 | ☐ |
| RC-001-B (Persistent header) | TEST-FDP-006, TEST-FDP-007 | ☐ |
| RC-001-C (Case switch confirmation) | TEST-SES-005 | ☐ |
| RC-001-D (Multi-case warning) | TEST-SES-004 | ☐ |
| RC-001-E (Non-collapsible header) | TEST-FDP-008, TEST-DXM-002 | ☐ |
| RC-002-A (Session registration) | TEST-SES-001, TEST-SES-002 | ☐ |
| RC-002-B/C (Multi-case warning) | TEST-SES-004 | ☐ |
| RC-003-A (MPP display) | TEST-MSR-004, TEST-MSR-005 | ☐ |
| RC-003-B (Block unknown scale) | TEST-MSR-007 | ☐ |
| RC-004-A (No Tier 1 endpoint) | TEST-TEL-002 | ☐ |
| RC-004-B (Session purge) | TEST-TEL-003 | ☐ |
| RC-004-C (Tier 3 schema) | TEST-TEL-004 | ☐ |
| RC-004-D (No duration) | TEST-TEL-005 | ☐ |
| RC-004-E (Session-only state) | TEST-RVW-004, TEST-RVW-005 | ☐ |
| RC-009-A (Health endpoint) | TEST-IMS-018 | ☐ |
| RC-009-B (Source caching) | TEST-IMS-031 | ☐ |
| RC-009-C (Tile caching) | TEST-IMS-032 | ☐ |
| RC-009-D (Error messaging) | TEST-ERR-001, TEST-ERR-002 | ☐ |
| RC-010-A (MPP from source) | TEST-IMS-023 | ☐ |
| RC-010-B (Calibration display) | TEST-MSR-005 | ☐ |
| RC-010-C (Block unknown scale) | TEST-MSR-007 | ☐ |
| RC-011-A (Multi-format support) | TEST-IMS-001 through TEST-IMS-009 | ☐ |
| RC-011-B (Unsupported error) | TEST-ERR-001 | ☐ |
| RC-012-A (ID validation) | TEST-SEC-023 | ☐ |
| RC-012-B (Traversal rejection) | TEST-SEC-024 | ☐ |

## 6. Validation Plan

Validation confirms the device meets user needs in realistic conditions.

### 6.1 Usability Validation

| ID | User Scenario | Participants | Method |
|:---|:--------------|:-------------|:-------|
| VAL-001 | Case examination workflow | 5 pathologists | Observed task completion |
| VAL-002 | Multi-case awareness | 3 pathologists | Simulated interruption |
| VAL-003 | Measurement workflow | 3 subspecialty attendings | Observed measurement accuracy |

### 6.2 Clinical Validation Criteria

| Criterion | Acceptance Threshold |
|:----------|:--------------------|
| Task completion rate | ≥ 95% |
| Case identity awareness | 100% correct identification |
| Measurement accuracy | Within ±5% of reference |

## 7. Test Documentation

Each test execution produces:
- Test ID and description
- Date and tester
- Test environment details
- Actual results
- Pass/Fail determination
- Defect ID (if failed)

## 8. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | QA | Initial VVP |
| 1.1 | 2026-01-22 | QA | Added Image Management Service test cases (TEST-IMS-001 to TEST-IMS-038, TEST-SEC-023 to TEST-SEC-030); updated risk control verification |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
