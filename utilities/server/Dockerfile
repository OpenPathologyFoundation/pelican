# Large Image Server Dockerfile
# SRS SYS-IMS-038: Docker deployment container
#
# Build:
#   docker build -t large-image-server .
#
# Run:
#   docker run -p 8000:8000 -v /path/to/slides:/images large-image-server
#
# With JWT authentication:
#   docker run -p 8000:8000 \
#     -e LARGE_IMAGE_SERVER_JWT_ENABLED=true \
#     -e LARGE_IMAGE_SERVER_JWT_SECRET=your-secret-key \
#     -v /path/to/slides:/images large-image-server

FROM python:3.12-slim

# Install system dependencies for image format support
# - openslide-tools: SVS, NDPI, VMS, SCN, MRXS support
# - libvips-dev: High-performance image processing
# - libopenslide0: OpenSlide library
# - libtiff-dev: TIFF/BigTIFF support
# - libopenjp2-7: JPEG2000 support
RUN apt-get update && apt-get install -y --no-install-recommends \
    openslide-tools \
    libopenslide0 \
    libvips-dev \
    libtiff-dev \
    libopenjp2-7 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY pyproject.toml setup.py README.md ./
COPY large_image_server/ ./large_image_server/

# Install the server with common image format support
# Use --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -e ".[common,jwt]"

# Create directory for images (mount point)
RUN mkdir -p /images

# Environment variables with sensible defaults
ENV LARGE_IMAGE_SERVER_IMAGE_DIR=/images
ENV LARGE_IMAGE_SERVER_HOST=0.0.0.0
ENV LARGE_IMAGE_SERVER_PORT=8000
ENV LARGE_IMAGE_SERVER_CORS_ENABLED=true
ENV LARGE_IMAGE_SERVER_DOCS_ENABLED=true

# Expose the default port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the server
# Using exec form for proper signal handling
CMD ["large_image_server"]
