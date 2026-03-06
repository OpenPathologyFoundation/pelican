"""Clinical and educational slide ingestion endpoints (SDS-STR-001 §7.1, SDS-EDU-001).

Accepts multipart file uploads, writes slides to year-partitioned
filesystem, computes HMAC-SHA256, extracts metadata via large_image,
and inserts database records transactionally.
"""

import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Query, UploadFile

from .. import db
from ..config import get_settings
import hmac as hmac_mod

from ..hmac_util import compute_file_hmac, verify_file_hmac

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/admin/ingest', tags=['Ingestion'])

_CASE_ID_RE = re.compile(r'^[A-Za-z]+(\d{2})-\d+$')
_EDU_CASE_ID_RE = re.compile(r'^EDU(\d{2})-\d{5}$')


def _parse_year_from_case_id(case_id: str) -> str:
    """Extract year from case_id prefix.

    'S26-0001' -> '2026', 'PS26-00001' -> '2026', 'C27-0001' -> '2027'
    Per spec §3.2: extract digits after alpha prefix, prepend '20'.
    """
    m = re.match(r'^[A-Za-z]+(\d{2})', case_id)
    if not m:
        raise ValueError(f'Cannot extract year from case_id: {case_id}')
    return f'20{m.group(1)}'


def _derive_slide_id(filename: str) -> str:
    """Derive slide_id from filename by stripping all extensions.

    'S26-0001_A1_S1.svs' -> 'S26-0001_A1_S1'
    'S26-0004_A3_S1.ome.tiff' -> 'S26-0004_A3_S1'
    """
    stem = filename
    while '.' in stem:
        stem = stem.rsplit('.', 1)[0]
    return stem


def _extract_format(filename: str) -> str:
    """Extract the file format extension (without dot).

    'slide.svs' -> 'svs', 'slide.ome.tiff' -> 'ome.tiff'
    """
    parts = filename.split('.', 1)
    return parts[1] if len(parts) > 1 else ''


def _extract_metadata(file_path: Path) -> dict:
    """Extract image metadata via large_image.

    Returns a dict with width_px, height_px, magnification, mpp_x, mpp_y, scanner.
    Falls back gracefully if large_image cannot open the file.
    """
    result = {}
    try:
        import large_image
        source = large_image.open(str(file_path))
        meta = source.getMetadata()
        result['width_px'] = meta.get('sizeX')
        result['height_px'] = meta.get('sizeY')
        result['magnification'] = meta.get('magnification')
        mm_x = meta.get('mm_x')
        mm_y = meta.get('mm_y')
        if mm_x is not None:
            result['mpp_x'] = round(mm_x * 1000, 4)
        if mm_y is not None:
            result['mpp_y'] = round(mm_y * 1000, 4)
        # Try to extract scanner info from internal metadata
        try:
            internal = source.getInternalMetadata() or {}
            result['scanner'] = internal.get('scanner') or internal.get('Scanner')
        except Exception:
            pass
    except Exception as e:
        logger.warning('Could not extract metadata from %s: %s', file_path, e)
    return result


@router.post(
    '/clinical',
    summary='Ingest a clinical slide',
    description='Upload a slide file, write to year-partitioned storage, '
    'compute HMAC-SHA256, extract metadata, and create database records.',
    status_code=201,
    responses={
        400: {'description': 'Missing required fields or invalid case_id'},
        409: {'description': 'Duplicate slide_id or file already exists'},
        503: {'description': 'Database or HMAC key not configured'},
    },
)
async def ingest_clinical_slide(
    file: UploadFile,
    case_id: str = Form(...),
    part_label: str = Form(...),
    block_label: str = Form(...),
    stain: str | None = Form(default=None),
    level_label: str | None = Form(default=None),
    specimen_type: str | None = Form(default=None),
    accession_date: str | None = Form(default=None),
    clinical_history: str | None = Form(default=None),
    patient_mrn: str | None = Form(default=None),
    patient_uuid: str | None = Form(default=None),
    part_designator: str | None = Form(default=None),
    anatomic_site: str | None = Form(default=None),
    final_diagnosis: str | None = Form(default=None),
) -> dict:
    """Ingest a clinical slide via multipart upload."""
    settings = get_settings()

    # 1. Validate prerequisites
    if not db.is_configured():
        raise HTTPException(status_code=503, detail='Database not configured')
    if not settings.hmac_key:
        raise HTTPException(status_code=503, detail='HMAC key not configured')
    if not settings.storage_clinical_root:
        raise HTTPException(status_code=503, detail='Clinical storage root not configured')
    if not file.filename:
        raise HTTPException(status_code=400, detail='File has no filename')

    # 2. Validate case_id format
    if not _CASE_ID_RE.match(case_id):
        raise HTTPException(
            status_code=400,
            detail=f'Invalid case_id format: {case_id}. '
            'Expected pattern like S26-0001, PS26-00001, C27-0001',
        )

    # 3. Derive identifiers
    filename = file.filename
    slide_id = _derive_slide_id(filename)
    format_ext = _extract_format(filename)

    try:
        year = _parse_year_from_case_id(case_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # 4. Construct paths
    relative_path = f'{year}/{case_id}/{filename}'
    clinical_root = settings.storage_clinical_root
    target_path = clinical_root / relative_path
    tmp_path = target_path.parent / f'{filename}.tmp'

    # 5. Check for duplicates
    existing = db.get_slide_by_id(slide_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f'Slide already exists in database: {slide_id}',
        )
    if target_path.exists():
        raise HTTPException(
            status_code=409,
            detail=f'File already exists on disk: {relative_path}',
        )

    # 6. Write file atomically
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Write to tmp file then rename (atomic on same filesystem)
        with open(tmp_path, 'wb') as f:
            while True:
                chunk = await file.read(65536)
                if not chunk:
                    break
                f.write(chunk)

        os.rename(tmp_path, target_path)
    except Exception as e:
        # Clean up on write failure
        for p in (tmp_path, target_path):
            if p.exists():
                p.unlink()
        raise HTTPException(
            status_code=500,
            detail=f'Failed to write file: {e}',
        ) from e

    # 7. Compute HMAC and extract metadata
    try:
        size_bytes = target_path.stat().st_size
        hmac_hex = compute_file_hmac(target_path, settings.hmac_key)
        image_meta = _extract_metadata(target_path)

        # Resolve patient by MRN or UUID
        resolved_patient_id = None
        if patient_mrn:
            patient = db.get_patient_by_mrn(patient_mrn)
            if not patient:
                if target_path.exists():
                    target_path.unlink()
                raise HTTPException(
                    status_code=400,
                    detail=f'Patient not found for MRN: {patient_mrn}',
                )
            resolved_patient_id = str(patient['id'])
        elif patient_uuid:
            patient = db.get_patient_by_uuid(patient_uuid)
            if not patient:
                if target_path.exists():
                    target_path.unlink()
                raise HTTPException(
                    status_code=400,
                    detail=f'Patient not found for UUID: {patient_uuid}',
                )
            resolved_patient_id = str(patient['id'])

        # 8. Insert into database transactionally
        slide_row = db.ingest_slide_transactional(
            case_id=case_id,
            collection='clinical',
            part_label=part_label,
            block_label=block_label,
            slide_id=slide_id,
            relative_path=relative_path,
            hmac_hex=hmac_hex,
            size_bytes=size_bytes,
            format_ext=format_ext,
            stain=stain,
            level_label=level_label,
            magnification=image_meta.get('magnification'),
            width_px=image_meta.get('width_px'),
            height_px=image_meta.get('height_px'),
            mpp_x=image_meta.get('mpp_x'),
            mpp_y=image_meta.get('mpp_y'),
            scanner=image_meta.get('scanner'),
            patient_id=resolved_patient_id,
            specimen_type=specimen_type,
            accession_date=accession_date,
            part_designator=part_designator,
            anatomic_site=anatomic_site,
            final_diagnosis=final_diagnosis,
        )

        return {
            'slideId': slide_row['slide_id'],
            'caseId': case_id,
            'relativePath': slide_row['relative_path'],
            'hmac': slide_row['hmac'],
            'sizeBytes': slide_row['size_bytes'],
            'widthPx': slide_row.get('width_px'),
            'heightPx': slide_row.get('height_px'),
            'magnification': slide_row.get('magnification'),
            'mppX': slide_row.get('mpp_x'),
            'mppY': slide_row.get('mpp_y'),
        }
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file on any post-write failure
        if target_path.exists():
            target_path.unlink()
        logger.error('Ingestion failed for %s: %s', slide_id, e)
        raise HTTPException(
            status_code=500,
            detail=f'Ingestion failed: {e}',
        ) from e


@router.get(
    '/verify/{slide_id}',
    summary='Verify slide integrity',
    description='Recompute HMAC for a slide and compare against stored value.',
    responses={
        404: {'description': 'Slide not found'},
        503: {'description': 'HMAC key or clinical root not configured'},
    },
)
async def verify_slide(slide_id: str) -> dict:
    """Verify a slide's HMAC integrity."""
    settings = get_settings()

    if not settings.hmac_key:
        raise HTTPException(status_code=503, detail='HMAC key not configured')
    if not settings.storage_clinical_root:
        raise HTTPException(status_code=503, detail='Clinical storage root not configured')

    slide_info = db.get_slide_hmac(slide_id)
    if not slide_info:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    stored_hmac = slide_info.get('hmac')
    if not stored_hmac:
        raise HTTPException(status_code=404, detail=f'No HMAC stored for slide: {slide_id}')

    file_path = settings.storage_clinical_root / slide_info['relative_path']
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f'Slide file not found on disk: {slide_info["relative_path"]}',
        )

    match = verify_file_hmac(file_path, settings.hmac_key, stored_hmac)

    if match:
        db.update_slide_verified(slide_id)

    return {
        'slideId': slide_id,
        'verified': match,
        'storedHmac': stored_hmac[:16] + '...',
        'verifiedAt': str(slide_info.get('verified_at')) if match else None,
    }


@router.post(
    '/backfill-hmac',
    summary='Backfill HMACs for seeded slides',
    description='Compute HMAC-SHA256 for all slides with NULL hmac. '
    'Intended for slides loaded via SQL seed before the ingestion API.',
    responses={
        503: {'description': 'Database, HMAC key, or clinical root not configured'},
    },
)
async def backfill_hmac() -> dict:
    """Compute and store HMACs for slides that have none."""
    settings = get_settings()

    if not db.is_configured():
        raise HTTPException(status_code=503, detail='Database not configured')
    if not settings.hmac_key:
        raise HTTPException(status_code=503, detail='HMAC key not configured')
    if not settings.storage_clinical_root:
        raise HTTPException(status_code=503, detail='Clinical storage root not configured')

    slides = db.list_slides_missing_hmac()
    processed = 0
    skipped = []
    errors = []

    for slide in slides:
        slide_id = slide['slide_id']
        rel_path = slide['relative_path']
        file_path = settings.storage_clinical_root / rel_path

        if not file_path.exists():
            skipped.append({'slideId': slide_id, 'reason': 'file not found'})
            continue

        try:
            hmac_hex = compute_file_hmac(file_path, settings.hmac_key)
            db.update_slide_hmac(slide_id, hmac_hex)
            processed += 1
        except Exception as e:
            logger.error('Backfill HMAC failed for %s: %s', slide_id, e)
            errors.append({'slideId': slide_id, 'error': str(e)})

    return {
        'processed': processed,
        'skipped': skipped,
        'errors': errors,
    }


@router.post(
    '/verify-all',
    summary='Verify all slide HMACs (batch sweep)',
    description='Background sweep per SDS-STR-001 §5.2. Recomputes HMAC for all '
    'slides and compares against stored values. Updates verified_at on match.',
    responses={
        503: {'description': 'Database, HMAC key, or clinical root not configured'},
    },
)
async def verify_all(
    stale_hours: int | None = Query(
        default=None,
        description='Only re-verify slides not verified within this many hours',
    ),
) -> dict:
    """Verify HMAC integrity for all slides needing verification."""
    settings = get_settings()

    if not db.is_configured():
        raise HTTPException(status_code=503, detail='Database not configured')
    if not settings.hmac_key:
        raise HTTPException(status_code=503, detail='HMAC key not configured')
    if not settings.storage_clinical_root:
        raise HTTPException(status_code=503, detail='Clinical storage root not configured')

    slides = db.list_slides_for_verification(stale_hours=stale_hours)
    verified = 0
    failed = 0
    missing_count = 0
    failures = []
    missing = []

    for slide in slides:
        slide_id = slide['slide_id']
        rel_path = slide['relative_path']
        stored_hmac = slide['hmac']
        file_path = settings.storage_clinical_root / rel_path

        if not file_path.exists():
            missing_count += 1
            missing.append({'slideId': slide_id, 'relativePath': rel_path})
            continue

        try:
            actual_hmac = compute_file_hmac(file_path, settings.hmac_key)
        except Exception as e:
            logger.error('Verify-all: failed to compute HMAC for %s: %s', slide_id, e)
            failed += 1
            failures.append({
                'slideId': slide_id,
                'expected': stored_hmac,
                'actual': f'error: {e}',
                'sizeBytes': None,
            })
            continue

        if hmac_mod.compare_digest(actual_hmac, stored_hmac):
            db.update_slide_verified(slide_id)
            verified += 1
        else:
            failed += 1
            try:
                size_bytes = file_path.stat().st_size
            except OSError:
                size_bytes = None
            logger.warning(
                'HMAC mismatch for slide %s: expected=%s actual=%s size=%s',
                slide_id, stored_hmac, actual_hmac, size_bytes,
            )
            failures.append({
                'slideId': slide_id,
                'expected': stored_hmac,
                'actual': actual_hmac,
                'sizeBytes': size_bytes,
            })

    total = verified + failed + missing_count
    return {
        'summary': {
            'verified': verified,
            'failed': failed,
            'missing': missing_count,
            'total': total,
        },
        'failures': failures,
        'missing': missing,
    }


@router.post(
    '/backfill-metadata',
    summary='Backfill image metadata for seeded slides',
    description='Extract width_px, height_px, magnification, mpp_x, mpp_y, and scanner '
    'from slide files for all slides with NULL width_px. '
    'Intended for slides loaded via SQL seed before the ingestion API.',
    responses={
        503: {'description': 'Database or clinical root not configured'},
    },
)
async def backfill_metadata() -> dict:
    """Extract and store image metadata for slides that have none."""
    settings = get_settings()

    if not db.is_configured():
        raise HTTPException(status_code=503, detail='Database not configured')
    if not settings.storage_clinical_root:
        raise HTTPException(status_code=503, detail='Clinical storage root not configured')

    slides = db.list_slides_missing_metadata()
    processed = 0
    skipped = []
    errors = []

    for slide in slides:
        slide_id = slide['slide_id']
        rel_path = slide['relative_path']
        file_path = settings.storage_clinical_root / rel_path

        if not file_path.exists():
            skipped.append({'slideId': slide_id, 'reason': 'file not found'})
            continue

        try:
            meta = _extract_metadata(file_path)
            if not meta.get('width_px'):
                skipped.append({'slideId': slide_id, 'reason': 'no dimensions extracted'})
                continue

            db.update_slide_metadata(
                slide_id,
                width_px=meta.get('width_px'),
                height_px=meta.get('height_px'),
                magnification=meta.get('magnification'),
                mpp_x=meta.get('mpp_x'),
                mpp_y=meta.get('mpp_y'),
                scanner=meta.get('scanner'),
            )
            processed += 1
        except Exception as e:
            logger.error('Backfill metadata failed for %s: %s', slide_id, e)
            errors.append({'slideId': slide_id, 'error': str(e)})

    return {
        'processed': processed,
        'skipped': skipped,
        'errors': errors,
    }


# ---------------------------------------------------------------------------
# Educational slide ingestion (SDS-EDU-001, SYS-ING-010..014)
# ---------------------------------------------------------------------------

@router.post(
    '/educational',
    summary='Ingest an educational slide',
    description='Upload a slide file to the educational collection (wsi_edu schema). '
    'If case_id is omitted, auto-assigns next EDU accession (e.g. EDU26-00001). '
    'Creates implied part/block hierarchy. Computes HMAC-SHA256 and extracts metadata.',
    status_code=201,
    responses={
        400: {'description': 'Invalid case_id format or missing file'},
        409: {'description': 'Duplicate slide_id or file already exists'},
        503: {'description': 'Database, HMAC key, or EDU storage root not configured'},
    },
)
async def ingest_educational_slide(
    file: UploadFile,
    case_id: str | None = Form(default=None),
    part_label: str = Form(default='A'),
    block_label: str = Form(default='1'),
    stain: str | None = Form(default=None),
    level_label: str | None = Form(default=None),
    specimen_type: str | None = Form(default=None),
    accession_date: str | None = Form(default=None),
    anatomic_site: str | None = Form(default=None),
    primary_diagnosis: str | None = Form(default=None),
    icd_code: str | None = Form(default=None),
    source_type: str | None = Form(
        default='external_upload',
        description='Provenance: external_upload, public_dataset, clinical_transfer',
    ),
    source_identifier: str | None = Form(default=None),
    curator_identity_id: str | None = Form(default=None),
) -> dict:
    """Ingest an educational slide via multipart upload."""
    from datetime import datetime, timezone

    settings = get_settings()

    # 1. Validate prerequisites
    if not db.is_configured():
        raise HTTPException(status_code=503, detail='Database not configured')
    if not settings.hmac_key:
        raise HTTPException(status_code=503, detail='HMAC key not configured')
    if not settings.storage_edu_root:
        raise HTTPException(status_code=503, detail='EDU storage root not configured')
    if not file.filename:
        raise HTTPException(status_code=400, detail='File has no filename')

    # 2. Validate case_id format if provided
    if case_id and not _EDU_CASE_ID_RE.match(case_id):
        raise HTTPException(
            status_code=400,
            detail=f'Invalid EDU case_id format: {case_id}. '
            'Expected pattern like EDU26-00001',
        )

    # 3. Determine year (from case_id or current date)
    if case_id:
        year = 2000 + int(case_id[3:5])
    else:
        year = datetime.now(tz=timezone.utc).year

    # 4. Derive identifiers
    filename = file.filename
    slide_id = _derive_slide_id(filename)
    format_ext = _extract_format(filename)

    # 5. Check for duplicate slide_id across both schemas
    existing = db.get_slide_by_id(slide_id)
    if not existing:
        existing = db.get_edu_slide_by_id(slide_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f'Slide already exists in database: {slide_id}',
        )

    # 6. For auto-assign: write file to staging, rename after accession known
    #    For explicit case_id: write directly to final path
    edu_root = settings.storage_edu_root

    if case_id:
        relative_path = f'{year}/{case_id}/{filename}'
        target_path = edu_root / relative_path
        if target_path.exists():
            raise HTTPException(
                status_code=409,
                detail=f'File already exists on disk: {relative_path}',
            )
    else:
        target_path = None

    # 7. Write file atomically
    staging_dir = edu_root / '_staging'
    try:
        if target_path:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            write_path = target_path.parent / f'{filename}.tmp'
        else:
            staging_dir.mkdir(parents=True, exist_ok=True)
            write_path = staging_dir / f'{slide_id}.tmp'

        with open(write_path, 'wb') as f:
            while True:
                chunk = await file.read(65536)
                if not chunk:
                    break
                f.write(chunk)

        if target_path:
            os.rename(write_path, target_path)
            hmac_source = target_path
        else:
            hmac_source = write_path
    except Exception as e:
        for p in (write_path, target_path):
            if p and p.exists():
                p.unlink()
        raise HTTPException(
            status_code=500,
            detail=f'Failed to write file: {e}',
        ) from e

    # 8. Compute HMAC and extract metadata
    try:
        size_bytes = hmac_source.stat().st_size
        hmac_hex = compute_file_hmac(hmac_source, settings.hmac_key)
        image_meta = _extract_metadata(hmac_source)

        # Build source lineage
        source_lineage = {'type': source_type or 'external_upload'}
        if source_identifier:
            source_lineage['identifier'] = source_identifier

        # 9. Insert into database transactionally
        slide_row = db.ingest_edu_slide_transactional(
            year=year,
            case_id=case_id,
            part_label=part_label,
            block_label=block_label,
            slide_id=slide_id,
            relative_path='_pending_',  # placeholder — updated below
            hmac_hex=hmac_hex,
            size_bytes=size_bytes,
            format_ext=format_ext,
            stain=stain,
            level_label=level_label,
            magnification=image_meta.get('magnification'),
            width_px=image_meta.get('width_px'),
            height_px=image_meta.get('height_px'),
            mpp_x=image_meta.get('mpp_x'),
            mpp_y=image_meta.get('mpp_y'),
            scanner=image_meta.get('scanner'),
            specimen_type=specimen_type,
            accession_date=accession_date,
            anatomic_site=anatomic_site,
            primary_diagnosis=primary_diagnosis,
            icd_code=icd_code,
            source_lineage=source_lineage,
            curator_identity_id=curator_identity_id,
        )

        # 10. Finalize file path with resolved case_id
        resolved_case_id = slide_row['case_id']
        final_relative_path = f'{year}/{resolved_case_id}/{filename}'
        final_target = edu_root / final_relative_path

        if not case_id:
            # Auto-assigned — move from staging to final location
            final_target.parent.mkdir(parents=True, exist_ok=True)
            os.rename(hmac_source, final_target)

        # 11. Update the relative_path in the database
        pool = db._get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE wsi_edu.slides SET relative_path = %s '
                    'WHERE slide_id = %s',
                    (final_relative_path, slide_id),
                )

        return {
            'slideId': slide_row['slide_id'],
            'caseId': resolved_case_id,
            'relativePath': final_relative_path,
            'hmac': slide_row['hmac'],
            'sizeBytes': slide_row['size_bytes'],
            'widthPx': slide_row.get('width_px'),
            'heightPx': slide_row.get('height_px'),
            'magnification': slide_row.get('magnification'),
            'mppX': slide_row.get('mpp_x'),
            'mppY': slide_row.get('mpp_y'),
            'autoAssigned': case_id is None,
        }
    except HTTPException:
        raise
    except Exception as e:
        # Clean up files on any post-write failure
        for p in (hmac_source, target_path):
            try:
                if p and p.exists():
                    p.unlink()
            except Exception:
                pass
        logger.error('EDU ingestion failed for %s: %s', slide_id, e)
        raise HTTPException(
            status_code=500,
            detail=f'EDU ingestion failed: {e}',
        ) from e
