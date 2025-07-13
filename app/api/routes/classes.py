from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict
import logging

from app.models.category import CategoryModel
from app.services.category_service import CategoryService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get(
    "/classes",
    response_model=Dict[str, List[CategoryModel]],
    summary="Get all available classes/categories",
    description="Retrieves a list of all classes (categories) from the database, or a default set if none are found."
)
@router.get(
    "/classes/",
    response_model=Dict[str, List[CategoryModel]],
    summary="Get all available classes/categories",
    description="Retrieves a list of all classes (categories) from the database, or a default set if none are found."
)
async def get_all_classes(category_service: CategoryService = Depends()):
    """
    Endpoint to retrieve all available classes/categories.
    Corresponds to `GET /api/Classes` in the C# controller.
    """
    try:
        logger.info("GET /api/classes called")
        categories = await category_service.get_categories_async()
        # Return as {"classes": [...]} for frontend compatibility
        return {"classes": categories}
    except Exception as e:
        logger.error(f"Error in GET /api/classes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
