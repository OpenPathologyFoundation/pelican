# Software Design Specification — WSI Storage Architecture

---
document_id: SDS-STR-001
title: Whole Slide Image Storage — Block Storage Layout, Data Model, and Integrity Verification
version: 0.1
status: DRAFT
owner: Engineering
created_date: 2026-02-28
effective_date: TBD
trace_source: SRS-001 (System Requirements Specification)
trace_destination: SDS-TLS-001 (Tile Server Architecture), VVP-001 (Verification & Validation Plan)
references:
  - SDS-TLS-001 (Tile Server Architecture — MOD-TLS-002 Source Manager)
  - IEC 62304:2006+A1:2015 (Section 5.4 — Software Architectural Design)
  - HIPAA 45 CFR §164.514 (De-identification standard)
---

## 1. Purpose and Scope

This document specifies the storage architecture for whole slide images (WSI) in the Okapi digital pathology platform. It defines three things: the filesystem directory layout on block storage, the relational data model that tracks image metadata and location, and the cryptographic integrity verification mechanism.

The specification covers two distinct storage collections:

- **Clinical** — slides retaining their laboratory accession numbers, organized by specimen type prefix and year
- **Educational (de-identified)** — slides stripped of patient-identifying information, assigned opaque identifiers, organized by ingestion date

The tile server (SDS-TLS-001) consumes this storage. It does not own the metadata model. It receives a slide identifier, resolves a filesystem path via the mechanisms defined here, and serves tiles. The case metadata model is owned by the Okapi auth system or a dedicated metadata service.

### 1.1 Out of Scope

- Cloud object storage (S3, GCS, Azure Blob) — this specification covers block storage (local filesystem, NFS, SAN) only; a cloud storage addendum may follow
- DICOM WSI storage and communication
- Backup and disaster recovery procedures (covered by operational runbooks)
- Scanner integration and automated ingestion pipelines (covered by a separate integration specification)

## 2. Design Principles

**Filesystem as dumb storage.** The directory layout serves human navigability, operational maintenance, and bounded directory sizes. It is not a query interface. All queries go through the database.

**Database as source of truth.** The path to every image is recorded in the database. The tile server resolves paths by database lookup. Clinical slides have an optimization where the path is deterministically derivable from the accession number, but the database remains canonical.

**Integrity verification is server-side only.** Cryptographic hashes are stored exclusively in the database, never as sidecar files alongside images. A sidecar hash file offers no tamper protection — an attacker who can modify the image file can replace the hash file in the same operation. The hash has value only when stored in a system the attacker cannot reach simultaneously.

**HMAC over bare SHA-256.** Image integrity uses HMAC-SHA256 with a server-held secret key. Even an attacker with database read access cannot forge a valid hash for a modified file without possessing the key.

**Separation of storage and search.** The tile server resolves paths and serves tiles. A separate service owns the case/part/slide data model and handles search, worklist generation, and case presentation.

**No information leakage from the filesystem.** For de-identified collections, the directory structure reveals nothing about case structure, slide count, ordering, or clinical dates. All such information exists only in the database.

## 3. Filesystem Layout

### 3.1 Storage Root Structure

```
/storage/
  clinical/          ← clinical slides (accession-based identity)
    2026/
    2027/
  edu/               ← de-identified / educational slides (opaque identity)
    2026/
      01/
      02/
```

The top-level separation between `clinical/` and `edu/` enables independent lifecycle management, access control, and retention policies.

### 3.2 Clinical Slides

Clinical slides retain their laboratory accession numbers. The naming convention encodes the year in the case ID (e.g., `S26-0001` is a surgical case from 2026, `PS26-00001` is a proficiency sample from 2026).

```
/storage/clinical/
  2026/
    S26-0001/
      S26-0001_A1_S1.svs           728 MB
      S26-0001_A1_S2.svs           520 MB
    S26-0002/
      S26-0002_A1_S1.svs
      S26-0002_B1_S1.svs
    PS26-00001/
      PS26-00001-01-01-01.svs
  2027/
    S27-0001/
      S27-0001_A1_S1.svs
```

**Year-only partitioning** is used. At an upper bound of ~12,000 cases per year with ~10 slides each, a year directory contains roughly 120,000 files distributed across 12,000 subdirectories. This is within the performance envelope of XFS or ext4 with `dir_index` enabled. Monthly subdivision is unnecessary at this volume.

**Path derivation rule:** Given a case ID, extract the two-digit year (the digits immediately following the alphabetic prefix), prepend `20`, and construct `{storage_root}/clinical/20{YY}/{case_id}/`. The prefix letter(s) (`S`, `PS`, `C`, `A`, etc.) are irrelevant to partitioning — only the year digits matter. New specimen type prefixes follow the same rule automatically.

**File naming convention** (existing, unchanged):

```
{CaseID}_{Part}{Block}_{Stain-or-Level}.{ext}

Examples:
  S26-0001_A1_S1.svs       Part A, Block 1, Slide/Level 1
  S26-0005_B1_S2.tiff      Part B, Block 1, Slide/Level 2
  PS26-00001-01-01-01.svs   Part 01, Block 01, Slide 01 (alternate format)
```

### 3.3 De-identified / Educational Slides

De-identified slides have been stripped of clinical accession information. They receive opaque identifiers at ingestion. The directory layout uses **ingestion date** — not the original scan or accession date, which may be identifying — and opaque tokens for both case and slide identity.

```
/storage/edu/
  2026/
    03/
      a7c2f9d1/                   ← case-level opaque ID
        e4b8.svs                  ← slide-level opaque token
        91f3.svs
        c0a2.svs
    04/
      b3e1a90c/
        f7d2.tiff
        aa01.svs
  2027/
    01/
      ...
```

**Monthly partitioning** is used (unlike clinical) because bulk imports may cluster and because the educational collection grows indefinitely without the natural lifecycle boundaries of clinical data.

**Identifier assignment:**

- **Case-level ID** (`a7c2f9d1`): Truncated `HMAC-SHA256(salt, original_accession)` where the salt is held by the honest broker. This is deterministic (same accession → same de-identified ID given the same salt), one-way (cannot reverse without the salt), and collision-resistant at 8 hex characters for volumes under 100,000 cases.
- **Slide-level ID** (`e4b8`): A random 4-hex-character token assigned independently to each slide. The ordering, level labels, and slide count are stored only in the database, not on the filesystem.

**De-identification properties of the layout:**

| Property | How it is protected |
|:---------|:-------------------|
| Clinical dates | Year/month is ingestion date, not accession or scan date |
| Slide count per case | Each slide has a random token; count requires database access |
| Slide ordering | Tokens are random, not sequential; ordering exists only in DB |
| Case identity | HMAC with secret salt; not reversible without the salt |
| Scanner metadata | Must be stripped from SVS/TIFF headers during de-identification before ingestion |

**Known residual risk:** File size is observable on disk and could theoretically fingerprint a case (an unusually large slide might correlate with a known case). This should be documented in the Hazard Analysis.

### 3.4 Supported File Formats

The storage layout is format-agnostic. The following formats are supported by the tile server's source plugins and may appear in storage:

| Extension(s) | Format | Typical Source | Notes |
|:-------------|:-------|:---------------|:------|
| `.svs` | Aperio SVS | Leica/Aperio scanners | Most common clinical format |
| `.tiff`, `.tif` | Pyramidal TIFF | Various scanners | Generic tiled pyramid |
| `.ptif`, `.qptiff` | Pyramidal TIFF variants | Hamamatsu, PerkinElmer | Vendor-specific TIFF |
| `.ome.tiff`, `.ome.tif` | OME-TIFF | Research scanners | Multi-channel, standardized metadata |
| `.ndpi` | Hamamatsu NDPI | Hamamatsu NanoZoomer | Proprietary TIFF variant |
| `.mrxs` | MIRAX | 3DHISTECH Pannoramic | Multi-file (`.mrxs` + data directory) |
| `.scn` | Leica SCN | Leica Biosystems | XML-described TIFF |
| `.czi` | Carl Zeiss Image | Zeiss AxioScan | Proprietary |

**MRXS special handling:** MIRAX `.mrxs` files reference a companion data directory (`{name}/`). Both the `.mrxs` file and its data directory must be stored together in the case directory. The database `relative_path` points to the `.mrxs` file; the tile server (via OpenSlide) resolves the companion directory automatically.

### 3.5 Filesystem Requirements

| Requirement | Specification |
|:------------|:-------------|
| Filesystem type | XFS (preferred) or ext4 with `dir_index` enabled |
| Block size | 4 KB default; no special requirement |
| Inode allocation | Ensure sufficient inodes for projected file count (estimate: 150,000 files per year-directory) |
| Mount options | `noatime` (avoids unnecessary metadata writes on read); `relatime` acceptable |
| Permissions | Image files `0640`, directories `0750`; tile server runs as read-only user |
| Concurrent access | Multiple tile server instances may read concurrently; no write contention (images are immutable after ingestion) |

## 4. Data Model

The data model mirrors the physical hierarchy of anatomic pathology: case → part → block → slide. It serves both clinical and de-identified collections.

Structured relational columns are used for fields that are consistently present and queried by filter (accession ID, stain, anatomic site, ICD codes). A `JSONB` metadata column on each entity provides an escape valve for fields that vary across specialties, appear only in certain case types, or change over time (Gleason score, margin status, tumor thickness, teaching notes).

### 4.1 Entity Relationships

```
                          iam.identity
                               │
                          0..N │ (assigned staff)
                               │
core.patients 1───0..N cases ──┤── 1───N parts 1───N blocks 1───N slides
                               │                                      │
                               ├── 1───N case_icd_codes          [physical WSI file]
                               │
                               └── 0..N case_pathologists
                                        (designation: PRIMARY | SECONDARY | CONSULTING | GROSSING)
                                        (person's org position resolved from iam.identity_roles)
```

The patient link is nullable: de-identified cases have `patient_id = NULL` (see §4.9). The case-pathologist link is a cross-schema relationship (`wsi.case_pathologists.identity_id` → `iam.identity.identity_id`); see §4.10.

### 4.2 Table: `cases`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | VARCHAR(64) | No | Accession number (clinical) or opaque HMAC ID (educational). Unique within collection. |
| `collection` | VARCHAR(16) | No | `'clinical'` or `'educational'` |
| `specimen_type` | VARCHAR(255) | Yes | E.g., `'Breast, left, lumpectomy'` |
| `clinical_history` | TEXT | Yes | Free-text clinical summary |
| `accession_date` | DATE | Yes | Original accession date (clinical only; NULL for educational) |
| `ingested_at` | TIMESTAMPTZ | No | When the case was added to the system |
| `status` | VARCHAR(32) | No | E.g., `'pending_review'`, `'signed_out'`, `'archived'` |
| `priority` | VARCHAR(16) | Yes | `'routine'`, `'stat'`, `'rush'` |
| `metadata` | JSONB | Yes | Extensible fields (see §4.8) |

**Indexes:**

- `UNIQUE (collection, case_id)` — accession uniqueness within a collection
- `GIN (metadata)` — enables efficient JSONB queries (e.g., `metadata->>'teaching_category'`)
- `BTREE (collection, status)` — worklist queries
- `BTREE (accession_date)` — date-range queries for clinical cases
- `BTREE (ingested_at)` — date-range queries for educational cases

### 4.3 Table: `parts`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | UUID FK | No | References `cases.id` |
| `part_label` | VARCHAR(16) | No | `'A'`, `'B'`, etc. (clinical) or opaque token (educational) |
| `part_designator` | VARCHAR(255) | Yes | Human label, e.g., `'Right lobe'`, `'Sentinel lymph node'` |
| `anatomic_site` | VARCHAR(128) | Yes | Standardized site: `'Breast'`, `'Prostate'`, `'Colon'` |
| `final_diagnosis` | TEXT | Yes | Part-level diagnostic narrative |
| `gross_description` | TEXT | Yes | Gross examination narrative |
| `metadata` | JSONB | Yes | Part-specific: margin status, tumor dimensions, grade, etc. |

**Indexes:**

- `BTREE (case_id)` — fast join to parent case
- `BTREE (anatomic_site)` — site-based search
- Full-text index on `final_diagnosis` via `tsvector` — enables diagnosis text search

**Design rationale:** Final diagnosis lives at the part level because that is how pathologists write it in clinical practice. A case-level diagnostic summary can be derived by aggregating part diagnoses, but forcing it into a single case-level field would lose the per-specimen granularity (e.g., a prostatectomy case where Part A is the prostate and Part B is lymph nodes, each with a distinct diagnosis).

### 4.4 Table: `case_icd_codes`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `case_id` | UUID FK | No | References `cases.id` |
| `icd_code` | VARCHAR(16) | No | ICD-10 or ICD-O morphology/topography code |
| `code_system` | VARCHAR(16) | No | `'ICD-10'`, `'ICD-O-3'`, `'SNOMED'` |
| `code_description` | VARCHAR(255) | Yes | Human-readable label |

**Primary key:** `(case_id, icd_code, code_system)`

**Indexes:**

- `BTREE (icd_code)` — fast lookup across all cases for a given code

**Design rationale:** ICD codes are stored at the case level even though diagnostically they derive from part-level findings. This reflects how codes are assigned in clinical practice (billing, tumor registries) and how they are queried in research (find all cases coded as C50.9). The JSONB metadata on parts can additionally carry part-specific coding if needed.

### 4.5 Table: `blocks`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `part_id` | UUID FK | No | References `parts.id` |
| `block_label` | VARCHAR(16) | No | `'1'`, `'2'`, etc. |
| `block_description` | TEXT | Yes | Tissue description, e.g., `'Representative section of tumor'` |

**Indexes:**

- `BTREE (part_id)` — fast join to parent part

### 4.6 Table: `slides`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `block_id` | UUID FK | No | References `blocks.id` |
| `slide_id` | VARCHAR(64) | No | External identifier: filename stem (clinical) or random token (educational) |
| `relative_path` | VARCHAR(512) | No | Path relative to collection root, e.g., `2026/S26-0001/S26-0001_A1_S1.svs` |
| `hmac` | VARCHAR(64) | No | HMAC-SHA256 hex digest computed at ingestion |
| `size_bytes` | BIGINT | No | File size; used for quick sanity check before full HMAC verification |
| `format` | VARCHAR(16) | No | File extension: `svs`, `tiff`, `ome.tiff`, `ndpi`, etc. |
| `stain` | VARCHAR(64) | Yes | Stain type: `'H&E'`, `'Ki-67'`, `'PAS'`, etc. |
| `level_label` | VARCHAR(16) | Yes | Cutting depth label (`L1`, `L2`). Stored in DB only, not in filename for edu slides. |
| `scanner` | VARCHAR(128) | Yes | Scanner make/model if known |
| `magnification` | DECIMAL(5,1) | Yes | Scan magnification (e.g., `40.0`) |
| `width_px` | INTEGER | Yes | Image width in pixels |
| `height_px` | INTEGER | Yes | Image height in pixels |
| `mpp_x` | DECIMAL(10,6) | Yes | Microns per pixel, X axis |
| `mpp_y` | DECIMAL(10,6) | Yes | Microns per pixel, Y axis |
| `ingested_at` | TIMESTAMPTZ | No | Timestamp of ingestion |
| `verified_at` | TIMESTAMPTZ | Yes | Last successful integrity verification |
| `scan_metadata` | JSONB | Yes | Full scanner metadata, color profile, compression, etc. |

**Indexes:**

- `UNIQUE (slide_id)` — globally unique slide identifier
- `BTREE (block_id)` — fast join to parent block
- `BTREE (relative_path)` — path-based lookup
- `BTREE (stain)` — stain-based filtering
- `BTREE (verified_at)` — find slides needing re-verification

**Immutability rule:** `relative_path` is set at ingestion and must not change during normal operation. If a file is physically moved (storage migration), the path is updated in the same database transaction as the move, and the HMAC is re-verified after the move completes.

### 4.7 Full-Text Search Strategy

For searching across diagnostic narratives, clinical history, and gross descriptions:

- **PostgreSQL `tsvector`** columns on `parts.final_diagnosis`, `parts.gross_description`, and `cases.clinical_history`, with GIN indexes
- A materialized view or search index that concatenates all text fields for a case (clinical history + all part diagnoses + all gross descriptions) enables case-level full-text search
- JSONB fields are searchable via `@>` containment operators and GIN indexes

For larger deployments (>100,000 cases), an external search engine (Elasticsearch, Meilisearch) may replace or supplement PostgreSQL full-text search. The data model does not change; only the search index pipeline differs.

### 4.8 JSONB Metadata Conventions

The `metadata` JSONB column on each entity is an escape valve for fields that vary by specialty or evolve over time. To maintain queryability, the following conventions apply:

**Case-level metadata (examples):**

```json
{
  "patient_age_at_accession": 56,
  "patient_sex": "F",
  "teaching_category": ["breast", "invasive_carcinoma"],
  "source_institution": "University Hospital",
  "de_identification_method": "safe_harbor"
}
```

**Part-level metadata (examples):**

```json
{
  "tumor_size_cm": 2.1,
  "margin_status": "negative",
  "closest_margin_mm": 3.5,
  "grade": "2",
  "gleason_score": "3+4=7",
  "er_status": "positive",
  "pr_status": "positive",
  "her2_status": "negative"
}
```

These fields are queryable via PostgreSQL JSONB operators (e.g., `WHERE metadata->>'er_status' = 'positive'`) and indexed via the GIN index on the column.

### 4.9 Patient Master and De-identification

Patient data is stored in a separate `core` schema, decoupled from both the identity/access management (`iam`) schema and the WSI storage (`wsi`) schema. This separation reflects the domain boundary: patients are clinical entities that exist independently of the imaging system.

**Table: `core.patients`**

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `mrn` | VARCHAR(64) | No | Medical record number (unique) |
| `given_name` | VARCHAR(128) | No | First name |
| `family_name` | VARCHAR(128) | No | Last name |
| `display_name` | VARCHAR(255) | No | Formatted display name |
| `dob` | DATE | Yes | Date of birth |
| `sex` | VARCHAR(8) | Yes | `'M'`, `'F'`, `'X'`, `'U'` |
| `phone` | VARCHAR(32) | Yes | Phone number |
| `email` | VARCHAR(255) | Yes | Email address |
| `address` | JSONB | Yes | Structured address (line, city, state, zip, country) |
| `is_active` | BOOLEAN | No | Whether the patient record is active |
| `is_test_patient` | BOOLEAN | No | Whether this is synthetic/test data |
| `metadata` | JSONB | Yes | Extensible fields (race, ethnicity, language, identifiers, flags) |
| `created_at` | TIMESTAMPTZ | No | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | Last modification timestamp |

**Relationship to `wsi.cases`:**

```
core.patients 1───0..N wsi.cases
                        (patient_id FK, ON DELETE SET NULL)
```

The `wsi.cases` table carries a nullable `patient_id` foreign key referencing `core.patients.id`. This relationship is the mechanism for both patient-case linkage and de-identification:

- **Clinical cases:** `patient_id` points to the patient record. The case can be queried by patient, and the patient's demographics are available for worklist display and clinical context.
- **De-identified / educational cases:** `patient_id` is `NULL`. Severing this link is the primary de-identification action. No patient-identifying information remains in the `wsi` schema — the case retains only its opaque case ID, specimen type, diagnosis, and image data.
- **"Send to Education" workflow:** When a clinical case is sent to the educational collection, a new case record is created with an opaque case ID, `collection = 'educational'`, and `patient_id = NULL`. The original clinical case is unaffected.

**`ON DELETE SET NULL` semantics:** If a patient record is removed from `core.patients` (e.g., patient data erasure request), all linked cases become orphaned (`patient_id = NULL`) rather than deleted. This preserves the imaging and diagnostic data while removing the patient link — effectively an automatic de-identification.

**Why `core` and not `iam` or `wsi`:**

- `iam` contains system users (pathologists, technologists, administrators) — people who log in. Patients do not log in.
- `wsi` contains imaging artifacts (cases, slides, tiles). Patient demographics are not imaging data.
- `core` is a neutral schema for clinical master data that multiple other schemas reference. If future modules need patient data (e.g., orders, results, clinical notes), they reference `core.patients` without coupling to the imaging schema.

**Test data convention (Xenonym):**

For development and testing, the `core.patients` table is seeded with 50 synthetic patients generated by the Xenonym project (seed: `azure-vale-9728`). These patients have phonologically plausible but unmistakably non-human names (e.g., "Ourfir Bruntilavoul", "Chungum Khumgezvovgaur"), fictional addresses in "Xenonymia," and built-in edge cases (SQL injection via family name, Unicode diacritics, mixed case). All Xenonym patients carry `is_test_patient = true` and MRNs in the range `XN-000001` through `XN-000050`. The seed file is located at `Okapi/seed/patients/xenonym-azure-vale-9728.json` and is loaded via `POST /admin/seed/patients`.

### 4.10 Case-Pathologist Assignment Model

Pathologist assignment to cases is stored as a first-class relationship in the `wsi` schema rather than only as a denormalized column on the worklist read model. This ensures a single source of truth for who is responsible for a case, supports one-to-many assignment (multiple people per case), and provides an audit trail for assignment changes.

#### 4.10.1 Assignment Pathways

Cases can be assigned to pathologists through three distinct pathways, all converging on the same `wsi.case_pathologists` table via a single assignment API:

1. **LIS-driven (accession desk):** When a case is accessioned in the Laboratory Information System, the LIS transmits the assigned pathologist as part of the case metadata (e.g., via HL7 ORM/OBR). The ingestion pipeline resolves the pathologist identity against `iam.identity` and writes the assignment to `case_pathologists`. This is the most common pathway for routine clinical cases — the case arrives with an assignment already made.

2. **Algorithmic (Qupanda service integration):** A third-party scheduling service (Qupanda) manages pathologist service schedules, subspecialty expertise, and workload balancing. The system queries Qupanda for the optimal assignment based on specimen type, service, and current pathologist availability, then writes the assignment via the same API. This pathway supports proportional case distribution and ensures cases are routed to pathologists who are on service.

3. **Manual (in-application):** An administrator or supervising pathologist assigns the case directly through the Okapi web client. This covers ad hoc reassignment, coverage changes, and educational case routing (assigning a resident or fellow to a case for training purposes).

All three pathways produce identical `case_pathologists` rows. The `assigned_by` column distinguishes the source: a system service account for LIS-driven and algorithmic assignments, or the acting user's identity for manual assignments.

#### 4.10.2 Table: `wsi.case_pathologists`

| Column | Type | Nullable | Description |
|:-------|:-----|:---------|:------------|
| `id` | UUID | No | Primary key |
| `case_id` | UUID FK | No | References `wsi.cases.id`. ON DELETE CASCADE. |
| `identity_id` | UUID FK | No | References `iam.identity.identity_id`. ON DELETE RESTRICT. |
| `designation` | VARCHAR(32) | No | The person's function on this case. CHECK IN (`PRIMARY`, `SECONDARY`, `CONSULTING`, `GROSSING`). |
| `sequence` | INTEGER | No | Display ordering within a designation group. Default 1. |
| `assigned_at` | TIMESTAMPTZ | No | When the assignment was made. Default `now()`. |
| `assigned_by` | UUID FK | Yes | References `iam.identity.identity_id`. The user or service account that created the assignment. NULL for system-seeded assignments. |

**Separation of designation and organizational position:**

The `designation` column captures the person's function on this specific case — are they the primary responsible party, a secondary, or a consultant? It does NOT encode the person's organizational position (pathologist, resident, fellow, cytotech, etc.). The organizational position is an inherent property of the identity, already modeled in `iam.identity` via role assignments (see V2 migration: `iam.identity_roles`).

This separation is important because the two dimensions are independent. A resident can be PRIMARY on a case (the resident assigned to draft and present it) while an attending pathologist is also PRIMARY on the same case (the one who signs it out). Two residents on the same case might have different designations (one PRIMARY trainee, one SECONDARY observer). A fellow can be a CONSULTING fellow. Mixing these into a single column would force artificial choices ("is this person a RESIDENT or a SECONDARY?") and would redundantly store information already captured in the IAM model.

At display time, the system resolves the full assignment label by joining `case_pathologists.designation` with the person's organizational role from `iam.identity_roles`. This produces human-readable labels such as "Primary Pathologist", "Secondary Resident", "Consulting Fellow", etc.

**Constraints:**

| Constraint | Type | Purpose |
|:-----------|:-----|:--------|
| `uq_case_identity` | UNIQUE (`case_id`, `identity_id`) | Prevents the same person from being assigned to the same case twice |
| `ix_case_one_primary` | Partial UNIQUE (`case_id`) WHERE `designation = 'PRIMARY'` | Enforces at most one PRIMARY assignment per case (see note below) |

**Note on the PRIMARY constraint:** The partial unique index enforces that at most one person holds the PRIMARY designation on a given case. In clinical practice, this is the attending pathologist who bears sign-out responsibility. Trainees (residents, fellows) working on the case are assigned as SECONDARY — their organizational role (RESIDENT, FELLOW) is visible from their identity, but their designation on the case reflects that the attending is ultimately responsible. If an institution's workflow requires distinguishing "primary trainee" from "secondary trainee," the `sequence` field provides ordering within the SECONDARY designation.

**Indexes:**

- `BTREE (identity_id)` — find all cases for a given person ("my cases" query)
- `BTREE (designation)` — filter by assignment designation

**Cross-schema foreign key:** The `identity_id` column references `iam.identity(identity_id)`, creating a cross-schema dependency between `wsi` and `iam`. This is intentional: identity is managed by the IAM system, and case assignment must reference real system users. The `ON DELETE RESTRICT` semantics prevent accidental deletion of a user who still has active case assignments — the identity must first be unassigned or deactivated.

#### 4.10.3 Relationship to the worklist read model

The `pathology_worklist` table (V4 migration) carries denormalized `assigned_to_identity_id` and `assigned_to_display` columns. These represent the PRIMARY assignment from `wsi.case_pathologists` and are updated when assignments change. The worklist is a read projection; `case_pathologists` is the source of truth. If they diverge, `case_pathologists` is authoritative.

#### 4.10.4 Designation semantics

| Designation | Meaning | Typical usage |
|:------------|:--------|:-------------|
| `PRIMARY` | The person ultimately responsible for this case | Attending pathologist who signs out; drives worklist "assigned to" display |
| `SECONDARY` | Additional person assigned to the case | Resident drafting the case, fellow rotating through, coverage pathologist, second reviewer |
| `CONSULTING` | Expert providing consultation on the case | Subspecialty consult (e.g., dermatopathologist reviewing a skin biopsy for a general pathologist) |
| `GROSSING` | The person who performed gross examination of the specimen | PA or resident who grossed the case; establishes the part/block/slide hierarchy. Tracked for training attribution and quality metrics. |

The person's organizational position (Pathologist, Resident, Fellow, Technician, etc.) is resolved at query time from `iam.identity_roles`, not stored in this table. The display label is a combination: `{designation} {position}` → "Primary Pathologist", "Secondary Resident", "Consulting Fellow".

#### 4.10.5 Design rationale

Why not just use the worklist `assigned_to_identity_id`? The worklist is a denormalized read model optimized for display performance. It has no designation differentiation (just "assigned to"), no history, no referential integrity (the comment in V4 migration explicitly says "no cross-schema foreign keys"), and supports only a single assignment per case. The `case_pathologists` table addresses all of these limitations while keeping the worklist as a fast projection for the common "show me my cases" query.

Why not encode the organizational position in the assignment table? Because it would duplicate data already in `iam.identity_roles` and create a maintenance burden — if a resident completes training and becomes an attending pathologist, their IAM role changes in one place, and all their existing case assignments automatically display the updated position without requiring a data migration in `case_pathologists`.

## 5. Integrity Verification

### 5.1 HMAC Computation

At ingestion, the system computes `HMAC-SHA256(key, file_bytes)` where `key` is a secret held in the tile server configuration (environment variable `LARGE_IMAGE_HMAC_KEY`). The 64-character hex digest is stored in `slides.hmac`.

**Why HMAC rather than bare SHA-256:**

| Threat | SHA-256 alone | HMAC-SHA256 |
|:-------|:-------------|:------------|
| Accidental corruption (bit rot) | Detected | Detected |
| Attacker modifies file on disk | Detected (if DB is uncompromised) | Detected (if DB is uncompromised) |
| Attacker modifies file AND has DB write access | **Not detected** — attacker recomputes hash | **Detected** — attacker cannot forge HMAC without key |

### 5.2 Verification Schedule

| Trigger | When | Latency Impact | Purpose |
|:--------|:-----|:---------------|:--------|
| Ingestion | At write time | None (offline) | Establish baseline HMAC |
| Background sweep | Nightly or weekly (configurable) | None (background job) | Detect silent corruption or tampering |
| Cold-start verification | First access after server restart (optional) | ~1-5s per slide on first request | Runtime tamper detection |

The tile server **never** computes HMACs on every tile request. Verification is a batch or cold-start operation, not a hot-path operation.

The background sweep iterates over all slides in the database, recomputes the HMAC for each file, and compares against the stored value. On success, it updates `slides.verified_at`. On failure, it logs an alert with the slide ID, expected HMAC, computed HMAC, and file size (to distinguish corruption from replacement).

### 5.3 Key Management

| Property | Specification |
|:---------|:-------------|
| Key provisioning | Environment variable `LARGE_IMAGE_HMAC_KEY` |
| Key storage | NOT in the database, version control, or on the storage volume |
| Key length | Minimum 32 bytes (256 bits); recommended: 64 bytes |
| Key rotation | Requires recomputing all HMACs as a background migration |
| Rotation strategy | Dual-key verification during rotation: accept either old or new key to avoid downtime |
| Key compromise response | Recompute all HMACs with new key; audit all `verified_at` timestamps |

## 6. Tile Server Integration

This section describes how the tile server (SDS-TLS-001) integrates with the storage layout. Changes are localized to `SourceManager._resolve_image_path()` (MOD-TLS-002).

### 6.1 Path Resolution

The tile server receives a slide identifier in the URL (e.g., `/deepzoom/{slide_id}.dzi`). Resolution depends on identifier format:

```
Incoming slide_id
      │
      ▼
┌─────────────────────────┐
│ Contains path separator │──── Yes ──→  Clinical path derivation:
│ (/ or %2F)?             │              parse year from case ID prefix,
└─────────────────────────┘              construct {root}/clinical/20{YY}/{case_id}/{filename}
      │                                          │
      No                                         ▼
      │                                  ┌───────────────┐
      ▼                                  │ File exists?  │── Yes ──→ Serve
┌─────────────────────────┐              └───────────────┘
│ Database lookup by       │                     │ No
│ slides.slide_id          │                     ▼
└─────────────────────────┘              Database lookup (fallback)
      │
      ▼
  Resolve relative_path
  from DB result, prepend
  collection storage root
      │
      ▼
    Serve
```

The resolved path is cached in the source manager LRU cache. Subsequent tile requests for the same slide bypass path resolution entirely.

### 6.2 API Compatibility

The existing tile server API (`/deepzoom`, `/tiles`, `/metadata` endpoints as defined in SDS-TLS-001) remains unchanged. The slide identifier in the URL is interpreted as either a clinical accession-qualified path (e.g., `S26-0001/S26-0001_A1_S1.svs`) or an opaque slide ID (e.g., `e4b8`), depending on format.

### 6.3 Configuration

New configuration parameters for the tile server:

| Setting | Environment Variable | Default | Description |
|:--------|:--------------------|:--------|:------------|
| Clinical storage root | `STORAGE_CLINICAL_ROOT` | `/storage/clinical` | Root for clinical slides |
| Educational storage root | `STORAGE_EDU_ROOT` | `/storage/edu` | Root for educational slides |
| HMAC key | `LARGE_IMAGE_HMAC_KEY` | (required) | Secret key for HMAC computation |
| Verify on cold start | `VERIFY_ON_COLD_START` | `false` | Verify HMAC on first access after restart |
| Database URL | `STORAGE_DB_URL` | (required) | Connection string for metadata database |

## 7. Ingestion Workflow

The ingestion process is how images enter the storage system. It is a transactional operation: either the image is fully ingested (file placed, database record created, HMAC computed) or the operation is rolled back.

### 7.1 Clinical Slide Ingestion

```
1. Receive image file + case metadata (accession, part, block, slide labels)
2. Parse year from accession number
3. Construct target path: {clinical_root}/{year}/{case_id}/{filename}
4. Create directory if needed
5. Write file to target path (atomic: write to temp, then rename)
6. Compute HMAC-SHA256 of written file
7. Read image metadata (dimensions, magnification, mpp) via large_image
8. INSERT into cases/parts/blocks/slides tables in a single transaction
9. If any step fails: delete the written file, rollback transaction
```

### 7.2 Educational Slide Ingestion (De-identification)

```
1. Receive image file + original accession (from honest broker)
2. Compute case-level opaque ID: truncate(HMAC-SHA256(salt, original_accession), 8)
3. Generate random 4-hex-character slide token
4. Determine ingestion year/month
5. Construct target path: {edu_root}/{year}/{month}/{case_opaque_id}/{slide_token}.{ext}
6. Strip identifying metadata from image file headers (scanner timestamps, patient fields)
7. Write stripped file to target path
8. Compute HMAC-SHA256 of written file
9. Read image metadata (dimensions, magnification, mpp) via large_image
10. INSERT into database tables
11. If any step fails: delete, rollback
```

### 7.3 Metadata Stripping

Before an image enters the educational collection, the following fields must be removed or redacted from file headers:

| Field | Location | Action |
|:------|:---------|:-------|
| Patient name | SVS/TIFF ImageDescription tag | Remove |
| Accession number | SVS/TIFF ImageDescription tag | Remove |
| Scan date/time | TIFF DateTime tag, scanner-specific tags | Replace with ingestion date or remove |
| Scanner serial number | Vendor-specific tags | Evaluate; remove if uniquely identifying |
| Institution name | Vendor-specific tags | Remove |
| Barcode text | Label associated image, barcode metadata | Remove; regenerate label image if needed |

**The label associated image** embedded in many SVS files often contains the patient name or accession number printed on the physical slide label. This image must be either removed or replaced with a generated label showing only the opaque slide ID.

## 8. Capacity Planning

### 8.1 Storage Sizing

| Parameter | Estimate |
|:----------|:---------|
| Cases per month | ~1,000 |
| Slides per case (average) | ~10 |
| Slides per month | ~10,000 |
| Average slide file size | ~500 MB (range: 50 MB – 2 GB) |
| Monthly storage growth | ~5 TB |
| Annual storage growth | ~60 TB |
| 5-year projection | ~300 TB |

### 8.2 Directory Sizing

| Level | Entries per directory | Notes |
|:------|:---------------------|:------|
| `clinical/` | ~1 per year | Grows by 1 directory per year |
| `clinical/2026/` | ~12,000 case directories | Upper bound; well within XFS/ext4 limits |
| `clinical/2026/S26-0001/` | ~10 files | Typical case |
| `edu/2026/` | 12 month directories | Fixed |
| `edu/2026/03/` | ~1,000 case directories | Depends on ingestion rate |

### 8.3 Tiered Storage

As clinical data ages, slides from prior years become less frequently accessed but must remain available for legal, accreditation, and research purposes.

| Tier | Storage type | Latency | Contents |
|:-----|:-------------|:--------|:---------|
| Hot | NVMe SSD or fast SAN | <1ms random read | Current year + active cases |
| Warm | HDD array or NAS | ~5ms random read | Prior 2-5 years |
| Cold | Tape / object store | Seconds to minutes | Archive (>5 years) |

The tile server can be configured with multiple storage roots corresponding to tiers. Path resolution checks hot tier first, then warm. Cold-tier access would require a retrieval request (not real-time tile serving).

## 9. Concurrent Access and Locking

Images are **immutable after ingestion**. There is no write contention. Multiple tile server instances may read the same files concurrently without coordination.

Ingestion is the only write operation and uses atomic file creation (write to temporary file, then `rename(2)` to final path). This ensures a tile server never reads a partially-written file.

The database uses standard PostgreSQL transaction isolation. Ingestion writes and tile server reads operate on different rows with no conflict.

## 10. Error Handling

| Error condition | Detection | Response |
|:----------------|:----------|:---------|
| File missing (DB record exists, file absent) | Path resolution failure | Return HTTP 404 to viewer; log alert for investigation |
| HMAC mismatch (background sweep) | Sweep job | Log alert with slide ID, expected vs. computed HMAC; flag slide as `verification_failed` |
| HMAC mismatch (cold-start check) | First access | Refuse to serve tiles; return HTTP 503; log alert |
| Database unreachable | Path resolution failure | Return HTTP 503; tile server health check reports degraded |
| Corrupt image (large_image cannot open) | Source manager | Return HTTP 500 with error detail; log for investigation |
| Disk full during ingestion | File write failure | Roll back: delete partial file, rollback DB transaction |
| Duplicate ingestion attempt | UNIQUE constraint violation | Reject with informative error; do not overwrite existing file |

## 11. Migration from Current Structure

The current `test-cases/` directory uses a flat layout: case directories directly under the image root with a single `cases.json` manifest.

### 11.1 Migration Steps

1. Create `clinical/2026/` directory under new storage root
2. Move existing case directories (`S26-0001/`, `S26-0002/`, etc.) into `clinical/2026/`
3. Populate relational database tables from `cases.json`
4. Compute HMAC-SHA256 for each image file; store in `slides.hmac`
5. Extract image metadata (dimensions, magnification, mpp) via `large_image`; populate `slides` columns
6. Update tile server `SourceManager._resolve_image_path()` to check year-partitioned path first, fall back to flat layout for backward compatibility during transition
7. Validate: for each slide, confirm tile server can resolve and serve tiles via new path
8. Remove flat layout fallback after validation period

### 11.2 Backward Compatibility

During migration, the tile server supports both old-style flat paths (`{image_dir}/S26-0001/S26-0001_A1_S1.svs`) and new-style year-partitioned paths (`{image_dir}/clinical/2026/S26-0001/S26-0001_A1_S1.svs`). The resolution order is: new path first, flat fallback second. This allows incremental migration without downtime.

The `cases.json` manifest file may be retained as a secondary human-readable data source but is no longer authoritative once the database is populated.

## 12. Traceability

| Design Element | Traces To |
|:---------------|:----------|
| Storage layout (§3) | SDS-TLS-001 MOD-TLS-002 (Source Manager path resolution) |
| Data model (§4) | SRS system requirements for case management and worklist |
| Patient master (§4.9) | SRS patient management; HIPAA de-identification requirements |
| Case-pathologist assignment (§4.10) | SRS-001 §1.12 (SYS-CA-001 through SYS-CA-012); PURS UN-CA-001 through UN-CA-004 |
| Integrity verification (§5) | Cybersecurity requirements (SDS-CYB) |
| Tile server integration (§6) | SDS-TLS-001 MOD-TLS-002, MOD-TLS-003, MOD-TLS-004 |
| De-identification (§3.3, §4.9, §7.2) | HIPAA 45 CFR §164.514; Hazard Analysis |
| Error handling (§10) | SRS reliability and availability requirements |

## 13. Open Questions

- **Retention policy:** What is the minimum retention period for clinical slides before they can move to cold storage? This is jurisdiction-dependent (typically 10-20 years for surgical pathology).
- **Multi-site replication:** If the system operates at multiple sites, should images be replicated across sites or accessed via a federated query model? Deferred to a separate specification.
- **MRXS companion directories:** The current layout assumes one-file-per-slide. MIRAX `.mrxs` files with companion data directories need special handling during ingestion and migration. Test with actual MIRXS data before finalizing.
- **Large case handling:** Cases with >50 slides (e.g., Whipple procedures, autopsy cases) — does the flat-within-case-directory model hold, or should these be further subdivided?

## 14. Revision History

| Version | Date | Author | Description |
|:--------|:-----|:-------|:------------|
| 0.1 | 2026-02-28 | Engineering | Initial draft |

---

**Document Control**: This is a controlled document. Changes require review and approval per SOP-DHF-Management.
