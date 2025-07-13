from typing import List, Dict, Any, Optional
from collections import Counter

from ..services.cosmos_service import CosmosDbService, CosmosResourceNotFoundError
from ..models.statistics import (
    ImagesPerBatchStat,
    LabelStatusStat,
    LabelBreakdownStat,
    ReviewStat,
    UserComparisonStat,
    StatisticsResponse
)
from ..core.config import get_settings, Settings

import logging
logger = logging.getLogger(__name__)

class StatisticsService:      
    def __init__(self, cosmos_service: CosmosDbService, settings: Settings):
        self.cosmos_service = cosmos_service
        self.settings = settings
        
    async def get_all_statistics(self, batch_id: Optional[str] = None) -> Optional[StatisticsResponse]:
        try:
            # Ensure the cosmos service is initialized
            await self.cosmos_service.initialize()
            
            # Build the query with optional batch filter
            query = "SELECT * FROM c"
            parameters: List[Dict[str, Any]] = []
            if batch_id:
                query += " WHERE c.BatchID = @batch_id"
                parameters.append({"name": "@batch_id", "value": batch_id})
            
            # Execute the query with proper error handling
            try:
                all_items = await self.cosmos_service.query_items(
                    query=query, 
                    container_name=self.settings.COSMOS_CONTAINER,
                    parameters=parameters
                )
            except Exception as query_error:
                logger.error(f"Error querying items from cosmos: {query_error}", exc_info=True)
                return StatisticsResponse(
                    images_per_batch=[],
                    label_status=[],
                    label_breakdown=[],
                    review_stats=[],
                    user_comparisons=[]
                )

            if not all_items:
                logger.info(f"No items found for statistics generation (batch_id: {batch_id}).")
                return StatisticsResponse(
                    images_per_batch=[],
                    label_status=[],
                    label_breakdown=[],
                    review_stats=[],
                    user_comparisons=[] 
                )

            # 1. Images per Batch
            images_per_batch_counts = Counter()
            for item in all_items:
                current_batch_id = item.get("BatchID")
                if current_batch_id:
                    images_per_batch_counts[current_batch_id] += 1
            
            images_per_batch_stats = [
                ImagesPerBatchStat(batch_id=bid, count=cnt) for bid, cnt in images_per_batch_counts.items()
            ]

            # 2. Label Status
            label_status_counts = Counter()
            for item in all_items:
                status = item.get("Status", "Unknown")
                # Handle None status values explicitly
                if status is None:
                    status = "Unknown"
                label_status_counts[status] += 1
            
            label_status_stats = [
                LabelStatusStat(status=stat, count=cnt) for stat, cnt in label_status_counts.items() if stat is not None
            ]

            # 3. Label Breakdown (by category)
            label_breakdown_counts = Counter()
            for item in all_items:
                categories_in_item = item.get("categories", []) 
                annotations_in_item = item.get("annotations", [])
                
                if not isinstance(categories_in_item, list) or not isinstance(annotations_in_item, list):
                    continue

                category_id_to_name = {cat.get("id"): cat.get("name") 
                                       for cat in categories_in_item 
                                       if isinstance(cat, dict) and cat.get("id") and cat.get("name")}

                for ann in annotations_in_item:
                    if not isinstance(ann, dict):
                        continue
                    category_id = ann.get("category_id")
                    if category_id in category_id_to_name:
                        category_name = category_id_to_name[category_id]
                        label_breakdown_counts[category_name] += 1
            
            label_breakdown_stats = [
                LabelBreakdownStat(category=cat_name, count=cnt) for cat_name, cnt in label_breakdown_counts.items()
            ]

            # 4. Review Stats (derived from label_status_stats)
            review_stats_dict: Dict[str, int] = {"Accepted": 0, "Rejected": 0, "Pending": 0}
            for stat_item in label_status_stats:
                if stat_item.status == "Accepted":
                    review_stats_dict["Accepted"] += stat_item.count
                elif stat_item.status == "Rejected":
                    review_stats_dict["Rejected"] += stat_item.count
                elif stat_item.status == "Labelled": 
                    review_stats_dict["Pending"] += stat_item.count

            review_stats_list = [ReviewStat(status=k, count=v) for k,v in review_stats_dict.items()]

            # 5. User Comparisons (mocked)
            total_items_count = len(all_items)
            user_comparisons_stats: List[UserComparisonStat] = []
            if total_items_count > 0:
                user_comparisons_stats.append(UserComparisonStat(user="User1", count=total_items_count // 2 if total_items_count > 1 else total_items_count))
                if total_items_count >= 3:
                    user_comparisons_stats.append(UserComparisonStat(user="User2", count=total_items_count // 3))
                if total_items_count >= 6:
                     user_comparisons_stats.append(UserComparisonStat(user="User3", count=total_items_count // 6))
                if not user_comparisons_stats:
                    user_comparisons_stats.append(UserComparisonStat(user="User1", count=total_items_count))
            
            return StatisticsResponse(
                images_per_batch=images_per_batch_stats,
                label_status=label_status_stats,
                label_breakdown=label_breakdown_stats,
                review_stats=review_stats_list,
                user_comparisons=user_comparisons_stats
            )

        except CosmosResourceNotFoundError:
            logger.warning(f"CosmosDB container '{self.settings.COSMOS_CONTAINER}' not found during statistics generation.")
            return StatisticsResponse(images_per_batch=[], label_status=[], label_breakdown=[], review_stats=[], user_comparisons=[])
        except Exception as e:
            logger.error(f"Error generating statistics (batch_id: {batch_id}): {e}", exc_info=True)
            return None
