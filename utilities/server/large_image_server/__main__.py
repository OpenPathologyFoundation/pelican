"""Command-line interface for Large Image Server."""

import argparse
import sys
from pathlib import Path


def _run_offline_command(args) -> int:
    """Run --backfill-hmac, --verify-all, or --backfill-metadata without starting the server."""
    from .config import get_settings
    from . import db

    settings = get_settings()

    if not settings.storage_db_url:
        print('Error: --db-url is required for offline commands', file=sys.stderr)
        return 1
    if not settings.storage_clinical_root:
        print('Error: --clinical-root is required for offline commands', file=sys.stderr)
        return 1
    if (args.backfill_hmac or args.verify_all) and not settings.hmac_key:
        print('Error: --hmac-key is required for HMAC commands', file=sys.stderr)
        return 1

    if not db.is_configured():
        print('Error: Could not connect to database', file=sys.stderr)
        return 1

    if args.backfill_hmac:
        from .hmac_util import compute_file_hmac
        slides = db.list_slides_missing_hmac()
        print(f'Found {len(slides)} slides with NULL hmac')

        processed = 0
        skipped = 0
        errors = 0
        for slide in slides:
            slide_id = slide['slide_id']
            file_path = settings.storage_clinical_root / slide['relative_path']

            if not file_path.exists():
                print(f'  SKIP {slide_id}: file not found')
                skipped += 1
                continue

            try:
                hmac_hex = compute_file_hmac(file_path, settings.hmac_key)
                db.update_slide_hmac(slide_id, hmac_hex)
                processed += 1
                print(f'  OK   {slide_id}: {hmac_hex[:16]}...')
            except Exception as e:
                print(f'  ERR  {slide_id}: {e}', file=sys.stderr)
                errors += 1

        print(f'\nBackfill complete: {processed} processed, {skipped} skipped, {errors} errors')
        return 1 if errors else 0

    if args.verify_all:
        import hmac as hmac_mod
        from .hmac_util import compute_file_hmac

        slides = db.list_slides_for_verification()
        print(f'Found {len(slides)} slides to verify')

        verified = 0
        failed = 0
        missing = 0
        for slide in slides:
            slide_id = slide['slide_id']
            stored_hmac = slide['hmac']
            file_path = settings.storage_clinical_root / slide['relative_path']

            if not file_path.exists():
                print(f'  MISS {slide_id}: file not found')
                missing += 1
                continue

            try:
                actual_hmac = compute_file_hmac(file_path, settings.hmac_key)
            except Exception as e:
                print(f'  ERR  {slide_id}: {e}', file=sys.stderr)
                failed += 1
                continue

            if hmac_mod.compare_digest(actual_hmac, stored_hmac):
                db.update_slide_verified(slide_id)
                verified += 1
                print(f'  OK   {slide_id}')
            else:
                failed += 1
                print(f'  FAIL {slide_id}: expected={stored_hmac[:16]}... actual={actual_hmac[:16]}...')

        print(f'\nVerification complete: {verified} verified, {failed} failed, {missing} missing')
        return 1 if failed else 0

    if args.backfill_metadata:
        from .routes.ingest import _extract_metadata

        slides = db.list_slides_missing_metadata()
        print(f'Found {len(slides)} slides with NULL metadata')

        processed = 0
        skipped = 0
        errors = 0
        for slide in slides:
            slide_id = slide['slide_id']
            file_path = settings.storage_clinical_root / slide['relative_path']

            if not file_path.exists():
                print(f'  SKIP {slide_id}: file not found')
                skipped += 1
                continue

            try:
                meta = _extract_metadata(file_path)
                if not meta.get('width_px'):
                    print(f'  SKIP {slide_id}: no dimensions extracted')
                    skipped += 1
                    continue

                db.update_slide_metadata(
                    slide_id,
                    width_px=meta.get('width_px'),
                    height_px=meta.get('height_px'),
                    magnification=meta.get('magnification'),
                    mpp_x=meta.get('mpp_x'),
                    mpp_y=meta.get('mpp_y'),
                    scanner=meta.get('scanner'),
                )
                processed += 1
                w = meta.get('width_px')
                h = meta.get('height_px')
                mag = meta.get('magnification')
                print(f'  OK   {slide_id}: {w}x{h} @ {mag}x')
            except Exception as e:
                print(f'  ERR  {slide_id}: {e}', file=sys.stderr)
                errors += 1

        print(f'\nMetadata backfill complete: {processed} processed, {skipped} skipped, {errors} errors')
        return 1 if errors else 0

    return 0


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
        '--db-url',
        type=str,
        default=None,
        help='PostgreSQL connection URL for WSI metadata '
        '(e.g., postgresql://user:pass@host:port/db)',
    )
    parser.add_argument(
        '--clinical-root',
        type=Path,
        default=None,
        help='Filesystem root for clinical slide collection '
        '(prepended to wsi.slides.relative_path from database)',
    )
    parser.add_argument(
        '--edu-root',
        type=Path,
        default=None,
        help='Filesystem root for educational slide collection '
        '(prepended to wsi_edu.slides.relative_path from database)',
    )
    parser.add_argument(
        '--hmac-key',
        type=str,
        default=None,
        help='Secret key for HMAC-SHA256 integrity verification '
        '(prefer env var LARGE_IMAGE_SERVER_HMAC_KEY)',
    )
    parser.add_argument(
        '--backfill-hmac',
        action='store_true',
        help='Compute HMACs for slides with NULL hmac, print summary, and exit '
        '(requires --db-url, --clinical-root, --hmac-key)',
    )
    parser.add_argument(
        '--verify-all',
        action='store_true',
        help='Verify all slides by recomputing HMACs, print summary, and exit '
        '(requires --db-url, --clinical-root, --hmac-key)',
    )
    parser.add_argument(
        '--backfill-metadata',
        action='store_true',
        help='Extract image metadata (dimensions, magnification, mpp) from slide files '
        'for slides with NULL width_px, print summary, and exit '
        '(requires --db-url, --clinical-root)',
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

    # Validate image directory (not required when using --db-url with --clinical-root)
    if not args.db_url:
        if not args.image_dir.exists():
            print(f'Error: Image directory does not exist: {args.image_dir}', file=sys.stderr)
            return 1
        if not args.image_dir.is_dir():
            print(f'Error: Not a directory: {args.image_dir}', file=sys.stderr)
            return 1

    # Validate clinical-root if provided
    if args.clinical_root and not args.clinical_root.is_dir():
        print(f'Error: Clinical root is not a directory: {args.clinical_root}', file=sys.stderr)
        return 1

    # Validate edu-root if provided
    if args.edu_root and not args.edu_root.is_dir():
        print(f'Error: Educational root is not a directory: {args.edu_root}', file=sys.stderr)
        return 1

    # Configure settings
    from .config import configure_settings

    config_kwargs = {
        'image_dir': args.image_dir.resolve(),
        'host': args.host,
        'port': args.port,
        'reload': args.reload,
        'workers': args.workers,
        'cache_backend': args.cache_backend,
        'source_cache_size': args.source_cache_size,
        'jpeg_quality': args.jpeg_quality,
        'default_encoding': args.default_encoding,
        'api_prefix': args.api_prefix,
        'cors_enabled': not args.no_cors,
        'docs_enabled': not args.no_docs,
    }

    if args.db_url:
        config_kwargs['storage_db_url'] = args.db_url
    if args.clinical_root:
        config_kwargs['storage_clinical_root'] = args.clinical_root.resolve()
    if args.edu_root:
        config_kwargs['storage_edu_root'] = args.edu_root.resolve()
    if args.hmac_key:
        config_kwargs['hmac_key'] = args.hmac_key

    configure_settings(**config_kwargs)

    # Handle offline commands (mutually exclusive with server startup)
    if args.backfill_hmac or args.verify_all or args.backfill_metadata:
        return _run_offline_command(args)

    # Create and run the app
    print('Starting Large Image Server...')
    print(f'  Image directory: {args.image_dir.resolve()}')
    if args.db_url:
        # Mask password in URL for display
        display_url = args.db_url.split('@')[-1] if '@' in args.db_url else args.db_url
        print(f'  Database: ...@{display_url}')
    if args.clinical_root:
        print(f'  Clinical root: {args.clinical_root.resolve()}')
    if args.edu_root:
        print(f'  Educational root: {args.edu_root.resolve()}')
    if config_kwargs.get('hmac_key'):
        print('  HMAC: configured')
    print(f'  Server: http://{args.host}:{args.port}')
    print(f'  API docs: http://{args.host}:{args.port}/docs')
    print()

    try:
        import uvicorn

        use_workers = args.workers if not args.reload else 1
        need_import_string = use_workers > 1 or args.reload

        if need_import_string:
            # uvicorn requires an import string (not a Python object) when using
            # multiple workers or reload, because it forks/re-imports the app.
            # Export CLI settings as env vars so each worker picks them up via
            # the Pydantic LARGE_IMAGE_SERVER_ prefix.
            import os

            _env_map = {
                'LARGE_IMAGE_SERVER_IMAGE_DIR': str(args.image_dir.resolve()),
                'LARGE_IMAGE_SERVER_HOST': args.host,
                'LARGE_IMAGE_SERVER_PORT': str(args.port),
                'LARGE_IMAGE_SERVER_RELOAD': str(args.reload).lower(),
                'LARGE_IMAGE_SERVER_WORKERS': str(args.workers),
                'LARGE_IMAGE_SERVER_SOURCE_CACHE_SIZE': str(args.source_cache_size),
                'LARGE_IMAGE_SERVER_JPEG_QUALITY': str(args.jpeg_quality),
                'LARGE_IMAGE_SERVER_DEFAULT_ENCODING': args.default_encoding,
                'LARGE_IMAGE_SERVER_API_PREFIX': args.api_prefix,
                'LARGE_IMAGE_SERVER_CORS_ENABLED': str(not args.no_cors).lower(),
                'LARGE_IMAGE_SERVER_DOCS_ENABLED': str(not args.no_docs).lower(),
            }
            if args.cache_backend:
                _env_map['LARGE_IMAGE_SERVER_CACHE_BACKEND'] = args.cache_backend
            if args.db_url:
                _env_map['LARGE_IMAGE_SERVER_STORAGE_DB_URL'] = args.db_url
            if args.clinical_root:
                _env_map['LARGE_IMAGE_SERVER_STORAGE_CLINICAL_ROOT'] = str(
                    args.clinical_root.resolve()
                )
            if args.edu_root:
                _env_map['LARGE_IMAGE_SERVER_STORAGE_EDU_ROOT'] = str(args.edu_root.resolve())
            if args.hmac_key:
                _env_map['LARGE_IMAGE_SERVER_HMAC_KEY'] = args.hmac_key

            for key, value in _env_map.items():
                os.environ[key] = value

            uvicorn.run(
                'large_image_server:create_app',
                factory=True,
                host=args.host,
                port=args.port,
                reload=args.reload,
                workers=use_workers,
                log_level='info',
            )
        else:
            from . import create_app

            app = create_app()

            uvicorn.run(
                app,
                host=args.host,
                port=args.port,
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
