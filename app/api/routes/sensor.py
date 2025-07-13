from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Dict, Any
import logging

from app.services.cosmos_service import CosmosDbService
from app.core.dependencies import get_cosmos_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{filename}")
async def get_sensor_data(
    filename: str = Path(..., description="The filename (not directly used in this endpoint but part of the original path)."),
    batch_id: str = Query(..., description="The batch ID to retrieve."),
    image_id: str = Query(..., description="The image ID to retrieve."),
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Returns sensor metadata for a specific image from Cosmos DB.
    """
    if not batch_id or not image_id:
        raise HTTPException(status_code=400, detail="batch_id and image_id parameters are required")

    try:
        # In the Python version, get_batch_image retrieves the specific COCO record
        coco_data = await cosmos_service.get_batch_image(batch_id, image_id)

        if coco_data:
            if isinstance(coco_data, dict) and "Sensor" in coco_data:
                logger.info(f"Found Sensor data in the COCO record for batch {batch_id}, image {image_id}")
                sensor_data = coco_data["Sensor"]
                return {
                    "sensor": sensor_data,
                    "source": "cosmos"
                }
            else:
                logger.warning(f"Sensor property not found in COCO record for batch {batch_id}, image {image_id}. Data: {coco_data}")
        
        logger.info(f"No sensor data found for batch {batch_id}, image {image_id}")
        return {
            "sensor": {},
            "message": "No sensor data found",
            "source": "none"
        }
    except HTTPException:
        raise # Re-raise HTTPException to ensure FastAPI handles it
    except Exception as e:
        logger.error(f"Error getting sensor data for batch {batch_id}, image {image_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not get sensor data: {str(e)}")

