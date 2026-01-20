"""Region extraction and thumbnail endpoints."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from large_image.exceptions import TileSourceError

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
    '/thumbnail/{image_id:path}',
    summary='Get image thumbnail',
    description='Get a thumbnail of the image, scaled to fit within the specified dimensions.',
    responses={
        200: {'content': {'image/jpeg': {}, 'image/png': {}}},
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_thumbnail(
    image_id: str,
    width: Annotated[int, Query(description='Maximum width', ge=1, le=4096)] = 256,
    height: Annotated[int, Query(description='Maximum height', ge=1, le=4096)] = 256,
    encoding: Annotated[str, Query(description='Output format')] = 'JPEG',
    frame: Annotated[int, Query(description='Frame index')] = 0,
    style: Annotated[str | None, Query(description='JSON style')] = None,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Get a thumbnail of the image.

    The thumbnail is scaled to fit within the specified width and height
    while maintaining aspect ratio.

    Args:
        image_id: Image identifier.
        width: Maximum thumbnail width.
        height: Maximum thumbnail height.
        encoding: Output format (JPEG, PNG, TIFF).
        frame: Frame index for multi-frame images.
        style: JSON style configuration.

    Returns:
        Thumbnail image data.
    """
    encoding_upper = encoding.upper()
    if encoding_upper == 'JPG':
        encoding_upper = 'JPEG'
    elif encoding_upper == 'TIF':
        encoding_upper = 'TIFF'

    mime_type = MIME_TYPES.get(encoding.lower(), 'image/jpeg')

    try:
        parsed_style = parse_style(style)
        source = source_manager.get_source(
            image_id,
            style=parsed_style,
            encoding=encoding_upper,
        )

        image_data, actual_mime = source.getThumbnail(
            width=width,
            height=height,
            encoding=encoding_upper,
            frame=frame,
        )

        return Response(
            content=image_data,
            media_type=actual_mime or mime_type,
            headers={
                'Cache-Control': 'public, max-age=3600',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/region/{image_id:path}',
    summary='Get image region',
    description='Extract a rectangular region from the image at a specified scale.',
    responses={
        200: {'content': {'image/jpeg': {}, 'image/png': {}}},
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_region(
    image_id: str,
    left: Annotated[float, Query(description='Left coordinate')],
    top: Annotated[float, Query(description='Top coordinate')],
    right: Annotated[float | None, Query(description='Right coordinate')] = None,
    bottom: Annotated[float | None, Query(description='Bottom coordinate')] = None,
    width: Annotated[float | None, Query(description='Region width')] = None,
    height: Annotated[float | None, Query(description='Region height')] = None,
    units: Annotated[
        str,
        Query(description='Coordinate units (base_pixels, pixels, mm, fraction)'),
    ] = 'base_pixels',
    max_width: Annotated[
        int | None,
        Query(description='Maximum output width', alias='maxWidth'),
    ] = None,
    max_height: Annotated[
        int | None,
        Query(description='Maximum output height', alias='maxHeight'),
    ] = None,
    encoding: Annotated[str, Query(description='Output format')] = 'JPEG',
    frame: Annotated[int, Query(description='Frame index')] = 0,
    style: Annotated[str | None, Query(description='JSON style')] = None,
    source_manager: SourceManager = Depends(get_source_manager),
) -> Response:
    """Extract a region from the image.

    The region can be specified using either (left, top, right, bottom) or
    (left, top, width, height). Coordinates can be in various units including
    pixels, millimeters, or fractions of the image size.

    Args:
        image_id: Image identifier.
        left: Left coordinate of the region.
        top: Top coordinate of the region.
        right: Right coordinate (mutually exclusive with width).
        bottom: Bottom coordinate (mutually exclusive with height).
        width: Region width (mutually exclusive with right).
        height: Region height (mutually exclusive with bottom).
        units: Coordinate units.
        max_width: Maximum output width (scales the result).
        max_height: Maximum output height (scales the result).
        encoding: Output format.
        frame: Frame index for multi-frame images.
        style: JSON style configuration.

    Returns:
        Region image data.
    """
    # Validate region specification
    if right is None and width is None:
        raise HTTPException(
            status_code=400,
            detail='Either right or width must be specified',
        )
    if bottom is None and height is None:
        raise HTTPException(
            status_code=400,
            detail='Either bottom or height must be specified',
        )

    encoding_upper = encoding.upper()
    if encoding_upper == 'JPG':
        encoding_upper = 'JPEG'
    elif encoding_upper == 'TIF':
        encoding_upper = 'TIFF'

    mime_type = MIME_TYPES.get(encoding.lower(), 'image/jpeg')

    try:
        parsed_style = parse_style(style)
        source = source_manager.get_source(
            image_id,
            style=parsed_style,
            encoding=encoding_upper,
        )

        # Build region specification
        region = {'left': left, 'top': top, 'units': units}
        if right is not None:
            region['right'] = right
        if bottom is not None:
            region['bottom'] = bottom
        if width is not None:
            region['width'] = width
        if height is not None:
            region['height'] = height

        # Build output specification
        output = {}
        if max_width is not None:
            output['maxWidth'] = max_width
        if max_height is not None:
            output['maxHeight'] = max_height

        image_data, actual_mime = source.getRegion(
            region=region,
            output=output if output else None,
            encoding=encoding_upper,
            frame=frame,
        )

        return Response(
            content=image_data,
            media_type=actual_mime or mime_type,
            headers={
                'Cache-Control': 'public, max-age=3600',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/pixel/{image_id:path}',
    summary='Get pixel value',
    description='Get the pixel value at a specific location.',
    responses={
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_pixel(
    image_id: str,
    x: Annotated[float, Query(description='X coordinate')],
    y: Annotated[float, Query(description='Y coordinate')],
    units: Annotated[str, Query(description='Coordinate units')] = 'base_pixels',
    frame: Annotated[int, Query(description='Frame index')] = 0,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict:
    """Get the pixel value at a specific location.

    Args:
        image_id: Image identifier.
        x: X coordinate.
        y: Y coordinate.
        units: Coordinate units.
        frame: Frame index.

    Returns:
        Pixel value information.
    """
    try:
        source = source_manager.get_source(image_id)

        # Get a 1x1 region at the specified location
        region = {
            'left': x,
            'top': y,
            'width': 1,
            'height': 1,
            'units': units,
        }

        import large_image

        result, _ = source.getRegion(
            region=region,
            format=large_image.constants.TILE_FORMAT_NUMPY,
            frame=frame,
        )

        # Extract pixel value
        if result is not None and result.size > 0:
            pixel_value = result.flatten().tolist()
            return {
                'x': x,
                'y': y,
                'units': units,
                'frame': frame,
                'value': pixel_value,
                'shape': list(result.shape),
            }
        else:
            raise HTTPException(status_code=404, detail='Pixel out of bounds')

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/histogram/{image_id:path}',
    summary='Get image histogram',
    description='Get histogram data for the image or a specific region.',
    responses={
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_histogram(
    image_id: str,
    frame: Annotated[int, Query(description='Frame index')] = 0,
    bins: Annotated[int, Query(description='Number of histogram bins', ge=2, le=1024)] = 256,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict:
    """Get histogram data for the image.

    Args:
        image_id: Image identifier.
        frame: Frame index.
        bins: Number of histogram bins.

    Returns:
        Histogram data including bin edges and counts.
    """
    try:
        source = source_manager.get_source(image_id)

        # Get histogram using the tile source's histogram method if available
        if hasattr(source, 'histogram'):
            hist_data = source.histogram(
                frame=frame,
                bins=bins,
                output={'maxWidth': 2048, 'maxHeight': 2048},
            )
            return hist_data
        else:
            # Fallback: compute from thumbnail
            import large_image
            import numpy as np

            thumb, _ = source.getThumbnail(
                width=1024,
                height=1024,
                frame=frame,
                format=large_image.constants.TILE_FORMAT_NUMPY,
            )

            histograms = []
            if len(thumb.shape) == 2:
                # Grayscale
                counts, edges = np.histogram(thumb.flatten(), bins=bins)
                histograms.append({
                    'bin_edges': edges.tolist(),
                    'hist': counts.tolist(),
                    'samples': int(thumb.size),
                })
            else:
                # Multi-channel
                for i in range(thumb.shape[-1]):
                    channel = thumb[..., i]
                    counts, edges = np.histogram(channel.flatten(), bins=bins)
                    histograms.append({
                        'bin_edges': edges.tolist(),
                        'hist': counts.tolist(),
                        'samples': int(channel.size),
                        'channel': i,
                    })

            return {
                'frame': frame,
                'bins': bins,
                'histograms': histograms,
            }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
