"""XYZ tile endpoints."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from large_image.exceptions import TileSourceError, TileSourceXYZRangeError

from ..models import ErrorResponse
from ..source_manager import SourceManager, get_source_manager

router = APIRouter()

# MIME type mapping
MIME_TYPES = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
}


def parse_style(style: str | None) -> dict | None:
    """Parse style parameter from JSON string."""
    if not style:
        return None
    try:
        return json.loads(style)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f'Invalid style JSON: {e}') from e


@router.get(
    '/tiles/{image_id:path}/{z}/{x}/{y}.{format}',
    summary='Get XYZ tile',
    description='Get a tile at the specified XYZ coordinates. '
    'Compatible with slippy map tile viewers (OpenLayers, Leaflet, etc.).',
    responses={
        200: {'content': {'image/png': {}, 'image/jpeg': {}}},
        404: {'model': ErrorResponse, 'description': 'Image or tile not found'},
        400: {'model': ErrorResponse, 'description': 'Invalid parameters'},
    },
)
async def get_tile(
    image_id: str,
    z: int,
    x: int,
    y: int,
    format: str,
    frame: Annotated[int, Query(description='Frame index for multi-frame images')] = 0,
    style: Annotated[
        str | None,
        Query(description='JSON style configuration'),
    ] = None,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get a tile at the specified XYZ coordinates.

    Args:
        image_id: Image identifier (filename or path relative to image directory).
        z: Zoom level (0 = lowest resolution).
        x: Tile X coordinate.
        y: Tile Y coordinate.
        format: Output format (png, jpeg, tiff).
        frame: Frame index for multi-frame images.
        style: JSON style configuration for color mapping.

    Returns:
        Tile image data.
    """
    format_lower = format.lower()
    if format_lower not in MIME_TYPES:
        raise HTTPException(status_code=400, detail=f'Unsupported format: {format}')

    encoding = format_lower.upper()
    if encoding == 'JPG':
        encoding = 'JPEG'
    elif encoding == 'TIF':
        encoding = 'TIFF'

    try:
        parsed_style = parse_style(style)
        source = source_manager.get_source(
            image_id,
            style=parsed_style,
            encoding=encoding,
        )

        tile_data = source.getTile(x, y, z, frame=frame)

        return Response(
            content=tile_data,
            media_type=MIME_TYPES[format_lower],
            headers={
                'Cache-Control': 'public, max-age=3600',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceXYZRangeError as e:
        raise HTTPException(
            status_code=404,
            detail=f'Tile out of range: z={z}, x={x}, y={y}',
        ) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/tiles/{image_id:path}/tile',
    summary='Get tile with query parameters',
    description='Alternative tile endpoint using query parameters.',
    responses={
        200: {'content': {'image/png': {}, 'image/jpeg': {}}},
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_tile_query(
    image_id: str,
    z: Annotated[int, Query(description='Zoom level')],
    x: Annotated[int, Query(description='Tile X coordinate')],
    y: Annotated[int, Query(description='Tile Y coordinate')],
    encoding: Annotated[str, Query(description='Output format')] = 'PNG',
    frame: Annotated[int, Query(description='Frame index')] = 0,
    style: Annotated[str | None, Query(description='JSON style')] = None,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get a tile using query parameters (Jupyter-compatible endpoint)."""
    format_map = {'PNG': 'png', 'JPEG': 'jpeg', 'TIFF': 'tiff'}
    format_ext = format_map.get(encoding.upper(), 'png')

    return await get_tile(
        image_id=image_id,
        z=z,
        x=x,
        y=y,
        format=format_ext,
        frame=frame,
        style=style,
        source_manager=source_manager,
    )
