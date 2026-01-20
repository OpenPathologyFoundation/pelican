# Fork Changes Summary

This document describes the modifications made to this fork of [Kitware's Large Image](https://github.com/girder/large_image) library.

## Overview

The repository has undergone **significant refactoring** with **244 total changes**:
- **194 files deleted** (primarily Girder-related code)
- **41 files modified** (configuration, documentation, sources)
- **1 file added/modified** (NOTICE)
- **8 new untracked items** (new directories and files)

---

## Where the Changes Are Located

### New Additions

| Directory/File | Purpose |
|----------------|---------|
| `digital-viewer/` | **SvelteKit-based digital pathology viewer frontend** - includes session service, viewer UI components |
| `utilities/server/` | **FastAPI-based tile server** - standalone HTTP server for serving image tiles |
| `samples/` | Sample whole slide images for testing |
| `test-cases/` | Test case data |
| `docs/evaluation_report.md` | Evaluation documentation |
| `docs/digital-viewer-module-specification-v2.1.md` | Comprehensive viewer specification (2758 lines) |

### Major Deletions (Girder Removal)

| Directory | Files Deleted | What Was Removed |
|-----------|---------------|------------------|
| `girder_annotation/` | 79 files | Girder annotation plugin (entire directory) |
| `girder/` | 63 files | Girder web framework integration (entire directory) |
| `sources/` | 53 files | Some source plugins that depended on Girder |
| `utilities/tasks/` | Multiple files | Girder task utilities |

### Key Modified Files

| File | Changes |
|------|---------|
| `README.md` | Added "Credits / Origins" section with Kitware attribution |
| `NOTICE` | Updated with modification notice for Open Pathology Foundation |
| `setup.py` | Updated for standalone operation |
| `docs/*.md` | Documentation updates removing Girder references |
| `.circleci/config.yml` | CI/CD configuration updates |
| `sources/*/` | Various tile source updates |
| `requirements-*.txt` | Dependency updates |

---

## What Was Done (Architectural Summary)

### 1. Girder Dependency Removal

- Deleted entire `girder/` directory (63 files)
- Deleted entire `girder_annotation/` directory (79 files)
- Removed Girder-specific task utilities
- The library now operates **standalone** without requiring Girder web framework

### 2. New Tile Server Architecture

- Added `utilities/server/` with a **FastAPI-based tile server**
- Supports XYZ tiles, DeepZoom, and metadata endpoints
- Designed for cloud deployment (Lambda/ECS compatible)

### 3. Digital Pathology Viewer Frontend

- Added `digital-viewer/` with **SvelteKit-based UI**
- Includes session awareness service (Node.js/WebSocket)
- Implements Focus Declaration Protocol (FDP) for patient safety

### 4. Documentation & Specification

- Added comprehensive `digital-viewer-module-specification-v2.1.md` (2758 lines)
- Defines tile server conformance levels, annotation schemas, telemetry governance

### 5. Apache 2.0 Compliance

- `LICENSE` file preserved (unchanged)
- `NOTICE` file updated with Kitware attribution + Open Pathology Foundation modifications
- `README.md` updated with "Credits / Origins" section

---

## File Count Summary

```
Before refactoring:  ~400+ files (with Girder)
After refactoring:   ~250 files (standalone)

Deleted:             194 files (mostly Girder)
Added:               ~50+ files (new viewer, server, docs)
Modified:            41 files (configs, docs, sources)
```

---

## Architecture After Changes

```
large_image/
├── large_image/          # Core Python library (preserved)
├── sources/              # Tile source plugins (modified, some removed)
├── utilities/
│   └── server/           # NEW: FastAPI tile server
├── digital-viewer/       # NEW: SvelteKit frontend + session service
├── docs/                 # Updated documentation
├── samples/              # NEW: Sample images
├── test-cases/           # NEW: Test data
├── LICENSE               # Apache 2.0 (unchanged)
├── NOTICE                # Updated with attribution
└── README.md             # Updated with Credits section
```

The repository is now a **focused whole slide image (WSI) library** for digital pathology, with a modern tile server and viewer architecture, completely independent of the Girder web framework.

---

## License

This fork maintains the original Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
