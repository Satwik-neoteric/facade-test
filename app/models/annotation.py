from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class AnnotationBase(BaseModel):
    id: int
    image_id: Union[int, str] = Field(alias="image_id") # Corresponds to CocoImage.id - can be int or string
    category_id: int = Field(alias="category_id") # Corresponds to CocoCategory.id
    segmentation: Optional[List[List[float]]] = None
    area: Optional[float] = None
    bbox: Optional[List[float]] = None # [x,y,width,height]
    iscrowd: Optional[int] = 0
    objectId: Optional[str] = None # Added from C# CocoAnnotation model
    
    class Config:
        populate_by_name = True

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(AnnotationBase):
    pass

class AnnotationDelete(BaseModel):
    id: int
    batch_id: str
    image_id: str
