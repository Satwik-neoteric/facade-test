from fastapi import APIRouter
from app.api.endpoints import models

router = APIRouter()

# Include the models endpoints
router.include_router(models.router, prefix="/inference", tags=["models"])
