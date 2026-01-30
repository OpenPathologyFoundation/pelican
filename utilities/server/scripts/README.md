# Large Image Server Scripts

## Batch Converter

Converts DICOM WSI files to pyramidal TIFF for fast tile serving.

### Why Convert?

| Format | Cold Start Load Time |
|--------|---------------------|
| DICOM WSI | ~1000 ms (must build frame index) |
| Pyramidal TIFF | ~35 ms (index in file header) |
| SVS | ~30 ms (baseline) |

DICOM WSI files store tiles as frames that must be indexed on first access.
Converting to pyramidal TIFF eliminates this overhead.

### Quick Start

```bash
# One-time conversion
python batch_converter.py \
    --inbox /data/inbox \
    --serving /data/serving \
    --archive /data/archive

#or better

    python batch_converter.py \
  --inbox "$HOME/_wsi_test/inbox" \
  --serving "$HOME/_wsi_test/serving" \
  --archive "$HOME/_wsi_test/archive"

# Watch mode (daemon)
python batch_converter.py \
    --inbox /data/inbox \
    --serving /data/serving \
    --archive /data/archive \
    --watch
```

### Directory Structure

```
/data/
├── inbox/          # Drop DICOM files here
│   └── *.dcm       # Automatically picked up
├── serving/        # Tile server reads from here
│   └── *.tiff      # Converted pyramidal TIFFs
└── archive/        # Originals preserved here
    └── *.dcm       # For compliance/backup
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--inbox, -i` | ./inbox | Input directory |
| `--serving, -s` | ./serving | Output directory |
| `--archive, -a` | ./archive | Archive directory |
| `--quality, -q` | 85 | JPEG quality (1-100) |
| `--tile-size, -t` | 256 | Tile size in pixels |
| `--max-concurrent, -c` | 2 | Parallel conversions |
| `--watch, -w` | false | Continuous monitoring |
| `--watch-interval` | 10 | Seconds between checks |
| `--dry-run, -n` | false | Preview without converting |

### Environment Variables

All options can be set via environment variables:

```bash
export CONVERTER_INBOX=/data/inbox
export CONVERTER_SERVING=/data/serving
export CONVERTER_ARCHIVE=/data/archive
export CONVERTER_QUALITY=85
export CONVERTER_MAX_CONCURRENT=2
```

### Running as a Service

Install the systemd service:

```bash
sudo cp batch_converter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable batch_converter
sudo systemctl start batch_converter

# Check status
sudo systemctl status batch_converter
sudo journalctl -u batch_converter -f
```

### Quality Settings

| Quality | File Size | Recommendation |
|---------|-----------|----------------|
| 85 | ~52% of original | Default, good for most cases |
| 90 | ~162% of original | Higher quality, larger files |
| 95 | ~212% of original | Near-lossless |

Note: Quality 90+ may produce files larger than the original due to
encoder differences. Quality 85 is recommended for serving.

### Color Preservation

The converter uses a custom DICOM to TIFF conversion pipeline that preserves
H&E staining colors correctly. This is important because:

1. **ICC Profile Handling**: When pyvips/openslide reads DICOM files, they
   may add an sRGB ICC profile that causes color transformations. The converter
   strips this ICC profile to preserve original pixel values.

2. **RGB JPEG Encoding**: The converter uses RGB JPEG encoding (not YCbCr)
   to minimize color space conversion artifacts.

3. **Verified Color Fidelity**: Pixel differences between original DICOM and
   converted TIFF are typically 1-3 values (within JPEG compression error).

This ensures converted files display correctly in viewers like QuPath,
ASAP, and other pathology software.

### Supported Input Formats

**Converted to TIFF** (slow formats):
- `.dcm`, `.dicom` - DICOM WSI

**Passthrough** (already fast):
- `.svs` - Aperio
- `.ndpi` - Hamamatsu
- `.mrxs` - 3DHistech
- `.scn` - Leica
- `.czi` - Zeiss
- `.tiff`, `.tif` - Generic TIFF
- `.ome.tiff`, `.ome.tif` - OME-TIFF
