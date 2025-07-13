from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

class BatchModel(BaseModel):
    batch_id: str
    created_date: datetime
    status: str
    image_count: int
    last_modified: datetime
    description: Optional[str] = None

class BatchCreate(BaseModel):
    batch_id: str
    description: Optional[str] = None
    categories: Optional[List[str]] = None

class JobParameters(BaseModel):
    model: str
    parameters: Optional[Dict[str, Any]] = None
