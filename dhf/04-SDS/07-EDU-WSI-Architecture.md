# Software Design Specification — Educational WSI Collection Architecture

---
document_id: SDS-EDU-001
title: Educational WSI Collection — Schema Design, Curation Model, and Teaching Annotations
version: 0.1
status: DRAFT
owner: Engineering
created_date: 2026-03-02
effective_date: TBD
trace_source: SRS-001 (System Requirements Specification — §1.13 Educational WSI Collections)
trace_destination: VVP-001 (Verification & Validation Plan)
references:
  - SDS-STR-001 (WSI Storage Architecture — clinical data model, integrity verification, filesystem layout)
  - SDS-ANN-001 (Annotation System Architecture — geometry model, event sourcing, visibility)
  - IEC 62304:2006+A1:2015 (Section 5.4 — Software Architectural Design)
  - HIPAA 45 CFR §164.514 (De-identification standard)
---

## 1. Purpose and Scope

This document specifies the software architecture for the educational whole slide image (WSI) collection within the Okapi digital pathology platform. It defines the `wsi_edu` database schema, the curator assignment model, the teaching annotation system, the clinical-to-educational transfer workflow, and the relationship to the clinical WSI schema defined in SDS-STR-001.

The educational collection is structurally parallel to the clinical collection: same case → part → block → slide hierarchy, same integrity verification (HMAC-SHA256), same tile server integration. The key differences are:

- **Curator-based governance** instead of clinical pathologist assignments
- **Teaching annotations** with visibility levels and instructor-controlled reveal
- **De-identification** — no patient link, stripped file headers, opaque identifiers on the filesystem
- **Provenance tracking** on the anatomic hierarchy (ACCESSIONED, IMPLIED, CURATED)
- **Source lineage** recording where each case originated
- **Named collections** for curriculum organization

### 1.1 Out of Scope

- Clinical annotation system internals (covered by SDS-ANN-001; educational annotations reuse the geometry model)
- Filesystem layout for educational slides (already specified in SDS-STR-001 §3.3)
- De-identification metadata stripping procedures (already specified in SDS-STR-001 §7.2–§7.3)
- Competency assessment and examination workflows (future specification)

## 2. Design Principles

**Schema parallelism.** The `wsi_edu` schema mirrors the clinical `wsi` schema table-for-table. This is intentional: the same viewer, tile server, and navigation code can operate on either schema with minimal conditional logic. The substitution of `case_curators` for `case_pathologists` is the only structural divergence.

**Complete isolation from clinical data.** Educational and clinical data live in separate PostgreSQL schemas (`wsi_edu` vs `wsi`). There are no foreign keys between them. The `source_lineage` JSONB column records the *identity* of the source clinical case but does not reference it referentially. This means a clinical case can be deleted without affecting any educational case derived from it.

**Provenance everywhere.** Every piece of information in the educational schema carries provenance: who put it there, when, and how confident should we be in its accuracy. This applies to the anatomic hierarchy (ACCESSIONED / IMPLIED / CURATED), to annotations (author_id), and to the case itself (source_lineage).

**Annotations as a first-class entity.** Unlike the clinical system where annotations are a separate service (SDS-ANN-001), educational annotations are tightly integrated into the `wsi_edu` schema because they are an essential part of the teaching content — not just markup on top of images.

**Lightweight governance.** The educational collection does not carry the regulatory weight of clinical data. Soft-delete is not required for slides (curators can remove them). Audit trails track changes for provenance, not for regulatory compliance. The system favors low friction over strict controls.

## 3. Entity Relationships

```
                      iam.identity
                           │
                      0..N │ (curators, annotation authors)
                           │
wsi_edu.cases ─────────────┤── 1───N parts 1───N blocks 1───N slides
  │                        │                                    │
  │ (patient_id = NULL)    ├── 1───N case_icd_codes        0..N annotations
  │                        │
  │                        └── 0..N case_curators
  │                                 (role: PRIMARY_CURATOR | CURATOR | CONTRIBUTOR)
  │
  ├── source_lineage (JSONB — origin tracking)
  │
  └── 0..N collection_memberships ── named_collections
```

## 4. Schema: `wsi_edu`

### 4.1 Table: `wsi_edu.cases`

Identical to `wsi.cases` (SDS-STR-001 §4.2) with the following modifications:

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | VARCHAR(64) | No | Educational accession number: `EDU{YY}-{NNNNN}` (e.g., `EDU26-00001`) |
| `collection` | VARCHAR(16) | No | Always `'educational'`. CHECK constraint enforced. |
| `patient_id` | — | — | **Column does not exist.** Educational cases have no patient link. This is the primary de-identification mechanism. |
| `specimen_type` | VARCHAR(255) | Yes | Same as clinical |
| `clinical_history` | TEXT | Yes | De-identified clinical context for teaching purposes |
| `accession_date` | DATE | Yes | **Always NULL** for educational cases. Original clinical dates are identifying. |
| `ingested_at` | TIMESTAMPTZ | No | When the case entered the educational collection |
| `status` | VARCHAR(32) | No | `'active'`, `'archived'`, `'draft'` |
| `priority` | VARCHAR(16) | Yes | Not clinically relevant; may be used for curriculum sequencing |
| `source_lineage` | JSONB | Yes | Origin tracking (see §4.1.1) |
| `metadata` | JSONB | Yes | Teaching-specific: `teaching_category`, `difficulty_level`, `curriculum_tags`, etc. |

**Note on `patient_id`:** Unlike `wsi.cases` which has a nullable FK to `core.patients`, the educational schema omits this column entirely. This is stronger than `NULL` — it makes re-identification at the schema level structurally impossible.

#### 4.1.1 Source Lineage

The `source_lineage` column records how the case entered the educational collection:

```json
// Clinical transfer
{
  "type": "clinical_transfer",
  "source_case_id": "XS26-00003",
  "transferred_by": "identity-uuid",
  "transferred_at": "2026-03-01T14:30:00Z",
  "slides_transferred": ["slide-uuid-1", "slide-uuid-2"]
}

// External upload
{
  "type": "external_upload",
  "source_description": "Conference teaching set — Dr. Smith",
  "uploaded_by": "identity-uuid",
  "uploaded_at": "2026-03-01T14:30:00Z"
}

// Public dataset
{
  "type": "public_dataset",
  "dataset": "TCGA",
  "project": "TCGA-BRCA",
  "tcga_case_id": "TCGA-A7-A0CE",
  "gdc_file_ids": ["uuid-1", "uuid-2"],
  "terms_of_use": "GDC open access"
}
```

**Indexes:**

- `UNIQUE (case_id)` — educational accession uniqueness
- `GIN (metadata)` — JSONB queries
- `GIN (source_lineage)` — lineage queries
- `BTREE (status)` — active case listing
- `BTREE (ingested_at)` — chronological ordering

### 4.2 Table: `wsi_edu.parts`

Identical to `wsi.parts` (SDS-STR-001 §4.3) with added provenance:

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | UUID FK | No | References `wsi_edu.cases.id` |
| `part_label` | VARCHAR(16) | No | `'A'`, `'B'`, etc. |
| `part_designator` | VARCHAR(255) | Yes | Human label, e.g., `'Right lobe, total thyroidectomy'` |
| `anatomic_site` | VARCHAR(128) | Yes | Standardized site |
| `final_diagnosis` | TEXT | Yes | Part-level diagnostic narrative |
| `gross_description` | TEXT | Yes | Gross examination narrative |
| `provenance` | VARCHAR(16) | No | `'ACCESSIONED'`, `'IMPLIED'`, `'CURATED'`. Default `'IMPLIED'`. |
| `metadata` | JSONB | Yes | Part-specific metadata |

**Provenance semantics:**

| Value | Meaning | Set when |
|:------|:--------|:---------|
| `ACCESSIONED` | Hierarchy inherited from a clinical case via "Send to Education" | Clinical transfer |
| `IMPLIED` | System-generated defaults; may not accurately represent the specimen | External upload, cold ingestion |
| `CURATED` | A curator has reviewed and confirmed or corrected this record | Manual edit after ingestion |

### 4.3 Table: `wsi_edu.blocks`

Identical to `wsi.blocks` (SDS-STR-001 §4.5) with added provenance:

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `part_id` | UUID FK | No | References `wsi_edu.parts.id` |
| `block_label` | VARCHAR(16) | No | `'1'`, `'2'`, etc. |
| `block_description` | TEXT | Yes | Tissue description |
| `provenance` | VARCHAR(16) | No | Same values as `parts.provenance`. Default `'IMPLIED'`. |

### 4.4 Table: `wsi_edu.slides`

Identical to `wsi.slides` (SDS-STR-001 §4.6). All columns carry over unchanged: `id`, `block_id`, `slide_id`, `relative_path`, `hmac`, `size_bytes`, `format`, `stain`, `level_label`, `scanner`, `magnification`, `width_px`, `height_px`, `mpp_x`, `mpp_y`, `ingested_at`, `verified_at`, `scan_metadata`.

The `relative_path` for educational slides follows the filesystem layout defined in SDS-STR-001 §3.3: `{year}/{month}/{case_opaque_id}/{slide_token}.{ext}`.

### 4.5 Table: `wsi_edu.case_icd_codes`

Identical to `wsi.case_icd_codes` (SDS-STR-001 §4.4). Same columns: `case_id`, `icd_code`, `code_system`, `code_description`. Same primary key: `(case_id, icd_code, code_system)`.

### 4.6 Table: `wsi_edu.case_curators`

This table replaces `wsi.case_pathologists` for the educational collection. It tracks who is responsible for curating and maintaining each educational case.

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | UUID FK | No | References `wsi_edu.cases.id`. ON DELETE CASCADE. |
| `identity_id` | UUID FK | No | References `iam.identity.identity_id`. ON DELETE RESTRICT. |
| `role` | VARCHAR(32) | No | `'PRIMARY_CURATOR'`, `'CURATOR'`, `'CONTRIBUTOR'`. CHECK constraint enforced. |
| `assigned_at` | TIMESTAMPTZ | No | When the curator was assigned. Default `now()`. |
| `assigned_by` | UUID FK | Yes | References `iam.identity.identity_id`. NULL for system-assigned. |

**Role semantics:**

| Role | Meaning | Typical usage |
|:-----|:--------|:-------------|
| `PRIMARY_CURATOR` | The person ultimately responsible for this educational case | Teaching faculty who selected/uploaded the case; has edit authority over all metadata |
| `CURATOR` | Additional person with edit authority | Co-maintainer of a teaching set; can modify hierarchy, metadata, and annotations |
| `CONTRIBUTOR` | Person who contributed annotations or metadata but does not own the case | Resident who added study annotations; visiting lecturer who annotated during a session |

**Constraints:**

| Constraint | Type | Purpose |
|:-----------|:-----|:--------|
| `uq_edu_case_identity` | UNIQUE (`case_id`, `identity_id`) | Prevents duplicate assignment |
| `ix_edu_case_one_primary` | Partial UNIQUE (`case_id`) WHERE `role = 'PRIMARY_CURATOR'` | At most one PRIMARY_CURATOR per case |

**Indexes:**

- `BTREE (identity_id)` — find all cases for a given curator ("my teaching cases")
- `BTREE (role)` — filter by curator role

**Key difference from `case_pathologists`:** The `role` column here captures the curator's function within the teaching context (`PRIMARY_CURATOR`, `CURATOR`, `CONTRIBUTOR`), not a clinical designation (`PRIMARY`, `SECONDARY`, `CONSULTING`, `GROSSING`). No restriction is placed on the curator's organizational position from `iam.identity_roles` — any active identity can be a curator.

### 4.7 Table: `wsi_edu.annotations`

Teaching annotations are stored directly in the `wsi_edu` schema rather than in the clinical annotation service. This reflects the different governance model: educational annotations are part of the teaching content and are managed by curators, not by clinical workflow rules.

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `slide_id` | UUID FK | No | References `wsi_edu.slides.id`. ON DELETE CASCADE. |
| `author_id` | UUID FK | No | References `iam.identity.identity_id`. ON DELETE RESTRICT. |
| `annotation_type` | VARCHAR(32) | No | `'REGION'`, `'POINT'`, `'FREEHAND'`, `'MEASUREMENT'`, `'TEXT_LABEL'`, `'ARROW'` |
| `geometry` | GEOMETRY | No | PostGIS geometry in full-resolution level-0 pixel coordinates (consistent with SDS-ANN-001 §3.3) |
| `label` | VARCHAR(255) | Yes | Short label, e.g., "Invasive ductal carcinoma" |
| `description` | TEXT | Yes | Extended description, teaching notes |
| `visibility` | VARCHAR(16) | No | `'PERSONAL'`, `'SHARED'`, `'TEACHING'`, `'PUBLIC'`. Default `'PERSONAL'`. |
| `color` | VARCHAR(16) | Yes | Rendering color hint (hex, e.g., `'#FF0000'`) |
| `properties` | JSONB | Yes | Extensible: measurement values, calibration state, etc. |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Default `now()` |

**Visibility enforcement:**

| Visibility | Who can see | Query filter |
|:-----------|:-----------|:-------------|
| `PERSONAL` | Only the author | `author_id = current_user` |
| `SHARED` | All curators of the case | `identity_id IN (SELECT identity_id FROM case_curators WHERE case_id = ...)` |
| `TEACHING` | Anyone, but only when instructor enables the teaching layer | Requires `show_teaching = true` session parameter |
| `PUBLIC` | Anyone with `VIEW_EDU_COLLECTION` permission | Always included in query results |

**Indexes:**

- `GIST (geometry)` — spatial queries (viewport intersection)
- `BTREE (slide_id)` — find all annotations for a slide
- `BTREE (author_id)` — find all annotations by a given author
- `BTREE (visibility)` — filter by visibility level
- Full-text index on `label` and `description` via `tsvector` — enables text search across annotations

**Design rationale — why not use the clinical annotation service:**

The clinical annotation service (SDS-ANN-001) is event-sourced, append-only, and designed for regulatory defensibility. Educational annotations have different requirements: they need to be easily editable (a curator correcting a label should not generate an event chain), deletable (a curator removing a bad annotation should be simple), and organized by visibility levels that don't exist in the clinical model. Sharing the geometry format (GeoJSON in level-0 coordinates) and the viewer rendering pipeline is the right level of reuse; sharing the persistence model would force unnecessary complexity.

### 4.8 Table: `wsi_edu.named_collections`

Named collections group educational cases for curriculum delivery.

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `name` | VARCHAR(255) | No | Collection name, e.g., "Breast Pathology Board Review 2026" |
| `description` | TEXT | Yes | Description of the collection's purpose and scope |
| `owner_id` | UUID FK | No | References `iam.identity.identity_id`. The person who created the collection. |
| `visibility` | VARCHAR(16) | No | `'PRIVATE'` (owner only), `'DEPARTMENT'`, `'INSTITUTION'`. Default `'PRIVATE'`. |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Default `now()` |
| `metadata` | JSONB | Yes | Extensible: curriculum year, target audience, exam flag, etc. |

### 4.9 Table: `wsi_edu.collection_cases`

Many-to-many linking table between named collections and educational cases.

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `collection_id` | UUID FK | No | References `wsi_edu.named_collections.id`. ON DELETE CASCADE. |
| `case_id` | UUID FK | No | References `wsi_edu.cases.id`. ON DELETE CASCADE. |
| `sequence` | INTEGER | No | Display ordering within the collection. Default 0. |
| `added_at` | TIMESTAMPTZ | No | Default `now()` |
| `added_by` | UUID FK | Yes | References `iam.identity.identity_id`. |

**Primary key:** `(collection_id, case_id)`

## 5. Clinical-to-Educational Transfer Workflow

The "Send to Education" operation is a multi-step process that copies a clinical case (or selected slides) into the educational collection with de-identification.

```
User initiates "Send to Education" for clinical case XS26-00003
                    │
                    ▼
┌──────────────────────────────────────┐
│ 1. Create wsi_edu.cases record       │
│    - Assign next EDU accession       │
│    - collection = 'educational'      │
│    - source_lineage = clinical ref   │
│    - No patient_id column            │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Copy parts/blocks hierarchy       │
│    - provenance = 'ACCESSIONED'      │
│    - Preserve part_designator,       │
│      anatomic_site, diagnosis        │
│    - Omit gross_description if it    │
│      contains identifiers            │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. For each slide to transfer:       │
│    a. Copy file to edu storage path  │
│    b. Strip metadata per §7.3 of     │
│       SDS-STR-001                    │
│    c. Compute new HMAC-SHA256        │
│    d. Create wsi_edu.slides record   │
│       with new relative_path, hmac   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 4. Assign requesting user as         │
│    PRIMARY_CURATOR                   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 5. Copy ICD codes from clinical case │
│    to wsi_edu.case_icd_codes         │
└──────────────────────────────────────┘
```

**Atomicity:** Steps 1–5 execute in a single database transaction. If any step fails (file copy, metadata strip, HMAC computation), the entire operation rolls back. The clinical case is never modified.

**Identifier handling:** The educational case receives a new `case_id` (EDU accession). The filesystem path uses the opaque HMAC-based directory structure defined in SDS-STR-001 §3.3. The `source_lineage` JSON records the original clinical case ID for honest-broker traceability, but no referential foreign key exists.

## 6. Access Control

### 6.1 Permissions

| Permission | Scope | Description |
|:-----------|:------|:------------|
| `VIEW_EDU_COLLECTION` | Educational schema | Browse and view educational cases, slides, and public/teaching annotations |
| `CURATE_EDU_COLLECTION` | Educational schema | Create/edit educational cases, manage curator assignments, create annotations |
| `MANAGE_EDU_COLLECTIONS` | Educational schema | Create/edit named collections, assign cases to collections |
| `TRANSFER_TO_EDU` | Cross-schema | Execute "Send to Education" from a clinical case |

These permissions are assigned to roles via the existing IAM role-permission model (`iam.role_permissions`). They are independent of clinical permissions — a user may have `VIEW_EDU_COLLECTION` without any clinical case access.

### 6.2 Curator Authority

Curators have implicit `CURATE_EDU_COLLECTION` authority scoped to the cases they are assigned to. A `PRIMARY_CURATOR` or `CURATOR` on a case can edit its metadata, manage its annotations, and add/remove other curators. A `CONTRIBUTOR` can create annotations but cannot modify case metadata or curator assignments.

## 7. Tile Server Integration

The tile server (SDS-TLS-001) serves educational slides using the same path resolution mechanism as clinical slides. The `STORAGE_EDU_ROOT` configuration (SDS-STR-001 §6.3) points to the educational storage directory. The slide identifier in the URL is resolved via `wsi_edu.slides.relative_path`.

No changes to the tile server are required. The `wsi_edu.slides` table has the same columns as `wsi.slides`, and the tile server's `SourceManager._resolve_image_path()` already supports educational paths per SDS-STR-001 §6.1.

## 8. Search and Discovery

### 8.1 Full-Text Search

Full-text search across the educational collection uses the same PostgreSQL `tsvector` approach as clinical (SDS-STR-001 §4.7):

- `tsvector` columns on `wsi_edu.parts.final_diagnosis`, `wsi_edu.parts.gross_description`, `wsi_edu.cases.clinical_history`
- Additional `tsvector` on `wsi_edu.annotations.label` and `wsi_edu.annotations.description` for annotation text search
- GIN indexes on all `tsvector` columns and on `metadata` JSONB columns

### 8.2 Faceted Search

The structured columns enable faceted search:

- By anatomic site: `wsi_edu.parts.anatomic_site`
- By ICD code: `wsi_edu.case_icd_codes.icd_code`
- By stain: `wsi_edu.slides.stain`
- By specimen type: `wsi_edu.cases.specimen_type`
- By ingestion year: `EXTRACT(YEAR FROM wsi_edu.cases.ingested_at)`
- By source: `wsi_edu.cases.source_lineage->>'type'`
- By difficulty: `wsi_edu.cases.metadata->>'difficulty_level'`

## 9. Seed Data

### 9.1 Accession Format

Educational seed cases use the `EDU26-NNNNN` format:

- `EDU26-00001` through `EDU26-00010` — initial teaching collection from TCGA downloads
- Sequential numbering within each year; counter resets annually

### 9.2 Seed File Structure

```
Okapi/seed/wsi/
  wsi-edu-cases.v1.json         ← educational case definitions
  wsi-test-cases.v2.json        ← clinical case definitions (XS26-*)
  case-assignments.v2.json      ← clinical pathologist assignments
  edu-curator-assignments.v1.json  ← educational curator assignments
```

The `wsi-edu-cases.v1.json` file follows the same structure as clinical case definitions but includes `source_lineage`, `provenance` on parts/blocks, and omits patient references.

## 10. Traceability

| Design Element | Traces To |
|:---------------|:----------|
| `wsi_edu` schema (§4) | SRS-001 §1.13.1 (SYS-EDU-001, SYS-EDU-002) |
| EDU accession format (§4.1) | SRS-001 §1.13.1 (SYS-EDU-003) |
| Part/block provenance (§4.2, §4.3) | SRS-001 §1.13.1 (SYS-EDU-004) |
| Source lineage (§4.1.1) | SRS-001 §1.13.1 (SYS-EDU-005); PURS UN-EDU-019 |
| Case curators (§4.6) | SRS-001 §1.13.2 (SYS-EDU-006 through SYS-EDU-009); PURS UN-EDU-007, UN-EDU-008 |
| Clinical transfer (§5) | SRS-001 §1.13.3 (SYS-EDU-010 through SYS-EDU-012); PURS UN-EDU-002 |
| External upload (§4, §5) | SRS-001 §1.13.4 (SYS-EDU-013 through SYS-EDU-015); PURS UN-EDU-005 |
| Teaching annotations (§4.7) | SRS-001 §1.13.5 (SYS-EDU-016 through SYS-EDU-020); PURS UN-EDU-010 through UN-EDU-013 |
| Access control (§6) | SRS-001 §1.13.6 (SYS-EDU-021); PURS UN-EDU-016 |
| Named collections (§4.8, §4.9) | SRS-001 §1.13.6 (SYS-EDU-022); PURS UN-EDU-017 |
| Search (§8) | SRS-001 §1.13.6 (SYS-EDU-023); PURS UN-EDU-018 |
| De-identification (§4.1, §5) | SDS-STR-001 §3.3, §4.9, §7.2; PURS UN-EDU-015 |
| Annotation geometry (§4.7) | SDS-ANN-001 §3.3 (coordinate space); PURS UN-EDU-012 |
| Integrity verification | SDS-STR-001 §5 (HMAC-SHA256); PURS UN-EDU-014 |

## 11. Open Questions

- **Annotation versioning:** Should educational annotations support version history (undo/redo) or is simple overwrite sufficient? Current design uses simple overwrite for low friction; version history could be added later if needed.
- **Cross-collection annotation sharing:** If the same TCGA slide appears in multiple named collections, should annotations be shared or independent per collection? Current design: annotations belong to the slide, not the collection, so they are visible across all collections containing that slide.
- **Bulk import tooling:** The TCGA manifest-based import (scripts/build-slide-manifests.py → seed data) needs a formal ingestion pipeline for production use. The current scripts are development tooling only.
- **Examination mode:** Future competency assessment workflows will need the ability to hide all annotations and record student responses. This is deferred to a separate specification.

## 12. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 0.1 | 2026-03-02 | Engineering | Initial draft |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
