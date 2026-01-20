"""Command-line interface for Large Image Server."""

import argparse
import sys
from pathlib import Path


def main() -> int:
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description='Large Image Server - FastAPI tile server for large images',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Serve images from a directory
  large_image_server --image-dir /path/to/images

  # Specify port and host
  large_image_server --image-dir /images --port 8080 --host 0.0.0.0

  # Enable development mode with auto-reload
  large_image_server --image-dir /images --reload

  # Use Redis caching
  large_image_server --image-dir /images --cache-backend redis

  # Multiple workers for production
  large_image_server --image-dir /images --workers 4
''',
    )

    parser.add_argument(
        '--image-dir',
        '-d',
        type=Path,
        default=Path('.'),
        help='Directory containing images to serve (default: current directory)',
    )
    parser.add_argument(
        '--host',
        '-H',
        type=str,
        default='0.0.0.0',
        help='Host to bind to (default: 0.0.0.0)',
    )
    parser.add_argument(
        '--port',
        '-p',
        type=int,
        default=8000,
        help='Port to bind to (default: 8000)',
    )
    parser.add_argument(
        '--workers',
        '-w',
        type=int,
        default=1,
        help='Number of worker processes (default: 1)',
    )
    parser.add_argument(
        '--reload',
        '-r',
        action='store_true',
        help='Enable auto-reload for development',
    )
    parser.add_argument(
        '--cache-backend',
        type=str,
        choices=['python', 'memcached', 'redis'],
        default=None,
        help='Cache backend (default: auto-select)',
    )
    parser.add_argument(
        '--source-cache-size',
        type=int,
        default=10,
        help='Maximum number of tile sources to keep open (default: 10)',
    )
    parser.add_argument(
        '--jpeg-quality',
        type=int,
        default=85,
        help='JPEG quality 1-100 (default: 85)',
    )
    parser.add_argument(
        '--default-encoding',
        type=str,
        choices=['JPEG', 'PNG', 'TIFF'],
        default='JPEG',
        help='Default tile encoding (default: JPEG)',
    )
    parser.add_argument(
        '--api-prefix',
        type=str,
        default='',
        help='API route prefix (e.g., /api/v1)',
    )
    parser.add_argument(
        '--no-cors',
        action='store_true',
        help='Disable CORS middleware',
    )
    parser.add_argument(
        '--no-docs',
        action='store_true',
        help='Disable Swagger/OpenAPI documentation',
    )
    parser.add_argument(
        '--version',
        '-v',
        action='store_true',
        help='Show version and exit',
    )

    args = parser.parse_args()

    if args.version:
        from . import __version__

        print(f'large-image-server {__version__}')
        return 0

    # Validate image directory
    if not args.image_dir.exists():
        print(f'Error: Image directory does not exist: {args.image_dir}', file=sys.stderr)
        return 1

    if not args.image_dir.is_dir():
        print(f'Error: Not a directory: {args.image_dir}', file=sys.stderr)
        return 1

    # Configure settings
    from .config import configure_settings

    configure_settings(
        image_dir=args.image_dir.resolve(),
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers,
        cache_backend=args.cache_backend,
        source_cache_size=args.source_cache_size,
        jpeg_quality=args.jpeg_quality,
        default_encoding=args.default_encoding,
        api_prefix=args.api_prefix,
        cors_enabled=not args.no_cors,
        docs_enabled=not args.no_docs,
    )

    # Create and run the app
    from . import create_app

    print(f'Starting Large Image Server...')
    print(f'  Image directory: {args.image_dir.resolve()}')
    print(f'  Server: http://{args.host}:{args.port}')
    print(f'  API docs: http://{args.host}:{args.port}/docs')
    print()

    try:
        import uvicorn

        app = create_app()

        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            reload=args.reload,
            workers=args.workers if not args.reload else 1,
            log_level='info',
        )
    except KeyboardInterrupt:
        print('\nShutting down...')
    except ImportError as e:
        print(f'Error: {e}', file=sys.stderr)
        print('Make sure uvicorn is installed: pip install uvicorn[standard]', file=sys.stderr)
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
