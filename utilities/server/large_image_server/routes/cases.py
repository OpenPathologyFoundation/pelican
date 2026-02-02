"""Case management endpoints for pathology workflow."""

import io
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


def _get_slide_image_path(case: dict, slide: dict) -> str:
    """Get the image path for a slide relative to image_dir."""
    case_id = case.get('caseId')
    filename = slide.get('filename')
    return f'{case_id}/{filename}'


def _generate_label_image(slide_id: str, width: int = 400, height: int = 150) -> bytes:
    """Generate a simple label image with slide ID text.

    Creates a white background with black text showing the slide ID.
    Optionally includes a 1D barcode if python-barcode is available.

    Args:
        slide_id: The slide identifier to display.
        width: Image width in pixels.
        height: Image height in pixels.

    Returns:
        PNG image data as bytes.
    """
    from PIL import Image, ImageDraw, ImageFont

    # Create white background
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)

    # Draw border
    draw.rectangle([0, 0, width - 1, height - 1], outline='black', width=2)

    # Try to use a nice font, fall back to default
    font_size = 24
    small_font_size = 14
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
        small_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', small_font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()
        small_font = font

    # Draw "SLIDE LABEL" header
    header_text = "SLIDE LABEL"
    header_bbox = draw.textbbox((0, 0), header_text, font=small_font)
    header_width = header_bbox[2] - header_bbox[0]
    draw.text(((width - header_width) / 2, 10), header_text, fill='gray', font=small_font)

    # Draw slide ID centered
    text_bbox = draw.textbbox((0, 0), slide_id, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    x = (width - text_width) / 2
    y = (height - text_height) / 2
    draw.text((x, y), slide_id, fill='black', font=font)

    # Draw "Generated - No physical label available" footer
    footer_text = "Generated - No physical label available"
    footer_bbox = draw.textbbox((0, 0), footer_text, font=small_font)
    footer_width = footer_bbox[2] - footer_bbox[0]
    draw.text(((width - footer_width) / 2, height - 25), footer_text, fill='gray', font=small_font)

    # Save to bytes
    output = io.BytesIO()
    img.save(output, format='PNG')
    return output.getvalue()


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
    description='Get the barcode label image for a slide. '
    'Extracts from source file if available, otherwise generates a placeholder.',
    responses={
        200: {'content': {'image/png': {}, 'image/jpeg': {}}},
        404: {'description': 'Slide not found'},
    },
)
async def get_slide_label(
    slide_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get the label image for a slide.

    Priority:
    1. Extract embedded label from source file (SVS, etc.)
    2. Generate a placeholder label with slide ID

    Args:
        slide_id: The slide identifier.

    Returns:
        Label image (PNG or JPEG).
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    image_path = _get_slide_image_path(case, slide)

    # Try to extract embedded label from source file
    try:
        source = source_manager.get_source(image_path)
        assoc_list = source.getAssociatedImagesList()

        if 'label' in assoc_list:
            image_data, mime_type = source.getAssociatedImage('label')
            return Response(
                content=image_data,
                media_type=mime_type or 'image/jpeg',
                headers={'Cache-Control': 'public, max-age=86400'},
            )
    except Exception:
        pass  # Fall through to generated label

    # Generate a placeholder label
    label_data = _generate_label_image(slide_id)
    return Response(
        content=label_data,
        media_type='image/png',
        headers={
            'Cache-Control': 'public, max-age=86400',
            'X-Generated': 'true',  # Indicate this is a generated label
        },
    )


@router.get(
    '/slides/{slide_id}/macro',
    summary='Get slide macro image',
    description='Get the macro (gross/overview) image for a slide. '
    'Extracts from source file if available.',
    responses={
        200: {'content': {'image/png': {}, 'image/jpeg': {}}},
        404: {'description': 'Macro image not found'},
    },
)
async def get_slide_macro(
    slide_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get the macro image for a slide.

    Macro images show the physical slide overview and cannot be synthesized.
    Returns 404 if not embedded in the source file.

    Args:
        slide_id: The slide identifier.

    Returns:
        Macro image (PNG or JPEG).
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    image_path = _get_slide_image_path(case, slide)

    # Try to extract embedded macro from source file
    try:
        source = source_manager.get_source(image_path)
        assoc_list = source.getAssociatedImagesList()

        if 'macro' in assoc_list:
            image_data, mime_type = source.getAssociatedImage('macro')
            return Response(
                content=image_data,
                media_type=mime_type or 'image/jpeg',
                headers={'Cache-Control': 'public, max-age=86400'},
            )
    except Exception:
        pass

    # Macro images cannot be synthesized - they show physical slide context
    raise HTTPException(
        status_code=404,
        detail=f'Macro image not available for slide: {slide_id}. '
        'Macro images must be embedded in the source file.',
    )


@router.get(
    '/slides/{slide_id}/thumbnail',
    summary='Get slide thumbnail',
    description='Get a thumbnail image for a slide. '
    'Extracts from source file or generates from pyramid.',
    responses={
        200: {'content': {'image/png': {}, 'image/jpeg': {}}},
        404: {'description': 'Slide not found'},
    },
)
async def get_slide_thumbnail(
    slide_id: str,
    width: int = 256,
    height: int = 256,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get a thumbnail image for a slide.

    Priority:
    1. Extract embedded thumbnail from source file
    2. Generate from lowest pyramid level

    Args:
        slide_id: The slide identifier.
        width: Maximum thumbnail width.
        height: Maximum thumbnail height.

    Returns:
        Thumbnail image (PNG or JPEG).
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    image_path = _get_slide_image_path(case, slide)

    try:
        source = source_manager.get_source(image_path)

        # First try embedded thumbnail
        assoc_list = source.getAssociatedImagesList()
        if 'thumbnail' in assoc_list:
            image_data, mime_type = source.getAssociatedImage('thumbnail')
            return Response(
                content=image_data,
                media_type=mime_type or 'image/jpeg',
                headers={'Cache-Control': 'public, max-age=86400'},
            )

        # Generate from pyramid
        image_data, mime_type = source.getThumbnail(
            width=width,
            height=height,
            encoding='JPEG',
        )
        return Response(
            content=image_data,
            media_type=mime_type or 'image/jpeg',
            headers={
                'Cache-Control': 'public, max-age=86400',
                'X-Generated': 'true',
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f'Failed to generate thumbnail: {e}',
        ) from e


@router.get(
    '/slides/{slide_id}/associated',
    summary='List associated images for slide',
    description='Get list of available associated images (thumbnail, label, macro) for a slide.',
    responses={404: {'description': 'Slide not found'}},
)
async def list_slide_associated_images(
    slide_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """List available associated images for a slide.

    Checks embedded images in the source file and indicates which
    images can be generated as fallback.

    Args:
        slide_id: The slide identifier.

    Returns:
        Dictionary with available images and their sources.
    """
    result = _get_slide_by_id(slide_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f'Slide not found: {slide_id}')

    case, slide = result
    image_path = _get_slide_image_path(case, slide)

    # Check what's embedded in the source file
    embedded = []
    try:
        source = source_manager.get_source(image_path)
        embedded = source.getAssociatedImagesList()
    except Exception:
        pass

    return {
        'thumbnail': {
            'available': True,  # Always available (embedded or generated)
            'source': 'embedded' if 'thumbnail' in embedded else 'generated',
        },
        'label': {
            'available': True,  # Always available (embedded or generated)
            'source': 'embedded' if 'label' in embedded else 'generated',
        },
        'macro': {
            'available': 'macro' in embedded,
            'source': 'embedded' if 'macro' in embedded else None,
        },
        'embedded_images': embedded,  # Raw list from source
    }


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
                {
                    'slideId': s.get('slideId'),
                    'stain': s.get('stain'),
                    'filename': s.get('filename'),
                }
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


# Extensions that benefit from pre-warming (slow to index on first load)
SLOW_EXTENSIONS = {'.dcm', '.dicom'}


@router.post(
    '/warm',
    summary='Pre-warm tile sources',
    description='Pre-load tile sources to avoid first-access delays. '
    'DICOM files particularly benefit from pre-warming.',
)
async def warm_sources(
    case_id: str | None = None,
    all_sources: bool = False,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """Pre-warm tile sources by loading them into cache.

    DICOM WSI files have significant first-load overhead due to frame indexing.
    Pre-warming loads them in advance so viewing is instant.

    Args:
        case_id: Optional case ID to warm. If None, warms all cases.
        all_sources: If True, warm all slides. If False (default), only warm
                    slow-loading formats (DICOM).

    Returns:
        Summary of warmed sources.
    """
    import time

    data = _load_cases()

    results = {'warmed': [], 'failed': [], 'skipped': []}

    for case in data.get('cases', []):
        if case_id and case.get('caseId') != case_id:
            continue

        for slide in case.get('slides', []):
            filename = slide.get('filename', '')
            ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''

            # Check if we should warm this file
            if not all_sources and ext not in SLOW_EXTENSIONS:
                results['skipped'].append({
                    'slideId': slide.get('slideId'),
                    'reason': f'extension {ext} not in warm list',
                })
                continue

            image_path = f"{case.get('caseId')}/{filename}"

            try:
                start = time.time()
                source_manager.get_source(image_path)
                elapsed = time.time() - start

                results['warmed'].append({
                    'slideId': slide.get('slideId'),
                    'path': image_path,
                    'time_seconds': round(elapsed, 2),
                })
            except Exception as e:
                results['failed'].append({
                    'slideId': slide.get('slideId'),
                    'path': image_path,
                    'error': str(e),
                })

    return {
        'summary': {
            'warmed': len(results['warmed']),
            'failed': len(results['failed']),
            'skipped': len(results['skipped']),
        },
        'details': results,
    }


@router.get(
    '/warm/status',
    summary='Get source cache status',
    description='Check which sources are currently cached.',
)
async def warm_status(
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """Get the current source cache status."""
    return source_manager.cache_info()
