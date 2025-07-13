from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import List, Optional
import logging
from datetime import datetime

# Define a minimal response model
class BatchItem:
    def __init__(self, id: str, batch_id: str):
        self.id = id
        self.batch_id = batch_id

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/batches/offline")
@router.get("/batches/offline/")
async def get_batches_offline(response: Response):
    """
    Emergency fallback endpoint that returns mock batch data when the main API is unavailable.
    """
    logger.info("Using offline batch data")
    
    # Add a header to indicate this is mock data
    response.headers["X-Data-Source"] = "mock-fallback"
    
    # Return a minimal response with mock data
    return {
        "batches": ["B1", "B2", "Sample"],
        "source": "mock-fallback",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/statistics/offline")
@router.get("/statistics/offline/")
async def get_statistics_offline(response: Response, batch_id: Optional[str] = None):
    """
    Emergency fallback endpoint that returns mock statistics data when the main API is unavailable.
    """
    logger.info(f"Using offline statistics data (batch_id: {batch_id})")
    
    # Add a header to indicate this is mock data
    response.headers["X-Data-Source"] = "mock-fallback"
    
    # Return mock statistics data that matches the structure expected by the frontend
    return {
        "images_per_batch": [
            {"batch_id": "B1", "count": 10},
            {"batch_id": "B2", "count": 15},
            {"batch_id": "Sample", "count": 5}
        ],
        "label_status": [
            {"status": "Unlabelled", "count": 20},
            {"status": "Labelled", "count": 8},
            {"status": "Accepted", "count": 2}
        ],
        "label_breakdown": [
            {"category": "Window", "count": 5},
            {"category": "Door", "count": 3},
            {"category": "Balcony", "count": 2}
        ],
        "review_stats": [
            {"status": "Accepted", "count": 2},
            {"status": "Rejected", "count": 0},
            {"status": "Pending", "count": 8}
        ],
        "user_comparisons": [
            {"user": "User1", "count": 15},
            {"user": "User2", "count": 10},
            {"user": "User3", "count": 5}
        ],
        "source": "mock-fallback",
        "timestamp": datetime.now().isoformat()
    }
