
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
import logging

from app.services.cosmos_service import CosmosService
from app.services.statistics_service import StatisticsService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/stats")
async def get_dashboard_stats(
    batch_id: Optional[str] = Query(None, description="Optional batch ID filter"),
    statistics_service: StatisticsService = Depends()
):
    """
    Get statistics for the dashboard.
    
    Args:
        batch_id: Optional batch ID filter
        
    Returns:
        Dict[str, Any]: Dashboard statistics
    """
    try:
        stats = await statistics_service.get_dashboard_stats(batch_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard statistics")

@router.get("/images-per-batch")
async def get_images_per_batch(
    statistics_service: StatisticsService = Depends()
):
    """
    Get number of images per batch.
    
    Returns:
        Dict[str, Any]: Images per batch statistics
    """
    try:
        stats = await statistics_service.get_images_per_batch()
        return stats
    except Exception as e:
        logger.error(f"Error getting images per batch: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve images per batch statistics")

@router.get("/labels-per-batch")
async def get_labels_per_batch(
    batch_id: Optional[str] = Query(None, description="Optional batch ID filter"),
    statistics_service: StatisticsService = Depends()
):
    """
    Get label statistics per batch.
    
    Args:
        batch_id: Optional batch ID filter
        
    Returns:
        Dict[str, Any]: Labels per batch statistics
    """
    try:
        stats = await statistics_service.get_labels_per_batch(batch_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting labels per batch: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve labels per batch statistics")

@router.get("/user-activity")
async def get_user_activity(
    batch_id: Optional[str] = Query(None, description="Optional batch ID filter"),
    statistics_service: StatisticsService = Depends()
):
    """
    Get user activity statistics.
    
    Args:
        batch_id: Optional batch ID filter
        
    Returns:
        Dict[str, Any]: User activity statistics
    """
    try:
        stats = await statistics_service.get_user_activity(batch_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting user activity: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user activity statistics")

@router.get("/review-status")
async def get_review_status(
    batch_id: Optional[str] = Query(None, description="Optional batch ID filter"),
    statistics_service: StatisticsService = Depends()
):
    """
    Get review status statistics.
    
    Args:
        batch_id: Optional batch ID filter
        
    Returns:
        Dict[str, Any]: Review status statistics
    """
    try:
        stats = await statistics_service.get_review_status(batch_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting review status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve review status statistics")
