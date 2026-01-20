"""Pydantic models for API requests and responses."""

from typing import Any

from pydantic import BaseModel, Field


class TileMetadata(BaseModel):
    """Image tile metadata."""

    levels: int = Field(description='Number of zoom levels')
    sizeX: int = Field(description='Image width in pixels')
    sizeY: int = Field(description='Image height in pixels')
    tileWidth: int = Field(description='Tile width in pixels')
    tileHeight: int = Field(description='Tile height in pixels')
    magnification: float | None = Field(default=None, description='Reported magnification')
    mm_x: float | None = Field(default=None, description='Pixel width in millimeters')
    mm_y: float | None = Field(default=None, description='Pixel height in millimeters')
    frames: list[dict[str, Any]] | None = Field(
        default=None,
        description='Frame information for multi-frame images',
    )
    IndexRange: dict[str, int] | None = Field(
        default=None,
        description='Range of frame indices',
    )
    IndexStride: dict[str, int] | None = Field(
        default=None,
        description='Stride of frame indices',
    )
    channels: list[str] | None = Field(
        default=None,
        description='Channel names',
    )
    dtype: str | None = Field(default=None, description='Data type')
    bandCount: int | None = Field(default=None, description='Number of bands/samples')


class DeepZoomInfo(BaseModel):
    """DeepZoom image descriptor information."""

    format: str = Field(description='Tile format (jpeg, png)')
    overlap: int = Field(default=0, description='Tile overlap in pixels')
    tileSize: int = Field(description='Tile size in pixels')
    width: int = Field(description='Image width')
    height: int = Field(description='Image height')


class RegionRequest(BaseModel):
    """Region extraction request parameters."""

    left: float = Field(description='Left coordinate')
    top: float = Field(description='Top coordinate')
    right: float | None = Field(default=None, description='Right coordinate')
    bottom: float | None = Field(default=None, description='Bottom coordinate')
    width: float | None = Field(default=None, description='Region width')
    height: float | None = Field(default=None, description='Region height')
    units: str = Field(
        default='base_pixels',
        description='Coordinate units (base_pixels, pixels, mm, fraction, etc.)',
    )


class OutputRequest(BaseModel):
    """Output specification for region/thumbnail requests."""

    maxWidth: int | None = Field(default=None, description='Maximum output width')
    maxHeight: int | None = Field(default=None, description='Maximum output height')


class StyleBand(BaseModel):
    """Style specification for a single band."""

    band: int | None = Field(default=None, description='Band index (1-based)')
    frame: int | None = Field(default=None, description='Frame index')
    min: float | str | None = Field(
        default=None,
        description='Minimum value or "auto"/"min"',
    )
    max: float | str | None = Field(
        default=None,
        description='Maximum value or "auto"/"max"',
    )
    palette: str | None = Field(
        default=None,
        description='Color palette (e.g., "#ff0000", "viridis")',
    )
    nodata: float | None = Field(default=None, description='No-data value')
    composite: str | None = Field(
        default=None,
        description='Compositing mode (e.g., "lighten", "multiply")',
    )


class TileStyle(BaseModel):
    """Tile styling configuration."""

    bands: list[StyleBand] | None = Field(
        default=None,
        description='Band styling specifications',
    )
    min: float | str | None = Field(default=None, description='Global minimum value')
    max: float | str | None = Field(default=None, description='Global maximum value')
    palette: str | None = Field(default=None, description='Global color palette')
    nodata: float | None = Field(default=None, description='Global no-data value')
    dtype: str | None = Field(default=None, description='Output data type')
    axis: dict[str, int] | None = Field(default=None, description='Axis selection')


class AssociatedImageInfo(BaseModel):
    """Information about an associated image."""

    name: str = Field(description='Associated image name')
    width: int | None = Field(default=None, description='Image width')
    height: int | None = Field(default=None, description='Image height')


class ImageInfo(BaseModel):
    """Complete image information."""

    id: str = Field(description='Image identifier')
    path: str = Field(description='Image file path')
    metadata: TileMetadata = Field(description='Tile metadata')
    associatedImages: list[str] = Field(
        default_factory=list,
        description='List of associated image names',
    )


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(default='healthy')
    version: str | None = Field(default=None)
    sources_loaded: int = Field(default=0)


class ErrorResponse(BaseModel):
    """Error response."""

    detail: str = Field(description='Error message')
    error_type: str | None = Field(default=None, description='Error type')
