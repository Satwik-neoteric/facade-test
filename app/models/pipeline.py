# app/models/pipeline.py
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid

# Base class with common fields.
# Uses snake_case for Python attributes and 'alias' for camelCase in JSON.
class PipelineBase(BaseModel):
    name: str
    version: str  # Consider if this should be int or a specific string format
    aml_id: str = Field(alias="amlId")

    class Config:
        populate_by_name = True# Allows initializing with amlId='value' or aml_id='value'
        # orm_mode = True # Not needed if not directly mapping from SQLAlchemy ORM objects

# Model for the client's request body when creating/updating a pipeline
class PipelineUpsertRequest(PipelineBase):
    id: Optional[str] = None  # Client can provide 'id' for updates or specific-ID creates.
                              # If None for a new pipeline, service will generate it.

# Model representing the pipeline document as stored in Cosmos DB and returned by the API
class PipelineInDB(PipelineBase):
    id: str # 'id' is mandatory in Cosmos DB and for our representation

    # You could add Cosmos DB system fields if needed for responses, e.g.:
    # _etag: Optional[str] = Field(default=None, alias="_etag") # Note: Pydantic v1 alias for fields starting with _ might need care