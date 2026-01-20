"""Case management endpoints for pathology workflow."""

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response

from ..config import get_settings
from ..source_manager import SourceManager, get_source_manager

router = APIRouter()

# Cache for cases.json
_cases_cache: dict[str, Any] | None = None
_cases_cache_mtime: float = 0


def _get_cases_json_path() -> Path:
    """Get the path to cases.json."""
    settings = get_settings()
    return settings.image_dir / 'cases.json'


def _get_associated_images_dir() -> Path:
    """Get the path to associated_images directory."""
    settings = get_settings()
    return settings.image_dir / 'associated_images'


def _load_cases() -> dict[str, Any]:
    """Load cases.json with caching."""
    global _cases_cache, _cases_cache_mtime

    cases_path = _get_cases_json_path()
    if not cases_path.exists():
        return {'cases': [], 'version': '1.0'}

    # Check if file was modified
    current_mtime = cases_path.stat().st_mtime
    if _cases_cache is not None and current_mtime == _cases_cache_mtime:
        return _cases_cache

    # Reload
    with open(cases_path) as f:
        _cases_cache = json.load(f)
        _cases_cache_mtime = current_mtime

    return _cases_cache


def _get_case_by_id(case_id: str) -> dict[str, Any] | None:
    """Get a case by its ID."""
    data = _load_cases()
    for case in data.get('cases', []):
        if case.get('caseId') == case_id:
            return case
    return None


def _get_slide_by_id(slide_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Get a slide by its ID, returning (case, slide) tuple."""
    data = _load_cases()
    for case in data.get('cases', []):
        for slide in case.get('slides', []):
            if slide.get('slideId') == slide_id:
                return case, slide
    return None


@router.get(
    '/cases',
    summary='List all cases',
    description='Get a list of all available pathology cases.',
)
async def list_cases() -> list[dict[str, Any]]:
    """List all cases with summary information.

    Returns:
        List of cases with basic info (no slides detail).
    """
    data = _load_cases()
    cases = []

    for case in data.get('cases', []):
        cases.append({
            'caseId': case.get('caseId'),
            'patientName': case.get('patientName'),
            'patientId': case.get('patientId'),
            'accessionDate': case.get('accessionDate'),
            'diagnosis': case.get('diagnosis'),
            'specimenType': case.get('specimenType'),
            'status': case.get('status'),
            'priority': case.get('priority'),
            'slideCount': len(case.get('slides', [])),
        })

    return cases


@router.get(
    '/cases/{case_id}',
    summary='Get case details',
    description='Get full details for a specific case including all slides.',
    responses={404: {'description': 'Case not found'}},
)
async def get_case(case_id: str) -> dict[str, Any]:
    """Get full case details.

    Args:
        case_id: The case identifier (e.g., "S26-0001").

    Returns:
        Complete case information including all slides.
    """
    case = _get_case_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f'Case not found: {case_id}')

    return case


@router.get(
    '/cases/{case_id}/slides',
    summary='List case slides',
    description='Get all slides for a specific case.',
    responses={404: {'description': 'Case not found'}},
)
async def get_case_slides(case_id: str) -> list[dict[str, Any]]:
    """Get all slides for a case.

    Args:
        case_id: The case identifier.

    Returns:
        List of slides in the case.
    """
    case = _get_case_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f'Case not found: {case_id}')

    return case.get('slides', [])


@router.get(
    '/slides/{slide_id}',
    summary='Get slide details',
    description='Get details for a specific slide including its case context.',
    responses={404: {'description': 'Slide not found'}},
)
async def get_slide(slide_id: str) -> dict[str, Any]:
    """Get slide details with case context.

    Args:
        slide_id: The slide identifier (e.g., "S26-0001_A1_S1").

    Returns:
        Slide information with case context.
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    return {
        **slide,
        'caseContext': {
            'caseId': case.get('caseId'),
            'patientName': case.get('patientName'),
            'patientId': case.get('patientId'),
            'patientDob': case.get('patientDob'),
            'diagnosis': case.get('diagnosis'),
            'status': case.get('status'),
            'priority': case.get('priority'),
        },
    }


@router.get(
    '/slides/{slide_id}/file',
    summary='Get slide file path',
    description='Get the resolved file path for a slide.',
    responses={404: {'description': 'Slide not found'}},
)
async def get_slide_file_path(
    slide_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, str]:
    """Get the file path for a slide.

    Args:
        slide_id: The slide identifier.

    Returns:
        File path information.
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    case_id = case.get('caseId')
    filename = slide.get('filename')

    # Build the relative path: case_id/filename
    image_path = f'{case_id}/{filename}'

    try:
        resolved = source_manager.get_source_path(image_path)
        return {
            'slideId': slide_id,
            'imagePath': image_path,
            'resolvedPath': str(resolved),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get(
    '/slides/{slide_id}/label',
    summary='Get slide label image',
    description='Get the barcode label image for a slide.',
    responses={
        200: {'content': {'image/png': {}}},
        404: {'description': 'Label not found'},
    },
)
async def get_slide_label(slide_id: str) -> Response:
    """Get the label image for a slide.

    Args:
        slide_id: The slide identifier.

    Returns:
        Label image (PNG).
    """
    # First check if slide exists in cases
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    # Look for label in associated_images directory
    assoc_dir = _get_associated_images_dir()
    label_path = assoc_dir / f'{slide_id}_label.png'

    if not label_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f'Label image not found for slide: {slide_id}',
        )

    return FileResponse(
        label_path,
        media_type='image/png',
        headers={'Cache-Control': 'public, max-age=86400'},
    )


@router.get(
    '/slides/{slide_id}/macro',
    summary='Get slide macro image',
    description='Get the macro (gross/overview) image for a slide.',
    responses={
        200: {'content': {'image/png': {}}},
        404: {'description': 'Macro image not found'},
    },
)
async def get_slide_macro(slide_id: str) -> Response:
    """Get the macro image for a slide.

    Args:
        slide_id: The slide identifier.

    Returns:
        Macro image (PNG).
    """
    # First check if slide exists in cases
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    # Look for macro in associated_images directory
    assoc_dir = _get_associated_images_dir()
    macro_path = assoc_dir / f'{slide_id}_macro.png'

    if not macro_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f'Macro image not found for slide: {slide_id}',
        )

    return FileResponse(
        macro_path,
        media_type='image/png',
        headers={'Cache-Control': 'public, max-age=86400'},
    )


@router.get(
    '/slides/{slide_id}/associated',
    summary='List associated images for slide',
    description='Get list of available associated images (label, macro) for a slide.',
    responses={404: {'description': 'Slide not found'}},
)
async def list_slide_associated_images(slide_id: str) -> list[str]:
    """List available associated images for a slide.

    Checks both the SVS file's embedded images and the associated_images directory.

    Args:
        slide_id: The slide identifier.

    Returns:
        List of available associated image names.
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    available = []

    # Check associated_images directory
    assoc_dir = _get_associated_images_dir()
    if (assoc_dir / f'{slide_id}_label.png').exists():
        available.append('label')
    if (assoc_dir / f'{slide_id}_macro.png').exists():
        available.append('macro')

    return available


@router.get(
    '/worklist',
    summary='Get worklist',
    description='Get cases formatted as a worklist for review.',
)
async def get_worklist(
    status: str | None = None,
    priority: str | None = None,
) -> list[dict[str, Any]]:
    """Get a worklist of cases for review.

    Args:
        status: Filter by status (e.g., "pending_review", "signed_out").
        priority: Filter by priority (e.g., "stat", "routine").

    Returns:
        List of cases matching the filters.
    """
    data = _load_cases()
    worklist = []

    for case in data.get('cases', []):
        # Apply filters
        if status and case.get('status') != status:
            continue
        if priority and case.get('priority') != priority:
            continue

        worklist.append({
            'caseId': case.get('caseId'),
            'patientName': case.get('patientName'),
            'patientId': case.get('patientId'),
            'accessionDate': case.get('accessionDate'),
            'specimenType': case.get('specimenType'),
            'diagnosis': case.get('diagnosis'),
            'status': case.get('status'),
            'priority': case.get('priority'),
            'slideCount': len(case.get('slides', [])),
            'slides': [
                {'slideId': s.get('slideId'), 'stain': s.get('stain')}
                for s in case.get('slides', [])
            ],
        })

    # Sort by priority (stat first) then by accession date
    priority_order = {'stat': 0, 'rush': 1, 'routine': 2}
    worklist.sort(key=lambda c: (
        priority_order.get(c.get('priority', 'routine'), 2),
        c.get('accessionDate', ''),
    ))

    return worklist
