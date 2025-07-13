from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class AdminMetadata(BaseModel):
    validation_user: str = Field(default="", alias="Validation_User")
    validation_date: str = Field(default="", alias="Validation_Date")
    validation_action: str = Field(default="", alias="Validation_Action")
    notes: str = Field(default="", alias="Notes")
    
    class Config:
        populate_by_name = True

class SensorData(BaseModel):
    timestamp_utc: Optional[str] = Field(alias="Timestamp (UTC)", default=None)
    fix_type: Optional[int] = Field(alias="Fix Type", default=None)
    fix_status: Optional[str] = Field(alias="Fix Status", default=None)
    latitude: Optional[float] = Field(alias="Latitude (deg)", default=None)
    longitude: Optional[float] = Field(alias="Longitude (deg)", default=None)
    altitude: Optional[float] = Field(alias="Altitude (meters)", default=None)
    altitude_sea_level: Optional[float] = Field(alias="Altitude Above Sea Level (meters)", default=None)
    satellites: Optional[int] = Field(alias="Number of Satellites", default=None)
    ground_speed: Optional[float] = Field(alias="Ground Speed (m/s)", default=None)
    heading: Optional[float] = Field(alias="Heading (degrees)", default=None)
    horizontal_accuracy: Optional[float] = Field(alias="Horizontal Accuracy (m)", default=None)
    vertical_accuracy: Optional[float] = Field(alias="Vertical Accuracy (m)", default=None)
    
    class Config:
        populate_by_name = True

class ImageInfo(BaseModel):
    file_name: str
    height: int
    width: int
    id: str  # Changed from int to str

class InfoData(BaseModel):
    date_created: str
    description: str

class CategoryData(BaseModel):
    id: int
    name: str
    supercategory: Optional[str] = None

class AnnotationData(BaseModel):
    id: int  # This is the annotation's own ID, likely an integer.
    image_id: str = Field(alias="image_id")  # Changed from int to str
    category_id: int = Field(alias="category_id")
    segmentation: Optional[List[List[float]]] = None
    area: Optional[float] = None
    bbox: Optional[List[float]] = None
    iscrowd: Optional[int] = 0
    
    class Config:
        populate_by_name = True

class BatchModel(BaseModel):
    id: str
    batch_id: str = Field(alias="BatchID")
    image_id: str = Field(alias="ImageID")
    annotations: List[AnnotationData] = []
    categories: List[CategoryData] = []
    images: List[ImageInfo] = []
    info: InfoData
    admin_metadata: AdminMetadata = Field(default_factory=AdminMetadata)
    sensor: Optional[SensorData] = Field(alias="Sensor", default=None)
    
    # CosmosDB metadata fields (these will be ignored in responses)
    _rid: Optional[str] = None
    _self: Optional[str] = None
    _etag: Optional[str] = None
    _attachments: Optional[str] = None
    _ts: Optional[int] = None
    
    class Config:
        populate_by_name = True

class BatchInfoModel(BaseModel):
    id: str
    batch_id: str = Field(alias="BatchID")
    image_id: str = Field(alias="ImageID")
    
    class Config:
        populate_by_name = True

class BatchListResponse(BaseModel):
    batches: List[str]
    source: str = "cosmos"
