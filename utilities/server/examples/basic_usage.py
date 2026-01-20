#!/usr/bin/env python3
"""Example usage of the Large Image Server.

This script demonstrates how to create and run a tile server programmatically.
"""

from pathlib import Path

# Example 1: Quick start with default settings
# --------------------------------------------
# from large_image_server import create_app
# import uvicorn
#
# app = create_app(image_dir="/path/to/images")
# uvicorn.run(app, host="0.0.0.0", port=8000)


# Example 2: Custom configuration
# -------------------------------
def run_custom_server():
    """Run server with custom configuration."""
    from large_image_server import create_app
    from large_image_server.config import ServerSettings
    import uvicorn

    # Create custom settings
    settings = ServerSettings(
        image_dir=Path('./images'),
        port=8080,
        jpeg_quality=90,
        default_encoding='JPEG',
        source_cache_size=20,
        cors_origins=['http://localhost:3000', 'http://localhost:5173'],
    )

    # Create app with settings
    app = create_app(settings=settings)

    # Run the server
    uvicorn.run(app, host='0.0.0.0', port=8080)


# Example 3: Mount as sub-application
# -----------------------------------
def create_combined_app():
    """Create a combined app with large_image_server as a sub-app."""
    from fastapi import FastAPI
    from large_image_server import create_app as create_tile_app

    # Main application
    main_app = FastAPI(title='My Application')

    @main_app.get('/')
    async def root():
        return {'message': 'Main application', 'tile_server': '/tiles'}

    # Mount tile server at /tiles
    tile_app = create_tile_app(image_dir='./images')
    main_app.mount('/tiles', tile_app)

    return main_app


# Example 4: Direct tile access without HTTP server
# -------------------------------------------------
def direct_tile_access():
    """Access tiles directly without HTTP server."""
    import large_image

    # Open an image
    source = large_image.open('/path/to/image.svs')

    # Get metadata
    metadata = source.getMetadata()
    print(f"Image size: {metadata['sizeX']} x {metadata['sizeY']}")
    print(f"Levels: {metadata['levels']}")
    print(f"Tile size: {metadata['tileWidth']} x {metadata['tileHeight']}")

    # Get a specific tile
    tile_data = source.getTile(x=0, y=0, z=0, encoding='PNG')
    with open('tile_0_0_0.png', 'wb') as f:
        f.write(tile_data)
    print('Saved tile_0_0_0.png')

    # Get a thumbnail
    thumbnail, mime_type = source.getThumbnail(width=256, height=256)
    with open('thumbnail.jpg', 'wb') as f:
        f.write(thumbnail)
    print('Saved thumbnail.jpg')

    # Get a region as numpy array
    import numpy as np

    region, _ = source.getRegion(
        region={'left': 1000, 'top': 1000, 'width': 512, 'height': 512},
        format=large_image.constants.TILE_FORMAT_NUMPY,
    )
    print(f'Region shape: {region.shape}, dtype: {region.dtype}')


# Example 5: Generate DeepZoom-compatible tiles
# ---------------------------------------------
def generate_deepzoom_response(image_path: str, level: int, col: int, row: int) -> bytes:
    """Generate a DeepZoom tile without pre-generating DZI files.

    This is exactly what the FastAPI server does internally.
    """
    import math

    import large_image

    source = large_image.open(image_path, encoding='JPEG')
    metadata = source.getMetadata()

    # Convert DeepZoom coordinates to large_image coordinates
    tile_size = metadata['tileWidth']
    dz_tile_level = math.ceil(math.log2(tile_size)) if tile_size > 0 else 8

    # large_image level = deepzoom level - log2(tile_size)
    li_level = level - dz_tile_level
    li_level = max(0, min(li_level, metadata['levels'] - 1))

    # Get the tile
    return source.getTile(col, row, li_level)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Large Image Server examples')
    parser.add_argument(
        '--example',
        choices=['server', 'combined', 'direct'],
        default='server',
        help='Example to run',
    )
    parser.add_argument(
        '--image-dir',
        type=Path,
        default=Path('.'),
        help='Image directory',
    )

    args = parser.parse_args()

    if args.example == 'server':
        print('Running custom server example...')
        print(f'Image directory: {args.image_dir}')
        # Update the settings with command line arg
        from large_image_server import create_app
        import uvicorn

        app = create_app(image_dir=args.image_dir)
        uvicorn.run(app, host='0.0.0.0', port=8000)

    elif args.example == 'combined':
        print('Running combined app example...')
        import uvicorn

        app = create_combined_app()
        uvicorn.run(app, host='0.0.0.0', port=8000)

    elif args.example == 'direct':
        print('Running direct tile access example...')
        direct_tile_access()
