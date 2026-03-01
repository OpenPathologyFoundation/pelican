# Cybersecurity Documentation

---
document_id: SEC-001
title: Digital Viewer Module — Cybersecurity Documentation
version: 1.2
status: ACTIVE
owner: Security Engineering
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: SRS-001 (System Requirements), Digital Viewer Specification v2.1
trace_destination: 05b-Hazard-Analysis.md
references:
  - FDA Guidance: Cybersecurity in Medical Devices (2023)
  - IEC 62443 (Industrial Cybersecurity)
  - NIST Cybersecurity Framework
  - HIPAA Security Rule
---

## 1. Purpose

This document defines the cybersecurity threat model, security controls, and risk mitigations for the Digital Viewer Module. It supports compliance with FDA cybersecurity guidance and institutional security requirements.

## 2. System Security Context

### 2.1 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRUST BOUNDARY: Browser                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     SvelteKit Frontend                                  │ │
│  │  • Tier 1 ephemeral data (browser-only)                                │ │
│  │  • User credentials never stored locally                               │ │
│  │  • JWT tokens stored in memory only                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS/WSS (TLS 1.3)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY: Backend Services                     │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │ Portal API         │  │ Session Service    │  │ Tile Server        │   │
│  │ (Spring Boot)      │  │ (WebSocket)        │  │ (Python/large_image│   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY: Data Stores                          │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │ PostgreSQL         │  │ Redis (Session)    │  │ Image Storage      │   │
│  │ (Annotations)      │  │                    │  │ (S3/NFS)           │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Classification

| Data Type | Classification | Tier | Retention | Encryption |
|:----------|:---------------|:-----|:----------|:-----------|
| Patient identifiers | PHI | Tier 2/3 | Per policy | At rest + transit |
| Case metadata | PHI | Tier 2 | Case lifecycle | At rest + transit |
| Slide images/tiles | PHI | — | Permanent | At rest + transit |
| Annotations | PHI | Tier 2 | Case lifecycle | At rest + transit |
| Navigation telemetry | Non-PHI | Tier 1 | Session only | Transit only |
| Voice transcripts | PHI | Tier 1 | Session only | Transit only |
| Audit logs | Non-PHI | Tier 3 | 7 years | At rest + transit |

## 3. Threat Model

### 3.1 STRIDE Analysis

| Threat Category | Applicable Threats | Impact | Likelihood |
|:----------------|:-------------------|:-------|:-----------|
| **Spoofing** | Session hijacking, JWT forgery | High | Medium |
| **Tampering** | Annotation modification, measurement falsification | High | Low |
| **Repudiation** | Denial of clinical actions | Medium | Low |
| **Information Disclosure** | PHI exposure, telemetry leakage | Critical | Medium |
| **Denial of Service** | Tile server overload, resource exhaustion | Medium | Medium |
| **Elevation of Privilege** | Unauthorized annotation sharing, admin access | High | Low |

### 3.2 Threat Scenarios

#### T-001: Unauthorized Case Access
**Description**: Attacker attempts to view slides from cases they are not authorized to access.
**Attack Vector**: API manipulation, session hijacking, JWT forgery
**Controls**: SC-001, SC-002, SC-003

#### T-002: PHI Exposure via Telemetry
**Description**: Navigation patterns or viewing behavior inadvertently creates discoverable PHI.
**Attack Vector**: Log aggregation, subpoena, data mining
**Controls**: SC-010, SC-011, SC-012

#### T-003: Annotation Tampering
**Description**: Malicious modification of clinical annotations.
**Attack Vector**: API injection, XSS, CSRF
**Controls**: SC-006, SC-007, SC-008

#### T-004: Session Hijacking
**Description**: Attacker gains control of authenticated session.
**Attack Vector**: XSS, network interception, session fixation
**Controls**: SC-001, SC-004, SC-005

#### T-005: Measurement Manipulation
**Description**: Attacker falsifies measurement values affecting diagnosis.
**Attack Vector**: Client-side tampering, API manipulation
**Controls**: SC-006, SC-007, SC-009

#### T-006: Tile Server Path Traversal
**Description**: Attacker attempts to access arbitrary files via manipulated image_id.
**Attack Vector**: Directory traversal sequences (../) in image_id parameter
**Controls**: SC-023, SC-024

#### T-007: Tile Server Denial of Service
**Description**: Attacker overwhelms tile server with requests causing service degradation.
**Attack Vector**: High-volume tile requests, large region extractions
**Controls**: SC-021, SC-025, SC-026

#### T-008: Metadata Spoofing
**Description**: Attacker manipulates MPP metadata causing measurement errors.
**Attack Vector**: Man-in-the-middle, compromised image source
**Controls**: SC-027, SC-028

#### T-009: Cross-Window Message Injection
**Description**: Malicious script in another tab sends forged postMessage events to the viewer window, attempting to inject false case context, trigger unauthorized case switches, or extract PHI.
**Attack Vector**: XSS in a co-resident page; malicious browser extension; compromised third-party iframe
**Controls**: SC-031, SC-032, SC-033

#### T-010: WSI Image Tampering on Storage
**Description**: Attacker (or silent corruption) modifies whole slide image files on the storage volume, introducing diagnostic artifacts or replacing tissue images.
**Attack Vector**: Compromised storage account; ransomware; bit rot on aging media; insider threat with filesystem access
**Controls**: SC-034, SC-035, SC-036

#### T-011: Metadata-Only Attack via Sidecar Files
**Description**: If integrity hashes were stored as sidecar files alongside images, an attacker with storage access could replace both the image and its hash simultaneously, bypassing tamper detection.
**Attack Vector**: Storage-level compromise where attacker has write access to the image volume
**Controls**: SC-034, SC-037

#### T-012: Bridge JWT Interception
**Description**: JWT provisioned from orchestrator to viewer via postMessage is intercepted by a malicious co-resident script and used to access tile server or annotation APIs.
**Attack Vector**: XSS in orchestrator page; browser extension with content script injection
**Controls**: SC-031, SC-033, SC-038

## 4. Security Controls

### 4.1 Authentication and Authorization

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-001 | Portal-issued case-scoped JWT | JWT contains case permissions; validated on each API call | Test |
| SC-002 | JWT expiration and refresh | Short-lived tokens (15 min); refresh via Portal session | Test |
| SC-003 | Capability-based authorization | GetPermissions API enforces view/annotate/share/export rights | Test |
| SC-004 | HTTPS/TLS 1.3 required | All communications encrypted; HSTS enforced | Analysis |
| SC-005 | Secure session management | httpOnly cookies; SameSite=Strict; no local storage of tokens | Inspection |

### 4.2 Data Integrity

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-006 | Event-sourced annotation storage | Immutable append-only log; current state materialized | Analysis |
| SC-007 | Client-generated event_id for idempotency | Deduplication prevents replay attacks | Test |
| SC-008 | Soft-delete only | No hard deletion except compliance process | Test |
| SC-009 | Measurement calibration binding | MPP from IMS; cannot be client-overridden in Phase 1 | Test |

### 4.3 Privacy and Telemetry Governance

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-010 | No server endpoint for Tier 1 data | Navigation/tile telemetry cannot be submitted | Code Review |
| SC-011 | Tier 1 purge on session close | Browser storage cleared; no persistence | Test |
| SC-012 | Tier 3 schema excludes behavioral fields | slide_id, coordinates, duration excluded from audit | Test |
| SC-013 | Voice transcript ephemeral | Transcripts processed and discarded (Tier 1) | Test |
| SC-014 | HIPAA-compliant transcription | Azure AI under BAA; no data retention by provider | Analysis |

### 4.4 Input Validation

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-015 | API input validation | All inputs validated against schema; reject malformed | Test |
| SC-016 | XSS prevention | Content Security Policy; output encoding | Test |
| SC-017 | SQL injection prevention | Parameterized queries; ORM usage | Test |
| SC-018 | Path traversal prevention | Slide/tile IDs validated; no direct filesystem access | Test |

### 4.5 Availability

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-019 | Graceful degradation | Voice/AI unavailable → viewer remains functional | Test |
| SC-020 | Error handling | Service failures surfaced as user-friendly messages | Test |
| SC-021 | Rate limiting | API rate limits prevent resource exhaustion | Test |
| SC-022 | Tile caching | Aggressive caching reduces server load | Test |

### 4.6 Tile Server Security

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-023 | Image ID validation | Allowlist validation; no filesystem path construction from user input | Test |
| SC-024 | Path traversal prevention | Sanitize image_id; reject sequences containing ".." or absolute paths | Test |
| SC-025 | Region extraction limits | Maximum region size enforced; reject requests exceeding threshold | Test |
| SC-026 | Source cache limits | Maximum open TileSources limited; LRU eviction | Test |
| SC-027 | Metadata integrity | MPP values sourced from original image files only | Analysis |
| SC-028 | HTTPS enforcement | All tile server endpoints require HTTPS; HSTS enabled | Test |
| SC-029 | Tile server authentication | JWT validation on all endpoints; case-scoped access | Test |
| SC-030 | CORS configuration | Configurable origin allowlist; default restrictive | Test |

### 4.7 Cross-Window Bridge Security

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-031 | postMessage origin validation | OrchestratorBridge validates `event.origin` against configured allowlist on every received message; messages from unexpected origins are silently dropped | Test |
| SC-032 | Typed message envelope with sequence numbers | All bridge messages use a typed envelope (`{type, seq, payload}`) enabling detection of replayed, out-of-order, or injected messages | Analysis |
| SC-033 | No credentials in postMessage payload | JWT is transmitted via a dedicated `JWT_REFRESH` message type; viewer stores token in memory only; token is never placed in URL parameters, localStorage, or sessionStorage | Inspection |
| SC-038 | JWT memory-only storage in viewer | Viewer holds JWT exclusively in a JavaScript closure variable; no persistence to any browser storage API; token cleared on window close | Test |

### 4.8 WSI Image Integrity

| ID | Control | Implementation | Verification |
|:---|:--------|:---------------|:-------------|
| SC-034 | HMAC-SHA256 integrity verification | Each slide's integrity hash is computed at ingestion using `HMAC-SHA256(server_key, file_bytes)` and stored in the database `slides.hmac` column | Test |
| SC-035 | Database-only hash storage | HMAC digests are stored exclusively in the database, never as sidecar files on the storage volume; this prevents an attacker with storage access from replacing both image and hash simultaneously | Analysis |
| SC-036 | Background integrity sweep | A configurable background job recomputes HMAC for all stored slides and compares against database values; mismatches generate alerts with slide ID, expected vs actual hash, and file size delta | Test |
| SC-037 | HMAC key separation from storage | The HMAC secret key is provisioned via environment variable (`LARGE_IMAGE_HMAC_KEY`), never stored in the database, version control, or on the image storage volume; minimum key length 256 bits | Inspection |

## 5. Security Requirements Traceability

| Security Control | Related System Requirements |
|:-----------------|:----------------------------|
| SC-001, SC-002, SC-003 | SYS-INT-002 |
| SC-010, SC-011, SC-012, SC-013 | SYS-TEL-001, SYS-TEL-002, SYS-TEL-003, SYS-TEL-004, SYS-TEL-005, SYS-VOC-003 |
| SC-006, SC-007, SC-008 | SYS-ANN-002, SYS-ANN-007, SYS-ANN-008 |
| SC-014 | SYS-VOC-004 |
| SC-019, SC-020 | SYS-VOC-005, SYS-ERR-001, SYS-ERR-002 |
| SC-023, SC-024 | SYS-IMS-010, SYS-IMS-011, SYS-IMS-012, SYS-IMS-016 |
| SC-025, SC-026 | SYS-IMS-031, SYS-IMS-032 |
| SC-027 | SYS-IMS-023, SYS-MSR-006 |
| SC-028, SC-029 | SYS-IMS-035, SYS-IMS-036 |
| SC-030 | SYS-IMS-035 |
| SC-031, SC-032, SC-033 | SYS-BRG-001, SYS-BRG-008 |
| SC-034, SC-035, SC-036, SC-037 | SDS-STR-001 §5 (Integrity Verification) |
| SC-038 | SYS-BRG-008, SYS-OVI-014 |

## 6. Vulnerability Management

### 6.1 Dependency Scanning
- Automated SBOM generation (npm audit, pip-audit, OWASP Dependency-Check)
- CI/CD integration for continuous scanning
- Critical/High vulnerabilities block release

### 6.2 Penetration Testing
- Annual third-party penetration testing
- OWASP Top 10 coverage
- Findings tracked to remediation

### 6.3 Incident Response
- Security incident classification per institutional policy
- PHI breach notification per HIPAA requirements
- Post-incident review and control updates

## 7. Compliance Mapping

| Framework | Requirement | Controls |
|:----------|:------------|:---------|
| HIPAA Security Rule | Access Control (§ 164.312(a)) | SC-001, SC-002, SC-003 |
| HIPAA Security Rule | Audit Controls (§ 164.312(b)) | SC-006, SC-007, Tier 3 logging |
| HIPAA Security Rule | Transmission Security (§ 164.312(e)) | SC-004 |
| FDA Cybersecurity | Authentication | SC-001, SC-002 |
| FDA Cybersecurity | Authorization | SC-003 |
| FDA Cybersecurity | Content Validation | SC-015, SC-016, SC-017, SC-018 |
| FDA Cybersecurity | Update and Patch | Dependency scanning |

## 8. Residual Risks

| Risk | Residual Level | Acceptance Rationale |
|:-----|:---------------|:---------------------|
| Sophisticated JWT attack | Low | Short expiration; refresh via Portal; institutional SSO |
| Client-side tampering | Low | Server-side validation; event sourcing; audit trail |
| Zero-day browser vulnerability | Low | Standard browser security model; rapid patch deployment |
| Cross-window message injection | Low | Origin validation on every message; typed envelopes with sequence numbers; no credentials in URL/storage |
| WSI image tampering (storage compromise) | Low | HMAC-SHA256 with server-held key; database-only hash storage; background verification sweep |
| HMAC key compromise | Low | Key separated from storage and database; rotation strategy with dual-key verification; operational monitoring |
| Bridge JWT interception via XSS | Low | Memory-only JWT storage; CSP enforcement; origin validation prevents exfiltration via postMessage |

## 9. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Security Engineering | Initial cybersecurity documentation |
| 1.1 | 2026-01-22 | Security Engineering | Added tile server threats (T-006 to T-008) and security controls (SC-023 to SC-030) |
| 1.2 | 2026-02-28 | Security Engineering | Added cross-window bridge threats (T-009, T-012), WSI integrity threats (T-010, T-011), and security controls (SC-031 to SC-038) |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
