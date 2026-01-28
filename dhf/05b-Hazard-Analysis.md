# Hazard Analysis

---
document_id: RMF-001
title: Digital Viewer Module — Hazard Analysis
version: 1.1
status: ACTIVE
owner: Quality Assurance
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: RMP-001 (Risk Management Plan), SRS-001 (System Requirements)
trace_destination: VVP-001 (Verification & Validation Plan)
references:
  - ISO 14971:2019 (Risk Management for Medical Devices)
  - Digital Viewer Module Specification v2.1 (Section 17)
---

## 1. Purpose

This document identifies hazards, analyzes foreseeable sequences of events leading to harm, evaluates risk levels, and documents risk controls and residual risk for the Digital Viewer Module.

## 2. Hazard Analysis Matrix

### 2.1 Clinical Hazards

#### RISK-001: Case-Image Mismatch

| Element | Description |
|:--------|:------------|
| **Hazard** | Wrong patient case displayed in viewer |
| **Foreseeable Event** | User switches between cases rapidly; multiple windows open |
| **Hazardous Situation** | Pathologist examines slides from Patient A while documenting Patient B |
| **Harm** | Wrong diagnosis assigned to wrong patient; delayed/incorrect treatment |
| **Severity** | 4 (Critical) |
| **P1** | 1.0 (Software could allow this) |
| **P2 (Pre-control)** | 4 (Likely — no safeguards) |
| **Initial Risk** | 16 (Critical) — UNACCEPTABLE |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-001-A | Focus Declaration Protocol — banner on focus | Information | SYS-FDP-001, SYS-FDP-002 |
| RC-001-B | Persistent case ID header | Information | SYS-FDP-006, SYS-FDP-007 |
| RC-001-C | Case switch confirmation prompt | Protective | SYS-SES-005 |
| RC-001-D | Multi-case warning (Layer 2) | Information | SYS-SES-004 |
| RC-001-E | Non-collapsible header in DX Mode | Protective | SYS-FDP-008 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 8 (Medium) | ALARP — Multiple redundant safeguards; user must bypass focus banner, persistent header, AND confirmation prompt |

---

#### RISK-002: Multi-Context Case Confusion

| Element | Description |
|:--------|:------------|
| **Hazard** | User has multiple cases open across different browsers/devices |
| **Foreseeable Event** | Pathologist opens Case A in Browser 1, Case B in Browser 2 |
| **Hazardous Situation** | Work performed on wrong case due to context switching |
| **Harm** | Incorrect annotation, review state, or report content |
| **Severity** | 4 (Critical) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm) |
| **Initial Risk** | 12 (High) — UNACCEPTABLE |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-002-A | Session Awareness Service registration | Protective | SYS-SES-001, SYS-SES-002 |
| RC-002-B | Multi-case warning broadcast | Information | SYS-SES-004 |
| RC-002-C | Persistent multi-case indicator | Information | SYS-SES-004 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 8 (Medium) | ALARP — Session service detects multi-case; user explicitly acknowledges warning |

---

#### RISK-003: Measurement Error — Uncalibrated Scale

| Element | Description |
|:--------|:------------|
| **Hazard** | Measurement made on slide with unknown/invalid MPP |
| **Foreseeable Event** | Slide scanned with incorrect metadata; manual import |
| **Hazardous Situation** | Tumor depth or margin reported incorrectly |
| **Harm** | Incorrect staging; inappropriate treatment selection |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 4 (Likely) |
| **Initial Risk** | 12 (High) — UNACCEPTABLE |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-003-A | Display MPP and calibration state | Information | SYS-MSR-004, SYS-MSR-005 |
| RC-003-B | Block measurements on unknown-scale (DX Mode) | Protective | SYS-MSR-007 |
| RC-003-C | Calibration indicator with validation state | Information | SYS-DXM-003 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 6 (Medium) | ALARP — Measurement blocked on unknown scale; calibration prominently displayed |

---

### 2.2 Data Governance Hazards

#### RISK-004: Navigation Telemetry Retention

| Element | Description |
|:--------|:------------|
| **Hazard** | Navigation patterns retained and discoverable |
| **Foreseeable Event** | Viewing behavior logged to server; subpoenaed in litigation |
| **Hazardous Situation** | "Diligence metrics" constructed from data; used against pathologist |
| **Harm** | Professional liability; perverse incentives for performative viewing |
| **Severity** | 3 (Serious) — Professional harm |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 5 (Very likely — if data exists, it will be used) |
| **Initial Risk** | 15 (Critical) — UNACCEPTABLE |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-004-A | No server endpoint for Tier 1 data | Inherent Safety | SYS-TEL-002 |
| RC-004-B | Tier 1 purge on session close | Inherent Safety | SYS-TEL-003 |
| RC-004-C | Tier 3 schema excludes behavioral fields | Inherent Safety | SYS-TEL-004 |
| RC-004-D | No duration calculation | Inherent Safety | SYS-TEL-005 |
| RC-004-E | "Opened" state is session-only | Inherent Safety | SYS-RVW-004, SYS-RVW-005 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE — Data cannot be produced because it doesn't exist |

---

### 2.3 Technical Risks

#### RISK-005: Image Rendering Failure

| Element | Description |
|:--------|:------------|
| **Hazard** | Tiles fail to load; image unavailable |
| **Foreseeable Event** | Network issues; tile server overload |
| **Hazardous Situation** | Pathologist cannot complete examination |
| **Harm** | Delayed diagnosis; workflow disruption |
| **Severity** | 2 (Minor) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-005-A | Clear error messaging | Information | SYS-ERR-001, SYS-ERR-002 |
| RC-005-B | Retry controls | Protective | SYS-ERR-001 |
| RC-005-C | Tile caching | Protective | SYS-VWR-008 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 4 (Low) | ACCEPTABLE |

---

#### RISK-006: Superseded Scan Not Detected

| Element | Description |
|:--------|:------------|
| **Hazard** | User examines outdated scan without awareness |
| **Foreseeable Event** | Slide rescanned; user accesses old link |
| **Hazardous Situation** | Diagnosis based on inferior image quality |
| **Harm** | Potentially missed findings |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm) |
| **Initial Risk** | 9 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-006-A | Supersession notice | Information | SYS-ERR-004 |
| RC-006-B | Option to view current scan | Protective | SYS-ERR-004 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 6 (Medium) | ALARP — User explicitly informed; can navigate to current |

---

### 2.4 Cybersecurity Hazards

#### RISK-007: Unauthorized Case Access

| Element | Description |
|:--------|:------------|
| **Hazard** | Attacker views patient slides without authorization |
| **Foreseeable Event** | Session hijacking; JWT forgery |
| **Hazardous Situation** | PHI disclosure |
| **Harm** | Privacy breach; regulatory violation |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely — requires sophisticated attack) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-007-A | Case-scoped JWT with expiration | Protective | SC-001, SC-002 |
| RC-007-B | Capability-based authorization | Protective | SC-003 |
| RC-007-C | HTTPS/TLS 1.3 required | Protective | SC-004 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE |

---

#### RISK-008: Annotation Tampering

| Element | Description |
|:--------|:------------|
| **Hazard** | Malicious modification of clinical annotations |
| **Foreseeable Event** | API injection; compromised account |
| **Hazardous Situation** | False annotation affects diagnosis |
| **Harm** | Incorrect clinical decision |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-008-A | Event-sourced storage with audit trail | Protective | SC-006 |
| RC-008-B | Owner-only delete | Protective | SYS-ANN-007 |
| RC-008-C | Input validation | Protective | SC-015 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE |

---

### 2.5 Image Management Service Hazards

#### RISK-009: Tile Server Unavailability

| Element | Description |
|:--------|:------------|
| **Hazard** | Tile server fails to respond; images cannot be viewed |
| **Foreseeable Event** | Server overload, network partition, deployment failure |
| **Hazardous Situation** | Pathologist cannot examine slides for diagnosis |
| **Harm** | Delayed diagnosis; workflow disruption |
| **Severity** | 2 (Minor) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-009-A | Health check endpoint for monitoring | Protective | SYS-IMS-018 |
| RC-009-B | Source caching to reduce load | Protective | SYS-IMS-031 |
| RC-009-C | Tile caching (Redis/Memcached) | Protective | SYS-IMS-032 |
| RC-009-D | Clear error messaging to user | Information | SYS-ERR-001, SYS-ERR-002 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 4 (Low) | ACCEPTABLE — Caching reduces server load; health monitoring enables rapid response |

---

#### RISK-010: Incorrect MPP Metadata

| Element | Description |
|:--------|:------------|
| **Hazard** | Tile server returns incorrect microns-per-pixel (MPP) values |
| **Foreseeable Event** | Scanner metadata error; source file corruption; plugin bug |
| **Hazardous Situation** | Measurements calculated with wrong scale factor |
| **Harm** | Incorrect tumor staging; inappropriate treatment decisions |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely — metadata typically reliable) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-010-A | MPP sourced directly from image file | Inherent Safety | SYS-IMS-023, SC-027 |
| RC-010-B | Calibration validation state displayed | Information | SYS-MSR-005 |
| RC-010-C | Block measurements on unknown scale | Protective | SYS-MSR-007 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE — MPP from source file; user sees validation state |

---

#### RISK-011: Unsupported Image Format

| Element | Description |
|:--------|:------------|
| **Hazard** | Slide cannot be opened due to unsupported or corrupted format |
| **Foreseeable Event** | New scanner format; file corruption during transfer |
| **Hazardous Situation** | Pathologist cannot examine slide |
| **Harm** | Delayed diagnosis |
| **Severity** | 2 (Minor) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely — major formats supported) |
| **Initial Risk** | 4 (Low) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-011-A | Multi-format support via plugins | Inherent Safety | SYS-IMS-001 through SYS-IMS-009 |
| RC-011-B | Clear error message for unsupported format | Information | SYS-ERR-001 |
| RC-011-C | Physical glass slide request workflow | Protective | UN-INT-003 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 2 (Low) | ACCEPTABLE — All major pathology formats supported |

---

#### RISK-012: Path Traversal Attack

| Element | Description |
|:--------|:------------|
| **Hazard** | Attacker accesses arbitrary files via manipulated image_id |
| **Foreseeable Event** | Directory traversal injection in API request |
| **Hazardous Situation** | Unauthorized access to system files or other patient images |
| **Harm** | Data breach; privacy violation |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely — requires knowledge of attack) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-012-A | Image ID allowlist validation | Protective | SC-023 |
| RC-012-B | Path traversal sequence rejection | Protective | SC-024 |
| RC-012-C | No filesystem path construction from user input | Inherent Safety | SC-023 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE — Input validation prevents traversal |

---

## 3. Risk Summary

| Risk ID | Hazard | Initial Risk | Residual Risk | Status |
|:--------|:-------|:-------------|:--------------|:-------|
| RISK-001 | Case-Image Mismatch | 16 (Critical) | 8 (Medium) | ALARP |
| RISK-002 | Multi-Context Confusion | 12 (High) | 8 (Medium) | ALARP |
| RISK-003 | Measurement Error | 12 (High) | 6 (Medium) | ALARP |
| RISK-004 | Navigation Telemetry Retention | 15 (Critical) | 3 (Low) | ACCEPTABLE |
| RISK-005 | Image Rendering Failure | 6 (Medium) | 4 (Low) | ACCEPTABLE |
| RISK-006 | Superseded Scan | 9 (Medium) | 6 (Medium) | ALARP |
| RISK-007 | Unauthorized Access | 6 (Medium) | 3 (Low) | ACCEPTABLE |
| RISK-008 | Annotation Tampering | 6 (Medium) | 3 (Low) | ACCEPTABLE |
| RISK-009 | Tile Server Unavailability | 6 (Medium) | 4 (Low) | ACCEPTABLE |
| RISK-010 | Incorrect MPP Metadata | 6 (Medium) | 3 (Low) | ACCEPTABLE |
| RISK-011 | Unsupported Image Format | 4 (Low) | 2 (Low) | ACCEPTABLE |
| RISK-012 | Path Traversal Attack | 6 (Medium) | 3 (Low) | ACCEPTABLE |

## 4. Overall Benefit-Risk Conclusion

The Digital Viewer Module provides significant clinical benefit by enabling digital pathology workflows with:
- Efficient whole slide image examination
- Calibrated measurements
- Collaborative annotations
- Protected navigation telemetry

All identified risks have been reduced to acceptable or ALARP levels. The overall benefit of the device exceeds the total residual risk.

## 5. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | QA | Initial Hazard Analysis |
| 1.1 | 2026-01-22 | QA | Added Image Management Service hazards (RISK-009 to RISK-012) |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
