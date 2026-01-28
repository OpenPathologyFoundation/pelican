# Standard Operating Procedures (SOPs)

## Overview

This directory contains project-specific Standard Operating Procedures for the Digital Viewer Module (Pelican). These SOPs complement the reusable QMS procedures defined in `qms-core/sops/`.

## Relationship to QMS-Core

| Location | Contains | Scope |
|:---------|:---------|:------|
| `qms-core/sops/` | Universal procedures (DHF management, design controls) | All projects |
| `sops/` (this directory) | Project-specific procedures | This project only |
| `dhf/` | Design History File artifacts | This project only |
| `templates/` | Document templates | This project only |

## Referenced SOPs

The following universal SOPs from qms-core govern this project:

| SOP | Document ID | Description |
|:----|:------------|:------------|
| [SOP-DHF-Management](https://github.com/yourorg/qms-core/blob/main/sops/SOP-DHF-Management.md) | SOP-DHF-001 | Design History File management workflow |

## Project-Specific SOPs

| SOP | Document ID | Description | Status |
|:----|:------------|:------------|:-------|
| *None yet defined* | — | — | — |

## Adding Project-Specific SOPs

When adding project-specific procedures:

1. Use naming convention: `SOP-<Topic>.md`
2. Include YAML frontmatter with document metadata
3. Ensure alignment with qms-core SOPs
4. Submit via Pull Request with independent review

## Document Control

All SOPs are version-controlled in Git. Changes require:
- Pull Request with detailed rationale
- Independent review (reviewer cannot be author)
- Approval via PR merge

## Related Documentation

| Document | Location | Description |
|:---------|:---------|:------------|
| DHF Index | [dhf/00-Index.md](../dhf/00-Index.md) | Design History File master index |
| Module Specification | [docs/digital-viewer-module-specification-v2.1.md](../docs/digital-viewer-module-specification-v2.1.md) | Primary design specification |

## Regulatory References

This project follows quality management requirements from:
- ISO 13485:2016 — Quality management systems for medical devices
- ISO 14971:2019 — Application of risk management to medical devices
- IEC 62304:2006+A1:2015 — Medical device software lifecycle processes
- 21 CFR 820.30 — FDA Design Controls

## Questions?

For questions about SOPs or quality processes, contact the Quality Assurance team.
