# Design History File Index

---
document_id: DHF-IDX-001
title: Digital Viewer Module — Design History File Index
version: 1.1
status: ACTIVE
owner: Quality Assurance
created_date: 2026-01-21
effective_date: 2026-01-21
review_cycle: Per Release
references:
  - SOP-DHF-Management (SOP-DHF-001)
  - ISO 13485:2016 (Section 7.3)
  - 21 CFR 820.30 (FDA Design Controls)
  - IEC 62304:2006+A1:2015
---

## 1. Purpose

This document serves as the master index for the Design History File (DHF) of the **Digital Viewer Module** — a component of the Pathology Portal Platform. The DHF contains all design control documentation required for regulatory compliance and quality assurance.

## 2. Product Identification

| Attribute | Value |
|:----------|:------|
| Product Name | Digital Viewer Module |
| Platform | Pathology Portal Platform (Pelican) |
| Classification | Software as a Medical Device (SaMD) — Class II |
| Intended Use | Clinical whole slide image viewing for diagnostic pathology |
| Regulatory Pathway | FDA 510(k) / EU MDR Class IIa |

## 3. DHF Contents

### 3.1 Design Control Documents

| ID | Document | File | Version | Status |
|:---|:---------|:-----|:--------|:-------|
| PURS-001 | Product & User Requirements Specification | [01-PURS.md](./01-PURS.md) | 1.1 | ACTIVE |
| SRS-001 | System Requirements Specification | [02-SRS.md](./02-SRS.md) | 1.2 | ACTIVE |
| SEC-001 | Cybersecurity Documentation | [03-Cybersecurity.md](./03-Cybersecurity.md) | 1.1 | ACTIVE |
| SDS-OVR-001 | Software Design Specification — Overview | [04-SDS/00-SDS-Overview.md](./04-SDS/00-SDS-Overview.md) | 1.0 | ACTIVE |
| SDS-VWR-001 | Viewer Core Architecture | [04-SDS/01-Viewer-Architecture.md](./04-SDS/01-Viewer-Architecture.md) | 1.0 | ACTIVE |
| SDS-FDP-001 | Focus Declaration Protocol Architecture | [04-SDS/02-FDP-Architecture.md](./04-SDS/02-FDP-Architecture.md) | 1.0 | ACTIVE |
| SDS-ANN-001 | Annotation System Architecture | [04-SDS/03-Annotation-Architecture.md](./04-SDS/03-Annotation-Architecture.md) | 1.0 | ACTIVE |
| SDS-TEL-001 | Telemetry Governance Architecture | [04-SDS/04-Telemetry-Architecture.md](./04-SDS/04-Telemetry-Architecture.md) | 1.0 | ACTIVE |
| SDS-TLS-001 | Tile Server (Image Management Service) Architecture | [04-SDS/05-TileServer-Architecture.md](./04-SDS/05-TileServer-Architecture.md) | 1.0 | ACTIVE |
| RMP-001 | Risk Management Plan | [05a-Risk-Plan.md](./05a-Risk-Plan.md) | 1.0 | ACTIVE |
| RMF-001 | Hazard Analysis | [05b-Hazard-Analysis.md](./05b-Hazard-Analysis.md) | 1.1 | ACTIVE |
| VVP-001 | Verification & Validation Plan | [06-VVP.md](./06-VVP.md) | 1.1 | ACTIVE |

### 3.2 Source Specification

| Document | Location | Description |
|:---------|:---------|:------------|
| Digital Viewer Module Specification v2.1 | [docs/digital-viewer-module-specification-v2.1.md](../docs/digital-viewer-module-specification-v2.1.md) | Primary design specification |
| Library Evaluation Report | [docs/evaluation_report.md](../docs/evaluation_report.md) | large_image library evaluation for tile server |

### 3.3 Release Records

| Release | Date | Record |
|:--------|:-----|:-------|
| *No releases yet* | — | — |

## 4. Traceability Summary

```
User Needs (PURS)
    │
    ▼ Trace: UN-### → SYS-###
System Requirements (SRS)
    │
    ▼ Trace: SYS-### → MOD-###
Design Specifications (SDS)
    │
    ▼ Trace: MOD-### → TEST-###
Verification & Validation (VVP)
```

## 5. Document Control

All documents in this DHF are version-controlled in Git. Changes require:
1. Pull Request with detailed rationale
2. Independent review (reviewer cannot be author)
3. CI validation (if applicable)
4. Approval via PR merge

## 6. Regulatory References

| Standard | Applicability |
|:---------|:--------------|
| ISO 13485:2016 | Quality management systems — Design and development (7.3) |
| ISO 14971:2019 | Risk management for medical devices |
| IEC 62304:2006+A1:2015 | Medical device software lifecycle |
| 21 CFR 820.30 | FDA Design Controls |
| EU MDR 2017/745 | Medical Device Regulation |
| FDA Guidance | Content of Premarket Submissions for Software |

## 7. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | QA | Initial DHF index creation |
| 1.1 | 2026-01-22 | QA | Added SDS-TLS-001 (Tile Server Architecture); updated document versions |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
