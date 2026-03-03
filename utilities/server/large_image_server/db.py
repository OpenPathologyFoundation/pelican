"""Database access layer for WSI metadata (SDS-STR-001).

Provides query and transactional write functions against the wsi schema in
PostgreSQL. Uses psycopg v3 with connection pooling. All queries use
parameterized SQL.

When ``storage_db_url`` is not configured the module is inert — all public
functions return ``None`` or empty lists so callers can fall back to the
JSON/filesystem code path.
"""

import atexit
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    """Lazily create the connection pool from settings."""
    global _pool
    if _pool is not None:
        return _pool

    with _pool_lock:
        # Double-check after acquiring lock
        if _pool is not None:
            return _pool

        from .config import get_settings
        settings = get_settings()

        if not settings.storage_db_url:
            return None

        try:
            from psycopg_pool import ConnectionPool
        except ImportError:
            logger.warning(
                'psycopg_pool not installed — install with: '
                'pip install large-image-server[db]'
            )
            return None

        _pool = ConnectionPool(
            conninfo=settings.storage_db_url,
            min_size=1,
            max_size=4,
            open=True,
            kwargs={'autocommit': True},
        )
        atexit.register(_shutdown_pool)
        logger.info('WSI database pool opened: %s', settings.storage_db_url.split('@')[-1])
        return _pool


def _shutdown_pool():
    """Close the pool at interpreter shutdown."""
    global _pool
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None


def is_configured() -> bool:
    """Return True if database storage is configured and available."""
    return _get_pool() is not None


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def _fetchone(sql: str, params: tuple = ()) -> dict[str, Any] | None:
    pool = _get_pool()
    if pool is None:
        return None
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            if row is None:
                return None
            cols = [desc.name for desc in cur.description]
            return dict(zip(cols, row))


def _fetchall(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    pool = _get_pool()
    if pool is None:
        return []
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [desc.name for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Public API — called by routes/cases.py and source_manager.py
# ---------------------------------------------------------------------------

def get_slide_by_id(slide_id: str) -> dict[str, Any] | None:
    """Look up a slide by its unique slide_id.

    Searches clinical (wsi) schema first, then educational (wsi_edu).
    Returns dict with keys: slide_id, relative_path, format, stain,
    level_label, case_id, collection ('clinical' or 'educational').
    """
    # Try clinical schema first
    result = _fetchone(
        """
        SELECT s.slide_id,
               s.relative_path,
               s.format,
               s.stain,
               s.level_label,
               s.magnification,
               s.width_px,
               s.height_px,
               s.mpp_x,
               s.mpp_y,
               c.case_id,
               'clinical' AS collection
          FROM wsi.slides s
          JOIN wsi.blocks b ON b.id = s.block_id
          JOIN wsi.parts  p ON p.id = b.part_id
          JOIN wsi.cases  c ON c.id = p.case_id
         WHERE s.slide_id = %s
        """,
        (slide_id,),
    )
    if result:
        return result

    # Fallback to educational schema
    return _fetchone(
        """
        SELECT s.slide_id,
               s.relative_path,
               s.format,
               s.stain,
               s.level_label,
               s.magnification,
               s.width_px,
               s.height_px,
               s.mpp_x,
               s.mpp_y,
               c.case_id,
               'educational' AS collection
          FROM wsi_edu.slides s
          JOIN wsi_edu.blocks b ON b.id = s.block_id
          JOIN wsi_edu.parts  p ON p.id = b.part_id
          JOIN wsi_edu.cases  c ON c.id = p.case_id
         WHERE s.slide_id = %s
        """,
        (slide_id,),
    )


def get_patient_by_mrn(mrn: str) -> dict | None:
    """Look up a patient by MRN. Returns dict with id, mrn, display_name, sex, dob."""
    return _fetchone(
        'SELECT id, mrn, display_name, sex, dob FROM core.patients WHERE mrn = %s',
        (mrn,),
    )


def get_patient_by_uuid(patient_uuid: str) -> dict | None:
    """Look up a patient by UUID. Returns dict with id, mrn, display_name, sex, dob."""
    return _fetchone(
        'SELECT id, mrn, display_name, sex, dob FROM core.patients WHERE id = %s::uuid',
        (patient_uuid,),
    )


def resolve_slide_path(image_id: str) -> dict[str, Any] | None:
    """Resolve an image identifier to a slide row.

    Handles multiple identifier formats used by different routes:
      - Exact slide_id: "S26-0001_A1_S1"
      - Path with filename: "S26-0001/S26-0001_A1_S1.svs"
      - Relative path: "2026/S26-0001/S26-0001_A1_S1.svs"

    Returns the same dict shape as get_slide_by_id, or None.
    """
    # 1. Try exact slide_id match
    result = get_slide_by_id(image_id)
    if result:
        return result

    # 2. Extract filename, strip extensions, try as slide_id
    #    "S26-0001/S26-0001_A1_S1.svs" → "S26-0001_A1_S1"
    #    "S26-0004/S26-0004_A3_S1.ome.tiff" → "S26-0004_A3_S1"
    from pathlib import PurePosixPath
    filename = PurePosixPath(image_id).name
    # Strip all suffixes (handles .ome.tiff, .ome.tif, etc.)
    stem = filename
    while '.' in stem:
        stem = stem.rsplit('.', 1)[0]
    if stem != image_id:
        result = get_slide_by_id(stem)
        if result:
            return result

    # 3. Try matching by relative_path suffix (clinical first, then edu)
    #    image_id "S26-0001/S26-0001_A1_S1.svs" matches
    #    relative_path "2026/S26-0001/S26-0001_A1_S1.svs"
    result = _fetchone(
        """
        SELECT s.slide_id,
               s.relative_path,
               s.format,
               s.stain,
               s.level_label,
               s.magnification,
               s.width_px,
               s.height_px,
               s.mpp_x,
               s.mpp_y,
               c.case_id,
               'clinical' AS collection
          FROM wsi.slides s
          JOIN wsi.blocks b ON b.id = s.block_id
          JOIN wsi.parts  p ON p.id = b.part_id
          JOIN wsi.cases  c ON c.id = p.case_id
         WHERE s.relative_path LIKE '%%' || %s
         LIMIT 1
        """,
        (image_id,),
    )
    if result:
        return result

    return _fetchone(
        """
        SELECT s.slide_id,
               s.relative_path,
               s.format,
               s.stain,
               s.level_label,
               s.magnification,
               s.width_px,
               s.height_px,
               s.mpp_x,
               s.mpp_y,
               c.case_id,
               'educational' AS collection
          FROM wsi_edu.slides s
          JOIN wsi_edu.blocks b ON b.id = s.block_id
          JOIN wsi_edu.parts  p ON p.id = b.part_id
          JOIN wsi_edu.cases  c ON c.id = p.case_id
         WHERE s.relative_path LIKE '%%' || %s
         LIMIT 1
        """,
        (image_id,),
    )


def list_cases(
    status: str | None = None,
    priority: str | None = None,
) -> list[dict[str, Any]]:
    """List cases with summary info and slide count.

    Returns list of dicts matching the JSON-derived format used by the
    /cases and /worklist endpoints.
    """
    conditions = ['1=1']
    params: list[Any] = []

    if status:
        conditions.append('c.status = %s')
        params.append(status)
    if priority:
        conditions.append('c.priority = %s')
        params.append(priority)

    where = ' AND '.join(conditions)

    rows = _fetchall(
        f"""
        SELECT c.case_id,
               c.specimen_type,
               c.clinical_history,
               c.accession_date,
               c.status,
               c.priority,
               pt.mrn AS patient_mrn,
               pt.display_name AS patient_name,
               pt.dob AS patient_dob,
               pt.sex AS patient_sex,
               count(s.id) AS slide_count
          FROM wsi.cases c
          LEFT JOIN core.patients pt ON pt.id = c.patient_id
          LEFT JOIN wsi.parts  p ON p.case_id = c.id
          LEFT JOIN wsi.blocks b ON b.part_id = p.id
          LEFT JOIN wsi.slides s ON s.block_id = b.id
         WHERE {where}
         GROUP BY c.id, pt.mrn, pt.display_name, pt.dob, pt.sex
         ORDER BY
            CASE c.priority
                WHEN 'stat' THEN 0
                WHEN 'rush' THEN 1
                ELSE 2
            END,
            c.accession_date
        """,
        tuple(params),
    )

    result = []
    for r in rows:
        # Extract diagnosis from first part's final_diagnosis
        diagnosis = _get_case_diagnosis(r['case_id'])
        result.append({
            'caseId': r['case_id'],
            'patientName': r.get('patient_name') or '',
            'patientId': r.get('patient_mrn') or '',
            'accessionDate': str(r['accession_date']) if r['accession_date'] else None,
            'diagnosis': diagnosis,
            'specimenType': r['specimen_type'],
            'status': r['status'],
            'priority': r['priority'],
            'slideCount': r['slide_count'],
        })
    return result


def _get_case_diagnosis(case_id: str) -> str | None:
    """Get the first part's final_diagnosis for a case."""
    row = _fetchone(
        """
        SELECT p.final_diagnosis
          FROM wsi.parts p
          JOIN wsi.cases c ON c.id = p.case_id
         WHERE c.case_id = %s
         ORDER BY p.part_label
         LIMIT 1
        """,
        (case_id,),
    )
    return row['final_diagnosis'] if row else None


def get_case(case_id: str) -> dict[str, Any] | None:
    """Get full case details with nested parts -> blocks -> slides.

    Searches clinical (wsi) schema first, then educational (wsi_edu).
    Returns a dict matching the JSON format expected by the API.
    """
    # Try clinical schema first
    case_row = _fetchone(
        """
        SELECT c.id AS uuid, c.case_id, c.collection, c.specimen_type,
               c.clinical_history, c.accession_date, c.status, c.priority,
               pt.mrn AS patient_mrn, pt.display_name AS patient_name,
               pt.dob AS patient_dob, pt.sex AS patient_sex
          FROM wsi.cases c
          LEFT JOIN core.patients pt ON pt.id = c.patient_id
         WHERE c.case_id = %s
        """,
        (case_id,),
    )
    if case_row is not None:
        return _build_case_response(case_row, schema='wsi')

    # Fallback to educational schema (no patient join)
    case_row = _fetchone(
        """
        SELECT c.id AS uuid, c.case_id, c.collection, c.specimen_type,
               c.clinical_history, c.accession_date, c.status,
               NULL AS priority,
               NULL AS patient_mrn, NULL AS patient_name,
               NULL AS patient_dob, NULL AS patient_sex
          FROM wsi_edu.cases c
         WHERE c.case_id = %s
        """,
        (case_id,),
    )
    if case_row is not None:
        return _build_case_response(case_row, schema='wsi_edu')

    return None


def _build_case_response(
    case_row: dict[str, Any],
    schema: str = 'wsi',
) -> dict[str, Any]:
    """Build case response dict from a case row and its slides."""
    slides = _fetchall(
        f"""
        SELECT s.slide_id, s.relative_path, s.format, s.stain,
               s.level_label, s.magnification, s.width_px, s.height_px,
               s.mpp_x, s.mpp_y,
               p.part_label, p.final_diagnosis,
               b.block_label
          FROM {schema}.slides s
          JOIN {schema}.blocks b ON b.id = s.block_id
          JOIN {schema}.parts  p ON p.id = b.part_id
         WHERE p.case_id = %s
         ORDER BY p.part_label, b.block_label, s.slide_id
        """,
        (case_row['uuid'],),
    )

    slide_list = []
    for s in slides:
        # Derive filename from relative_path (last segment)
        filename = s['relative_path'].rsplit('/', 1)[-1] if s['relative_path'] else ''
        slide_list.append({
            'slideId': s['slide_id'],
            'filename': filename,
            'stain': s['stain'],
            'levelLabel': s['level_label'],
            'partLabel': s['part_label'],
            'blockLabel': s['block_label'],
        })

    diagnosis = slides[0]['final_diagnosis'] if slides else None

    patient_dob = case_row.get('patient_dob')
    if patient_dob is not None:
        patient_dob = str(patient_dob)

    return {
        'caseId': case_row['case_id'],
        'patientName': case_row.get('patient_name') or '',
        'patientId': case_row.get('patient_mrn') or '',
        'patientDob': patient_dob or '',
        'patientSex': case_row.get('patient_sex') or '',
        'accessionDate': str(case_row['accession_date']) if case_row['accession_date'] else None,
        'clinicalHistory': case_row['clinical_history'],
        'specimenType': case_row['specimen_type'],
        'diagnosis': diagnosis,
        'status': case_row['status'],
        'priority': case_row.get('priority'),
        'slides': slide_list,
    }


def get_case_slides(case_id: str) -> list[dict[str, Any]] | None:
    """Get slides for a case. Returns None if case not found."""
    case = get_case(case_id)
    if case is None:
        return None
    return case.get('slides', [])


def get_slide_with_context(slide_id: str) -> dict[str, Any] | None:
    """Get slide details with case context.

    Searches clinical (wsi) first, then educational (wsi_edu).
    Returns dict matching the format of the /slides/{id} endpoint.
    """
    # Try clinical schema
    row = _fetchone(
        """
        SELECT s.slide_id, s.relative_path, s.format, s.stain,
               s.level_label, s.magnification, s.width_px, s.height_px,
               s.mpp_x, s.mpp_y,
               c.case_id, c.status, c.priority,
               pt.mrn AS patient_mrn, pt.display_name AS patient_name,
               pt.dob AS patient_dob, pt.sex AS patient_sex,
               p.part_label, p.final_diagnosis,
               b.block_label
          FROM wsi.slides s
          JOIN wsi.blocks b ON b.id = s.block_id
          JOIN wsi.parts  p ON p.id = b.part_id
          JOIN wsi.cases  c ON c.id = p.case_id
          LEFT JOIN core.patients pt ON pt.id = c.patient_id
         WHERE s.slide_id = %s
        """,
        (slide_id,),
    )

    # Fallback to educational schema
    if row is None:
        row = _fetchone(
            """
            SELECT s.slide_id, s.relative_path, s.format, s.stain,
                   s.level_label, s.magnification, s.width_px, s.height_px,
                   s.mpp_x, s.mpp_y,
                   c.case_id, c.status, NULL AS priority,
                   NULL AS patient_mrn, NULL AS patient_name,
                   NULL AS patient_dob, NULL AS patient_sex,
                   p.part_label, p.final_diagnosis,
                   b.block_label
              FROM wsi_edu.slides s
              JOIN wsi_edu.blocks b ON b.id = s.block_id
              JOIN wsi_edu.parts  p ON p.id = b.part_id
              JOIN wsi_edu.cases  c ON c.id = p.case_id
             WHERE s.slide_id = %s
            """,
            (slide_id,),
        )

    if row is None:
        return None

    filename = row['relative_path'].rsplit('/', 1)[-1] if row['relative_path'] else ''

    patient_dob = row.get('patient_dob')
    if patient_dob is not None:
        patient_dob = str(patient_dob)

    return {
        'slideId': row['slide_id'],
        'filename': filename,
        'stain': row['stain'],
        'levelLabel': row['level_label'],
        'partLabel': row['part_label'],
        'blockLabel': row['block_label'],
        'caseContext': {
            'caseId': row['case_id'],
            'patientName': row.get('patient_name') or '',
            'patientId': row.get('patient_mrn') or '',
            'patientDob': patient_dob or '',
            'diagnosis': row['final_diagnosis'],
            'status': row['status'],
            'priority': row.get('priority'),
        },
    }


def get_worklist_cases(
    status: str | None = None,
    priority: str | None = None,
) -> list[dict[str, Any]]:
    """Get cases formatted as worklist entries with slide summaries.

    Each case includes a 'slides' list with slideId, stain, and filename.
    """
    cases = list_cases(status=status, priority=priority)

    for case in cases:
        slides = _fetchall(
            """
            SELECT s.slide_id, s.stain, s.relative_path
              FROM wsi.slides s
              JOIN wsi.blocks b ON b.id = s.block_id
              JOIN wsi.parts  p ON p.id = b.part_id
              JOIN wsi.cases  c ON c.id = p.case_id
             WHERE c.case_id = %s
             ORDER BY s.slide_id
            """,
            (case['caseId'],),
        )
        case['slides'] = [
            {
                'slideId': s['slide_id'],
                'stain': s['stain'],
                'filename': s['relative_path'].rsplit('/', 1)[-1] if s['relative_path'] else '',
            }
            for s in slides
        ]

    return cases


def search_cases(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search cases by case_id (case-insensitive substring match)."""
    rows = _fetchall(
        """
        SELECT c.case_id,
               c.specimen_type,
               c.clinical_history,
               c.accession_date,
               c.status,
               c.priority,
               pt.mrn AS patient_mrn,
               pt.display_name AS patient_name,
               pt.dob AS patient_dob,
               pt.sex AS patient_sex,
               count(s.id) AS slide_count
          FROM wsi.cases c
          LEFT JOIN core.patients pt ON pt.id = c.patient_id
          LEFT JOIN wsi.parts  p ON p.case_id = c.id
          LEFT JOIN wsi.blocks b ON b.part_id = p.id
          LEFT JOIN wsi.slides s ON s.block_id = b.id
         WHERE c.case_id ILIKE '%%' || %s || '%%'
         GROUP BY c.id, pt.mrn, pt.display_name, pt.dob, pt.sex
         ORDER BY c.case_id
         LIMIT %s
        """,
        (query, limit),
    )

    result = []
    for r in rows:
        diagnosis = _get_case_diagnosis(r['case_id'])
        result.append({
            'caseId': r['case_id'],
            'patientName': r.get('patient_name') or '',
            'patientId': r.get('patient_mrn') or '',
            'accessionDate': str(r['accession_date']) if r['accession_date'] else None,
            'diagnosis': diagnosis,
            'specimenType': r['specimen_type'],
            'status': r['status'],
            'priority': r['priority'],
            'slideCount': r['slide_count'],
        })
    return result


# ---------------------------------------------------------------------------
# Write helpers — transactional ingestion (SDS-STR-001 §7)
# ---------------------------------------------------------------------------

def _execute_returning(conn, sql: str, params: tuple) -> dict[str, Any] | None:
    """Execute INSERT … RETURNING inside an existing connection/transaction."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        if row is None:
            return None
        cols = [desc.name for desc in cur.description]
        return dict(zip(cols, row))


def _fetchone_conn(conn, sql: str, params: tuple) -> dict[str, Any] | None:
    """Execute a SELECT inside an existing connection/transaction."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        if row is None:
            return None
        cols = [desc.name for desc in cur.description]
        return dict(zip(cols, row))


def find_or_create_case(conn, case_id: str, collection: str, **kwargs) -> dict[str, Any]:
    """Find existing case or create new one. Returns case row with 'id'.

    Runs within an existing connection/transaction.
    If the case already exists but has no patient_id and one is provided,
    the FK is backfilled.
    """
    row = _fetchone_conn(
        conn,
        'SELECT id, case_id, collection, patient_id FROM wsi.cases WHERE case_id = %s',
        (case_id,),
    )
    if row:
        if kwargs.get('patient_id') and not row.get('patient_id'):
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE wsi.cases SET patient_id = %s WHERE id = %s',
                    (kwargs['patient_id'], row['id']),
                )
        return row

    return _execute_returning(
        conn,
        """
        INSERT INTO wsi.cases (case_id, collection, specimen_type,
            clinical_history, accession_date, status, priority, patient_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, case_id, collection
        """,
        (
            case_id,
            collection,
            kwargs.get('specimen_type'),
            kwargs.get('clinical_history'),
            kwargs.get('accession_date'),
            kwargs.get('status', 'pending_review'),
            kwargs.get('priority', 'routine'),
            kwargs.get('patient_id'),
        ),
    )


def find_or_create_part(conn, case_uuid, part_label: str, **kwargs) -> dict[str, Any]:
    """Find existing part or create new one. Returns part row with 'id'."""
    row = _fetchone_conn(
        conn,
        'SELECT id, part_label FROM wsi.parts WHERE case_id = %s AND part_label = %s',
        (case_uuid, part_label),
    )
    if row:
        return row

    return _execute_returning(
        conn,
        """
        INSERT INTO wsi.parts (case_id, part_label, part_designator,
            anatomic_site, final_diagnosis)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, part_label
        """,
        (
            case_uuid,
            part_label,
            kwargs.get('part_designator'),
            kwargs.get('anatomic_site'),
            kwargs.get('final_diagnosis'),
        ),
    )


def find_or_create_block(conn, part_uuid, block_label: str) -> dict[str, Any]:
    """Find existing block or create new one. Returns block row with 'id'."""
    row = _fetchone_conn(
        conn,
        'SELECT id, block_label FROM wsi.blocks WHERE part_id = %s AND block_label = %s',
        (part_uuid, block_label),
    )
    if row:
        return row

    return _execute_returning(
        conn,
        """
        INSERT INTO wsi.blocks (part_id, block_label)
        VALUES (%s, %s)
        RETURNING id, block_label
        """,
        (part_uuid, block_label),
    )


def insert_slide(conn, block_uuid, slide_id: str, relative_path: str, **kwargs) -> dict[str, Any]:
    """Insert a new slide record. Raises IntegrityError on duplicate slide_id."""
    return _execute_returning(
        conn,
        """
        INSERT INTO wsi.slides (
            block_id, slide_id, relative_path, format, hmac,
            size_bytes, stain, level_label, magnification,
            width_px, height_px, mpp_x, mpp_y,
            scanner, scan_metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        RETURNING id, slide_id, relative_path, format, hmac,
                  size_bytes, width_px, height_px, magnification, mpp_x, mpp_y
        """,
        (
            block_uuid,
            slide_id,
            relative_path,
            kwargs.get('format_ext'),
            kwargs.get('hmac_hex'),
            kwargs.get('size_bytes'),
            kwargs.get('stain'),
            kwargs.get('level_label'),
            kwargs.get('magnification'),
            kwargs.get('width_px'),
            kwargs.get('height_px'),
            kwargs.get('mpp_x'),
            kwargs.get('mpp_y'),
            kwargs.get('scanner'),
            kwargs.get('scan_metadata_json'),
        ),
    )


def ingest_slide_transactional(
    case_id: str,
    collection: str,
    part_label: str,
    block_label: str,
    slide_id: str,
    relative_path: str,
    hmac_hex: str,
    size_bytes: int,
    format_ext: str,
    stain: str | None = None,
    level_label: str | None = None,
    magnification: float | None = None,
    width_px: int | None = None,
    height_px: int | None = None,
    mpp_x: float | None = None,
    mpp_y: float | None = None,
    scanner: str | None = None,
    scan_metadata: dict | None = None,
    patient_id: str | None = None,
    specimen_type: str | None = None,
    accession_date: str | None = None,
    part_designator: str | None = None,
    anatomic_site: str | None = None,
    final_diagnosis: str | None = None,
) -> dict[str, Any]:
    """Atomic ingestion: find/create case -> part -> block, insert slide.

    All operations in a single transaction. Returns the inserted slide row.
    Raises IntegrityError on duplicate slide_id.
    """
    import json

    pool = _get_pool()
    if pool is None:
        raise RuntimeError('Database not configured')

    scan_metadata_json = json.dumps(scan_metadata) if scan_metadata else None

    with pool.connection() as conn:
        conn.autocommit = False
        try:
            case_row = find_or_create_case(
                conn, case_id, collection,
                specimen_type=specimen_type,
                accession_date=accession_date,
                patient_id=patient_id,
            )

            part_row = find_or_create_part(
                conn, case_row['id'], part_label,
                part_designator=part_designator,
                anatomic_site=anatomic_site,
                final_diagnosis=final_diagnosis,
            )

            block_row = find_or_create_block(conn, part_row['id'], block_label)

            slide_row = insert_slide(
                conn, block_row['id'], slide_id, relative_path,
                format_ext=format_ext,
                hmac_hex=hmac_hex,
                size_bytes=size_bytes,
                stain=stain,
                level_label=level_label,
                magnification=magnification,
                width_px=width_px,
                height_px=height_px,
                mpp_x=mpp_x,
                mpp_y=mpp_y,
                scanner=scanner,
                scan_metadata_json=scan_metadata_json,
            )

            conn.commit()
            return slide_row
        except Exception:
            conn.rollback()
            raise


def update_slide_verified(slide_id: str) -> bool:
    """Set verified_at = now() for a slide. Returns True if updated."""
    pool = _get_pool()
    if pool is None:
        return False
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE wsi.slides SET verified_at = now() WHERE slide_id = %s',
                (slide_id,),
            )
            return cur.rowcount > 0


def list_slides_missing_hmac() -> list[dict[str, Any]]:
    """Return slides where hmac IS NULL (need backfill).

    Fields: slide_id, relative_path.
    """
    return _fetchall(
        """
        SELECT s.slide_id, s.relative_path
          FROM wsi.slides s
         WHERE s.hmac IS NULL
         ORDER BY s.slide_id
        """,
    )


def list_slides_for_verification(stale_hours: int | None = None) -> list[dict[str, Any]]:
    """Return slides needing verification.

    Always includes slides with NULL verified_at. If stale_hours is given,
    also includes slides verified more than that many hours ago.

    Fields: slide_id, relative_path, hmac, verified_at.
    """
    if stale_hours is not None:
        return _fetchall(
            """
            SELECT s.slide_id, s.relative_path, s.hmac, s.verified_at
              FROM wsi.slides s
             WHERE s.hmac IS NOT NULL
               AND (s.verified_at IS NULL
                    OR s.verified_at < now() - make_interval(hours => %s))
             ORDER BY s.slide_id
            """,
            (stale_hours,),
        )
    return _fetchall(
        """
        SELECT s.slide_id, s.relative_path, s.hmac, s.verified_at
          FROM wsi.slides s
         WHERE s.hmac IS NOT NULL
           AND s.verified_at IS NULL
         ORDER BY s.slide_id
        """,
    )


def update_slide_hmac(slide_id: str, hmac_hex: str) -> bool:
    """Set hmac for a slide (backfill). Returns True if updated."""
    pool = _get_pool()
    if pool is None:
        return False
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE wsi.slides SET hmac = %s WHERE slide_id = %s',
                (hmac_hex, slide_id),
            )
            return cur.rowcount > 0


def list_slides_missing_metadata() -> list[dict[str, Any]]:
    """Return slides where width_px IS NULL (need metadata backfill).

    Fields: slide_id, relative_path.
    """
    return _fetchall(
        """
        SELECT s.slide_id, s.relative_path
          FROM wsi.slides s
         WHERE s.width_px IS NULL
         ORDER BY s.slide_id
        """,
    )


def update_slide_metadata(
    slide_id: str,
    width_px: int | None = None,
    height_px: int | None = None,
    magnification: float | None = None,
    mpp_x: float | None = None,
    mpp_y: float | None = None,
    scanner: str | None = None,
) -> bool:
    """Update image metadata columns for a slide. Returns True if updated."""
    pool = _get_pool()
    if pool is None:
        return False
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE wsi.slides
                   SET width_px = %s,
                       height_px = %s,
                       magnification = %s,
                       mpp_x = %s,
                       mpp_y = %s,
                       scanner = %s
                 WHERE slide_id = %s
                """,
                (width_px, height_px, magnification, mpp_x, mpp_y, scanner, slide_id),
            )
            return cur.rowcount > 0


def get_slide_hmac(slide_id: str) -> dict[str, Any] | None:
    """Get slide HMAC and path info for verification."""
    return _fetchone(
        """
        SELECT s.slide_id, s.relative_path, s.hmac, s.verified_at
          FROM wsi.slides s
         WHERE s.slide_id = %s
        """,
        (slide_id,),
    )
