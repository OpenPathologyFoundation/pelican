# Hazard Analysis

---
document_id: RMF-001
title: Digital Viewer Module — Hazard Analysis
version: 1.3
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

#### RISK-013: Color Inaccuracy Due to ICC Transformation

| Element | Description |
|:--------|:------------|
| **Hazard** | Displayed slide colors differ from physical tissue appearance |
| **Foreseeable Event** | ICC profile applied during tile serving; DICOM-to-TIFF conversion with color corruption |
| **Hazardous Situation** | Pathologist interprets stain intensity or tissue color incorrectly |
| **Harm** | Diagnostic error due to misinterpreted staining patterns |
| **Severity** | 3 (Serious) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm) |
| **Initial Risk** | 9 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-013-A | Disable ICC profile application in tile serving | Inherent Safety | SYS-IMS-046, SYS-IMS-047 |
| RC-013-B | Preserve color fidelity during image conversion | Inherent Safety | SYS-IMS-049 |
| RC-013-C | Avoid JPEG color space corruption (no rgbjpeg flag) | Inherent Safety | Conversion pipeline |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 3 (Low) | ACCEPTABLE — ICC disabled; conversion validated; original pixel values preserved |

---

### 2.6 Orchestrator Bridge Hazards

#### RISK-014: Bridge Failure During Case Switch

| Element | Description |
|:--------|:------------|
| **Hazard** | Case switch message lost during bridge degradation |
| **Foreseeable Event** | Pathologist clicks new case in worklist while bridge is temporarily disconnected (network glitch, orchestrator tab reload) |
| **Hazardous Situation** | Orchestrator displays new case context; viewer still shows old case. Pathologist may document findings against the wrong patient. |
| **Harm** | Case-image mismatch leading to wrong diagnosis |
| **Severity** | 4 (Critical) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm — bridge drops are foreseeable in clinical environments) |
| **Initial Risk** | 12 (High) — UNACCEPTABLE |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-014-A | Viewer retains its own case context independently of the orchestrator; does not accept implicit case changes | Inherent Safety | SYS-BRG-001 |
| RC-014-B | Bridge reconnect handshake validates case context match; mismatch requires explicit user confirmation | Protective | SYS-BRG-006 |
| RC-014-C | FDP persistent header in viewer always shows the viewer's current case, regardless of orchestrator state | Information | SYS-BRG-009, SYS-FDP-006 |
| RC-014-D | Case switch requires explicit ACK from viewer; timeout triggers orchestrator warning | Protective | SYS-OVI-011 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 4 (Low) | ACCEPTABLE — Viewer independently maintains and displays case context; mismatch detected on reconnect; FDP header provides continuous identity verification |

---

#### RISK-015: Viewer JWT Expiry During Bridge Outage

| Element | Description |
|:--------|:------------|
| **Hazard** | Authentication token expires while bridge is disconnected |
| **Foreseeable Event** | Orchestrator tab closed or network partition exceeds JWT lifetime (30+ minutes) |
| **Hazardous Situation** | Viewer cannot refresh tiles, save annotations, or persist review state |
| **Harm** | Loss of diagnostic work (unsaved annotations); workflow disruption |
| **Severity** | 2 (Minor) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm — extended outages during diagnosis are foreseeable) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-015-A | JWT minimum lifetime of 30 minutes (sufficient for typical case examination) | Protective | SYS-OVI-012 |
| RC-015-B | Proactive JWT refresh at 75% of lifetime when bridge is connected | Protective | SYS-OVI-013 |
| RC-015-C | Non-blocking expiry banner with reconnection guidance (no abrupt close) | Information | SYS-BRG-007 |
| RC-015-D | Cached tiles remain viewable after JWT expiry (read-only degradation) | Protective | SYS-BRG-007 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 2 (Low) | ACCEPTABLE — 30-minute token covers most examinations; cached tiles provide read-only access; user warned before expiry |

---

#### RISK-016: Popup Blocker Prevents Viewer Launch

| Element | Description |
|:--------|:------------|
| **Hazard** | Browser popup blocker prevents viewer window from opening |
| **Foreseeable Event** | Hospital-managed browser with strict popup policies; first-time use without popup exception configured |
| **Hazardous Situation** | Pathologist cannot view slides; no clear indication of why |
| **Harm** | Workflow disruption; delayed diagnosis |
| **Severity** | 2 (Minor) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 3 (May cause harm — popup blockers are common in enterprise environments) |
| **Initial Risk** | 6 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-016-A | Popup blocker detection within 3 seconds | Protective | SYS-OVI-002 |
| RC-016-B | User-actionable message with instructions to allow popups for the application origin | Information | SYS-OVI-002 |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 2 (Unlikely) | 4 (Low) | ACCEPTABLE — Detection is immediate; clear user guidance provided; IT deployment can pre-configure popup exception |

---

#### RISK-017: Session Awareness Service Outage Masks Multi-Case Scenario

| Element | Description |
|:--------|:------------|
| **Hazard** | Session Awareness Service unavailable; multi-case warning not generated |
| **Foreseeable Event** | Service crash, deployment failure, network partition to WebSocket endpoint |
| **Hazardous Situation** | Pathologist has cases open in multiple browsers/devices without awareness |
| **Harm** | Increased risk of multi-context case confusion (RISK-002 compound) |
| **Severity** | 4 (Critical) |
| **P1** | 1.0 |
| **P2 (Pre-control)** | 2 (Unlikely — requires both service outage AND multi-case scenario simultaneously) |
| **Initial Risk** | 8 (Medium) |

**Risk Controls**:
| ID | Control | Type | Design Element |
|:---|:--------|:-----|:---------------|
| RC-017-A | FDP Layer 1 operates independently of Session Awareness Service — focus declaration, persistent header, and DX mode all function without Layer 2 | Inherent Safety | SYS-BRG-009, SYS-BRG-010 |
| RC-017-B | Automatic reconnection with exponential backoff minimizes outage window | Protective | SYS-OVI-022 |
| RC-017-C | Session service health monitoring and restart automation (operational) | Protective | Deployment runbook |

| P2 (Post-control) | Residual Risk | Acceptance |
|:------------------|:--------------|:-----------|
| 1 (Very unlikely) | 4 (Low) | ACCEPTABLE — FDP Layer 1 provides primary safety; Layer 2 outage is detectable and auto-recoverable; compound scenario (outage + multi-case) is rare |

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
| RISK-013 | Color Inaccuracy | 9 (Medium) | 3 (Low) | ACCEPTABLE |
| RISK-014 | Bridge Failure During Case Switch | 12 (High) | 4 (Low) | ACCEPTABLE |
| RISK-015 | JWT Expiry During Bridge Outage | 6 (Medium) | 2 (Low) | ACCEPTABLE |
| RISK-016 | Popup Blocker Prevents Viewer | 6 (Medium) | 4 (Low) | ACCEPTABLE |
| RISK-017 | Session Service Outage Masks Multi-Case | 8 (Medium) | 4 (Low) | ACCEPTABLE |

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
| 1.2 | 2026-02-02 | QA | Added RISK-013 (Color Inaccuracy) with risk controls for ICC profile handling and conversion fidelity |
| 1.3 | 2026-02-28 | QA | Added RISK-014 through RISK-017 (Orchestrator Bridge Hazards) covering bridge failure during case switch, JWT expiry during outage, popup blocker, and session service outage |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
