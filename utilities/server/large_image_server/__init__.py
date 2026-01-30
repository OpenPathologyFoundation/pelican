"""Large Image Server - FastAPI tile server for large multi-resolution images.

This package provides a production-ready REST API for serving tiles from
large images, including pathology whole slide images (WSI).

Example usage:

    from large_image_server import create_app

    app = create_app(image_dir="/path/to/images")

    # Run with uvicorn
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

Or from command line:

    large_image_server --image-dir /path/to/images --port 8000

"""

from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .auth import CurrentUser, JWTPayload, jwt_bearer
from .config import ServerSettings, configure_settings, get_settings
from .models import HealthResponse
from .routes import api_router
from .source_manager import SourceManager, configure_source_manager, get_source_manager

__all__ = [
    'create_app',
    'ServerSettings',
    'SourceManager',
    'get_settings',
    'configure_settings',
    'get_source_manager',
    'configure_source_manager',
    'jwt_bearer',
    'JWTPayload',
    'CurrentUser',
]

# Version from setuptools_scm
try:
    from importlib.metadata import version

    __version__ = version('large-image-server')
except Exception:
    __version__ = '0.0.0'


def create_app(
    image_dir: str | Path | None = None,
    settings: ServerSettings | None = None,
    **kwargs: Any,
) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        image_dir: Directory containing images to serve.
        settings: Pre-configured settings instance.
        **kwargs: Additional settings overrides.

    Returns:
        Configured FastAPI application.
    """
    # Configure settings
    if settings is not None:
        configure_settings(**settings.model_dump())
    elif image_dir is not None or kwargs:
        config_kwargs = kwargs.copy()
        if image_dir is not None:
            config_kwargs['image_dir'] = Path(image_dir)
        configure_settings(**config_kwargs)

    settings = get_settings()

    # Configure source manager
    configure_source_manager(
        image_dir=settings.image_dir,
        max_sources=settings.source_cache_size,
    )

    # Configure large_image caching
    try:
        import large_image

        if settings.cache_backend:
            large_image.config.setConfig('cache_backend', settings.cache_backend)
    except Exception:
        pass

    # Create FastAPI app
    app = FastAPI(
        title='Large Image Server',
        description='REST API for serving tiles from large multi-resolution images',
        version=__version__,
        docs_url='/docs' if settings.docs_enabled else None,
        redoc_url='/redoc' if settings.docs_enabled else None,
        openapi_url='/openapi.json' if settings.docs_enabled else None,
    )

    # Add CORS middleware
    if settings.cors_enabled:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=settings.cors_allow_credentials,
            allow_methods=['*'],
            allow_headers=['*'],
        )

    # Include API routes
    app.include_router(api_router, prefix=settings.api_prefix)

    # Health check endpoint
    @app.get('/health', response_model=HealthResponse, tags=['Health'])
    async def health_check() -> dict:
        """Health check endpoint."""
        source_manager = get_source_manager()
        cache_info = source_manager.cache_info()
        return {
            'status': 'healthy',
            'version': __version__,
            'sources_loaded': cache_info['cached_sources'],
        }

    # Cache management endpoints
    @app.delete('/cache', tags=['Cache'])
    async def clear_cache() -> dict:
        """Clear all cached tile sources."""
        source_manager = get_source_manager()
        count = source_manager.clear_cache()
        return {'cleared': count}

    @app.get('/cache', tags=['Cache'])
    async def cache_info() -> dict:
        """Get cache information."""
        source_manager = get_source_manager()
        return source_manager.cache_info()

    # Root endpoint with viewer example
    @app.get('/', response_class=HTMLResponse, include_in_schema=False)
    async def root() -> str:
        """Root endpoint with embedded viewer example."""
        return _get_viewer_html()

    return app


def _get_viewer_html() -> str:
    """Generate HTML for the example viewer page."""
    return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Large Image Server - Pathology Viewer</title>
    <script src="https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/openseadragon.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: #16213e;
            border-bottom: 1px solid #333;
        }
        h1 { font-size: 1.25rem; font-weight: 600; }
        .links a {
            color: #64b5f6;
            text-decoration: none;
            margin-left: 20px;
            font-size: 0.9rem;
        }
        .links a:hover { text-decoration: underline; }

        /* Case announcement bar */
        .case-banner {
            background: #1a365d;
            color: #fff;
            padding: 12px 20px;
            display: none;
            align-items: center;
            justify-content: center;
            gap: 20px;
        }
        .case-banner.visible { display: flex; }
        .case-banner__id { font-size: 1.25rem; font-weight: 600; }
        .case-banner__patient { font-size: 1rem; }
        .case-banner__separator {
            width: 1px;
            height: 24px;
            background: rgba(255,255,255,0.3);
        }

        .content {
            display: grid;
            grid-template-columns: 320px 1fr;
            flex: 1;
            overflow: hidden;
        }
        .sidebar {
            background: #16213e;
            overflow-y: auto;
            border-right: 1px solid #333;
        }
        .sidebar-section {
            padding: 15px;
            border-bottom: 1px solid #333;
        }
        .sidebar-section h2 {
            font-size: 0.85rem;
            text-transform: uppercase;
            color: #90caf9;
            margin-bottom: 10px;
        }

        /* Case list */
        .case-item {
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 8px;
            background: rgba(255,255,255,0.03);
            border-left: 3px solid transparent;
        }
        .case-item:hover { background: rgba(255,255,255,0.08); }
        .case-item.selected {
            background: #0f3460;
            border-left-color: #64b5f6;
        }
        .case-item.priority-stat { border-left-color: #ef4444; }
        .case-item__header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .case-item__id { font-weight: 600; font-size: 0.95rem; }
        .case-item__priority {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 3px;
            background: #475569;
        }
        .case-item__priority.stat { background: #ef4444; }
        .case-item__patient { font-size: 0.85rem; opacity: 0.9; }
        .case-item__diagnosis {
            font-size: 0.8rem;
            opacity: 0.7;
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Slide list */
        .slide-list { margin-top: 10px; }
        .slide-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 4px;
        }
        .slide-item:hover { background: rgba(255,255,255,0.08); }
        .slide-item.selected { background: #0f3460; }
        .slide-item__thumb {
            width: 60px;
            height: 45px;
            background: #333;
            border-radius: 3px;
            object-fit: cover;
        }
        .slide-item__info { flex: 1; min-width: 0; }
        .slide-item__id { font-size: 0.85rem; font-weight: 500; }
        .slide-item__desc {
            font-size: 0.75rem;
            opacity: 0.7;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Viewer area */
        .viewer-area {
            display: flex;
            flex-direction: column;
            background: #0a0a0a;
            position: relative;
        }
        #viewer { flex: 1; }

        .info-panel {
            position: absolute;
            bottom: 15px;
            left: 15px;
            background: rgba(0,0,0,0.85);
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 0.8rem;
            max-width: 300px;
            display: none;
        }
        .info-panel.visible { display: block; }
        .info-panel p { margin: 4px 0; }
        .info-panel strong { color: #90caf9; }

        /* Associated images panel */
        .assoc-panel {
            position: absolute;
            top: 15px;
            right: 15px;
            display: flex;
            gap: 10px;
        }
        .assoc-img {
            background: rgba(0,0,0,0.85);
            border-radius: 6px;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .assoc-img:hover { transform: scale(1.05); }
        .assoc-img img {
            display: block;
            max-height: 120px;
            width: auto;
        }
        .assoc-img--label img { max-height: 180px; }

        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .loading { text-align: center; padding: 20px; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Pathology Viewer</h1>
            <div class="links">
                <a href="/docs">API Docs</a>
                <a href="/worklist">Worklist API</a>
                <a href="/health">Health</a>
            </div>
        </header>

        <div id="case-banner" class="case-banner">
            <span class="case-banner__id" id="banner-case-id"></span>
            <span class="case-banner__separator"></span>
            <span class="case-banner__patient" id="banner-patient"></span>
        </div>

        <div class="content">
            <div class="sidebar">
                <div class="sidebar-section">
                    <h2>Worklist</h2>
                    <div id="case-list"><div class="loading">Loading cases...</div></div>
                </div>
                <div class="sidebar-section" id="slides-section" style="display:none;">
                    <h2>Slides</h2>
                    <div id="slide-list"></div>
                </div>
            </div>
            <div class="viewer-area">
                <div id="viewer"></div>
                <div id="info-panel" class="info-panel"></div>
                <div id="assoc-panel" class="assoc-panel"></div>
            </div>
        </div>
    </div>

    <script>
        let viewer = null;
        let currentCase = null;
        let currentSlide = null;

        async function loadCases() {
            try {
                const response = await fetch('/worklist');
                const cases = await response.json();
                const container = document.getElementById('case-list');

                if (cases.length === 0) {
                    // Fall back to image list mode
                    loadImagesMode();
                    return;
                }

                container.innerHTML = '';
                cases.forEach(c => {
                    const div = document.createElement('div');
                    div.className = 'case-item' + (c.priority === 'stat' ? ' priority-stat' : '');
                    div.innerHTML = `
                        <div class="case-item__header">
                            <span class="case-item__id">${c.caseId}</span>
                            ${c.priority === 'stat' ? '<span class="case-item__priority stat">STAT</span>' : ''}
                        </div>
                        <div class="case-item__patient">${c.patientName}</div>
                        <div class="case-item__diagnosis">${c.diagnosis || ''}</div>
                    `;
                    div.onclick = () => selectCase(c, div);
                    container.appendChild(div);
                });

                // Auto-select first case
                if (cases.length > 0) {
                    selectCase(cases[0], container.firstChild);
                }
            } catch (error) {
                loadImagesMode();
            }
        }

        async function loadImagesMode() {
            // Fallback to simple image list if no cases.json
            try {
                const response = await fetch('/images');
                const images = await response.json();
                const container = document.getElementById('case-list');

                if (images.length === 0) {
                    container.innerHTML = '<div class="no-data">No images found</div>';
                    return;
                }

                container.innerHTML = '';
                images.forEach(img => {
                    const div = document.createElement('div');
                    div.className = 'case-item';
                    div.innerHTML = `<div class="case-item__id">${img}</div>`;
                    div.onclick = () => loadImage(img);
                    container.appendChild(div);
                });
            } catch (error) {
                document.getElementById('case-list').innerHTML =
                    '<div class="no-data">Error: ' + error.message + '</div>';
            }
        }

        async function selectCase(caseData, element) {
            currentCase = caseData;

            // Update selection
            document.querySelectorAll('.case-item').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');

            // Show case banner
            const banner = document.getElementById('case-banner');
            document.getElementById('banner-case-id').textContent = caseData.caseId;
            document.getElementById('banner-patient').textContent = caseData.patientName;
            banner.classList.add('visible');

            // Load slides
            const slideContainer = document.getElementById('slide-list');
            slideContainer.innerHTML = '';

            const slidesSection = document.getElementById('slides-section');
            slidesSection.style.display = 'block';

            (caseData.slides || []).forEach(slide => {
                const div = document.createElement('div');
                div.className = 'slide-item';
                div.innerHTML = `
                    <img class="slide-item__thumb"
                         src="/slides/${slide.slideId}/macro"
                         onerror="this.style.display='none'">
                    <div class="slide-item__info">
                        <div class="slide-item__id">${slide.slideId}</div>
                        <div class="slide-item__desc">${slide.stain || 'H&E'}</div>
                    </div>
                `;
                div.onclick = () => loadSlide(slide, div);
                slideContainer.appendChild(div);
            });

            // Auto-load first slide
            if (caseData.slides && caseData.slides.length > 0) {
                loadSlide(caseData.slides[0], slideContainer.firstChild);
            }
        }

        async function loadSlide(slide, element) {
            currentSlide = slide;

            // Update selection
            document.querySelectorAll('.slide-item').forEach(el => el.classList.remove('selected'));
            if (element) element.classList.add('selected');

            // Build image path: caseId/filename (supports any format: .svs, .dcm, .ndpi, etc.)
            const imagePath = currentCase.caseId + '/' + (slide.filename || slide.slideId + '.svs');

            await loadImage(imagePath, slide.slideId);
        }

        async function loadImage(imagePath, slideId) {
            try {
                // Load metadata
                const metaResponse = await fetch('/metadata/' + encodeURIComponent(imagePath));
                const metadata = await metaResponse.json();

                // Update info panel
                const panel = document.getElementById('info-panel');
                panel.innerHTML = `
                    <p><strong>${slideId || imagePath}</strong></p>
                    <p>Size: ${metadata.sizeX?.toLocaleString()} x ${metadata.sizeY?.toLocaleString()}</p>
                    <p>Levels: ${metadata.levels}</p>
                    ${metadata.magnification ? '<p>Magnification: ' + metadata.magnification + 'x</p>' : ''}
                    ${metadata.mm_x ? '<p>Resolution: ' + (metadata.mm_x * 1000).toFixed(3) + ' µm/px</p>' : ''}
                `;
                panel.classList.add('visible');

                // Load associated images
                const assocPanel = document.getElementById('assoc-panel');
                assocPanel.innerHTML = '';

                if (slideId) {
                    // Try to load label
                    const labelImg = document.createElement('div');
                    labelImg.className = 'assoc-img assoc-img--label';
                    labelImg.innerHTML = `<img src="/slides/${slideId}/label" onerror="this.parentElement.remove()">`;
                    assocPanel.appendChild(labelImg);
                }

                // Initialize viewer
                if (viewer) viewer.destroy();

                viewer = OpenSeadragon({
                    id: 'viewer',
                    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
                    tileSources: '/deepzoom/' + encodeURIComponent(imagePath) + '.dzi',
                    showNavigator: true,
                    navigatorPosition: 'TOP_LEFT',
                    animationTime: 0.3,
                    blendTime: 0.1,
                    minZoomImageRatio: 0.8,
                    maxZoomPixelRatio: 2,
                    gestureSettingsMouse: { scrollToZoom: true }
                });

            } catch (error) {
                console.error('Error loading image:', error);
                const panel = document.getElementById('info-panel');
                panel.innerHTML = '<p style="color: #f44336;">Error: ' + error.message + '</p>';
                panel.classList.add('visible');
            }
        }

        // Initialize
        loadCases();
    </script>
</body>
</html>'''
