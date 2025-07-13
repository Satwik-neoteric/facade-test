# filepath: c:\\projects\\facadeai-studio\\app\\models\\category.py
from pydantic import BaseModel, Field
from typing import Optional

class CategoryModel(BaseModel):
    id: str = Field(..., description="The unique identifier for the category.")
    name: str = Field(..., description="The name of the category.")
    supercategory: Optional[str] = Field(None, description="The supercategory this category belongs to.")
    color: Optional[str] = Field(None, description="The color associated with the category.")
    solidColor: Optional[str] = Field(None, description="The solid color associated with the category.")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "1",
                "name": "Short-Gasket",
                "supercategory": "Facade",
                "color": "rgba(108,52,131,0.5)",
                "solidColor": "rgb(108,52,131)"
            }
        }
