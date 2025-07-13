from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ModelBase(BaseModel):
    """Base model for AI model information"""
    ModelName: str = Field(..., description="Name of the model")
    AzureModelName: str = Field(..., description="Name of the model in Azure")
    Confidence: int = Field(..., description="Confidence threshold percentage (0-100)")
    ModelAccuracy: float = Field(..., description="Model accuracy percentage (0-100)")
    categoryNo: int = Field(..., description="Category number associated with the model")

class ModelInDB(ModelBase):
    """Model representation in the database"""
    id: str = Field(..., description="Unique identifier for the model")
    Organisation: str = Field(..., description="Organization that owns this model")
    CreatedDate: datetime = Field(default_factory=datetime.now, description="Date and time when the model was created")
    ModifiedDate: datetime = Field(default_factory=datetime.now, description="Date and time when the model was last modified")

class ModelUpsertRequest(ModelBase):
    """Request model for creating or updating a model"""
    id: Optional[str] = Field(None, description="Unique identifier for the model. If provided, updates existing model")
    Organisation: Optional[str] = Field("Default", description="Organization that owns this model")

class ModelResponse(ModelInDB):
    """Response model for model data"""
    pass
