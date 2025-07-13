\
# filepath: c:\\projects\\facadeai-studio\\app\\models\\coco.py
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid

class CocoInfoModel(BaseModel):
    description: Optional[str] = None
    date_created: Optional[str] = None # Keep as string to match C# and typical COCO format

class CocoImageModel(BaseModel):
    id: Union[int, str] # Image ID, referenced by annotations - can be int or string
    file_name: Optional[str] = Field(None, alias="file_name")
    width: Optional[int] = None
    height: Optional[int] = None

    class Config:
        populate_by_name = True

class CocoAnnotationModel(BaseModel):
    id: Optional[Union[str,int]] = None # Annotation ID, unique within the image's annotations list
    image_id: Union[int, str] = Field(alias="image_id") # References CocoImageModel.id - can be int or string
    category_id: int = Field(alias="category_id") # References CocoCategoryModel.id
    segmentation: Optional[List[List[float]]] = None
    area: Optional[float] = None
    bbox: Optional[List[float]] = None  # [x,y,width,height]
    iscrowd: Optional[int] = 0
    objectId: Optional[str] = None # From C# CocoAnnotation

    @validator('id', pre=True)
    def ensure_id(cls, v, values):
        """Ensure an id exists, generate one if missing"""
        if not v:
            return str(uuid.uuid4())
        return v

    class Config:
        populate_by_name = True

class CocoCategoryModel(BaseModel):
    id: int # Category ID
    name: Optional[str] = None
    supercategory: Optional[str] = None

class CocoAdminMetadataModel(BaseModel):
    Validation_User: Optional[str] = ""
    Validation_Date: Optional[str] = ""
    Validation_Action: Optional[str] = ""
    Notes: Optional[str] = ""

class CocoSensorDataModel(BaseModel):
    Timestamp_UTC: Optional[str] = Field(None, alias="Timestamp (UTC)")
    Fix_Type: Optional[int] = Field(None, alias="Fix Type")
    Fix_Status: Optional[str] = Field(None, alias="Fix Status")
    Latitude_deg: Optional[float] = Field(None, alias="Latitude (deg)")
    Longitude_deg: Optional[float] = Field(None, alias="Longitude (deg)")
    Altitude_meters: Optional[float] = Field(None, alias="Altitude (meters)")
    Altitude_Above_Sea_Level_meters: Optional[float] = Field(None, alias="Altitude Above Sea Level (meters)")
    Number_of_Satellites: Optional[int] = Field(None, alias="Number of Satellites")
    Ground_Speed_ms: Optional[float] = Field(None, alias="Ground Speed (m/s)")
    Heading_degrees: Optional[float] = Field(None, alias="Heading (degrees)")
    Horizontal_Accuracy_m: Optional[float] = Field(None, alias="Horizontal Accuracy (m)")
    Vertical_Accuracy_m: Optional[float] = Field(None, alias="Vertical Accuracy (m)")

    class Config:
        populate_by_name = True


class CocoModel(BaseModel):
    info: Optional[CocoInfoModel] = None
    images: List[CocoImageModel] = Field(default_factory=list)
    annotations: List[CocoAnnotationModel] = Field(default_factory=list)
    categories: List[CocoCategoryModel] = Field(default_factory=list)

    # Metadata fields often stored at the root of the CosmosDB document
    BatchID: Optional[str] = None
    ImageID: Optional[str] = None # This is the string identifier for the image, e.g., 'cam1_1742977845'
    id: Optional[str] = None # Document ID in CosmosDB, often same as ImageID or a UUID
    Status: Optional[str] = None
    admin_metadata: Optional[CocoAdminMetadataModel] = Field(default_factory=CocoAdminMetadataModel)
    Sensor: Optional[Union[CocoSensorDataModel, Dict[str, Any]]] = None # Allow dict for flexibility from C# object
    
    class Config:
        # This makes the model more tolerant of unexpected fields
        extra = "allow"

    # Cosmos DB system properties (optional, usually not part of request/response payload directly)
    _rid: Optional[str] = None
    _self: Optional[str] = None
    _etag: Optional[str] = None
    _attachments: Optional[str] = None
    _ts: Optional[int] = None

    class Config:
        populate_by_name = True

# For the GET request response
class AnnotationGetResponse(BaseModel):
    exists: bool
    coco: Optional[CocoModel] = None
    log: Optional[List[str]] = None
    source: Optional[str] = None # "cosmosdb" or "local"
    error: Optional[str] = None

# For the POST request body
class AnnotationSaveRequest(BaseModel):
    coco: CocoModel
    log: Optional[List[str]] = None

# For the POST request response
class AnnotationSaveResponse(BaseModel):
    message: str
    cosmosDBSaved: bool
    cosmosDBError: Optional[str] = None

