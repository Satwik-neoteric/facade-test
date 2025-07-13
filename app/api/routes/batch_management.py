from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form, Response, Body, Request, Query
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from typing import List, Dict, Any, Optional
from app.models.batch_management import BatchModel, BatchCreate, JobParameters
from app.models.image import ImageInfo
from app.core.dependencies import get_cosmos_service, get_blob_storage_service
from app.services.cosmos_service import CosmosDbService
from app.services.blob_service import BlobStorageService
import httpx
import os
import io
import json
import zipfile
from datetime import datetime
import logging
import asyncio
from tempfile import NamedTemporaryFile

router = APIRouter()
logger = logging.getLogger(__name__)

# Azure Function URLs (should be moved to config/env in production)
BLOB2COSMOS_URL = "https://batch.azurewebsites.net/api/blob2cosmos?code=<YOUR_FUNCTION_KEY>"
DOWNLOAD_IMAGES_URL = "https://batch.azurewebsites.net/api/download?code=<YOUR_FUNCTION_KEY>"
GET_STATUS_URL = "https://batch.azurewebsites.net/api/status?code=<YOUR_FUNCTION_KEY>"
SUBMIT_JOB_URL = "https://batch.azurewebsites.net/api/submit?code=<YOUR_FUNCTION_KEY>"
UPLOAD_IMAGES_URL = "https://batch.azurewebsites.net/api/upload?code=<YOUR_FUNCTION_KEY>"

# 1. List Batches - True Single-Query Optimization
@router.get("/admin/batches", response_model=List[BatchModel])
async def list_batches(cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
    """
    Retrieve a list of batches from CosmosDB with maximum optimization.
    Uses a single query to get all batch data at once, then processes in memory.
    """
    try:
        logger.info("Executing highly optimized single-query batch retrieval.")
        
        # Single query to get ALL data we need at once
        # This gets minimal required fields for all documents, then we aggregate in Python
        optimized_query = """
        SELECT 
            c.BatchID,
            c._ts,
            c.info.date_created as date_created,
            c.info.description as description
        FROM c 
        WHERE c.BatchID != null
        """
        
        logger.debug("Executing single comprehensive query")
        all_results = await cosmos_service.query_items(query=optimized_query)
        
        if not all_results:
            logger.warning("No batch data found in CosmosDB.")
            return []

        logger.info(f"Retrieved {len(all_results)} total records, processing batches...")
        
        # Process results in memory - much faster than multiple DB queries
        batch_data = {}
        
        for record in all_results:
            batch_id = record.get("BatchID")
            if not batch_id:
                continue
                
            # Initialize batch if not seen before
            if batch_id not in batch_data:
                batch_data[batch_id] = {
                    "batch_id": batch_id,
                    "image_count": 0,
                    "latest_ts": 0,
                    "earliest_date_created": None,
                    "description": None
                }
            
            # Increment image count
            batch_data[batch_id]["image_count"] += 1
            
            # Track latest timestamp
            ts = record.get("_ts", 0)
            if ts > batch_data[batch_id]["latest_ts"]:
                batch_data[batch_id]["latest_ts"] = ts
            
            # Get earliest creation date
            date_created = record.get("date_created")
            if date_created and not batch_data[batch_id]["earliest_date_created"]:
                batch_data[batch_id]["earliest_date_created"] = date_created
            
            # Get description (from any record that has it)
            description = record.get("description")
            if description and not batch_data[batch_id]["description"]:
                batch_data[batch_id]["description"] = description
        
        # Convert aggregated data to BatchModel objects
        batches = []
        current_time = datetime.now()
        
        for batch_id, data in batch_data.items():
            try:
                # Parse creation date
                created_date = current_time
                if data["earliest_date_created"]:
                    try:
                        created_date = datetime.fromisoformat(data["earliest_date_created"])
                    except ValueError:
                        logger.warning(f"Invalid date format in batch {batch_id}")
                
                # Parse last modified
                last_modified = current_time
                if data["latest_ts"] > 0:
                    try:
                        last_modified = datetime.fromtimestamp(data["latest_ts"])
                    except (ValueError, TypeError):
                        pass
                
                batch = BatchModel(
                    batch_id=batch_id,
                    created_date=created_date,
                    status="Available",
                    image_count=data["image_count"],
                    last_modified=last_modified,
                    description=data.get("description", "") or ""
                )
                batches.append(batch)
                
            except Exception as batch_error:
                logger.error(f"Error processing batch {batch_id}: {str(batch_error)}")
                # Create minimal entry on error
                batch = BatchModel(
                    batch_id=batch_id,
                    created_date=current_time,
                    status="Error",
                    image_count=data.get("image_count", 0),
                    last_modified=current_time,
                    description="Error processing batch"
                )
                batches.append(batch)
        
        # Sort by batch_id for consistent ordering
        batches.sort(key=lambda x: x.batch_id)
        
        logger.info(f"Successfully processed {len(batches)} batches with single-query optimization.")
        return batches
        
    except Exception as e:
        logger.error(f"Error fetching batches: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batches: {str(e)}")

# Alternative: Ultra-optimized version for very large datasets
@router.get("/admin/batches/fast", response_model=List[BatchModel])
async def list_batches_ultra_fast(cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
    """
    Ultra-fast batch listing with minimal data processing.
    Uses the most basic CosmosDB queries for maximum compatibility.
    """
    try:
        logger.info("Executing ultra-fast batch query.")
        
        # Get unique batch IDs only - most basic query possible
        simple_query = "SELECT DISTINCT c.BatchID FROM c WHERE c.BatchID != null"
        batch_id_results = await cosmos_service.query_items(query=simple_query)
        
        if not batch_id_results:
            return []

        batches = []
        current_time = datetime.now()
        
        # For ultra-fast mode, skip detailed metadata and just return basic info
        for batch_item in batch_id_results:
            batch_id = batch_item.get("BatchID")
            if not batch_id:
                continue
                
            # Create minimal batch entry without additional queries
            batch = BatchModel(
                batch_id=batch_id,
                created_date=current_time,
                status="Available",
                image_count=0,  # Skip count for maximum speed
                last_modified=current_time,
                description=""  # Skip description for speed
            )
            batches.append(batch)
        
        logger.info(f"Ultra-fast query returned {len(batches)} batches.")
        return batches
        
    except Exception as e:
        logger.error(f"Error in ultra-fast batch query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batches: {str(e)}")

# Alternative: Partially optimized version for better performance
@router.get("/admin/batches/optimized", response_model=List[BatchModel])
async def list_batches_optimized(cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
    """
    Partially optimized batch listing that balances speed and data completeness.
    Uses CosmosDB-compatible queries without complex GROUP BY operations.
    """
    try:
        logger.info("Executing partially optimized batch query.")
        
        # Get unique batch IDs
        batch_ids_query = "SELECT DISTINCT c.BatchID FROM c WHERE c.BatchID != null ORDER BY c.BatchID"
        batch_id_results = await cosmos_service.query_items(query=batch_ids_query)
        
        if not batch_id_results:
            return []

        unique_batch_ids = [item.get("BatchID") for item in batch_id_results if item.get("BatchID")]
        batches = []
        
        # Process batches with minimal queries
        for batch_id in unique_batch_ids:
            try:
                # Get count using VALUE COUNT - this should work in CosmosDB
                count_query = f"SELECT VALUE COUNT(1) FROM c WHERE c.BatchID = '{batch_id}'"
                count_results = await cosmos_service.query_items(query=count_query)
                image_count = count_results[0] if count_results and len(count_results) > 0 else 0
                
                # Get latest timestamp and sample metadata
                metadata_query = f"SELECT TOP 1 c._ts, c.info FROM c WHERE c.BatchID = '{batch_id}' ORDER BY c._ts DESC"
                metadata_results = await cosmos_service.query_items(query=metadata_query)
                
                # Parse metadata
                created_date = datetime.now()
                last_modified = datetime.now()
                description = ""
                
                if metadata_results and len(metadata_results) > 0:
                    metadata = metadata_results[0]
                    
                    # Get last modified from timestamp
                    if "_ts" in metadata and metadata["_ts"]:
                        try:
                            last_modified = datetime.fromtimestamp(metadata["_ts"])
                        except (ValueError, TypeError):
                            pass
                    
                    # Get created date and description from info
                    info = metadata.get("info", {})
                    if isinstance(info, dict):
                        date_created_str = info.get("date_created", "")
                        if date_created_str and isinstance(date_created_str, str):
                            try:
                                created_date = datetime.fromisoformat(date_created_str)
                            except ValueError:
                                created_date = last_modified
                        
                        description = info.get("description", "") or ""
                
                batch = BatchModel(
                    batch_id=batch_id,
                    created_date=created_date,
                    status="Available",
                    image_count=image_count,
                    last_modified=last_modified,
                    description=description
                )
                batches.append(batch)
                
            except Exception as batch_error:
                logger.error(f"Error processing batch {batch_id}: {str(batch_error)}")
                # Create minimal entry on error
                batch = BatchModel(
                    batch_id=batch_id,
                    created_date=datetime.now(),
                    status="Error",
                    image_count=0,
                    last_modified=datetime.now(),
                    description="Error loading batch"
                )
                batches.append(batch)
        
        logger.info(f"Partially optimized query returned {len(batches)} batches.")
        return batches
        
    except Exception as e:
        logger.error(f"Error in optimized batch query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batches: {str(e)}")

# Ultra-Performance: Async parallel batch processing
@router.get("/admin/batches/parallel", response_model=List[BatchModel])
async def list_batches_parallel(cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
    """
    Ultra-fast batch listing using parallel processing.
    Processes multiple batch queries simultaneously for maximum speed.
    """
    import asyncio
    
    try:
        logger.info("Executing parallel batch processing.")
        
        # Step 1: Get unique batch IDs quickly
        batch_ids_query = "SELECT DISTINCT c.BatchID FROM c WHERE c.BatchID != null"
        batch_id_results = await cosmos_service.query_items(query=batch_ids_query)
        
        if not batch_id_results:
            return []

        unique_batch_ids = [item.get("BatchID") for item in batch_id_results if item.get("BatchID")]
        logger.info(f"Processing {len(unique_batch_ids)} batches in parallel")
        
        # Step 2: Process all batches in parallel
        async def process_single_batch(batch_id: str) -> BatchModel:
            try:
                # Run count and metadata queries in parallel for each batch
                count_task = cosmos_service.query_items(
                    query=f"SELECT VALUE COUNT(1) FROM c WHERE c.BatchID = '{batch_id}'"
                )
                metadata_task = cosmos_service.query_items(
                    query=f"SELECT TOP 1 c._ts, c.info FROM c WHERE c.BatchID = '{batch_id}'"
                )
                
                # Wait for both queries to complete
                count_results, metadata_results = await asyncio.gather(
                    count_task, metadata_task, return_exceptions=True
                )
                
                # Extract results safely
                image_count = 0
                if not isinstance(count_results, Exception) and count_results:
                    image_count = count_results[0] if len(count_results) > 0 else 0
                
                created_date = datetime.now()
                last_modified = datetime.now()
                description = ""
                
                if not isinstance(metadata_results, Exception) and metadata_results and len(metadata_results) > 0:
                    metadata = metadata_results[0]
                    
                    # Parse timestamp
                    if "_ts" in metadata and metadata["_ts"]:
                        try:
                            last_modified = datetime.fromtimestamp(metadata["_ts"])
                        except (ValueError, TypeError):
                            pass
                    
                    # Parse info
                    info = metadata.get("info", {})
                    if isinstance(info, dict):
                        date_created_str = info.get("date_created", "")
                        if date_created_str:
                            try:
                                created_date = datetime.fromisoformat(date_created_str)
                            except ValueError:
                                pass
                        description = info.get("description", "") or ""
                
                return BatchModel(
                    batch_id=batch_id,
                    created_date=created_date,
                    status="Available",
                    image_count=image_count,
                    last_modified=last_modified,
                    description=description
                )
                
            except Exception as e:
                logger.error(f"Error processing batch {batch_id}: {str(e)}")
                return BatchModel(
                    batch_id=batch_id,
                    created_date=datetime.now(),
                    status="Error",
                    image_count=0,
                    last_modified=datetime.now(),
                    description="Error loading batch"
                )
        
        # Process all batches in parallel with limited concurrency
        semaphore = asyncio.Semaphore(5)  # Limit to 5 concurrent requests
        
        async def bounded_process(batch_id: str):
            async with semaphore:
                return await process_single_batch(batch_id)
        
        # Execute all batch processing in parallel
        tasks = [bounded_process(batch_id) for batch_id in unique_batch_ids]
        batches = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and sort results
        valid_batches = [b for b in batches if isinstance(b, BatchModel)]
        valid_batches.sort(key=lambda x: x.batch_id)
        
        logger.info(f"Parallel processing completed: {len(valid_batches)} batches")
        return valid_batches
        
    except Exception as e:
        logger.error(f"Error in parallel batch processing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batches: {str(e)}")

# 2. Register Batch - Create a new batch
@router.post("/admin/batches", response_model=BatchModel)
async def create_batch(
    batch: BatchCreate,
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Register a new batch in the system by proxying to the blob2cosmos Azure Function.
    """
    try:
        logger.info(f"Registering new batch: {batch.batch_id}")
        
        # Prepare request payload
        payload = {
            "batch_id": batch.batch_id,
            "description": batch.description if batch.description else "",
            "categories": batch.categories if batch.categories else []
        }
        
        # Call Azure Function to register batch
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(BLOB2COSMOS_URL, json=payload)
            
        if response.status_code != 200:
            logger.error(f"Error registering batch: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to register batch: {response.text}")
        
        result = response.json()
        logger.info(f"Batch registered successfully: {result}")
        
        # Create response object with standardized fields
        return BatchModel(
            batch_id=batch.batch_id,
            created_date=datetime.now(),
            status="Ready",
            image_count=0,
            last_modified=datetime.now(),
            description=batch.description
        )
    
    except Exception as e:
        logger.exception("Error creating batch")
        raise HTTPException(status_code=500, detail=f"Failed to register batch: {str(e)}")

# 3. Upload Images - Add images to a batch

@router.post("/admin/batches/{batch_id}/images")
async def upload_images(
    batch_id: str,
    files: List[UploadFile] = File(...),
    override: bool = Form(False),
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
):
    """
    Upload images to an existing batch by proxying to the upload_images Azure Function.
    """
    try:
        logger.info(f"Uploading {len(files)} images to batch {batch_id}")

        # Form fields go in `data=`
        form_data = {
            "override": str(override).lower(),
            "batch_id": batch_id
        }

        # Files go in `files=`
        upload_files = []
        for file in files:
            file_bytes = await file.read()
            upload_files.append(
                ("files", (file.filename, file_bytes, file.content_type or "application/octet-stream"))
            )

        # Submit request
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                UPLOAD_IMAGES_URL,
                data=form_data,   # <- Fields like batch_id go here
                files=upload_files  # <- Actual images go here
            )

        if response.status_code != 200:
            logger.error(f"Error uploading images: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to upload images: {response.text}"
            )

        result = response.json()
        logger.info(f"Images uploaded successfully: {result}")

        return {
            "status": "success",
            "message": f"Successfully uploaded {len(files)} images to batch {batch_id}",
            "details": result
        }

    except Exception as e:
        logger.exception("Error uploading images")
        raise HTTPException(status_code=500, detail=f"Failed to upload images: {str(e)}")


# 4. Run Inference - Process a batch with AI models
@router.post("/admin/batches/{batch_id}/inference")
async def run_inference(
    batch_id: str,
    job_params: JobParameters,
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Run inference on a batch using specified AI models by proxying to the submit_job Azure Function.
    """
    try:
        logger.info(f"Running inference on batch {batch_id} with model {job_params.model}")
        
        # Prepare request payload
        payload = {
            "batch_id": batch_id,
            "model": job_params.model,
            "parameters": job_params.parameters if job_params.parameters else {}
        }
        
        # Call Azure Function to submit inference job
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(SUBMIT_JOB_URL, json=payload)
            
        if response.status_code != 200:
            logger.error(f"Error running inference: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to run inference: {response.text}")
        
        result = response.json()
        logger.info(f"Inference job submitted successfully: {result}")
        
        return {
            "status": "success",
            "message": f"Inference job submitted for batch {batch_id}",
            "job_id": result.get("job_id"),
            "details": result
        }
    
    except Exception as e:
        logger.exception("Error running inference")
        raise HTTPException(status_code=500, detail=f"Failed to run inference: {str(e)}")

# 5. Get Batch Status - Check status of batch operations
@router.get("/admin/batches/{batch_id}/status")
async def get_batch_status(
    batch_id: str,
    job_id: Optional[str] = Query(None),
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Check the status of a batch or a specific job within a batch by proxying to the get_status Azure Function.
    """
    try:
        logger.info(f"Getting status for batch {batch_id}" + (f" job {job_id}" if job_id else ""))
        
        # Build request URL
        url = f"{GET_STATUS_URL}&batchId={batch_id}"
        if job_id:
            url += f"&jobId={job_id}"
        
        # Call Azure Function to get status
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            
        if response.status_code != 200:
            logger.error(f"Error getting status: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to get status: {response.text}")
        
        result = response.json()
        logger.info(f"Status retrieved successfully: {result}")
        
        return result
    
    except Exception as e:
        logger.exception("Error getting batch status")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

# 6. Download Batch Images - Download images from a batch
@router.get("/admin/batches/{batch_id}/download")
async def download_batch_images(
    batch_id: str,
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
):
    """
    Download all images from a batch as a ZIP file by proxying to the download_images Azure Function.
    """
    try:
        logger.info(f"Downloading images from batch {batch_id}")
        
        # Call Azure Function to download images
        async with httpx.AsyncClient(timeout=300.0) as client:  # Longer timeout for downloads
            response = await client.get(f"{DOWNLOAD_IMAGES_URL}&batchId={batch_id}")
            
        if response.status_code != 200:
            logger.error(f"Error downloading images: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to download images: {response.text}")
        
        # Create a StreamingResponse with the downloaded content
        def iterfile():
            yield response.content
        
        return StreamingResponse(
            iterfile(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_images.zip"}
        )
    
    except Exception as e:
        logger.exception("Error downloading batch images")
        raise HTTPException(status_code=500, detail=f"Failed to download images: {str(e)}")

# 7. Get Batch Images - Get a list of images in a batch
@router.get("/admin/batches/{batch_id}/images")
async def get_batch_images(
    batch_id: str,
    limit: int = Query(100, ge=1, le=1000),
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
):
    """
    Get a list of images in a batch for display in the UI.
    """
    try:
        logger.info(f"Getting images for batch {batch_id}")
        
        # Query for batch data in CosmosDB
        query = f"""
        SELECT c.images
        FROM c
        WHERE c.BatchID = '{batch_id}'
        """
        
        results = await cosmos_service.query_items(query=query)
        
        if not results:
            logger.warning(f"Batch {batch_id} not found")
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        
        # Extract images from the results
        batch_data = results[0]
        images = batch_data.get("images", [])
        
        # Apply limit
        images = images[:limit]
        
        # Generate SAS URLs for images if using blob storage
        for image in images:
            if not image.get("url"):
                # Construct URL - either direct URL or add a SAS token
                image["url"] = f"/api/admin/batches/{batch_id}/images/{image['file_name']}"
        
        logger.info(f"Retrieved {len(images)} images from batch {batch_id}")
        
        return images
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error getting batch images")
        raise HTTPException(status_code=500, detail=f"Failed to get images: {str(e)}")

# 8. Get individual image from a batch
@router.get("/admin/batches/{batch_id}/images/{image_name}")
async def get_batch_image(
    batch_id: str,
    image_name: str,
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    blob_service: BlobStorageService = Depends(get_blob_storage_service)
):
    """
    Get a specific image from a batch.
    """
    try:
        logger.info(f"Getting image {image_name} from batch {batch_id}")
        
        # Try to get the image from blob storage
        try:
            container_name = f"batch-{batch_id}"
            blob_content = await blob_service.download_blob(container_name, image_name)
            
            # Determine content type
            content_type = "image/jpeg"  # Default
            if image_name.lower().endswith(".png"):
                content_type = "image/png"
            elif image_name.lower().endswith(".gif"):
                content_type = "image/gif"
            elif image_name.lower().endswith(".webp"):
                content_type = "image/webp"
                
            # Return the image
            return Response(content=blob_content, media_type=content_type)
            
        except Exception as blob_error:
            logger.warning(f"Failed to get image from blob storage: {str(blob_error)}")
            
            # Try to proxy to Azure Function as fallback
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(f"{DOWNLOAD_IMAGES_URL}&batchId={batch_id}&imageName={image_name}")
                
            if response.status_code != 200:
                logger.error(f"Error getting image: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Failed to get image: {response.text}")
            
            # Determine content type from response
            content_type = response.headers.get("content-type", "image/jpeg")
            
            # Return the image
            return Response(content=response.content, media_type=content_type)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting image {image_name} from batch {batch_id}")
        raise HTTPException(status_code=500, detail=f"Failed to get image: {str(e)}")

# Cached version for instant response after first load
@router.get("/admin/batches/cached", response_model=List[BatchModel])
async def list_batches_cached(cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
    """
    Cached batch listing for instant response.
    First call takes normal time, subsequent calls are instant until cache expires.
    """
    import time
    
    # Simple in-memory cache (in production, use Redis or similar)
    cache_key = "batch_list_cache"
    cache_duration = 300  # 5 minutes
    
    # Check if we have cached data
    if hasattr(list_batches_cached, '_cache'):
        cache_data = getattr(list_batches_cached, '_cache')
        if time.time() - cache_data['timestamp'] < cache_duration:
            logger.info(f"Returning cached batch data ({len(cache_data['batches'])} batches)")
            return cache_data['batches']
    
    try:
        logger.info("Cache miss - fetching fresh batch data")
        
        # Use the optimized single-query approach
        optimized_query = """
        SELECT 
            c.BatchID,
            c._ts,
            c.info.date_created as date_created,
            c.info.description as description
        FROM c 
        WHERE c.BatchID != null
        """
        
        all_results = await cosmos_service.query_items(query=optimized_query)
        
        if not all_results:
            return []

        # Process results in memory
        batch_data = {}
        
        for record in all_results:
            batch_id = record.get("BatchID")
            if not batch_id:
                continue
                
            if batch_id not in batch_data:
                batch_data[batch_id] = {
                    "batch_id": batch_id,
                    "image_count": 0,
                    "latest_ts": 0,
                    "earliest_date_created": None,
                    "description": None
                }
            
            batch_data[batch_id]["image_count"] += 1
            
            ts = record.get("_ts", 0)
            if ts > batch_data[batch_id]["latest_ts"]:
                batch_data[batch_id]["latest_ts"] = ts
            
            date_created = record.get("date_created")
            if date_created and not batch_data[batch_id]["earliest_date_created"]:
                batch_data[batch_id]["earliest_date_created"] = date_created
            
            description = record.get("description")
            if description and not batch_data[batch_id]["description"]:
                batch_data[batch_id]["description"] = description
        
        # Convert to BatchModel objects
        batches = []
        current_time = datetime.now()
        
        for batch_id, data in batch_data.items():
            try:
                created_date = current_time
                if data["earliest_date_created"]:
                    try:
                        created_date = datetime.fromisoformat(data["earliest_date_created"])
                    except ValueError:
                        pass
                
                last_modified = current_time
                if data["latest_ts"] > 0:
                    try:
                        last_modified = datetime.fromtimestamp(data["latest_ts"])
                    except (ValueError, TypeError):
                        pass
                
                batch = BatchModel(
                    batch_id=batch_id,
                    created_date=created_date,
                    status="Available",
                    image_count=data["image_count"],
                    last_modified=last_modified,
                    description=data.get("description", "") or ""
                )
                batches.append(batch)
                
            except Exception as batch_error:
                logger.error(f"Error processing batch {batch_id}: {str(batch_error)}")
        
        # Sort and cache results
        batches.sort(key=lambda x: x.batch_id)
        
        # Store in cache
        setattr(list_batches_cached, '_cache', {
            'batches': batches,
            'timestamp': time.time()
        })
        
        logger.info(f"Cached {len(batches)} batches for future requests")
        return batches
        
    except Exception as e:
        logger.error(f"Error in cached batch listing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batches: {str(e)}")

# Cache invalidation endpoint
@router.post("/admin/batches/cache/invalidate")
async def invalidate_batch_cache():
    """
    Invalidate the batch cache to force fresh data on next request.
    """
    if hasattr(list_batches_cached, '_cache'):
        delattr(list_batches_cached, '_cache')
        logger.info("Batch cache invalidated")
        return {"message": "Cache invalidated successfully"}
    return {"message": "No cache to invalidate"}