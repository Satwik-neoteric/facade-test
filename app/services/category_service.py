# filepath: c:\\projects\\facadeai-studio\\app\\services\\category_service.py
import logging
from typing import List, Optional
from fastapi import Depends

from app.models.category import CategoryModel
from pathlib import Path
from app.services.cosmos_service import CosmosDbService # Changed from CosmosService
from app.core.config import get_settings
import json
import os

logger = logging.getLogger(__name__)
settings = get_settings()

class CategoryService:
    from app.core.dependencies import get_cosmos_service
    def __init__(self, cosmos_service: CosmosDbService = Depends(get_cosmos_service)):
        self.cosmos_service = cosmos_service
        self.batches_container_name = settings.COSMOS_CONTAINER
        
    async def get_categories_async(self) -> List[CategoryModel]:
        """Fetch all categories/classes from JSON config."""
        try:
            # Update the path resolution logic to ensure compatibility with deployment structure
            config_path = Path(settings.BASE_DIR) / "config" / "class_config.json"
            if not config_path.exists():
                logger.warning(f"Config file not found at {config_path}. Returning empty categories list.")
                return []
            with config_path.open("r") as f:
                config_data = json.load(f)
                return [CategoryModel(**cls) for cls in config_data.get("classes", [])]
        except Exception as e:
            logger.error(f"Error fetching categories from JSON: {str(e)}", exc_info=True)
            return []
    
    async def upsert_categories_async(self, categories: List[CategoryModel]) -> None:
        """Insert or update categories in the database."""
        try:
            for category in categories:
                # Upsert logic for Cosmos DB
                await self.cosmos_service.upsert_item(
                    container_name=self.batches_container_name,
                    item={
                        "id": category.id,
                        "name": category.name,
                        "supercategory": category.supercategory
                    }
                )
            logger.info("Successfully upserted categories into the database.")
        except Exception as e:
            logger.error(f"Error upserting categories: {str(e)}", exc_info=True)
            raise