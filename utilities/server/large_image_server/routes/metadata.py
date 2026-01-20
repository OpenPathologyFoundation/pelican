"""Metadata endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from large_image.exceptions import TileSourceError

from ..models import ErrorResponse, ImageInfo, TileMetadata
from ..source_manager import SourceManager, get_source_manager

router = APIRouter()


@router.get(
    '/metadata/{image_id:path}',
    summary='Get image metadata',
    description='Get tile metadata including dimensions, tile size, levels, and magnification.',
    response_model=TileMetadata,
    responses={
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_metadata(
    image_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """Get image tile metadata.

    Args:
        image_id: Image identifier.

    Returns:
        Tile metadata including dimensions, levels, magnification, etc.
    """
    try:
        source = source_manager.get_source(image_id)
        return source.getMetadata()

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/metadata/{image_id:path}/internal',
    summary='Get internal metadata',
    description='Get format-specific internal metadata.',
    responses={
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_internal_metadata(
    image_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """Get internal (format-specific) metadata.

    This returns additional metadata that may be specific to the
    image format, such as TIFF tags, DICOM attributes, etc.

    Args:
        image_id: Image identifier.

    Returns:
        Internal metadata dictionary.
    """
    try:
        source = source_manager.get_source(image_id)
        return source.getInternalMetadata() or {}

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/info/{image_id:path}',
    summary='Get complete image info',
    description='Get complete image information including metadata and associated images.',
    response_model=ImageInfo,
    responses={
        404: {'model': ErrorResponse},
        400: {'model': ErrorResponse},
    },
)
async def get_image_info(
    image_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> dict[str, Any]:
    """Get complete image information.

    Args:
        image_id: Image identifier.

    Returns:
        Complete image info including metadata and associated images list.
    """
    try:
        path = source_manager.get_source_path(image_id)
        source = source_manager.get_source(image_id)
        metadata = source.getMetadata()

        # Get associated images list
        try:
            associated = source.getAssociatedImagesList() or []
        except Exception:
            associated = []

        return {
            'id': image_id,
            'path': str(path),
            'metadata': metadata,
            'associatedImages': associated,
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/associated/{image_id:path}',
    summary='List associated images',
    description='Get list of associated images (label, macro, thumbnail, etc.).',
    responses={
        404: {'model': ErrorResponse},
    },
)
async def list_associated_images(
    image_id: str,
    source_manager: SourceManager = Depends(get_source_manager),
) -> list[str]:
    """List available associated images.

    Associated images are secondary images embedded in whole slide images,
    such as label images, macro (overview) images, and thumbnails.

    Args:
        image_id: Image identifier.

    Returns:
        List of associated image names.
    """
    try:
        source = source_manager.get_source(image_id)
        return source.getAssociatedImagesList() or []

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/associated/{image_id:path}/{name}',
    summary='Get associated image',
    description='Get an associated image by name (e.g., "label", "macro").',
    responses={
        200: {'content': {'image/jpeg': {}, 'image/png': {}}},
        404: {'model': ErrorResponse},
    },
)
async def get_associated_image(
    image_id: str,
    name: str,
    source_manager: SourceManager = Depends(get_source_manager),
):
    """Get an associated image.

    Args:
        image_id: Image identifier.
        name: Associated image name (e.g., "label", "macro").

    Returns:
        Associated image data.
    """
    from fastapi import Response

    try:
        source = source_manager.get_source(image_id)

        # Check if the associated image exists
        available = source.getAssociatedImagesList() or []
        if name not in available:
            raise HTTPException(
                status_code=404,
                detail=f'Associated image "{name}" not found. Available: {available}',
            )

        image_data, mime_type = source.getAssociatedImage(name)

        return Response(
            content=image_data,
            media_type=mime_type,
            headers={
                'Cache-Control': 'public, max-age=86400',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TileSourceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    '/images',
    summary='List available images',
    description='List all available images in the configured image directory.',
)
async def list_images(
    source_manager: SourceManager = Depends(get_source_manager),
) -> list[str]:
    """List all available images.

    Returns:
        List of image identifiers.
    """
    return source_manager.list_images()
