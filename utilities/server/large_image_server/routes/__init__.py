"""API routes for the Large Image Server."""

from fastapi import APIRouter, Depends

from ..auth import jwt_bearer
from .cases import router as cases_router
from .deepzoom import router as deepzoom_router
from .metadata import router as metadata_router
from .regions import router as regions_router
from .tiles import router as tiles_router

# Create main API router with optional JWT authentication dependency
# When JWT is enabled in settings, all routes require valid Bearer token
# When JWT is disabled (default), the dependency passes through (SRS SYS-IMS-036)
api_router = APIRouter(dependencies=[Depends(jwt_bearer)])

# Include all route modules
api_router.include_router(cases_router, tags=['Cases'])
api_router.include_router(tiles_router, tags=['Tiles'])
api_router.include_router(deepzoom_router, tags=['DeepZoom'])
api_router.include_router(metadata_router, tags=['Metadata'])
api_router.include_router(regions_router, tags=['Regions'])

__all__ = ['api_router']
