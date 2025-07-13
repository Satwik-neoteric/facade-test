import asyncio
import json
from pathlib import Path

from app.services.category_service import CategoryService
from app.models.category import CategoryModel

async def update_categories():
    config_path = Path("app/config/class_config.json")
    with config_path.open() as f:
        class_config = json.load(f)

    categories = [
        CategoryModel(
            id=str(index + 1),
            name=cls["name"],
            supercategory=None
        )
        for index, cls in enumerate(class_config["classes"])
    ]

    category_service = CategoryService()
    await category_service.upsert_categories_async(categories)

if __name__ == "__main__":
    asyncio.run(update_categories())
