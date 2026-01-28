# System Requirements Specification (SRS)

---
document_id: SRS-001
title: Digital Viewer Module — System Requirements Specification
version: 1.2
status: ACTIVE
owner: Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: PURS-001 (Product & User Requirements)
trace_destination: SDS-OVR-001 (Software Design Specification)
references:
  - Digital Viewer Module Specification v2.1
  - ISO 13485:2016 (Section 7.3.3 — Design Outputs)
  - IEC 62304:2006+A1:2015
---

## 1. Purpose

This document defines the technical "shall" statements derived from the User Needs specified in PURS-001. Each requirement is traceable to its source user need and specifies the verification method.

## 2. System Overview

The Digital Viewer Module is a browser-based application for clinical examination of whole slide images (WSI). It operates within the Pathology Portal Platform and integrates with the Image Management Service, Laboratory Information System (LIS), and Session Awareness Service.

## 3. System Requirements

### 3.1 Image Rendering Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-VWR-001 | The system shall display whole slide images using a tiled pyramid rendering architecture | UN-VWR-001 | Test, Demonstration |
| SYS-VWR-002 | The system shall achieve initial tile visibility within 2 seconds of viewer open | UN-VWR-002 | Test |
| SYS-VWR-003 | The system shall achieve pan response latency below 16ms (60fps) during continuous navigation | UN-VWR-002 | Test |
| SYS-VWR-004 | The system shall achieve zoom response latency below 50ms | UN-VWR-002 | Test |
| SYS-VWR-005 | The system shall support smooth continuous pan and zoom at any magnification level | UN-VWR-003 | Demonstration |
| SYS-VWR-006 | The system shall render slides up to 100,000 x 100,000 pixels with memory usage below 2GB | UN-VWR-003 | Test |
| SYS-VWR-007 | The system shall provide tile prefetching based on predicted viewport movement | UN-VWR-002 | Test, Analysis |
| SYS-VWR-008 | The system shall cache tiles using browser storage with Cache-Control headers | UN-VWR-002 | Test |

### 3.2 User Interface Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-UI-001 | The system shall default to a minimal interface with no visible tool palettes | UN-VWR-001, UN-VWR-004 | Inspection |
| SYS-UI-002 | The system shall display tools only upon user invocation or configuration | UN-VWR-004 | Demonstration |
| SYS-UI-003 | The system shall provide a slide gallery showing all slides in the current case | UN-VWR-005 | Demonstration |
| SYS-UI-004 | The system shall group slides by specimen part in the gallery view | UN-VWR-005 | Demonstration |
| SYS-UI-005 | The system shall support side-by-side comparison of two slides (Phase 3) | UN-VWR-006 | Demonstration |
| SYS-UI-006 | The system shall support dual-monitor configuration with Case Context and Viewer Context windows | UN-ENV-001 | Demonstration |
| SYS-UI-007 | The system shall support single-monitor operation with reduced functionality | UN-ENV-002 | Demonstration |
| SYS-UI-008 | The system shall provide a collapsible tools panel that can be hidden/shown | UN-VWR-004 | Demonstration |
| SYS-UI-009 | The system shall provide magnification presets (1x, 2x, 5x, 10x, 20x, 40x) for quick zoom navigation | UN-VWR-003 | Demonstration |
| SYS-UI-010 | The system shall display current approximate magnification level | UN-VWR-003 | Inspection |

### 3.3 Focus Declaration Protocol (FDP) Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-FDP-001 | The system shall display a focus announcement banner upon receiving window focus | UN-SAF-001, UN-SAF-003 | Test |
| SYS-FDP-002 | The focus announcement shall include case identifier and patient identifier | UN-SAF-001 | Inspection |
| SYS-FDP-003 | The focus announcement shall display for a minimum of 1.5 seconds | UN-SAF-003 | Test |
| SYS-FDP-004 | The focus announcement banner shall have minimum height of 48 pixels | UN-SAF-001 | Inspection |
| SYS-FDP-005 | The focus announcement shall have contrast ratio of at least 4.5:1 (WCAG AA) | UN-SAF-001 | Analysis |
| SYS-FDP-006 | The system shall maintain a persistent case identification header after announcement | UN-SAF-002 | Inspection |
| SYS-FDP-007 | The persistent header shall have minimum height of 24 pixels | UN-SAF-002 | Inspection |
| SYS-FDP-008 | The persistent header shall not be collapsible in Diagnostic Mode | UN-DXM-001 | Test |
| SYS-FDP-009 | The system shall extend announcement duration based on time since last focus | UN-SAF-003 | Test |
| SYS-FDP-010 | The system shall support privacy mode displaying abbreviated patient identification | UN-SAF-002 | Demonstration |

### 3.4 Session Awareness Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-SES-001 | The system shall register with Session Awareness Service upon opening a case | UN-SAF-004 | Test |
| SYS-SES-002 | The system shall send heartbeat to Session Awareness Service every 30 seconds | UN-SAF-004 | Test |
| SYS-SES-003 | The system shall deregister from Session Awareness Service upon closing viewer | UN-SAF-004 | Test |
| SYS-SES-004 | The system shall display multi-case warning when same user has multiple cases open | UN-SAF-004 | Demonstration |
| SYS-SES-005 | The system shall require explicit confirmation before switching cases while viewer is open | UN-SAF-005 | Test |

### 3.5 Measurement Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-MSR-001 | The system shall provide linear measurement tools (line, ruler) | UN-MSR-001 | Demonstration |
| SYS-MSR-002 | The system shall provide area measurement tools (rectangle, polygon) | UN-MSR-001 | Demonstration |
| SYS-MSR-003 | The system shall display measurements in micrometers (um) and millimeters (mm) | UN-MSR-003 | Inspection |
| SYS-MSR-004 | The system shall display microns-per-pixel (MPP) value and source | UN-MSR-002 | Inspection |
| SYS-MSR-005 | The system shall display calibration validation state (site-calibrated/factory/unvalidated/unknown) | UN-MSR-002 | Inspection |
| SYS-MSR-006 | The system shall consume MPP from Image Management Service metadata | UN-MSR-004 | Test |
| SYS-MSR-007 | The system shall block measurements on unknown-scale slides in Diagnostic Mode | UN-MSR-002, UN-DXM-001 | Test |

### 3.6 Annotation Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-ANN-001 | The system shall provide annotation tools: point, line, rectangle, polygon | UN-ANN-001 | Demonstration |
| SYS-ANN-002 | The system shall persist annotations to the Portal annotation database | UN-ANN-002 | Test |
| SYS-ANN-003 | The system shall bind annotations to specific scan_id (immutable) | UN-ANN-002 | Test |
| SYS-ANN-004 | The system shall support annotation visibility levels: private, case_team, department, conference, external, published | UN-ANN-003, UN-ANN-004 | Test |
| SYS-ANN-005 | The system shall default new annotations to "private" visibility | UN-ANN-003 | Test |
| SYS-ANN-006 | The system shall never display annotations without explicit user action | UN-ANN-005 | Test |
| SYS-ANN-007 | The system shall allow users to delete only their own annotations | UN-ANN-006 | Test |
| SYS-ANN-008 | The system shall implement soft-delete for annotations (tombstone) | UN-ANN-006 | Test |
| SYS-ANN-009 | The system shall store annotation coordinates in full-resolution pixel space (level 0) | UN-ANN-001 | Analysis |
| SYS-ANN-010 | The system shall render up to 10,000 annotations in viewport within 100ms | UN-ANN-001 | Test |
| SYS-ANN-011 | The system shall provide text annotation tool for placing textual labels on slides | UN-ANN-001 | Demonstration |

### 3.7 Review State Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-RVW-001 | The system shall support user-declared review states: Reviewed, Flagged, Needs_Attending | UN-RVW-001, UN-RVW-002 | Demonstration |
| SYS-RVW-002 | The system shall persist review state changes as Tier 2 declaration events | UN-RVW-001 | Test |
| SYS-RVW-003 | The system shall NOT automatically set review states based on navigation behavior | UN-RVW-003 | Test |
| SYS-RVW-004 | The system shall treat "Opened/In_Progress" as session-only state (Tier 1) | UN-RVW-003 | Test |
| SYS-RVW-005 | The system shall purge "Opened/In_Progress" state on session close | UN-RVW-003 | Test |

### 3.8 Telemetry Governance Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-TEL-001 | The system shall classify telemetry into three tiers: Tier 1 (ephemeral), Tier 2 (persistent), Tier 3 (audit) | UN-RVW-004 | Analysis |
| SYS-TEL-002 | The system shall NOT transmit Tier 1 data (navigation, tile requests, viewport) to any server | UN-RVW-004 | Test |
| SYS-TEL-003 | The system shall purge all Tier 1 data on session close | UN-RVW-004 | Test |
| SYS-TEL-004 | The system shall NOT include tile coordinates or viewport state in Tier 3 audit logs | UN-RVW-004 | Test |
| SYS-TEL-005 | The system shall NOT calculate or store viewing duration | UN-RVW-004 | Test, Code Review |

### 3.9 Diagnostic Mode Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-DXM-001 | The system shall default to Diagnostic Mode for cases from clinical worklist | UN-DXM-002 | Test |
| SYS-DXM-002 | The system shall enforce persistent header (non-collapsible) in Diagnostic Mode | UN-DXM-001 | Test |
| SYS-DXM-003 | The system shall display MPP source and validation state on measurements in Diagnostic Mode | UN-DXM-001 | Inspection |
| SYS-DXM-004 | The system shall require attestation to disable Diagnostic Mode | UN-DXM-003 | Test |
| SYS-DXM-005 | The system shall log Diagnostic Mode opt-out as Tier 2 event | UN-DXM-003 | Test |

### 3.10 Voice Interaction Requirements (Phase 2)

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-VOC-001 | The system shall provide voice command processing for navigation and measurement | UN-VOC-001 | Demonstration |
| SYS-VOC-002 | The system shall allow voice features to be enabled/disabled by user preference | UN-VOC-002 | Demonstration |
| SYS-VOC-003 | The system shall NOT retain voice transcripts beyond the session (Tier 1) | UN-VOC-003 | Test |
| SYS-VOC-004 | The system shall use HIPAA-compliant transcription service under BAA | UN-VOC-003 | Analysis |
| SYS-VOC-005 | The system shall remain fully functional when voice services are unavailable | UN-VOC-002 | Test |

### 3.11 Integration Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-INT-001 | The system shall receive case/slide metadata from Portal via documented API | UN-INT-001 | Test |
| SYS-INT-002 | The system shall authenticate using Portal-issued case-scoped JWT | UN-INT-001 | Test |
| SYS-INT-003 | The system shall consume tiles from Image Management Service Level 1+ conformant endpoint | UN-INT-001 | Test |
| SYS-INT-004 | The system shall export structured measurements for Report Authoring integration | UN-INT-002 | Test |
| SYS-INT-005 | The system shall provide workflow for requesting physical glass slides | UN-INT-003 | Demonstration |

### 3.12 Error Handling Requirements

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-ERR-001 | The system shall display "Image temporarily unavailable" when >50% tile requests fail | UN-VWR-002 | Test |
| SYS-ERR-002 | The system shall display "Service unavailable" overlay when backend is unreachable | UN-VWR-002 | Test |
| SYS-ERR-003 | The system shall prompt re-authentication when JWT expires or is invalid | UN-INT-001 | Test |
| SYS-ERR-004 | The system shall display supersession notice when viewing a superseded scan | UN-VWR-003 | Demonstration |

### 3.13 Image Management Service Requirements (Tile Server)

#### 3.13.1 Image Format Support

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-001 | The system shall support tile serving for Aperio SVS format (.svs) via OpenSlide plugin | UN-IMG-001 | Test |
| SYS-IMS-002 | The system shall support tile serving for Hamamatsu NDPI format (.ndpi, .vms) via OpenSlide plugin | UN-IMG-001 | Test |
| SYS-IMS-003 | The system shall support tile serving for Leica SCN format (.scn) via OpenSlide plugin | UN-IMG-001 | Test |
| SYS-IMS-004 | The system shall support tile serving for 3DHISTECH MIRAX format (.mrxs) via OpenSlide plugin | UN-IMG-001 | Test |
| SYS-IMS-005 | The system shall support tile serving for Zeiss CZI format (.czi) via OpenSlide or bioformats plugin | UN-IMG-001 | Test |
| SYS-IMS-006 | The system shall support tile serving for Pyramidal TIFF format (.tif, .ptif, .qptiff) via tiff plugin | UN-IMG-001 | Test |
| SYS-IMS-007 | The system shall support tile serving for OME-TIFF format (.ome.tif) via ometiff plugin | UN-IMG-001 | Test |
| SYS-IMS-008 | The system shall support tile serving for DICOM WSI format (.dcm) via dicom plugin | UN-IMG-001 | Test |
| SYS-IMS-009 | The system shall support tile serving for JPEG2000 format (.jp2) via openjpeg plugin | UN-IMG-001 | Test |

#### 3.13.2 REST API Endpoints

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-010 | The system shall expose GET /tiles/{image_id}/{z}/{x}/{y}.{format} for XYZ tile retrieval | UN-VWR-002, UN-VWR-003 | Test |
| SYS-IMS-011 | The system shall expose GET /deepzoom/{image_id}.dzi for DeepZoom XML descriptor generation | UN-VWR-002 | Test |
| SYS-IMS-012 | The system shall expose GET /deepzoom/{image_id}_files/{level}/{col}_{row}.{format} for DeepZoom tiles | UN-VWR-002 | Test |
| SYS-IMS-013 | The system shall expose GET /metadata/{image_id} for slide metadata including dimensions, MPP, and pyramid info | UN-IMG-003, UN-MSR-002 | Test |
| SYS-IMS-014 | The system shall expose GET /associated/{image_id}/{name} for associated images (label, macro) | UN-IMG-002 | Test |
| SYS-IMS-015 | The system shall expose GET /thumbnail/{image_id} for slide thumbnails | UN-IMG-004 | Test |
| SYS-IMS-016 | The system shall expose GET /region/{image_id} for arbitrary region extraction | UN-ANN-001 | Test |
| SYS-IMS-017 | The system shall expose GET /images for listing available images | UN-INT-001 | Test |
| SYS-IMS-018 | The system shall expose GET /health for health check monitoring | UN-VWR-002 | Test |

#### 3.13.3 Tile Generation and Encoding

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-019 | The system shall support JPEG encoding for tile output | UN-VWR-002 | Test |
| SYS-IMS-020 | The system shall support PNG encoding for tile output | UN-VWR-002 | Test |
| SYS-IMS-021 | The system shall generate DeepZoom descriptors dynamically without creating stored .dzi files | UN-ISP-003 | Analysis |
| SYS-IMS-022 | The system shall generate tiles on-demand from source images without pre-generating tile files | UN-ISP-003 | Analysis |

#### 3.13.4 Metadata and Calibration

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-023 | The system shall include microns-per-pixel (MPP) values (mm_x, mm_y) in metadata responses | UN-IMG-003, UN-MSR-002 | Test |
| SYS-IMS-024 | The system shall include image dimensions (sizeX, sizeY) in metadata responses | UN-IMG-003 | Test |
| SYS-IMS-025 | The system shall include tile size (tileWidth, tileHeight) in metadata responses | UN-VWR-002 | Test |
| SYS-IMS-026 | The system shall include pyramid level count in metadata responses | UN-VWR-002 | Test |

#### 3.13.5 Multi-Channel and Z-Stack Support

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-027 | The system shall support frame parameter for selecting channels in multi-channel images | UN-IMG-005 | Test |
| SYS-IMS-028 | The system shall support frame parameter for selecting Z-planes in Z-stack images | UN-IMG-006 | Test |
| SYS-IMS-029 | The system shall support style parameter for false-color compositing of multi-channel images | UN-IMG-005 | Test |
| SYS-IMS-030 | The system shall support band selection and min/max remapping via style parameter | UN-IMG-005 | Test |

#### 3.13.6 Caching and Performance

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-031 | The system shall implement LRU cache for keeping frequently-used tile sources open | UN-ISP-002 | Test |
| SYS-IMS-032 | The system shall support tile caching via Redis, Memcached, or in-memory backends | UN-ISP-001 | Test |
| SYS-IMS-033 | The system shall set appropriate Cache-Control headers on tile responses | UN-ISP-001 | Test |
| SYS-IMS-034 | The system shall support random access to tiles within pyramidal images (no full image loading) | UN-ISP-001 | Analysis |

#### 3.13.7 Integration and Deployment

| ID | System Requirement | Trace to User Need | Verification Method |
|:---|:-------------------|:-------------------|:--------------------|
| SYS-IMS-035 | The system shall support CORS configuration for browser-based viewers | UN-VWR-002 | Test |
| SYS-IMS-036 | The system shall support JWT-based authentication for tile requests | UN-INT-001 | Test |
| SYS-IMS-037 | The system shall provide auto-generated API documentation (OpenAPI/Swagger) | UN-INT-001 | Inspection |
| SYS-IMS-038 | The system shall support Docker container deployment | UN-ISP-003 | Demonstration |

## 4. Performance Requirements Summary

| Metric | Target | Requirement ID |
|:-------|:-------|:---------------|
| Initial load time | < 2 seconds | SYS-VWR-002 |
| Tile load latency (cached) | < 100ms (P95) | SYS-VWR-003 |
| Tile load latency (uncached) | < 300ms (P95) | SYS-VWR-003 |
| Pan response | < 16ms (60fps) | SYS-VWR-003 |
| Zoom response | < 50ms | SYS-VWR-004 |
| Memory usage | < 2GB | SYS-VWR-006 |
| Annotation rendering | < 100ms for 10k annotations | SYS-ANN-010 |
| Tile server latency (cached) | < 50ms (P95) | SYS-IMS-032 |
| Tile server latency (uncached) | < 200ms (P95) | SYS-IMS-010 |
| Source cache hit rate | > 90% | SYS-IMS-031 |
| Concurrent tile requests | > 100 per server | SYS-IMS-010 |

## 5. Traceability Matrix

| User Need | System Requirements |
|:----------|:--------------------|
| UN-VWR-001 | SYS-VWR-001, SYS-UI-001 |
| UN-VWR-002 | SYS-VWR-002, SYS-VWR-003, SYS-VWR-004, SYS-VWR-007, SYS-VWR-008, SYS-ERR-001, SYS-ERR-002 |
| UN-VWR-003 | SYS-VWR-005, SYS-VWR-006, SYS-ERR-004 |
| UN-VWR-004 | SYS-UI-001, SYS-UI-002 |
| UN-VWR-005 | SYS-UI-003, SYS-UI-004 |
| UN-VWR-006 | SYS-UI-005 |
| UN-SAF-001 | SYS-FDP-001, SYS-FDP-002, SYS-FDP-004, SYS-FDP-005 |
| UN-SAF-002 | SYS-FDP-006, SYS-FDP-007, SYS-FDP-010 |
| UN-SAF-003 | SYS-FDP-001, SYS-FDP-003, SYS-FDP-009 |
| UN-SAF-004 | SYS-SES-001, SYS-SES-002, SYS-SES-003, SYS-SES-004 |
| UN-SAF-005 | SYS-SES-005 |
| UN-MSR-001 | SYS-MSR-001, SYS-MSR-002 |
| UN-MSR-002 | SYS-MSR-004, SYS-MSR-005, SYS-MSR-007 |
| UN-MSR-003 | SYS-MSR-003 |
| UN-MSR-004 | SYS-MSR-006 |
| UN-ANN-001 | SYS-ANN-001, SYS-ANN-009, SYS-ANN-010 |
| UN-ANN-002 | SYS-ANN-002, SYS-ANN-003 |
| UN-ANN-003 | SYS-ANN-004, SYS-ANN-005 |
| UN-ANN-004 | SYS-ANN-004 |
| UN-ANN-005 | SYS-ANN-006 |
| UN-ANN-006 | SYS-ANN-007, SYS-ANN-008 |
| UN-RVW-001 | SYS-RVW-001, SYS-RVW-002 |
| UN-RVW-002 | SYS-RVW-001 |
| UN-RVW-003 | SYS-RVW-003, SYS-RVW-004, SYS-RVW-005 |
| UN-RVW-004 | SYS-TEL-001, SYS-TEL-002, SYS-TEL-003, SYS-TEL-004, SYS-TEL-005 |
| UN-VOC-001 | SYS-VOC-001 |
| UN-VOC-002 | SYS-VOC-002, SYS-VOC-005 |
| UN-VOC-003 | SYS-VOC-003, SYS-VOC-004 |
| UN-DXM-001 | SYS-DXM-002, SYS-DXM-003, SYS-MSR-007 |
| UN-DXM-002 | SYS-DXM-001 |
| UN-DXM-003 | SYS-DXM-004, SYS-DXM-005 |
| UN-INT-001 | SYS-INT-001, SYS-INT-002, SYS-INT-003, SYS-ERR-003 |
| UN-INT-002 | SYS-INT-004 |
| UN-INT-003 | SYS-INT-005 |
| UN-ENV-001 | SYS-UI-006 |
| UN-ENV-002 | SYS-UI-007 |
| UN-IMG-001 | SYS-IMS-001, SYS-IMS-002, SYS-IMS-003, SYS-IMS-004, SYS-IMS-005, SYS-IMS-006, SYS-IMS-007, SYS-IMS-008, SYS-IMS-009 |
| UN-IMG-002 | SYS-IMS-014 |
| UN-IMG-003 | SYS-IMS-013, SYS-IMS-023, SYS-IMS-024 |
| UN-IMG-004 | SYS-IMS-015 |
| UN-IMG-005 | SYS-IMS-027, SYS-IMS-029, SYS-IMS-030 |
| UN-IMG-006 | SYS-IMS-028 |
| UN-ISP-001 | SYS-IMS-032, SYS-IMS-033, SYS-IMS-034 |
| UN-ISP-002 | SYS-IMS-031 |
| UN-ISP-003 | SYS-IMS-021, SYS-IMS-022, SYS-IMS-038 |

## 6. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Engineering | Initial SRS derived from specification v2.1 |
| 1.1 | 2026-01-21 | Engineering | Added SYS-UI-008 to SYS-UI-010 (zoom presets, collapsible tools), SYS-ANN-011 (text annotations) |
| 1.2 | 2026-01-22 | Engineering | Added Section 3.13 Image Management Service Requirements (SYS-IMS-001 to SYS-IMS-038) derived from library evaluation report; updated traceability matrix |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
