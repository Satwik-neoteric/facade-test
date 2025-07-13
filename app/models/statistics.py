from pydantic import BaseModel
from typing import List, Optional, Any

class ImagesPerBatchStat(BaseModel):
    batch_id: Optional[str] # Changed from batchId to batch_id for Pythonic convention
    count: int

class LabelStatusStat(BaseModel):
    status: str
    count: int

class LabelBreakdownStat(BaseModel):
    category: str
    count: int

class ReviewStat(BaseModel):
    status: str
    count: int

class UserComparisonStat(BaseModel):
    user: str
    count: int

class StatisticsResponse(BaseModel):
    images_per_batch: List[ImagesPerBatchStat]
    label_status: List[LabelStatusStat]
    label_breakdown: List[LabelBreakdownStat]
    review_stats: List[ReviewStat] # Changed from reviewStats
    user_comparisons: List[UserComparisonStat] # Changed from userComparisons
