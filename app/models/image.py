# filepath: c:\projects\facadeai-studio\app\models\image.py
from pydantic import BaseModel, Field # Added Field
from typing import Optional, Dict, Any, List

class ImageInfo(BaseModel):
    """
    Model for basic image information in batches.
    Used for batch management and image listings.
    """
    file_name: str
    height: int
    width: int
    id: str
    url: Optional[str] = None
    format: Optional[str] = None
    filesize: Optional[int] = None

class ImageMetadataResponse(BaseModel):
    filename: str
    filesize: str # e.g., "123.4 KB"
    modified: str # e.g., "yyyy-MM-dd HH:mm:ss"
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None
    date_taken: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    exposure: Optional[str] = None
    f_number: Optional[str] = None
    iso: Optional[str] = None
    blob_metadata: Optional[Dict[str, Any]] = None
    image_error: Optional[str] = None # For errors during image processing (e.g. loading dimensions)
    exif_error: Optional[str] = None # For errors during EXIF extraction

class FilterCriteria(BaseModel):
    batch_id: str = Field(..., alias='batchId') # Added alias
    hasAnnotations: Optional[bool] = None # C# default seems to be true if not for the special 'false' case
    showDeleted: Optional[bool] = False
    unlabelledOnly: Optional[bool] = False
    status: Optional[List[str]] = None
    classes: Optional[List[str]] = None
    nameWildcard: Optional[str] = None

    class Config:
        populate_by_name = True # Allow population by alias
        # If you still want to use field names (batch_id) in Python and alias (batchId) in JSON:
        # by_alias = True # This is for serialization, populate_by_name is for deserialization
        # allow_population_by_field_name = True # Pydantic v2, use populate_by_name
