"""Configuration settings for the Large Image Server."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ServerSettings(BaseSettings):
    """Server configuration settings.

    Settings can be configured via environment variables with the prefix LARGE_IMAGE_SERVER_.
    For example: LARGE_IMAGE_SERVER_IMAGE_DIR=/path/to/images
    """

    model_config = SettingsConfigDict(
        env_prefix='LARGE_IMAGE_SERVER_',
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
    )

    # Server settings
    host: str = Field(default='0.0.0.0', description='Host to bind the server to')
    port: int = Field(default=8000, description='Port to bind the server to')
    reload: bool = Field(default=False, description='Enable auto-reload for development')
    workers: int = Field(default=1, description='Number of worker processes')

    # Image settings
    image_dir: Path = Field(
        default=Path('.'),
        description='Directory containing images to serve',
    )
    allowed_extensions: set[str] = Field(
        default={
            '.svs', '.ndpi', '.vms', '.scn', '.mrxs', '.czi',
            '.tif', '.tiff', '.ptif', '.qptiff',
            '.ome.tif', '.ome.tiff',
            '.nd2', '.dcm', '.jp2', '.png', '.jpg', '.jpeg',
            '.zarr', '.zarr.zip',
        },
        description='Allowed image file extensions',
    )

    # Tile settings
    default_encoding: Literal['JPEG', 'PNG', 'TIFF'] = Field(
        default='JPEG',
        description='Default tile encoding format',
    )
    jpeg_quality: int = Field(
        default=85,
        ge=1,
        le=100,
        description='JPEG quality (1-100)',
    )
    jpeg_subsampling: int = Field(
        default=1,
        ge=0,
        le=2,
        description='JPEG chroma subsampling (0=4:4:4, 1=4:2:2, 2=4:2:0)',
    )

    # Caching settings
    cache_backend: Literal['python', 'memcached', 'redis'] | None = Field(
        default=None,
        description='Cache backend (None for auto-select)',
    )
    cache_tile_timeout: int = Field(
        default=300,
        description='Tile cache timeout in seconds',
    )
    source_cache_size: int = Field(
        default=10,
        description='Maximum number of tile sources to keep open',
    )

    # CORS settings
    cors_enabled: bool = Field(
        default=True,
        description='Enable CORS middleware',
    )
    cors_origins: list[str] = Field(
        default=['*'],
        description='Allowed CORS origins',
    )
    cors_allow_credentials: bool = Field(
        default=False,
        description='Allow credentials in CORS requests',
    )

    # API settings
    api_prefix: str = Field(
        default='',
        description='API route prefix (e.g., "/api/v1")',
    )
    docs_enabled: bool = Field(
        default=True,
        description='Enable Swagger/OpenAPI documentation',
    )

    # JWT Authentication settings (SRS SYS-IMS-036)
    jwt_enabled: bool = Field(
        default=False,
        description='Enable JWT authentication for tile endpoints',
    )
    jwt_secret: str | None = Field(
        default=None,
        description='Secret key for HS* algorithms or public key for RS* algorithms',
    )
    jwt_algorithm: str = Field(
        default='HS256',
        description='JWT signing algorithm (HS256, HS384, HS512, RS256, RS384, RS512)',
    )
    jwt_audience: str | None = Field(
        default=None,
        description='Expected JWT audience claim (optional)',
    )
    jwt_issuer: str | None = Field(
        default=None,
        description='Expected JWT issuer claim (optional)',
    )


# Global settings instance
_settings: ServerSettings | None = None


def get_settings() -> ServerSettings:
    """Get the global settings instance."""
    global _settings
    if _settings is None:
        _settings = ServerSettings()
    return _settings


def configure_settings(**kwargs) -> ServerSettings:
    """Configure and return new settings instance."""
    global _settings
    _settings = ServerSettings(**kwargs)
    return _settings
