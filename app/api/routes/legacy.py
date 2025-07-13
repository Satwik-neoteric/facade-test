"""
Legacy API adapter that maps original Flask routes to FastAPI endpoints
"""
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any

from app.core.config import get_settings, Settings
from app.services.blob_storage_service import BlobStorageService
from app.core.dependencies import get_blob_storage_service

# Initialize logger
logger = logging.getLogger(__name__)

# Create router with no prefix (will be prefixed in main.py)
router = APIRouter()

# Cache for image lists - mimics the original Flask implementation
IMAGE_LIST_CACHE = {
    'data': None,
    'timestamp': None,
    'expiry': 300  # Cache expiry in seconds (5 minutes)
}

# Cache for prefixes - mimics the original Flask implementation
IMAGE_PREFIXES_CACHE = {
    'data': None,
    'timestamp': None,
    'expiry': 600  # Cache expiry in seconds (10 minutes)
}

def allowed_file(filename):
    """Check if a filename has an allowed extension"""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@router.get("/api/images", tags=["legacy_api"], summary="Legacy API: Get list of images")
async def get_image_list(
    request: Request,
    prefix: Optional[str] = Query(None, description="Filter images by prefix (folder-like)"),
    page: int = Query(1, ge=1, description="Page number"),
    prefixes_only: Optional[bool] = Query(None, description="Return only prefixes (folders) instead of images"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
):
    """
    Legacy API that mimics the original Flask route /api/images
    Returns a list of image filenames from the Input container, limited to 30 files per page.
    """
    try:
        if not blob_service.client:
            return JSONResponse(
                content={"error": "Azure Blob Storage not configured"}, 
                status_code=500
            )
        
        page_size = 30  # Fixed to exactly 30 images per page as per original
        
        # Check if requesting prefixes (folders) only
        if prefixes_only:
            # Use the blob_service to get prefixes
            container_name = settings.AZURE_INPUT_CONTAINER
            prefixes = await blob_service.get_blob_prefixes(container_name)
            return {"prefixes": prefixes}
        
        # If requesting first page with no prefix, check cache
        if page == 1 and not prefix and IMAGE_LIST_CACHE['data'] is not None:
            current_time = time.time()
            if (current_time - IMAGE_LIST_CACHE['timestamp']) < IMAGE_LIST_CACHE['expiry']:
                # Return just the first page from cache
                total_images = len(IMAGE_LIST_CACHE['data'])
                result = {
                    "images": IMAGE_LIST_CACHE['data'][:page_size],
                    "total": total_images,
                    "page": page,
                    "pages": (total_images + page_size - 1) // page_size
                }
                return result
        
        # Standard paginated approach - only return page_size files per request
        container_name = settings.AZURE_INPUT_CONTAINER
        
        # Get blobs with pagination and prefix
        if prefix:
            # For paginated results with a prefix
            all_blobs = await blob_service.list_blobs(
                container_name=container_name, 
                name_starts_with=prefix,
                max_results=page_size * page
            )
        else:
            # For paginated results without a prefix
            all_blobs = await blob_service.list_blobs(
                container_name=container_name,
                max_results=page_size * page
            )
        
        # Apply filtering for image extensions
        images = [blob for blob in all_blobs if allowed_file(blob)]
        
        # Sort the filtered results
        images.sort()
        
        # For first page with no prefix, update cache
        if page == 1 and not prefix:
            IMAGE_LIST_CACHE['data'] = images
            IMAGE_LIST_CACHE['timestamp'] = time.time()
        
        # Calculate offset for pagination
        offset = (page - 1) * page_size
        
        # Get current page of results
        start_idx = offset if offset < len(images) else 0
        end_idx = min(start_idx + page_size, len(images))
        current_page_images = images[start_idx:end_idx]
        
        # Try to estimate total number of images, but don't do a full count
        if page == 1:
            # For the first page, make a conservative estimate of total
            # Assume we have at least this many pages total
            total_images_estimate = max(len(images), page_size * 2)
        else:
            # For subsequent pages, use our existing count as a minimum
            total_images_estimate = max(len(images), offset + len(current_page_images))
        
        # Prepare response with pagination info
        result = {
            "images": current_page_images,
            "total": total_images_estimate,
            "page": page,
            "pages": (total_images_estimate + page_size - 1) // page_size,
            "isPartialList": True  # Always indicate this is a partial list
        }
        
        return result

    except Exception as e:
        logger.error(f"Error in legacy get_image_list: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": f"Failed to retrieve images: {str(e)}"},
            status_code=500
        )
