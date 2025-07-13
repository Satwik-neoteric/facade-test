import logging
from typing import Optional, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, Query

from ...models.statistics import StatisticsResponse
from ...services.statistics_service_fixed import StatisticsService
from ...services.cosmos_service import CosmosDbService
from ...core.config import get_settings, Settings
from ...core.dependencies import get_cosmos_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependency for StatisticsService
def get_statistics_service(
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    settings: Settings = Depends(get_settings)
) -> StatisticsService:
    return StatisticsService(cosmos_service=cosmos_service, settings=settings)

@router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(
    batch_id: Optional[str] = None,
    stats_service: StatisticsService = Depends(get_statistics_service),
    response: Response = None
):
    """
    Get statistics for the dashboard. Can filter by batch_id.
    Returns:
    - Statistics for all batches if no batch_id is provided
    - Statistics for a specific batch if batch_id is provided
    - Empty statistics (lists) if no data is found
    """
    try:
        logger.info(f"Statistics request received, batch_id: {batch_id}")
        statistics = await stats_service.get_all_statistics(batch_id=batch_id)
        
        # Handle the case where no data was found
        if not statistics.images_per_batch and not statistics.label_status:
            logger.info(f"No statistics data found for request (batch_id: {batch_id})")
            # We'll return an empty response with a 200 status to make frontend more resilient
            # But set a warning header
            if response:
                response.headers["X-Warning"] = "No data found"
        
        return statistics
    except Exception as e:
        logger.error(f"Error processing statistics request: {e}", exc_info=True)
        # Return empty stats with 200 status to avoid breaking the frontend
        return StatisticsResponse(
            images_per_batch=[],
            label_status=[],
            label_breakdown=[],
            review_stats=[],
            user_comparisons=[]
        )
