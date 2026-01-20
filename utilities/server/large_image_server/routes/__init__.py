"""API routes for the Large Image Server."""

from fastapi import APIRouter

from .cases import router as cases_router
from .deepzoom import router as deepzoom_router
from .metadata import router as metadata_router
from .regions import router as regions_router
from .tiles import router as tiles_router

# Create main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(cases_router, tags=['Cases'])
api_router.include_router(tiles_router, tags=['Tiles'])
api_router.include_router(deepzoom_router, tags=['DeepZoom'])
api_router.include_router(metadata_router, tags=['Metadata'])
api_router.include_router(regions_router, tags=['Regions'])

__all__ = ['api_router']
