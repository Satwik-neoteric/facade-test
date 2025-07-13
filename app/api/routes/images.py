import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Path as FastApiPath, Body # Added Body
from fastapi.responses import Response
from typing import List, Optional, Dict, Tuple, Any 
from datetime import datetime, timedelta
import mimetypes
import os
import io # For BytesIO
import re # For regex in filtered-images
from PIL import Image, ExifTags # For image processing and EXIF
from pydantic import ValidationError # Added ValidationError

from ...core.config import get_settings, Settings
from ...services.blob_storage_service import BlobStorageService
from ...services.cosmos_service import CosmosDbService # ADDED IMPORT
from ...core.dependencies import get_cosmos_service as get_core_cosmos_service, get_blob_storage_service # ADJUSTED IMPORT
from ...models.image import ImageMetadataResponse, FilterCriteria # Added FilterCriteria
from ...services.cosmos_service import CosmosResourceNotFoundError # Import the exception

logger = logging.getLogger(__name__)
router = APIRouter()

PAGE_SIZE = 30 # This was NEW_ENDPOINT_PAGE_SIZE, now using the existing PAGE_SIZE
# Cache for image lists: cache_key -> (list_of_images, timestamp, expiry_timedelta)
_image_list_cache: Dict[str, Tuple[List[str], datetime, timedelta]] = {}
# Cache for prefixes: container_name -> (list_of_prefixes, timestamp, expiry_timedelta)
_prefix_list_cache: Dict[str, Tuple[List[str], datetime, timedelta]] = {}
# Cache for successful image path resolutions: original_path -> resolved_path
_image_path_cache: Dict[str, str] = {}


def get_blob_service() -> BlobStorageService: # This is the local helper
    print(">>>> IMAGES.PY: LOCAL get_blob_service CALLED <<<<") # DEBUG PRINT
    return BlobStorageService()


@router.get("/batch/{batch_id}/images", tags=["batch_images"], summary="Get list of images for a specific batch ID")
async def get_batch_images(
    batch_id: str = FastApiPath(..., description="The ID of the batch to retrieve images for"),
    page: int = Query(1, ge=1, description="Page number, defaults to 1"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service) # CHANGED to use local get_blob_service
):
    """
    Get a list of images for a specific batch ID.
    The router is prefixed with /api, so the full path will be /api/batch/{batch_id}/images.
    """
    logger.info(f"Fetching images for batch_id: {batch_id}, page: {page} via /api/batch/... route")

    if not blob_service.client: # Changed from blob_service.blob_service_client to blob_service.client
        logger.error("Azure Blob Storage not configured for /api/batch/{batch_id}/images endpoint.")
        raise HTTPException(status_code=500, detail="Azure Blob Storage not configured")

    input_container = settings.AZURE_INPUT_CONTAINER
    # Ensure the prefix correctly targets files within the batch "folder"
    prefix_to_list = f"{batch_id}/" 

    try:
        # Assuming blob_service.list_blobs takes container_name and name_starts_with
        blob_names = await blob_service.list_blobs(container_name=input_container, name_starts_with=prefix_to_list)
        
        # Filter for allowed image files
        # The allowed_file method in BlobStorageService checks extensions
        all_images_for_batch = sorted([name for name in blob_names if blob_service.allowed_file(name)])
        
        total_images = len(all_images_for_batch)
        offset = (page - 1) * PAGE_SIZE # Using the PAGE_SIZE defined in this file
        paginated_images = all_images_for_batch[offset : offset + PAGE_SIZE]
        total_pages = (total_images + PAGE_SIZE - 1) // PAGE_SIZE if total_images > 0 else 1
        
        logger.info(f"Found {total_images} images for batch {batch_id}. Returning page {page} of {total_pages}.")
        return {
            "batch_id": batch_id,
            "images": paginated_images,
            "total_items": total_images,
            "current_page": page,
            "total_pages": total_pages,
        }
    except Exception as e:
        logger.error(f"Error listing images for batch {batch_id} via /api/batch/...: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not list images for batch {batch_id}: {str(e)}")

@router.get("/images", summary="Get list of images with pagination or list of prefixes")
async def get_image_list(
    prefix: Optional[str] = Query(None, description="Optional folder prefix to filter results"),
    page: int = Query(1, ge=1, description="Page number, defaults to 1"),
    prefixes_only: bool = Query(False, description="If true, returns only folder prefixes"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service)
):
    if not blob_service.blob_service_client:
        raise HTTPException(status_code=500, detail="Azure Blob Storage not configured")

    input_container = settings.AZURE_INPUT_CONTAINER

    if prefixes_only:
        cache_key = f"prefix_list_{input_container}"
        cached_data = _prefix_list_cache.get(cache_key)
        found_prefixes: List[str] = []

        if cached_data:
            prefixes_from_cache, timestamp, expiry_duration = cached_data
            if datetime.utcnow() - timestamp < expiry_duration:
                found_prefixes = prefixes_from_cache
                logger.debug(f"Cache hit for prefix list in container: {input_container}")
            else:
                logger.debug(f"Cache expired for prefix list in container: {input_container}")
                cached_data = None # Force refresh
        
        if not cached_data:
            try:
                # The C# UtilityService.GetBlobPrefixes lists all blobs and extracts unique directory paths.
                # My BlobStorageService.list_prefixes aims to replicate this.
                # It should list top-level prefixes if name_starts_with is None.
                found_prefixes = await blob_service.list_prefixes(input_container, name_starts_with=None)
                _prefix_list_cache[cache_key] = (
                    found_prefixes,
                    datetime.utcnow(),
                    timedelta(seconds=settings.IMAGE_PREFIXES_CACHE_EXPIRY_SECONDS) # Use a specific cache time for prefixes
                )
                logger.debug(f"Cache updated for prefix list in container: {input_container}. Count: {len(found_prefixes)}")

            except Exception as e:
                logger.error(f"Error listing prefixes: {e}")
                raise HTTPException(status_code=500, detail=f"Could not list prefixes: {str(e)}")
        return {"prefixes": found_prefixes}

    # Handling for image listing (not prefixes_only)
    # Cache key should include the prefix if provided
    cache_key = f"image_list_{input_container}_{prefix if prefix else '_root_'}"
    cached_data = _image_list_cache.get(cache_key)
    all_images_for_prefix: List[str] = []

    if cached_data:
        images_from_cache, timestamp, expiry_duration = cached_data
        if datetime.utcnow() - timestamp < expiry_duration:
            all_images_for_prefix = images_from_cache
            logger.debug(f"Cache hit for image list in '{input_container}' with prefix: '{prefix}'")
        else:
            logger.debug(f"Cache expired for image list in '{input_container}' with prefix: '{prefix}'")
            cached_data = None # Force refresh
    
    if not cached_data:
        try:
            # List all blobs for the given prefix. The C# code fetches up to page * PageSize.
            # For simplicity and better caching, fetch all, then paginate.
            # If performance becomes an issue for very large "folders", this might need revisiting.
            blob_names = await blob_service.list_blobs(
                input_container, 
                name_starts_with=prefix
                # max_results could be used if we adopt the C# controller\'s incremental fetching,
                # but that complicates caching the "total" count.
            )
            # Filter and sort
            all_images_for_prefix = sorted([name for name in blob_names if blob_service.allowed_file(name)])
            
            _image_list_cache[cache_key] = (
                all_images_for_prefix, 
                datetime.utcnow(), 
                timedelta(seconds=settings.CACHE_EXPIRY_SECONDS)
            )
            logger.debug(f"Cache updated for image list in '{input_container}' with prefix: '{prefix}'. Count: {len(all_images_for_prefix)}")
        except Exception as e:
            logger.error(f"Error listing images from blob storage: {e}")
            raise HTTPException(status_code=500, detail=f"Could not list images: {str(e)}")

    total_images = len(all_images_for_prefix)
    offset = (page - 1) * PAGE_SIZE
    paginated_images = all_images_for_prefix[offset : offset + PAGE_SIZE]
    total_pages = (total_images + PAGE_SIZE - 1) // PAGE_SIZE if total_images > 0 else 1
    
    # The C# controller has an 'isPartialList' logic which seems to always be true.
    # And its total/pages calculation is based on an estimate if not page 1.
    # Here, since we fetch all (for the prefix) then paginate, our total is accurate for that prefix.
    return {
        "images": paginated_images,
        "total": total_images, # This is total for the current prefix
        "page": page,
        "pages": total_pages,
        # "isPartialList": True # Mimicking C# if needed, but our list for the prefix is complete.
    }

@router.get("/image/{filename:path}", summary="Get an image file")
async def get_image(
    filename: str = FastApiPath(..., description="The path to the image file, e.g., B1/img1.jpg or B1/cam/img1.jpg"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service)
):
    if not blob_service.blob_service_client:
        raise HTTPException(status_code=500, detail="Azure Blob Storage not configured")

    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):        raise HTTPException(status_code=400, detail="Invalid path")

    input_container = settings.AZURE_INPUT_CONTAINER
    content: Optional[bytes] = None
    actual_filename_used = filename
    error_message_detail = None # Store detailed error for logging or specific 404

    # Check cache first for previously resolved paths
    if filename in _image_path_cache:
        cached_path = _image_path_cache[filename]
        logger.debug(f"Using cached path resolution: '{filename}' -> '{cached_path}'")
        try:
            if await blob_service.blob_exists(input_container, cached_path):
                content = await blob_service.download_blob_content(input_container, cached_path)
                if content:
                    actual_filename_used = cached_path
                    logger.info(f"Image found via cache at: '{actual_filename_used}'")
                else:
                    # Cache entry is stale, remove it
                    del _image_path_cache[filename]
            else:
                # Cache entry is stale, remove it
                del _image_path_cache[filename]
        except Exception as e:
            logger.warning(f"Error accessing cached path '{cached_path}': {e}")
            # Remove stale cache entry
            del _image_path_cache[filename]

    # If not found in cache or cache was stale, try the normal resolution process
    if not content:
        # Paths to try, in order of preference or likelihood
        paths_to_try: List[str] = [filename]
        
        # Logic from C# controller: if filename is like "batch_id/image_id.jpg" (2 parts)
        # try common subdirectories.
        parts = filename.split('/')
        if len(parts) == 2:
            batch_id, image_file = parts[0], parts[1]
            # Ensure image_file itself is not a path and batch_id doesn\'t look like a subfolder already
            if '/' not in image_file and '\\' not in image_file and not any(sub in batch_id.lower() for sub in ["cam", "images", "data"]):
                paths_to_try.extend([
                    f"{batch_id}/cam/{image_file}",
                    f"{batch_id}/images/{image_file}",
                    f"{batch_id}/data/{image_file}"
                ])
        
        logger.debug(f"Attempting to fetch image. Original request: '{filename}'. Paths to try: {paths_to_try}")

        for path_to_attempt in paths_to_try:
            try:
                logger.debug(f"Trying path: '{path_to_attempt}' in container '{input_container}'")
                # Check existence first to avoid download attempt on non-existent blob,
                # which might be slightly more efficient if ResourceNotFoundError is common.
                if await blob_service.blob_exists(input_container, path_to_attempt):
                    content = await blob_service.download_blob_content(input_container, path_to_attempt)
                    if content:
                        actual_filename_used = path_to_attempt
                        # Cache successful resolution for future requests
                        _image_path_cache[filename] = path_to_attempt
                        logger.info(f"Image found and cached path resolution: '{filename}' -> '{actual_filename_used}'")
                        break # Found the image
                    else: # Should not happen if blob_exists is true and download_blob_content is robust
                        logger.warning(f"Blob '{path_to_attempt}' exists but download returned no content.")
                else:
                    logger.debug(f"Blob does not exist at path: '{path_to_attempt}'")
            except Exception as e: # Catch any exception during blob interaction for this specific path
                logger.warning(f"Error checking/downloading blob at '{path_to_attempt}': {e}")
                if error_message_detail is None: # Store first error encountered
                     error_message_detail = f"Error accessing '{path_to_attempt}': {str(e)}"
    
    if not content:
        logger.warning(f"Image not found after trying all paths for original request: '{filename}'")
        detail_msg = f"Image '{filename}' not found."
        # If a more specific error occurred (e.g. permissions vs. not found), it might be in error_message_detail
        # However, the C# controller returns a generic "Image not found" or "Error retrieving image"
        # For simplicity, stick to a clear "not found" unless a critical error happened during an attempt.
        # The C# code returns 500 for general exceptions during download, 404 if blobClient is null or after trying alternatives.
        # Let\'s use 404 if not found, 500 if an unexpected error happened during an attempt.
        # The current logic will lead to 404 if all attempts fail to find the blob.
        # If an attempt itself raised an exception that wasn\'t ResourceNotFoundError, that might be lost.
        # The C# code catches general Exception and returns 500.
        # For now, if content is None, it means all attempts either didn\'t find it or failed to download.
        final_detail = error_message_detail if error_message_detail else f"Image '{filename}' not found after trying all candidate paths."
        raise HTTPException(status_code=404, detail=final_detail)

    media_type = None    # Try to get content_type from blob properties first
    try:
        properties = await blob_service.get_blob_properties_async(input_container, actual_filename_used)
        if properties and properties.get("content_type") and properties["content_type"] != "application/octet-stream":
            media_type = properties["content_type"]
            logger.debug(f"Media type from blob properties: {media_type}")
    except Exception as e:
        logger.warning(f"Could not get blob properties for '{actual_filename_used}' to determine media type: {e}")

    if not media_type:
        # Infer from file extension as a fallback (like C# code)
        filename_for_type_inference = actual_filename_used
        file_ext = os.path.splitext(filename_for_type_inference)[1].lower()
        
        if file_ext == ".jpg" or file_ext == ".jpeg":
            media_type = "image/jpeg"
        elif file_ext == ".png":
            media_type = "image/png"
        elif file_ext == ".gif":
            media_type = "image/gif"
        else:
            # Use python\'s mimetypes library as a more general fallback
            guessed_type, _ = mimetypes.guess_type(filename_for_type_inference)
            media_type = guessed_type if guessed_type else "application/octet-stream"
        logger.debug(f"Media type inferred using mimetypes/extension for '{filename_for_type_inference}': {media_type}")
    
    # Add caching headers to improve performance
    headers = {
        "Cache-Control": "public, max-age=3600, immutable",  # Cache for 1 hour
        "ETag": f'"{hash(actual_filename_used)}"',  # Simple ETag based on filename
    }
    
    return Response(content=content, media_type=media_type, headers=headers)

# Placeholder for the model to be created later
# Ensure this is defined or imported before use if strict type checking is enabled
# For now, this is just a forward reference.
# class ImageMetadataResponse(BaseModel): 
#    filename: str
#    filesize: str
#    modified: str
#    width: Optional[int] = None
#    height: Optional[int] = None
#    format: Optional[str] = None
#    # ... other fields like exif

@router.get("/metadata/{filename:path}", response_model=ImageMetadataResponse, summary="Get image metadata")
async def get_image_metadata(
    filename: str = FastApiPath(..., description="The path to the image file"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service),
    cosmos_service: CosmosDbService = Depends(get_core_cosmos_service) # CHANGED
):
    logger.info(f"Getting metadata for image: {filename}")
    if not blob_service.client:
        raise HTTPException(status_code=500, detail="Azure Blob Storage not configured")

    input_container = settings.AZURE_INPUT_CONTAINER
    metadata = {}
    batch_id = None
    image_id_for_cosmos = None
      # Try to get metadata directly from blob properties
    try:
        properties = await blob_service.get_blob_properties_async(input_container, filename)
        if properties:
            metadata = {
                "filename": properties.get("name", filename),
                "filesize": f"{properties.get('size', 0) / 1024.0:.1f} KB",
                "modified": properties.get("last_modified").strftime("%Y-%m-%d %H:%M:%S") if properties.get("last_modified") else "N/A",
                "blob_metadata": properties.get("metadata", {})
            }
            # Use get with default empty dict to avoid NoneType errors
            image_id_for_cosmos = metadata.get("blob_metadata", {}).get("image_id") # Assuming image_id is stored in metadata
            logger.info(f"Metadata retrieved from blob properties for image: {filename}")
        else:
            logger.warning(f"No properties found for blob: {filename}, trying to infer metadata from image content.")
    except Exception as e:
        logger.warning(f"Error getting blob properties for metadata: {e}")

    # If metadata is incomplete, try to infer from image content (like EXIF data)
    if not metadata.get("width") or not metadata.get("height") or not metadata.get("format"):
        try:
            image_content = await blob_service.download_blob_content(input_container, filename)
            if image_content:
                img = Image.open(io.BytesIO(image_content))
                if not metadata.get("width"):
                    metadata["width"] = img.width
                if not metadata.get("height"):
                    metadata["height"] = img.height
                if not metadata.get("format"):
                    metadata["format"] = img.format.lower() if img.format else os.path.splitext(filename)[1].lstrip('.').lower()

                # Try to extract more metadata from EXIF if available
                try:
                    exif_data = img._getexif() # Returns a dict {tag_id: value}
                    if exif_data:
                        # Reverse mapping from Pillow's ExifTags to find string names
                        exif_tags_map = {v: k for k, v in ExifTags.TAGS.items()}

                        # DateTimeOriginal (Tag ID: 36867)
                        dt_original_val = exif_data.get(exif_tags_map.get('DateTimeOriginal'))
                        if dt_original_val:
                            metadata["date_taken"] = str(dt_original_val)

                        # Make (Tag ID: 271)
                        make_val = exif_data.get(exif_tags_map.get('Make'))
                        if make_val:
                            metadata["camera_make"] = str(make_val)

                        # Model (Tag ID: 272)
                        model_val = exif_data.get(exif_tags_map.get('Model'))
                        if model_val:
                            metadata["camera_model"] = str(model_val)

                        # ExposureTime (Tag ID: 33434)
                        exposure_val = exif_data.get(exif_tags_map.get('ExposureTime'))
                        if exposure_val:
                            if isinstance(exposure_val, tuple) and len(exposure_val) == 2: # Rational type (numerator, denominator)
                                metadata["exposure"] = f"{exposure_val[0]}/{exposure_val[1]} sec"
                            # Fall back to string representation if EXIF parsing fails
                            metadata["exposure"] = str(exposure_val)

                        # FNumber (Tag ID: 33437)
                        fnumber_val = exif_data.get(exif_tags_map.get('FNumber'))
                        if fnumber_val:
                            if isinstance(fnumber_val, tuple) and len(fnumber_val) == 2: # Rational
                                val = fnumber_val[0] / fnumber_val[1]
                                metadata["f_number"] = f"f/{val:.1f}"
                            # Fall back to string representation if EXIF parsing fails
                            metadata["f_number"] = str(fnumber_val)

                        # ISOSpeedRatings (Tag ID: 34855)
                        iso_val = exif_data.get(exif_tags_map.get('ISOSpeedRatings'))
                        if iso_val:
                            metadata["iso"] = str(iso_val)
                except Exception as exif_ex:
                    logger.warning(f"Error extracting EXIF data for {filename}: {exif_ex}")
                    metadata["exif_error"] = str(exif_ex)

                logger.info(f"Metadata inferred from image content for image: {filename}")
            else:
                logger.warning(f"Image content not found for {filename}, unable to infer metadata.")
        except Exception as img_ex:
            logger.error(f"Error processing image {filename} for metadata: {img_ex}")
            metadata["image_error"] = str(img_ex)
            # If image processing fails, we might not have width/height/format
            # but we already populated basic file info.

    # If we have batch_id from metadata, we can use it to fetch related information from CosmosDB
    if image_id_for_cosmos and cosmos_service.client:
        try:
            # Example query to fetch related data, adjust based on actual requirements
            query = "SELECT c.id, c.BatchID, c.ImageID, c.Status, c.admin_metadata, c.categories FROM c WHERE c.ImageID = @image_id"
            parameters = [{"name": "@image_id", "value": image_id_for_cosmos}]
            
            related_items = await cosmos_service.query_items_async(
                container_name=settings.COSMOS_CONTAINER, # This is 'batches' container
                query=query,
                parameters=parameters
            )
            
            if related_items and len(related_items) > 0:
                # Assuming we just need the first related item
                first_related_item = related_items[0]
                metadata["related_batch_id"] = first_related_item.get("BatchID")
                metadata["related_image_id"] = first_related_item.get("ImageID")
                metadata["status"] = first_related_item.get("Status")
                metadata["admin_metadata"] = first_related_item.get("admin_metadata")
                metadata["categories"] = first_related_item.get("categories")
                logger.info(f"Related metadata found in CosmosDB for image: {filename}")
            else:
                logger.info(f"No related metadata found in CosmosDB for image: {filename}")

        except Exception as cosmos_ex:
            logger.warning(f"Error fetching related metadata from CosmosDB for {filename}: {cosmos_ex}")

    return metadata


@router.post("/delete/{filename:path}", summary="Move an image and related files to a delete container")
async def delete_image(
    filename: str = FastApiPath(..., description="The path to the image file to delete, e.g., B1/img1.jpg or B1/cam/img1.jpg"),
    settings: Settings = Depends(get_settings),
    blob_service: BlobStorageService = Depends(get_blob_service),
    cosmos_service: CosmosDbService = Depends(get_core_cosmos_service) # CHANGED
):
    if not blob_service.blob_service_client:
        raise HTTPException(status_code=500, detail="Azure Blob Storage not configured")

    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid path")

    input_container = settings.AZURE_INPUT_CONTAINER
    delete_container = settings.AZURE_DELETE_CONTAINER
    annotations_container = settings.AZURE_ANNOTATIONS_CONTAINER

    # Ensure filename is just the path, not including container name if accidentally passed
    # The FastApiPath should handle this, but good to be cautious.
    # filename = os.path.basename(filename) # This might be too aggressive if path is intended

    source_image_exists = await blob_service.blob_exists(input_container, filename)
    if not source_image_exists:
        # C# controller checks for alternative paths for GetImage, but not for DeleteImage.
        # It directly uses the provided filename to check existence in input container.
        raise HTTPException(status_code=404, detail=f"Image {filename} not found in Input container.")

    # Determine base filename for related files (COCO, log)
    # Path.GetFileNameWithoutExtension in C#
    base_filename_no_ext = os.path.splitext(os.path.basename(filename))[0]
    coco_filename = f"{base_filename_no_ext}.coco"
    log_filename = f"{base_filename_no_ext}.log"

    # Path for related files in the delete container (they go into the root of delete container in C# code)
    # The C# code uses `deleteContainerClient.GetBlobClient(cocoFileName)` which implies root.
    # If they should maintain folder structure, dest_coco_filename = os.path.join(os.path.dirname(filename), coco_filename)
    dest_coco_filename_in_delete_container = coco_filename 
    dest_log_filename_in_delete_container = log_filename

    try:
        # 1. Move image file
        copied_image = await blob_service.copy_blob(
            source_container=input_container, 
            source_blob_name=filename, 
            dest_container=delete_container, 
            dest_blob_name=filename # Keep same path structure in delete container
        )
        if copied_image:
            await blob_service.delete_blob(input_container, filename)
            logger.info(f"Moved image {filename} from {input_container} to {delete_container}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to copy image {filename} to delete container.")

        # 2. Move corresponding COCO annotation file if it exists
        # The C# code looks for cocoFileName in the annotations_container.
        # It does not use the original image's subfolder structure for the coco file name.
        coco_exists_in_annotations = await blob_service.blob_exists(annotations_container, coco_filename)
        if coco_exists_in_annotations:
            copied_coco = await blob_service.copy_blob(
                source_container=annotations_container,
                source_blob_name=coco_filename,
                dest_container=delete_container,
                dest_blob_name=dest_coco_filename_in_delete_container
            )
            if copied_coco:
                await blob_service.delete_blob(annotations_container, coco_filename)
                logger.info(f"Moved COCO file {coco_filename} from {annotations_container} to {delete_container}")
            else:
                logger.warning(f"Failed to copy COCO file {coco_filename} to delete container, but image was moved.")
        
        # 3. Move corresponding log file if it exists (similar logic to COCO)
        log_exists_in_annotations = await blob_service.blob_exists(annotations_container, log_filename)
        if log_exists_in_annotations:
            copied_log = await blob_service.copy_blob(
                source_container=annotations_container,
                source_blob_name=log_filename,
                dest_container=delete_container,
                dest_blob_name=dest_log_filename_in_delete_container
            )
            if copied_log:
                await blob_service.delete_blob(annotations_container, log_filename)
                logger.info(f"Moved log file {log_filename} from {annotations_container} to {delete_container}")
            else:
                logger.warning(f"Failed to copy log file {log_filename} to delete container, but image was moved.")

        # 4. Delete from CosmosDB
        # C# code: "SELECT * FROM c WHERE c.BatchID = '{batchId}' AND (c.ImageID = '{imageId}' OR c.id = '{imageId}')"
        # Then iterates and calls _cosmosDbService.DeleteItemAsync(id, batchId)
        # We need to parse batchId and imageId from the filename string.
        # Example filename: "B2/cam/cam1_1742977845.jpg"
        # batchId = "B2", imageId = "cam1_1742977845"
        
        parts = filename.split('/')
        batch_id_from_path: Optional[str] = None
        image_id_from_path: Optional[str] = None # This is image_id, not full filename

        if len(parts) >= 2: # Needs at least batch/file.ext or batch/folder/file.ext
            batch_id_from_path = parts[0]
            # The imageId is the filename without extension from the last part of the path
            image_id_from_path = os.path.splitext(os.path.basename(filename))[0]
        
        if batch_id_from_path and image_id_from_path and cosmos_service.client:
            try:
                # Construct query carefully. The C# query uses ImageID OR id.
                # Assuming 'id' in Cosmos is the primary unique ID for the item, and ImageID is specific to the image.
                # The Batches container schema has "BatchID" and "ImageID" and "id" (which is often same as ImageID in examples)
                query = f"SELECT c.id FROM c WHERE c.BatchID = @batch_id AND (c.ImageID = @image_id OR c.id = @image_id)"
                parameters = [
                    {"name": "@batch_id", "value": batch_id_from_path},
                    {"name": "@image_id", "value": image_id_from_path}
                ]
                
                items_to_delete = await cosmos_service.query_items_async(
                    container_name=settings.COSMOS_CONTAINER, # This is 'batches' container
                    query=query,
                    parameters=parameters
                )
                
                deleted_count = 0
                for item in items_to_delete:
                    item_id = item.get("id")
                    if item_id:
                        # CosmosDbService.delete_item needs partition_key. For 'batches' container, it's BatchID.
                        await cosmos_service.delete_item_async(settings.COSMOS_CONTAINER, item_id, batch_id_from_path)
                        logger.info(f"Deleted CosmosDB record id '{item_id}' for BatchID='{batch_id_from_path}', ImageID='{image_id_from_path}'")
                        deleted_count += 1
                if deleted_count > 0:
                     logger.info(f"Successfully deleted {deleted_count} items from CosmosDB for {filename}")
                else:
                    logger.info(f"No CosmosDB records found or deleted for BatchID='{batch_id_from_path}', ImageID='{image_id_from_path}' matching query.")

            except CosmosResourceNotFoundError:
                logger.info(f"CosmosDB container '{settings.COSMOS_CONTAINER}' not found or no items matched for deletion for {filename}.")
            except Exception as cosmos_ex:
                # Log warning but don't fail the whole operation if CosmosDB deletion fails, similar to C#
                logger.warning(f"Error deleting CosmosDB records for {filename}: {cosmos_ex}. Image and related files were moved.")
        elif not cosmos_service.client:
            logger.warning("CosmosDB client not initialized. Skipping deletion of CosmosDB records.")
        else:
            logger.info(f"Could not determine BatchID/ImageID from filename '{filename}' for CosmosDB deletion. Skipping.")

        return {"message": f"Image {filename} and related files moved to delete container successfully."}

    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Error deleting image {filename}: {e}")
        # Attempt to rollback or log inconsistencies if possible, though C# doesn't show explicit rollback.
        # For now, return a generic error.
        raise HTTPException(status_code=500, detail=f"Could not complete delete operation for {filename}: {str(e)}")

@router.post("/filtered-images", tags=["images"], summary="Get a list of images based on filter criteria from Cosmos DB")
async def get_filtered_images(
    raw_criteria: Dict[str, Any] = Body(...), 
    cosmos_service: CosmosDbService = Depends(get_core_cosmos_service),
    blob_service: BlobStorageService = Depends(get_blob_service),  # Added blob_service dependency
    settings: Settings = Depends(get_settings)
):
    logger.info(f"POST /filtered-images received raw criteria: {raw_criteria}")
    
    # Log detailed info about the class filters for debugging
    if 'classes' in raw_criteria:
        class_filters = raw_criteria.get('classes', [])
        logger.info(f"Class filters requested: {class_filters} (count: {len(class_filters)})")
        if not class_filters or len(class_filters) == 0:
            logger.warning("Empty class filters array received, this might cause all images to be returned")
    
    try:
        criteria = FilterCriteria.model_validate(raw_criteria)
    except ValidationError as e:
        logger.error(f"Validation error for filter criteria: {e.errors()}")
        raise HTTPException(status_code=422, detail=e.errors())

    # Fetch blob data first - needed for the complete result processing
    all_image_files_blob_info = []
    try:
        if criteria.batch_id and blob_service.client:
            # Get all blobs for the specified batch
            prefix_to_list = f"{criteria.batch_id}/" 
            input_container = settings.AZURE_INPUT_CONTAINER
            
            # List all blobs with the batch prefix
            blob_names = await blob_service.list_blobs(
                container_name=input_container, 
                name_starts_with=prefix_to_list
            )
            
            # Filter for allowed image files and gather metadata
            for name in blob_names:
                if blob_service.allowed_file(name):
                    # Extract derived ID (could be filename without extension, or last path component, etc.)
                    # You might need to adjust this logic based on your actual ID derivation needs
                    file_basename = os.path.basename(name)
                    derived_id = os.path.splitext(file_basename)[0]
                    
                    all_image_files_blob_info.append({
                        "file_name": name,
                        "derived_id": derived_id
                    })
            
            logger.info(f"Found {len(all_image_files_blob_info)} candidate image blobs for batch {criteria.batch_id}")
        else:
            logger.warning("No batch_id specified or blob_service not initialized. Cannot list images from storage.")
    except Exception as e:
        logger.error(f"Error listing blobs for batch {criteria.batch_id}: {e}")
        # Continue with query - we might still get results from Cosmos DB
    
    # Continue with the existing query building logic
    query_parts = []
    params = {} # CHANGED: Initialize as a dictionary
    param_idx = 1 

    # Build the query
    if criteria.batch_id:
        query_parts.append("c.BatchID = @batch_id")
        params["@batch_id"] = criteria.batch_id

    if criteria.unlabelledOnly:
        query_parts.append("(NOT IS_DEFINED(c.Status) OR c.Status = 'Not Reviewed')")
    elif criteria.status:
        status_conditions_parts = []
        for i, s_val in enumerate(criteria.status):
            param_name = f"@status_{i}"
            status_conditions_parts.append(f"c.Status = {param_name}")
            params[param_name] = s_val
        if status_conditions_parts:
            query_parts.append(f"({ ' OR '.join(status_conditions_parts) })")

    if not criteria.showDeleted:
        # Mimic C# logic: (NOT Status='Deleted') AND (NOT Deletion_Date set)
        cond_status_not_deleted = "(NOT IS_DEFINED(c.Status) OR c.Status != 'Deleted')"
        cond_no_deletion_date = "(NOT IS_DEFINED(c.admin_metadata.Deletion_Date) OR c.admin_metadata.Deletion_Date = '')"
        query_parts.append(f"({cond_status_not_deleted} AND {cond_no_deletion_date})")

    # Handle classes (present in annotations.category_id, needs mapping from class name to ID)
    # This requires a separate query to get class IDs if names are provided, or direct use if IDs are provided.
    # For now, assuming criteria.classes contains class *names* that need to be mapped to category_ids.
    # This part is complex and may require an additional call to get category IDs from names.
    # Simplified: If classes are specified, we assume they are category_ids for now or this needs enhancement.
    if criteria.classes:
        class_conditions = []
        for i, cls_name_or_id in enumerate(criteria.classes):
            # Assuming cls_name_or_id is a category_id for now
            # In a real scenario, you\'d look up the ID if it\'s a name.
            # This part of the query becomes tricky with arrays of annotations.
            # We need to check if ANY annotation in the \'annotations\' array has a matching \'category_id\'.
            # This often requires a UDF in Cosmos DB or more complex JOIN-like syntax if available for sub-arrays.
            # Using ARRAY_CONTAINS with a specific path might work if we restructure or denormalize.
            # A simpler, less efficient approach for now, might be to filter in Python after fetching more data.
            # For a direct query, it\'s complex. Let\'s placeholder a Python-side filter idea.
            # Example of how one might try to express it (syntax might need verification for Cosmos SQL):
            # EXISTS (SELECT VALUE ann FROM ann IN c.annotations WHERE ann.category_id = @class_id_N)
            param_name = f"@class_id{i}"
            # This is a conceptual query part; actual Cosmos SQL for this is tricky.
            # class_conditions.append(f"EXISTS (SELECT VALUE ann FROM ann IN c.annotations WHERE ann.category_id = {param_name})")
            # params[param_name] = cls_name_or_id # Assuming it\'s an ID
            # Due to complexity, this part will be simplified or handled post-query.
            # For now, let\'s assume criteria.classes are IDs and we want items where *any* annotation has this category_id.
            # This is a common pattern: check if an array contains an object with a certain property value.
            # Cosmos DB SQL might require a UDF for this or a more specific ARRAY_CONTAINS on a projected array of category_ids.
            # Let\'s try a simpler approach: fetch candidates and filter in Python if this part is used.            # Add array_contains check for annotations with matching class
            param_name = f"@class_id{i}"            # We can't directly filter based on class name in the Cosmos DB query
            # because annotations reference categories by ID, not by name
            # We'll handle class filtering in Python after fetching results
            # For now, just include this class name in the parameters
            params[param_name] = cls_name_or_id        # When classes are specified, we'll do filtering in Python code instead
        # because of the complex relationship between annotations and categories
        # No need to add class conditions to the query

    base_query = "SELECT * FROM c WHERE "
    final_query_string = base_query + " AND ".join(query_parts) if query_parts else base_query
    logger.debug(f"Constructed Cosmos DB query string: {final_query_string}") # ADDED LOGGING
    # Prepare parameters for Cosmos DB SDK
    sdk_parameters = [{"name": k, "value": v} for k, v in params.items()]
    logger.debug(f"Cosmos DB SDK parameters: {sdk_parameters}") # ADDED LOGGING
    
    try:
        if cosmos_service.container:  # FIXED: use container instead of client
            # Call CosmosDB service
            cosmos_results_raw = await cosmos_service.query_items(
                container_name=settings.COSMOS_CONTAINER, # This is 'batches'
                query=final_query_string,
                parameters=sdk_parameters # CORRECTED PARAMETER FORMAT
                # enable_cross_partition_query parameter removed - not supported by the CosmosDbService implementation
            )
            logger.info(f"Query returned {len(cosmos_results_raw)} documents before further Python filtering.")

    except HTTPException: # Re-raise HTTPExceptions from service
        raise
    except Exception as e:
        logger.error(f"Error querying CosmosDB for filtered images (batch '{criteria.batch_id}'): {e}")
        raise HTTPException(status_code=500, detail="Error querying database for filtered images.")

    # Process CosmosDB results
    map_derived_id_to_filename = {info['derived_id']: info['file_name'] for info in all_image_files_blob_info}
    processed_images: List[Dict[str, Any]] = []

    if criteria.unlabelledOnly:
        # Images from Cosmos query are considered "labelled" or have a status.
        # We need images from blob list that are NOT in this set.
        ids_from_cosmos_query = {(item.get("ImageID") or item.get("id")) for item in cosmos_results_raw if (item.get("ImageID") or item.get("id"))}
        for img_blob_info in all_image_files_blob_info:
            if img_blob_info["derived_id"] not in ids_from_cosmos_query:
                processed_images.append({
                    "id": img_blob_info["derived_id"],
                    "file_name": img_blob_info["file_name"],
                    "status": "Not Reviewed" # Default status for unlabelled
                })
    else:
        for item in cosmos_results_raw:
            current_item_id = item.get("ImageID") or item.get("id")
            if not current_item_id: continue

            file_name = map_derived_id_to_filename.get(current_item_id)
            if not file_name: # Fallback logic if ID from Cosmos doesn't match a blob-derived ID
                cosmos_images_array = item.get("images")
                if cosmos_images_array and isinstance(cosmos_images_array, list) and len(cosmos_images_array) > 0:
                    first_image_info = cosmos_images_array[0]
                    if isinstance(first_image_info, dict):
                        file_name = first_image_info.get("file_name")
            if not file_name: # Final fallback: construct path
                file_name = f"{criteria.batch_id}/cam/{current_item_id}.jpg"
            
            status = item.get("Status", "Not Reviewed")
            processed_images.append({"id": current_item_id, "file_name": file_name, "status": status})

    # Apply nameWildcard filter
    if criteria.nameWildcard:
        try:
            # Convert wildcard to regex: * -> .*, ? -> .
            pattern_str = criteria.nameWildcard.replace("*", ".*").replace("?", ".")
            regex = re.compile(pattern_str, re.IGNORECASE)
            processed_images = [img for img in processed_images if regex.search(img["file_name"])]
        except re.error as re_ex:
            logger.warning(f"Invalid regex from nameWildcard '{criteria.nameWildcard}': {re_ex}")
            # Optionally, could raise HTTPException or ignore filter if regex is bad    # Python-side filter for classes
    # Based on the Cosmos DB document structure, we need to:
    # 1. Get category_id from the category name in the categories array
    # 2. Check if any annotation has that category_id
    if criteria.classes and len(criteria.classes) > 0 and criteria.hasAnnotations and not criteria.unlabelledOnly:
        logger.info(f"Filtering by classes: {criteria.classes}")
        class_filtered_images = []
        for img in processed_images:
            img_id = img.get("id")
            if not img_id:
                continue
                
            # Find original document with annotations
            original_doc = next((doc for doc in cosmos_results_raw if 
                              (doc.get("ImageID") == img_id or doc.get("id") == img_id)), None)
                
            if not original_doc:
                continue
                
            # Get annotations and categories from the document
            annotations = original_doc.get("annotations", [])
            categories = original_doc.get("categories", [])
            
            if not annotations or not categories:
                continue
              # Create a mapping of category names to ids
            category_name_to_id = {cat.get("name"): cat.get("id") for cat in categories if cat.get("name") and cat.get("id")}
            
            # Log the available categories in this document for debugging
            logger.debug(f"Available categories in document: {[cat.get('name') for cat in categories if cat.get('name')]}")
            
            # Check if any annotations match the requested classes
            should_include = False
            for cls_name in criteria.classes:
                # Find the category ID for this class name
                category_id = category_name_to_id.get(cls_name)
                logger.debug(f"Looking for class '{cls_name}', mapped to category_id: {category_id}")
                
                if category_id is not None:
                    # Check if any annotation has this category_id
                    annotation_matches = [ann for ann in annotations if ann.get("category_id") == category_id]
                    if annotation_matches:
                        logger.debug(f"Found {len(annotation_matches)} annotations with category_id {category_id}")
                        should_include = True
                        break
                    else:
                        logger.debug(f"No annotations found with category_id {category_id}")
                else:
                    logger.debug(f"Class '{cls_name}' not found in document categories")
                        
            if should_include:
                class_filtered_images.append(img)
                      # Replace processed_images with filtered results
        if class_filtered_images:
            logger.info(f"Class filter reduced results from {len(processed_images)} to {len(class_filtered_images)}")
            processed_images = class_filtered_images
        else:
            logger.warning(f"Class filter found no matching images")
            # Return an empty list when no matches are found
            # This ensures we don't show all images when no matches exist
            processed_images = []
            
    # Return processed images as JSON
    return processed_images