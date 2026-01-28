# Product & User Requirements Specification (PURS)

---
document_id: PURS-001
title: Digital Viewer Module — Product & User Requirements
version: 1.1
status: ACTIVE
owner: Product Management
created_date: 2026-01-21
effective_date: 2026-01-21
trace_source: Stakeholder interviews, clinical workflows, design sessions
trace_destination: SRS-001 (System Requirements Specification)
references:
  - Digital Viewer Module Specification v2.1
  - ISO 13485:2016 (Section 7.3.2 — Design Inputs)
---

## 1. Purpose

This document captures the high-level, non-technical user needs for the Digital Viewer Module. These requirements represent stakeholder expectations and clinical workflow requirements that drive the technical design.

## 2. Intended Use

The Digital Viewer Module enables pathologists to examine digitized whole slide images (WSI) for clinical diagnosis. It is intended for use by licensed medical professionals in diagnostic pathology workflows within accredited laboratory settings.

## 3. User Profiles

### 3.1 Primary Users

| User Type | Representative | Key Characteristics |
|:----------|:---------------|:--------------------|
| Senior Attending Pathologist | Dr. Richard Okonkwo | High volume, minimal UI, maximum speed |
| Subspecialty Attending | Dr. Margaret Chen, Dr. Kwame Asante | Measurement-focused, comparison views |
| Resident/Fellow | Dr. Priya Sharma | Learning-oriented, annotation-heavy |
| Pathology Informaticist | Dr. Samuel Adeyemi | Standards-focused, integration-aware |

## 4. User Needs

### 4.1 Core Viewing Experience

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-VWR-001 | The user needs the slide image to be the primary focus with minimal interface distractions | Mimics microscope experience; reduces cognitive load during diagnosis | Critical |
| UN-VWR-002 | The user needs interaction latency to feel instantaneous during navigation | Delays disrupt diagnostic flow and reduce efficiency | Critical |
| UN-VWR-003 | The user needs to pan and zoom smoothly across the entire slide at any magnification | Essential for examining tissue at multiple scales | Critical |
| UN-VWR-004 | The user needs tools to appear only when needed and hide when not in use | Reduces visual clutter; supports progressive disclosure | High |
| UN-VWR-005 | The user needs to view multiple slides from the same case in a gallery format | Cases often have multiple parts/blocks requiring review | High |
| UN-VWR-006 | The user needs side-by-side comparison of current and prior specimens | Comparison is essential for progression assessment | Medium |

### 4.2 Case Safety and Identity

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-SAF-001 | The user needs absolute clarity about which patient case is being examined | Case-image mismatch is a critical patient safety risk | Critical |
| UN-SAF-002 | The user needs visible case identification at all times during viewing | Prevents inadvertent work on wrong patient | Critical |
| UN-SAF-003 | The user needs a clear announcement when switching between cases | Reduces risk of context confusion | Critical |
| UN-SAF-004 | The user needs a warning when multiple cases are open simultaneously | Multi-case scenarios increase mismatch risk | High |
| UN-SAF-005 | The user needs explicit confirmation before switching cases while viewing | Prevents accidental case switches | High |

### 4.3 Measurements and Calibration

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-MSR-001 | The user needs to make calibrated measurements on slides (length, area) | Tumor depth, margin distance are diagnostic criteria | Critical |
| UN-MSR-002 | The user needs clear indication of measurement calibration status | Unknown-scale measurements may lead to diagnostic error | Critical |
| UN-MSR-003 | The user needs measurements in clinically meaningful units (mm, um) | Direct use in diagnostic reports | High |
| UN-MSR-004 | The user needs confidence that measurements are accurate to scanner specifications | Measurement error could affect treatment decisions | High |

### 4.4 Annotations

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-ANN-001 | The user needs to mark regions of interest on slides | Essential for communication, teaching, and documentation | High |
| UN-ANN-002 | The user needs annotations to persist across viewing sessions | Annotations support continuity of care and case review | High |
| UN-ANN-003 | The user needs a private annotation space not visible to others | Supports learning without scrutiny; personal notes | High |
| UN-ANN-004 | The user needs to share annotations selectively with colleagues | Supports consultation and second opinions | Medium |
| UN-ANN-005 | The user needs annotations to never involuntarily appear on images | False annotations could mislead diagnosis | High |
| UN-ANN-006 | The user needs to delete their own annotations | Allows correction of errors | Medium |

### 4.5 Review State and Workflow

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-RVW-001 | The user needs to explicitly declare when slide review is complete | Review state must be a conscious attestation, not inferred | High |
| UN-RVW-002 | The user needs to flag slides for attending review | Supports resident-attending workflow | High |
| UN-RVW-003 | The user needs review states to reflect deliberate decisions, not navigation | Navigation patterns should not be discoverable as "diligence metrics" | Critical |
| UN-RVW-004 | The user needs assurance that viewing patterns are not tracked as performance metrics | Prevents perverse incentives for performative viewing | Critical |

### 4.6 Conversational Interaction

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-VOC-001 | The user needs to navigate and control the viewer using voice commands | Supports hands-free operation during complex workflows | Medium |
| UN-VOC-002 | The user needs voice interaction to be optional and configurable | Some users prefer manual controls; some environments unsuitable | High |
| UN-VOC-003 | The user needs voice transcripts to not be retained after the session | Privacy protection; prevents discoverable artifacts | High |

### 4.7 Clinical Mode Requirements

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-DXM-001 | The user needs a clinical mode that enforces patient safety constraints | Ensures appropriate safeguards during sign-out | High |
| UN-DXM-002 | The user needs clinical mode to be the default for worklist cases | Reduces risk of accidental non-compliant workflows | High |
| UN-DXM-003 | The user needs the ability to disable clinical mode with attestation | Supports education, research, and training contexts | Medium |

### 4.8 Integration and Interoperability

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-INT-001 | The user needs the viewer to integrate with existing LIS workflows | Seamless case access without duplicate data entry | High |
| UN-INT-002 | The user needs measurements to flow into diagnostic reports | Reduces transcription errors; improves efficiency | Medium |
| UN-INT-003 | The user needs the ability to request physical glass slides from within the viewer | Digital examination may be insufficient for some cases | Medium |

### 4.9 Physical Environment

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-ENV-001 | The user needs the viewer to be optimized for dual-monitor workstations | Standard pathology workstation configuration | High |
| UN-ENV-002 | The user needs single-monitor operation to be supported | Not all environments have dual monitors | Medium |

### 4.10 Image Format Support

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-IMG-001 | The user needs to view slides scanned in multiple WSI formats (SVS, NDPI, MRXS, CZI, TIFF, OME-TIFF, DICOM) | Different scanners produce different proprietary formats; laboratories have mixed equipment from various vendors | Critical |
| UN-IMG-002 | The user needs access to associated images (label, macro thumbnail) embedded in slide files | Label image helps verify physical slide matches digital; macro provides tissue orientation context | High |
| UN-IMG-003 | The user needs magnification metadata (microns-per-pixel) embedded in slides to be available | Calibrated measurements require accurate pixel-to-micron conversion from scanner metadata | Critical |
| UN-IMG-004 | The user needs thumbnails for quick slide preview in gallery views | Reduces time to identify correct slide in multi-slide cases | High |
| UN-IMG-005 | The user needs multi-channel fluorescence support for IF/IHC slides | Multiplex immunofluorescence staining requires channel selection, false-color compositing, and intensity adjustment | Medium |
| UN-IMG-006 | The user needs Z-stack support for thick section or confocal images | Some specimens require examination at multiple focal planes | Low |

### 4.11 Image Service Performance

| ID | User Need Statement | Rationale/Clinical Justification | Priority |
|:---|:--------------------|:---------------------------------|:---------|
| UN-ISP-001 | The user needs tiles to load quickly even for very large slides (>100,000 x 100,000 pixels) | Large pathology slides can exceed 10GB; slow loading disrupts diagnostic flow | Critical |
| UN-ISP-002 | The user needs the system to remain responsive when viewing multiple slides concurrently | Multi-slide case review requires switching between slides without reloading delays | High |
| UN-ISP-003 | The user needs tile serving to be cost-effective in cloud deployments | Healthcare organizations increasingly use cloud infrastructure; excessive storage/bandwidth costs limit adoption | High |

## 5. Stakeholder Quotes

> "Whatever you build — make sure I can still feel the glass. That connection to the material. Don't let the technology get in the way of the pathology."
> — Dr. Richard Okonkwo, Senior Attending

> "I use the measurement tool constantly. But I'm not using the polygon annotation tool."
> — Dr. Margaret Chen, Subspecialty Attending

> "When I was learning, I needed to *find* the features. Discoverability matters for new users."
> — Dr. Priya Sharma, Junior Attending

> "For this to become an industry pattern, it needs to be simple to implement, non-proprietary, and clearly beneficial."
> — Dr. Samuel Adeyemi, Informatics Consultant

## 6. Traceability

All User Needs in this document trace forward to System Requirements in [02-SRS.md](./02-SRS.md).

## 7. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 1.0 | 2026-01-21 | Product Management | Initial PURS derived from specification v2.1 |
| 1.1 | 2026-01-22 | Product Management | Added UN-IMG-001 to UN-IMG-006 (Image Format Support), UN-ISP-001 to UN-ISP-003 (Image Service Performance) derived from library evaluation report |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
