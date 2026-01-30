#!/usr/bin/env python3
"""
Batch Converter for DICOM WSI to Pyramidal TIFF

This script monitors an inbox directory for DICOM files and converts them
to pyramidal TIFF format for fast tile serving. Original DICOM files are
moved to an archive directory.

Usage:
    # One-time conversion
    python batch_converter.py --inbox /data/inbox --serving /data/serving --archive /data/archive

    # Watch mode (continuous monitoring)
    python batch_converter.py --inbox /data/inbox --serving /data/serving --archive /data/archive --watch

    # Dry run (show what would be done)
    python batch_converter.py --inbox /data/inbox --serving /data/serving --archive /data/archive --dry-run

Directory Structure:
    /inbox/                     # Drop DICOM files here
        S26-0001_A1_S1.dcm
        S26-0002_B1_S1.dcm

    /serving/                   # Converted TIFFs served by tile server
        S26-0001_A1_S1.tiff
        S26-0002_B1_S1.tiff

    /archive/                   # Original DICOMs preserved
        S26-0001_A1_S1.dcm
        S26-0002_B1_S1.dcm

Configuration via environment variables:
    CONVERTER_INBOX=/data/inbox
    CONVERTER_SERVING=/data/serving
    CONVERTER_ARCHIVE=/data/archive
    CONVERTER_QUALITY=85
    CONVERTER_TILE_SIZE=256
    CONVERTER_WATCH_INTERVAL=10
    CONVERTER_MAX_CONCURRENT=2
"""

import argparse
import json
import logging
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# File extensions that need conversion (slow to index)
CONVERTIBLE_EXTENSIONS = {'.dcm', '.dicom'}

# Extensions that are already fast (just move, don't convert)
PASSTHROUGH_EXTENSIONS = {'.svs', '.ndpi', '.mrxs', '.scn', '.czi', '.tiff', '.tif', '.ome.tiff', '.ome.tif'}


def _fix_pyramid_tags(output_path: str) -> None:
    """
    Fix TIFF pyramid tags for QuPath compatibility.

    pyvips creates pyramidal TIFFs without NewSubfileType=0 on the first IFD.
    QuPath and some other viewers require this tag to recognize the file as
    properly pyramidal. This function adds the missing tag.

    Args:
        output_path: Path to the TIFF file to fix.
    """
    import tifftools

    info = tifftools.read_tiff(output_path)

    # Check if first IFD is missing NewSubfileType tag (254)
    first_ifd = info['ifds'][0]
    if 254 not in first_ifd.get('tags', {}):
        # Add NewSubfileType=0 (full resolution image) to first IFD
        first_ifd['tags'][254] = {
            'datatype': 4,  # LONG
            'count': 1,
            'data': [0],  # 0 = full resolution image
        }
        # Write back the fixed file
        tifftools.write_tiff(info, output_path, allowExisting=True)


def convert_dicom_to_tiff(
    source_path: str,
    output_path: str,
    quality: int = 85,
    tile_size: int = 256,
) -> None:
    """
    Convert DICOM WSI to pyramidal TIFF with correct color preservation.

    This function handles a color calibration issue where pyvips/openslide adds
    an ICC profile when reading DICOM files. By stripping the ICC profile and
    setting the interpretation to RGB, we preserve the original pixel colors.

    The output TIFF is compatible with QuPath and other WSI viewers:
    - Properly tagged pyramidal structure (NewSubfileType=0 on base image)
    - RGB JPEG compression (no YCbCr color space conversion)
    - No ICC profile embedded (prevents color management transformations)

    Args:
        source_path: Path to the source DICOM file.
        output_path: Path for the output TIFF file.
        quality: JPEG quality (1-100).
        tile_size: Tile size in pixels.
    """
    import pyvips

    # Load DICOM - pyvips uses openslide which adds an ICC profile
    img = pyvips.Image.new_from_file(source_path, access='sequential')

    # Extract RGB bands (remove alpha if present)
    if img.bands == 4:
        img = img.extract_band(0, n=3)

    # Strip ICC profile by recreating from raw pixel memory
    # This prevents color management transformations during save
    mem = img.write_to_memory()
    img_clean = pyvips.Image.new_from_memory(
        mem, img.width, img.height, img.bands, img.format
    )

    # Set interpretation to RGB (not sRGB) to avoid color management
    img_clean = img_clean.copy(interpretation=pyvips.Interpretation.RGB)

    # Save as pyramidal TIFF with RGB JPEG (no YCbCr conversion in JPEG)
    img_clean.tiffsave(
        output_path,
        compression='jpeg',
        Q=quality,
        tile=True,
        tile_width=tile_size,
        tile_height=tile_size,
        pyramid=True,
        rgbjpeg=True,
        bigtiff=True,
    )

    # Fix pyramid tags for QuPath compatibility
    # pyvips doesn't set NewSubfileType=0 on the first IFD
    _fix_pyramid_tags(output_path)


@dataclass
class ConversionResult:
    """Result of a single file conversion."""
    source_path: Path
    success: bool
    output_path: Optional[Path] = None
    archive_path: Optional[Path] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    input_size_mb: float = 0.0
    output_size_mb: float = 0.0


@dataclass
class ConversionConfig:
    """Configuration for the batch converter."""
    inbox_dir: Path
    serving_dir: Path
    archive_dir: Path
    processing_dir: Optional[Path] = None
    quality: int = 85
    tile_size: int = 256
    compression: str = 'jpeg'
    max_concurrent: int = 2
    watch_interval: int = 10
    dry_run: bool = False
    preserve_subdirs: bool = True

    def __post_init__(self):
        # Set default processing dir
        if self.processing_dir is None:
            self.processing_dir = self.inbox_dir / '.processing'


class BatchConverter:
    """Batch converter for DICOM WSI files."""

    def __init__(self, config: ConversionConfig):
        self.config = config
        self._ensure_directories()

    def _ensure_directories(self):
        """Create required directories if they don't exist."""
        for dir_path in [
            self.config.inbox_dir,
            self.config.serving_dir,
            self.config.archive_dir,
            self.config.processing_dir,
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def _get_relative_path(self, file_path: Path) -> Path:
        """Get path relative to inbox directory."""
        try:
            return file_path.relative_to(self.config.inbox_dir)
        except ValueError:
            return Path(file_path.name)

    def _needs_conversion(self, file_path: Path) -> bool:
        """Check if file needs conversion (vs passthrough)."""
        suffix = file_path.suffix.lower()
        # Handle .ome.tiff specially
        if file_path.name.lower().endswith('.ome.tiff') or file_path.name.lower().endswith('.ome.tif'):
            return False
        return suffix in CONVERTIBLE_EXTENSIONS

    def _is_supported(self, file_path: Path) -> bool:
        """Check if file is a supported image format."""
        suffix = file_path.suffix.lower()
        name_lower = file_path.name.lower()

        if name_lower.endswith('.ome.tiff') or name_lower.endswith('.ome.tif'):
            return True
        return suffix in CONVERTIBLE_EXTENSIONS or suffix in PASSTHROUGH_EXTENSIONS

    def find_pending_files(self) -> list[Path]:
        """Find all files in inbox that need processing."""
        pending = []

        for file_path in self.config.inbox_dir.rglob('*'):
            # Skip directories and hidden files
            if file_path.is_dir():
                continue
            if file_path.name.startswith('.'):
                continue
            # Skip files in processing directory
            if self.config.processing_dir in file_path.parents:
                continue
            # Check if supported
            if self._is_supported(file_path):
                pending.append(file_path)

        return sorted(pending)

    def convert_file(self, source_path: Path) -> ConversionResult:
        """Convert a single file."""
        start_time = time.time()
        relative_path = self._get_relative_path(source_path)
        input_size_mb = source_path.stat().st_size / 1024 / 1024

        logger.info(f"Processing: {relative_path} ({input_size_mb:.1f} MB)")

        if self.config.dry_run:
            return ConversionResult(
                source_path=source_path,
                success=True,
                duration_seconds=0,
                input_size_mb=input_size_mb,
            )

        try:
            # Determine output paths
            if self.config.preserve_subdirs:
                output_subpath = relative_path.parent
            else:
                output_subpath = Path()

            # Processing path (temporary)
            stem = source_path.stem
            if stem.endswith('.ome'):
                stem = stem[:-4]  # Remove .ome from stem

            processing_path = self.config.processing_dir / f"{stem}.tiff"

            # Final paths
            serving_path = self.config.serving_dir / output_subpath / f"{stem}.tiff"
            archive_path = self.config.archive_dir / output_subpath / source_path.name

            # Ensure output directories exist
            serving_path.parent.mkdir(parents=True, exist_ok=True)
            archive_path.parent.mkdir(parents=True, exist_ok=True)

            # Check if already processed
            if serving_path.exists():
                logger.warning(f"Output already exists, skipping: {serving_path}")
                return ConversionResult(
                    source_path=source_path,
                    success=True,
                    output_path=serving_path,
                    duration_seconds=time.time() - start_time,
                    input_size_mb=input_size_mb,
                )

            if self._needs_conversion(source_path):
                # Convert DICOM to TIFF using custom color-preserving conversion
                logger.info(f"  Converting to pyramidal TIFF (quality={self.config.quality})...")

                convert_dicom_to_tiff(
                    str(source_path),
                    str(processing_path),
                    quality=self.config.quality,
                    tile_size=self.config.tile_size,
                )

                output_size_mb = processing_path.stat().st_size / 1024 / 1024

                # Move converted file to serving directory
                shutil.move(str(processing_path), str(serving_path))

                # Move original to archive
                shutil.move(str(source_path), str(archive_path))

                duration = time.time() - start_time
                logger.info(f"  Done: {output_size_mb:.1f} MB ({duration:.1f}s)")

                return ConversionResult(
                    source_path=source_path,
                    success=True,
                    output_path=serving_path,
                    archive_path=archive_path,
                    duration_seconds=duration,
                    input_size_mb=input_size_mb,
                    output_size_mb=output_size_mb,
                )
            else:
                # Passthrough: just move to serving directory
                logger.info(f"  Passthrough (already optimal format)")

                # Copy to serving (some formats need the original structure)
                shutil.copy2(str(source_path), str(serving_path))
                output_size_mb = serving_path.stat().st_size / 1024 / 1024

                # Move original to archive
                shutil.move(str(source_path), str(archive_path))

                duration = time.time() - start_time

                return ConversionResult(
                    source_path=source_path,
                    success=True,
                    output_path=serving_path,
                    archive_path=archive_path,
                    duration_seconds=duration,
                    input_size_mb=input_size_mb,
                    output_size_mb=output_size_mb,
                )

        except Exception as e:
            logger.error(f"  Failed: {e}")

            # Clean up any partial output
            if 'processing_path' in locals() and processing_path.exists():
                processing_path.unlink()

            return ConversionResult(
                source_path=source_path,
                success=False,
                error=str(e),
                duration_seconds=time.time() - start_time,
                input_size_mb=input_size_mb,
            )

    def process_batch(self, files: list[Path]) -> list[ConversionResult]:
        """Process a batch of files with concurrency control."""
        results = []

        if not files:
            logger.info("No files to process")
            return results

        logger.info(f"Processing {len(files)} file(s) with max {self.config.max_concurrent} concurrent...")

        with ThreadPoolExecutor(max_workers=self.config.max_concurrent) as executor:
            future_to_file = {
                executor.submit(self.convert_file, f): f
                for f in files
            }

            for future in as_completed(future_to_file):
                result = future.result()
                results.append(result)

        return results

    def run_once(self) -> list[ConversionResult]:
        """Run a single pass over the inbox."""
        files = self.find_pending_files()
        return self.process_batch(files)

    def run_watch(self):
        """Continuously watch inbox for new files."""
        logger.info(f"Watching {self.config.inbox_dir} for new files...")
        logger.info(f"  Serving directory: {self.config.serving_dir}")
        logger.info(f"  Archive directory: {self.config.archive_dir}")
        logger.info(f"  Poll interval: {self.config.watch_interval}s")
        logger.info("Press Ctrl+C to stop")

        try:
            while True:
                results = self.run_once()

                if results:
                    success = sum(1 for r in results if r.success)
                    failed = sum(1 for r in results if not r.success)
                    logger.info(f"Batch complete: {success} succeeded, {failed} failed")

                time.sleep(self.config.watch_interval)

        except KeyboardInterrupt:
            logger.info("Shutting down...")


def print_summary(results: list[ConversionResult]):
    """Print summary of conversion results."""
    if not results:
        return

    success = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    print("\n" + "=" * 60)
    print("CONVERSION SUMMARY")
    print("=" * 60)
    print(f"Total files:     {len(results)}")
    print(f"Succeeded:       {len(success)}")
    print(f"Failed:          {len(failed)}")

    if success:
        total_input = sum(r.input_size_mb for r in success)
        total_output = sum(r.output_size_mb for r in success)
        total_time = sum(r.duration_seconds for r in success)

        print(f"\nInput size:      {total_input:.1f} MB")
        print(f"Output size:     {total_output:.1f} MB")
        if total_input > 0:
            print(f"Compression:     {total_output/total_input*100:.1f}%")
        print(f"Total time:      {total_time:.1f}s")
        if total_time > 0:
            print(f"Throughput:      {total_input/total_time:.1f} MB/s")

    if failed:
        print("\nFailed files:")
        for r in failed:
            print(f"  - {r.source_path.name}: {r.error}")

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Batch converter for DICOM WSI to pyramidal TIFF',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--inbox', '-i',
        type=Path,
        default=Path(os.environ.get('CONVERTER_INBOX', './inbox')),
        help='Input directory to monitor (default: ./inbox or $CONVERTER_INBOX)'
    )
    parser.add_argument(
        '--serving', '-s',
        type=Path,
        default=Path(os.environ.get('CONVERTER_SERVING', './serving')),
        help='Output directory for converted files (default: ./serving or $CONVERTER_SERVING)'
    )
    parser.add_argument(
        '--archive', '-a',
        type=Path,
        default=Path(os.environ.get('CONVERTER_ARCHIVE', './archive')),
        help='Archive directory for originals (default: ./archive or $CONVERTER_ARCHIVE)'
    )
    parser.add_argument(
        '--quality', '-q',
        type=int,
        default=int(os.environ.get('CONVERTER_QUALITY', '85')),
        help='JPEG quality 1-100 (default: 85)'
    )
    parser.add_argument(
        '--tile-size', '-t',
        type=int,
        default=int(os.environ.get('CONVERTER_TILE_SIZE', '256')),
        help='Tile size in pixels (default: 256)'
    )
    parser.add_argument(
        '--max-concurrent', '-c',
        type=int,
        default=int(os.environ.get('CONVERTER_MAX_CONCURRENT', '2')),
        help='Maximum concurrent conversions (default: 2)'
    )
    parser.add_argument(
        '--watch', '-w',
        action='store_true',
        help='Continuously watch for new files'
    )
    parser.add_argument(
        '--watch-interval',
        type=int,
        default=int(os.environ.get('CONVERTER_WATCH_INTERVAL', '10')),
        help='Seconds between inbox checks in watch mode (default: 10)'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Show what would be done without actually converting'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Validate quality
    if not 1 <= args.quality <= 100:
        parser.error("Quality must be between 1 and 100")

    # Create configuration
    config = ConversionConfig(
        inbox_dir=args.inbox.resolve(),
        serving_dir=args.serving.resolve(),
        archive_dir=args.archive.resolve(),
        quality=args.quality,
        tile_size=args.tile_size,
        max_concurrent=args.max_concurrent,
        watch_interval=args.watch_interval,
        dry_run=args.dry_run,
    )

    # Log configuration
    logger.info("Batch Converter Configuration:")
    logger.info(f"  Inbox:        {config.inbox_dir}")
    logger.info(f"  Serving:      {config.serving_dir}")
    logger.info(f"  Archive:      {config.archive_dir}")
    logger.info(f"  Quality:      {config.quality}")
    logger.info(f"  Tile size:    {config.tile_size}")
    logger.info(f"  Max concurrent: {config.max_concurrent}")
    if args.dry_run:
        logger.info("  Mode:         DRY RUN (no changes will be made)")

    # Check for pyvips
    try:
        import pyvips
    except ImportError:
        logger.error("pyvips not installed!")
        logger.error("Install with: pip install pyvips")
        sys.exit(1)

    # Create converter and run
    converter = BatchConverter(config)

    if args.watch:
        converter.run_watch()
    else:
        results = converter.run_once()
        print_summary(results)

        # Exit with error if any failures
        if any(not r.success for r in results):
            sys.exit(1)


if __name__ == '__main__':
    main()
