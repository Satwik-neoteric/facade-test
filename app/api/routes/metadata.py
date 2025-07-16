from fastapi import APIRouter, HTTPException, Query, Depends,Path
from typing import Optional, Dict, Any
import logging
from app.services.blob_service import BlobStorageService
from app.core.dependencies import get_blob_storage_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/metadata/{image_path:path}")
async def get_image_metadata_by_path(
    image_path: str = Path(..., description="Path to the image"),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
) -> Dict[str, Any]:
    """
    Get metadata for a specific image (path-based route for backward compatibility)
    """
    return await _get_image_metadata(image_path, blob_service)

@router.get("/metadata")
async def get_image_metadata(
    image_path: str = Query(..., description="Path to the image"),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
) -> Dict[str, Any]:
    """
    Get metadata for a specific image (query-based route)
    """
    return await _get_image_metadata(image_path, blob_service)

async def _get_image_metadata(
    image_path: str,
    blob_service: BlobStorageService
) -> Dict[str, Any]:
    try:
        logger.info(f"Fetching metadata for image: {image_path}")
        
        # Get blob properties
        blob_client = blob_service.get_blob_client("images", image_path)
        
        try:
            properties = blob_client.get_blob_properties()
            
            metadata = {
                "filename": image_path.split('/')[-1],
                "size": properties.size,
                "content_type": properties.content_settings.content_type,
                "last_modified": properties.last_modified.isoformat() if properties.last_modified else None,
                "etag": properties.etag,
                "blob_type": str(properties.blob_type),
                "creation_time": properties.creation_time.isoformat() if properties.creation_time else None,
                "custom_metadata": properties.metadata or {}
            }
            
            # Add image dimensions if available in metadata
            if properties.metadata and "width" in properties.metadata:
                metadata["dimensions"] = {
                    "width": int(properties.metadata.get("width", 0)),
                    "height": int(properties.metadata.get("height", 0))
                }
            
            logger.info(f"Successfully fetched metadata for {image_path}")
            return metadata
            
        except Exception as blob_error:
            logger.error(f"Error accessing blob {image_path}: {str(blob_error)}")
            # Return basic metadata if blob access fails
            return {
                "filename": image_path.split('/')[-1],
                "error": "Could not access blob properties"
            }
            
    except Exception as e:
        logger.error(f"Error fetching metadata for {image_path}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch metadata: {str(e)}"
        )