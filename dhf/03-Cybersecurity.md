# Cybersecurity Documentation

---
document_id: SEC-001
title: Digital Viewer Module — Cybersecurity Documentation
version: 1.1
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

## 9. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Security Engineering | Initial cybersecurity documentation |
| 1.1 | 2026-01-22 | Security Engineering | Added tile server threats (T-006 to T-008) and security controls (SC-023 to SC-030) |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
