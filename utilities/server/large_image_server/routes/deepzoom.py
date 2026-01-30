"""DeepZoom (DZI) endpoints for OpenSeaDragon compatibility."""

import json
import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from large_image.exceptions import TileSourceError, TileSourceXYZRangeError

from ..models import ErrorResponse
from ..source_manager import SourceManager, get_source_manager

router = APIRouter()


def parse_style(style: str | None) -> dict | None:
    """Parse style parameter from JSON string."""
    if not style:
        return None
    try:
        return json.loads(style)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f'Invalid style JSON: {e}') from e


@router.get(
    '/deepzoom/{image_id:path}.dzi',
    summary='Get DeepZoom descriptor',
    description='Get the DZI XML descriptor for an image. '
    'Use this URL as the tileSources for OpenSeaDragon.',
    responses={
        200: {'content': {'application/xml': {}}},
        404: {'model': ErrorResponse},
    },
)
async def get_dzi_descriptor(
    image_id: str,
    format: Annotated[str, Query(description='Tile format')] = 'jpeg',
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get DeepZoom Image (DZI) descriptor XML.

    This endpoint generates the DZI XML descriptor dynamically from the
    source image metadata. OpenSeaDragon uses this to understand the
    image structure.

    Args:
        image_id: Image identifier.
        format: Tile format (jpeg or png).

    Returns:
        DZI XML descriptor.
    """
    try:
        source = source_manager.get_source(image_id)
        metadata = source.getMetadata()

        # DeepZoom uses 0 overlap by default
        overlap = 0
        tile_size = metadata['tileWidth']

        # Generate DZI XML
        dzi_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="{format}"
       Overlap="{overlap}"
       TileSize="{tile_size}">
    <Size Width="{metadata['sizeX']}" Height="{metadata['sizeY']}"/>
</Image>'''

        return Response(
            content=dzi_xml,
            media_type='application/xml',
            headers={
                'Cache-Control': 'public, max-age=86400',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/deepzoom/{image_id:path}_files/{level}/{col}_{row}.{format}',
    summary='Get DeepZoom tile',
    description='Get a tile in DeepZoom format. '
    'These URLs are requested by OpenSeaDragon based on the DZI descriptor.',
    responses={
        200: {'content': {'image/jpeg': {}, 'image/png': {}}},
        404: {'model': ErrorResponse},
    },
)
async def get_dzi_tile(
    image_id: str,
    level: int,
    col: int,
    row: int,
    format: str,
    frame: Annotated[int, Query(description='Frame index')] = 0,
    style: Annotated[str | None, Query(description='JSON style')] = None,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get a DeepZoom tile.

    DeepZoom levels are numbered differently than large_image levels:
    - DeepZoom level 0 is a 1x1 pixel image
    - Each level doubles in size
    - The highest level is the full resolution image

    This endpoint converts DeepZoom coordinates to large_image coordinates.

    Args:
        image_id: Image identifier.
        level: DeepZoom level (0 = 1x1 pixel).
        col: Tile column (x).
        row: Tile row (y).
        format: Tile format (jpeg, png).
        frame: Frame index for multi-frame images.
        style: JSON style configuration.

    Returns:
        Tile image data.
    """
    format_lower = format.lower()
    if format_lower not in ('jpeg', 'jpg', 'png'):
        raise HTTPException(status_code=400, detail=f'Unsupported format: {format}')

    encoding = 'JPEG' if format_lower in ('jpeg', 'jpg') else 'PNG'
    mime_type = 'image/jpeg' if encoding == 'JPEG' else 'image/png'

    try:
        parsed_style = parse_style(style)
        source = source_manager.get_source(
            image_id,
            style=parsed_style,
            encoding=encoding,
        )
        metadata = source.getMetadata()

        # Convert DeepZoom level to large_image level
        #
        # DeepZoom numbering: level 0 = 1x1 pixel, level N = 2^N pixels on longest side
        # large_image numbering: level 0 = lowest res, level (levels-1) = full res
        #
        # The mapping is:
        #   DeepZoom max level (dz_max_level) = full resolution
        #   large_image max level (levels-1) = full resolution
        #
        # So: li_level = level - dz_max_level + (levels - 1)
        #     li_level = level - (dz_max_level - levels + 1)
        #
        max_dim = max(metadata['sizeX'], metadata['sizeY'])
        dz_max_level = math.ceil(math.log2(max_dim)) if max_dim > 0 else 0

        # Calculate the level offset between DeepZoom and large_image
        level_offset = dz_max_level - (metadata['levels'] - 1)

        # Convert DeepZoom level to large_image level
        li_level = level - level_offset

        # Clamp to valid range
        if li_level < 0:
            # Request is for a level smaller than our smallest tile
            # Return a scaled version of the lowest level tile
            li_level = 0
        elif li_level >= metadata['levels']:
            li_level = metadata['levels'] - 1

        tile_data = source.getTile(col, row, li_level, frame=frame)

        return Response(
            content=tile_data,
            media_type=mime_type,
            headers={
                'Cache-Control': 'public, max-age=3600',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceXYZRangeError as e:
        raise HTTPException(
            status_code=404,
            detail=f'Tile out of range: level={level}, col={col}, row={row}',
        ) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/deepzoom/{image_id:path}/info',
    summary='Get DeepZoom info as JSON',
    description='Get DeepZoom descriptor information as JSON (alternative to XML).',
)
async def get_dzi_info(
    image_id: str,
    format: Annotated[str, Query(description='Tile format')] = 'jpeg',
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict:
    """Get DeepZoom info as JSON.

    This is a convenience endpoint that returns the DZI information
    as JSON instead of XML, useful for programmatic access.
    """
    try:
        source = source_manager.get_source(image_id)
        metadata = source.getMetadata()

        return {
            'format': format,
            'overlap': 0,
            'tileSize': metadata['tileWidth'],
            'width': metadata['sizeX'],
            'height': metadata['sizeY'],
            'levels': metadata['levels'],
            'maxLevel': math.ceil(
                math.log2(max(metadata['sizeX'], metadata['sizeY'])),
            ),
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
