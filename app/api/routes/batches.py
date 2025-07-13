from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.cosmos_service import CosmosDbService
from app.core.dependencies import get_cosmos_service
from app.models.batch import BatchModel, BatchInfoModel, BatchListResponse
from typing import List, Optional
from app.core.config import Settings
import logging

router = APIRouter()
settings = Settings()
logger = logging.getLogger(__name__)

@router.get("/batches", response_model=BatchListResponse, summary="Get all batches")
@router.get("/batches/", response_model=BatchListResponse, summary="Get all batches (root path)")
async def get_all_batches(
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    limit: int = Query(default=1000, ge=1, le=2000) # A more reasonable limit for a dropdown
):
    """
    Retrieve a unique list of BatchIDs from Cosmos DB.
    """
    try:
        logger.info("Attempting to fetch unique batches.")
        
        # This is the key change: Use DISTINCT to get unique BatchIDs directly from the DB.
        # Note: We are not applying the LIMIT in the DB query here. See explanation below.
        query = "SELECT DISTINCT c.BatchID FROM c ORDER BY c.BatchID"

        query_results = await cosmos_service.query_items(query=query)
        
        if not query_results:
            logger.warning("No batches found in CosmosDB.")
            return BatchListResponse(batches=[], source="cosmos_empty")

        # The result is a list of objects: [{'BatchID': 'A'}, {'BatchID': 'B'}, ...]
        # Convert it to a simple list of strings.
        unique_batch_ids = [item.get("BatchID") for item in query_results if item.get("BatchID")]
        
        logger.info(f"Successfully fetched {len(unique_batch_ids)} total unique batches from DB.")

        # Apply the limit AFTER getting all unique batches.
        final_batches = unique_batch_ids[:limit]
        
        return BatchListResponse(batches=final_batches, source="cosmos_distinct")

    except Exception as e:
        logger.error(f"Error fetching unique batches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch unique batches: {str(e)}")


@router.get("/list", response_model=BatchListResponse, summary="Get all batch IDs as a list of strings")
async def get_all_batch_ids(
    cosmos_service: CosmosDbService = Depends(get_cosmos_service),
    limit: int = Query(default=100, ge=1, le=1000)
):
    """
    Retrieve all unique BatchIDs from Cosmos DB.
    """
    try:
        logger.info(f"Attempting to fetch all batch IDs with limit: {limit}")        # Query to get distinct BatchIDs
        query = f"SELECT DISTINCT VALUE c.BatchID FROM c ORDER BY c.BatchID OFFSET 0 LIMIT {limit}"
        batch_ids = await cosmos_service.query_items_no_model(query=query)
        
        if not batch_ids:
            logger.warning("No batch IDs found in CosmosDB.")
            return BatchListResponse(batches=[], source="cosmos_empty")
            
        logger.info(f"Successfully fetched {len(batch_ids)} batch IDs.")
        return BatchListResponse(batches=batch_ids, source="cosmos")
    except Exception as e:
        logger.error(f"Error fetching batch IDs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch IDs: {str(e)}")

@router.get("/batch/{batch_id}", response_model=BatchModel, summary="Get a specific batch by ID")
async def get_batch_by_id(
    batch_id: str, 
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Retrieve a specific batch by its BatchID.
    """
    try:
        logger.info(f"Attempting to fetch batch with BatchID: {batch_id}")        # Query to find the item where BatchID matches.
        # Note: If BatchID is not the 'id' of the document, this query might be inefficient without proper indexing.
        # If 'id' field in CosmosDB is actually the BatchID, then use read_item.
        # Assuming 'BatchID' is a queryable field.
        query = f"SELECT * FROM c WHERE c.BatchID = '{batch_id}'"
        items = await cosmos_service.query_items(query=query)
        
        if not items:
            logger.warning(f"Batch with BatchID '{batch_id}' not found.")
            raise HTTPException(status_code=404, detail=f"Batch with BatchID '{batch_id}' not found")
        
        # Assuming the query returns at most one item or the first one is the desired one.
        batch_data = items[0]
        logger.info(f"Successfully fetched batch with BatchID: {batch_id}")
        return BatchModel(**batch_data)
    except HTTPException:
        raise # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        logger.error(f"Error fetching batch {batch_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch {batch_id}: {str(e)}")

# Keep the test endpoint for now, can be removed later
@router.get("/test", summary="Test endpoint for batches router")
async def test_batch_endpoint():
    logger.info("Batches router test endpoint was called.")
    return {"message": "Batches router test endpoint is working!"}
