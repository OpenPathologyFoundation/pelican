# Pelican — Software Development Plan (Annex to Workspace SDP)

---
document_id: DHF-SDP-PELICAN-001
version: 0.1
status: DRAFT
owner: Software Development Lead
created_date: 2026-04-19
standard_ref: IEC 62304:2006+AMD1:2015 §5.1
workspace_sdp_ref: /qms/Software-Development-Plan.md (WS-SDP-001)
module: pelican (digital viewer + tile server + session service + imaging library)
trace_to: 00-Index.md, 01-PURS.md, 02-SRS.md, 03-Cybersecurity.md, 04-SDS/, 05a-Risk-Plan.md, 05b-Hazard-Analysis.md, 06-VVP.md
---

# 1. Purpose and Relationship to Workspace SDP

This document is the module-specific Software Development Plan for **Pelican**, the whole-slide-image (WSI) viewer and tile-serving infrastructure of the open pathology platform. It is an **annex** to the workspace-level Software Development Plan at `/qms/Software-Development-Plan.md` (`WS-SDP-001`). The workspace SDP is authoritative for lifecycle model, AI-assistance policy, configuration management, shared SOPs, and cross-module verification strategy. This annex captures only what is Pelican-specific.

**DHF path note:** Pelican's DHF is rooted at `pelican/dhf/` rather than `pelican/qms/dhf/` for historical reasons predating the workspace convention. This deviation is acknowledged and is not scheduled for rename in the current period; future migration to `pelican/qms/dhf/` is a workspace backlog item.

# 2. Module Scope and Intended Use

Pelican comprises four software items:

1. **digital-viewer** (Svelte 5 + OpenSeadragon + annotations + voice control, `:5174`) — browser-based WSI viewer with slide rendering, multi-layer annotation, focus declaration protocol (FDP) for cross-window awareness, and voice-command integration.
2. **tile-server** (Python / FastAPI with `large_image`, `:8000`) — serves DZI and XYZ tile pyramids from pyramidal TIFF, SVS, and DICOM source files.
3. **session-service** (Node.js WebSocket, `:8765`) — FDP Layer 2 real-time focus and activity declaration across viewer windows.
4. **large_image library** — shared Python imaging library with pluggable tile sources (OpenSlide, TIFF, DICOM, GDAL).

Pelican renders the diagnostic image that pathologists use to make clinical determinations. It is a rendering and navigation surface, not a decision support system; it does not make or recommend clinical determinations itself.

# 3. Software Safety Classification

Per the workspace Safety Classification (`/qms/Safety-Classification.md`), the digital viewer is classified as **IEC 62304 Class B**. Rationale: incorrect rendering (color, resolution, scale, orientation, region of interest) could contribute to missed or misdiagnosed findings on a slide. The tile server and large_image library inherit the classification of the viewer because they are on the rendering path. The session service is Class A (coordination-only; a failure produces an inconvenience, not an incorrect rendering).

Detailed per-item classification is to be produced in Pelican's `10-Safety-Classification.md` under the workspace classification pass.

# 4. Current Lifecycle Phase

As of 2026-04-19, Pelican is in **Phase 3 (Implementation)** for the digital viewer, with selected Phase 4 (Integration and System Verification) activity for the orchestrated-mode integration with Starling. The tile server and large_image library are in ongoing iterative development with periodic returns to Phase 2 for new tile-source plugin additions.

# 5. Module-Specific Deliverables

- **Focus Declaration Protocol (FDP) specification** — design document in `dhf/04-SDS/` defining the cross-window focus coordination protocol. Changes to the FDP are cross-module concerns per workspace SDP §8.2.
- **Tile server API contract** — DZI and XYZ endpoint specifications; consumers include the viewer and any future direct-consumer module.
- **Module-orchestration entry** — `orchestrated.html` and the module-side bridge client; changes here are coordinated with Starling's `ViewerBridge`.

# 6. Module-Specific Standards and Tooling

- **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`), **TypeScript**, **Vite 5**.
- **Python 3.10+**, **FastAPI**, **uvicorn**, **ruff** (single-quote, 100 char line length).
- **Unit tests:** Vitest (`npm test`), pytest (`pytest test/` for core library, `utilities/server/tests/` for server).
- **Library tests:** tox (`tox -e core` for full matrix).
- **OpenSeadragon** and `large_image` library are SOUP items and require entries in `09-SOUP-List.md`.

Coverage thresholds for Class B items apply per workspace SDP §9.3. The session service, as Class A, applies the Class A threshold.

# 7. Module-Specific Cross-Module Obligations

1. **Viewer bridge contract** — changes to `ViewerBridge` / `OrchestratorBridge` message types require coordinated updates with Starling's `web-client/src/lib/viewer-bridge.ts` and a round-trip integration test.
2. **DICOM and image format provenance** — new tile-source plugins (new SOUP) require SOUP list entry, security review (imaging libraries have historical CVE exposure), and tile-server regression tests for rendering fidelity.
3. **Voice control content** — voice integrations may interact with the Willet MCP (`:8001`); coordination required for shared vocabularies.

# 8. Module-Specific Deviations from Workspace SDP

1. **DHF path:** Pelican uses `pelican/dhf/` rather than `pelican/qms/dhf/`. Acknowledged deviation; not scheduled for rename in current period.
2. **No `qms/sops/` directory in the module repo.** Pelican uses the shared workspace SOPs at `/qms/sops/` exclusively.

# 9. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-04-19 | Software Development Lead, with Claude Opus 4.7 assistance | Initial draft — closes IEC 62304 §5.1 gap for Pelican module. References workspace SDP WS-SDP-001 v0.1. Acknowledges DHF-path deviation. |
