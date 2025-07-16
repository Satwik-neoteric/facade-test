import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from ...models.statistics import StatisticsResponse
from ...services.statistics_service import StatisticsService
from ...services.cosmos_service import CosmosDbService # For dependency injection
from ...core.config import get_settings, Settings # For dependency injection
from ...core.dependencies import get_cosmos_service # Standardized dependency getter

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependency for StatisticsService
def get_statistics_service(
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    settings: Settings = Depends(get_settings)
) -> StatisticsService:
    return StatisticsService(cosmos_service=cosmos_service, settings=settings)

@router.get("/statistics/images", summary="Get total images count for dashboard")
async def get_images_statistics(
    batch_id: Optional[str] = None,
    stats_service: StatisticsService = Depends(get_statistics_service)
):
    """
    Get total images count across all batches or for a specific batch.
    Returns a simple count for dashboard display.
    """
    try:
        statistics = await stats_service.get_all_statistics(batch_id=batch_id)
        if statistics is None:
            raise HTTPException(status_code=500, detail="Error retrieving statistics.")
        
        # Calculate total images from images_per_batch
        total_images = sum(batch.count for batch in statistics.images_per_batch)
        
        return {"total_images": total_images}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /statistics/images endpoint (batch_id: {batch_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving image statistics.")

@router.get("/statistics", response_model=StatisticsResponse, summary="Get various statistics for dashboard")
@router.get("/statistics/", response_model=StatisticsResponse, summary="Get various statistics for dashboard (root path)")
async def get_statistics(
    batch_id: Optional[str] = None, # Changed from batchId to batch_id
    stats_service: StatisticsService = Depends(get_statistics_service)
):
    """
    Retrieve statistics for all batches or a specific batch if batch_id is provided.
    This includes:
    - Images per batch
    - Label status counts (e.g., Labelled, Reviewed, Accepted)
    - Label breakdown by category
    - Review statistics (Accepted, Rejected, Pending)
    - User comparison statistics (mocked data)
    """
    try:
        statistics = await stats_service.get_all_statistics(batch_id=batch_id)
        if statistics is None:
            # This case might occur if there was a fundamental error in service, not just no data
            # If no data, service returns an empty StatisticsResponse
            raise HTTPException(status_code=500, detail="Error retrieving statistics.")
        
        # If batch_id was provided and no items were found for that batch,
        # the service returns an empty StatisticsResponse. 
        # The C# controller returns NotFound("No batches found.") if cocoItems is empty initially.
        # If batch_id is specified and filters result in no items, C# would still process empty list.
        # Here, if images_per_batch is empty AND a batch_id was specified, it implies that batch didn't exist or had no items.
        if batch_id and not statistics.images_per_batch:
             raise HTTPException(status_code=404, detail=f"No data found for batch ID '{batch_id}'.")
        
        # If no batch_id and no data at all
        if not batch_id and not statistics.images_per_batch and not statistics.label_status:
            # This mirrors the C# "No batches found" if the initial fetch is empty.
            raise HTTPException(status_code=404, detail="No statistics data found.")
            
        return statistics
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Error in /statistics endpoint (batch_id: {batch_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving statistics.")
