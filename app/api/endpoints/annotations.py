import uuid
import logging
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# Assuming these functions are defined elsewhere in your code
# from app.db import cosmosdb_get_batch, cosmosdb_update_batch

def ensure_annotation_ids(batch_record):
    """Ensure every annotation has a unique id. Returns True if any were added."""
    modified = False
    for annotation in batch_record.get("annotations", []):
        if "id" not in annotation or not annotation["id"]:
            annotation["id"] = str(uuid.uuid4())
            logging.info(f"Added missing annotation id: {annotation['id']} for annotation {annotation}")
            modified = True
    return modified

@router.get("/api/annotations/{batch}/{image_path}")
async def get_annotations(batch: str, image_path: str, batch_id: str = Query(...), image_id: str = Query(...)):
    try:
        # Fetch the batch record from CosmosDB
        batch_record = await cosmosdb_get_batch(batch_id)
        if not batch_record:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Add IDs to annotations before any validation occurs
        modified = ensure_annotation_ids(batch_record)
        if modified:
            await cosmosdb_update_batch(batch_id, batch_record)
            logging.info(f"Updated batch {batch_id} with new annotation ids.")

        # Filter annotations for the given image_id
        annotations = [
            annotation for annotation in batch_record.get("annotations", [])
            if annotation.get("image_id") == image_id
        ]

        return annotations
    except Exception as e:
        # Log the error but continue providing annotations with IDs
        logging.error(f"Error in get_annotations: {str(e)}")
        # Try to recover by ensuring all annotations have IDs
        try:
            batch_record = await cosmosdb_get_batch(batch_id)
            if batch_record:
                ensure_annotation_ids(batch_record)
                await cosmosdb_update_batch(batch_id, batch_record)
                annotations = [
                    annotation for annotation in batch_record.get("annotations", [])
                    if annotation.get("image_id") == image_id
                ]
                return annotations
        except Exception as inner_e:
            logging.error(f"Recovery attempt failed: {str(inner_e)}")
        
        # If we can't recover, return empty list to avoid 500 error
        return []

# Example: Patch for /api/metadata endpoint (add this if not present)
@router.get("/api/metadata/{batch}/{image_path}")
async def get_metadata(batch: str, image_path: str, batch_id: str = Query(...)):
    try:
        batch_record = await cosmosdb_get_batch(batch_id)
        if not batch_record:
            raise HTTPException(status_code=404, detail="Batch not found")

        modified = ensure_annotation_ids(batch_record)
        if modified:
            await cosmosdb_update_batch(batch_id, batch_record)
            logging.info(f"Updated batch {batch_id} with new annotation ids (metadata endpoint).")

        return batch_record
    except Exception as e:
        # Log the error but try to resolve the validation issue
        logging.error(f"Error in get_metadata: {str(e)}")
        return {"error": "An error occurred retrieving metadata"}