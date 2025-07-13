from fastapi import APIRouter
from app.api.endpoints.debug_cosmos import router as debug_cosmos_router

# Create a parent router for combining endpoints
router = APIRouter(prefix="/cosmos", tags=["debug_cosmos"])

# Include the endpoint routes
router.include_router(debug_cosmos_router)
