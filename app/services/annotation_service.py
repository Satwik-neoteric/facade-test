from typing import List, Dict, Any, Optional
import logging
from fastapi import Depends, HTTPException
from datetime import datetime
import json
import os
from pathlib import Path

from app.models.annotation import AnnotationCreate, AnnotationUpdate
from app.models.coco import CocoModel, AnnotationGetResponse, AnnotationSaveRequest, AnnotationSaveResponse, CocoAdminMetadataModel
from app.services.cosmos_service import CosmosDbService
from app.core.dependencies import get_cosmos_service
from app.core.config import settings

logger = logging.getLogger(__name__)

class AnnotationService:
    def __init__(
        self,
        cosmos_service: CosmosDbService = Depends(get_cosmos_service)
    ):
        self.cosmos_service = cosmos_service
        self.base_dir = settings.BASE_DIR

    async def get_annotations_document(
        self, filename: str, batch_id: Optional[str], image_id: Optional[str]
    ) -> AnnotationGetResponse:
        sanitized_image_id = Path(image_id).name if image_id else None
        logger.info(f"Looking for annotations of '{filename}' with batch_id='{batch_id}', image_id='{sanitized_image_id}'")

        print("inside AnnotationService.get_annotations_document")

        # Try to get from CosmosDB first
        if batch_id and sanitized_image_id:
            print("inside if batch_id and sanitized_image_id")
            try:
                logger.info(f"Querying CosmosDB with batch_id='{batch_id}', image_id='{sanitized_image_id}'")
                item_dict = await self.cosmos_service.get_batch_image(batch_id, sanitized_image_id)  
                print(f"item_dict: {item_dict}")
                    # Keep the ID as is, since we've updated models to accept string IDs
                def extract_id(val):
                    return val

                if item_dict:
                    print("inside if item_dict")
                    logger.info(f"Found record in CosmosDB for batch_id='{batch_id}', image_id='{sanitized_image_id}'")                    # We'll keep original IDs since our models now support string IDs
                    if 'images' in item_dict and isinstance(item_dict['images'], list):
                        for img in item_dict['images']:
                            if 'id' in img:
                                img['id'] = extract_id(img['id'])
                    if 'annotations' in item_dict and isinstance(item_dict['annotations'], list):
                        for ann in item_dict['annotations']:
                            if 'image_id' in ann:
                                ann['image_id'] = extract_id(ann['image_id'])
                    try:
                        print("inside try")
                        coco_model = CocoModel(**item_dict)
                        print("inside try after coco_model", coco_model)
                        return AnnotationGetResponse(exists=True, coco=coco_model, source="cosmosdb")
                    except Exception as validation_err:
                        print("inside except")
                        logger.error(f"Validation error for CosmosDB record: {str(validation_err)}")
                        return AnnotationGetResponse(
                            exists=False, 
                            error=f"Data validation error: {str(validation_err)}", 
                            source="cosmosdb"
                        )
                else:
                    logger.info(f"No record found in CosmosDB for batch_id='{batch_id}', image_id='{sanitized_image_id}'")
            except Exception as e:
                logger.error(f"Error querying CosmosDB: {str(e)}")
                # Fall through to check local annotations

        # If not found in CosmosDB or query failed/skipped, check local annotations
        local_annotation_file_path = Path(self.base_dir) / "Annotations" / f"{filename}.coco"
        logger.info(f"Checking local annotation file: {local_annotation_file_path}")

        if local_annotation_file_path.exists():
            try:
                coco_json_content = local_annotation_file_path.read_text()
                coco_data = json.loads(coco_json_content)

                def extract_int_from_id(val):
                    if isinstance(val, int):
                        return val
                    if isinstance(val, str):
                        import re
                        m = re.search(r'(\d+)$', val)
                        if m:
                            return int(m.group(1))
                    return None

                # Preprocess images[].id and annotations[].image_id
                if 'images' in coco_data and isinstance(coco_data['images'], list):
                    for img in coco_data['images']:
                        if 'id' in img:
                            img['id'] = extract_int_from_id(img['id'])
                if 'annotations' in coco_data and isinstance(coco_data['annotations'], list):
                    for ann in coco_data['annotations']:
                        if 'image_id' in ann:
                            ann['image_id'] = extract_int_from_id(ann['image_id'])
                try:
                    coco_model = CocoModel(**coco_data)
                    # Check for log file as well
                    log_file_path = Path(self.base_dir) / "Annotations" / f"{filename}.log"
                    log_lines = []
                    if log_file_path.exists():
                        try:
                            log_lines = log_file_path.read_text().splitlines()
                        except Exception as log_err:
                            logger.error(f"Error reading log file: {str(log_err)}")
                    
                    return AnnotationGetResponse(exists=True, coco=coco_model, log=log_lines, source="local")
                except Exception as validation_err:
                    logger.error(f"Validation error for local COCO file: {str(validation_err)}")
                    return AnnotationGetResponse(
                        exists=False,
                        error=f"Data validation error in local file: {str(validation_err)}",
                        source="local"
                    )
            except json.JSONDecodeError as json_err:
                error_msg = f"Invalid JSON in annotation file: {str(json_err)}"
                logger.error(error_msg)
                return AnnotationGetResponse(exists=False, error=error_msg, source="local")
            except Exception as e:
                error_msg = f"Error reading annotation file: {str(e)}"
                logger.error(error_msg)
                return AnnotationGetResponse(exists=False, error=error_msg, source="local")

        # No annotations found
        logger.info(f"No annotations found for image '{filename}'")
        return AnnotationGetResponse(exists=False, source="none")
        
    async def save_annotations_document(
        self, filename: str, batch_id: Optional[str], image_id: Optional[str], data: AnnotationSaveRequest
    ) -> AnnotationSaveResponse:
        sanitized_image_id = Path(image_id).name if image_id else None
        logger.info(f"Saving annotations for '{filename}' with batch_id='{batch_id}', image_id='{sanitized_image_id}'")

        coco_data_model: CocoModel = data.coco
        log_entries: Optional[List[str]] = data.log

        cosmos_db_saved = False
        cosmos_error: Optional[str] = None

        if batch_id and sanitized_image_id and coco_data_model:
            try:
                logger.info(f"Attempting to save to CosmosDB: batch_id='{batch_id}', image_id='{sanitized_image_id}'")
                
                # Check if item exists
                existing_item_dict = await self.cosmos_service.get_batch_image(batch_id, sanitized_image_id)
                
                incoming_coco_dict = coco_data_model.model_dump(by_alias=True, exclude_none=False) # Use False to keep nulls if needed for merging

                if existing_item_dict:
                    logger.info(f"Found existing record in CosmosDB for batch_id='{batch_id}', image_id='{sanitized_image_id}', updating...")
                    item_to_update = existing_item_dict.copy()

                    # Merge logic based on C# controller
                    if "Status" in incoming_coco_dict: # Handles None explicitly if present
                        item_to_update["Status"] = incoming_coco_dict["Status"]
                    
                    if incoming_coco_dict.get("admin_metadata") is not None:
                        if not item_to_update.get("admin_metadata"): # Ensure admin_metadata dict exists
                            item_to_update["admin_metadata"] = CocoAdminMetadataModel().model_dump(by_alias=True)
                        
                        # Merge individual fields of admin_metadata
                        for k, v in incoming_coco_dict["admin_metadata"].items():
                            item_to_update["admin_metadata"][k] = v
                    
                    # Update other fields from incoming COCO data, excluding system/key fields
                    fields_to_copy = ["info", "images", "annotations", "categories", "Sensor"]
                    for key in fields_to_copy:
                        if key in incoming_coco_dict: # Handles None explicitly if present
                             item_to_update[key] = incoming_coco_dict[key]
                    
                    # Ensure BatchID and ImageID (logical) are from the incoming model if they exist,
                    # but id (document id) should be the sanitized_image_id used for update.
                    if "BatchID" in incoming_coco_dict: item_to_update["BatchID"] = incoming_coco_dict["BatchID"]
                    if "ImageID" in incoming_coco_dict: item_to_update["ImageID"] = incoming_coco_dict["ImageID"]

                    # The document ID for update must be the one used to fetch it.
                    doc_id_for_update = existing_item_dict.get("id", sanitized_image_id)
                    
                    await self.cosmos_service.update_item(doc_id_for_update, item_to_update, partition_key=batch_id)
                    cosmos_db_saved = True
                    logger.info(f"Successfully updated item ID '{doc_id_for_update}' in CosmosDB.")

                else:
                    logger.info("No existing record found in CosmosDB, creating new record.")
                    # Prepare new document from incoming coco_data_model
                    new_doc_dict = coco_data_model.model_dump(by_alias=True, exclude_none=False) # Keep nulls from model
                    
                    # Explicitly set IDs and partition key
                    new_doc_dict["id"] = sanitized_image_id # Document ID
                    new_doc_dict["BatchID"] = batch_id     # Partition Key
                    new_doc_dict["ImageID"] = sanitized_image_id # Logical image ID (often same as doc ID)

                    if new_doc_dict.get("Status") is None:
                        new_doc_dict["Status"] = "Labelled"
                    
                    # Ensure admin_metadata exists with defaults if not provided or null
                    if new_doc_dict.get("admin_metadata") is None:
                         new_doc_dict["admin_metadata"] = CocoAdminMetadataModel().model_dump(by_alias=True)

                    logger.info(f"Creating new CosmosDB document with Status: {new_doc_dict.get('Status')}")
                    await self.cosmos_service.create_item(new_doc_dict, partition_key=batch_id)
                    cosmos_db_saved = True
                    logger.info(f"Successfully created new item ID '{sanitized_image_id}' in CosmosDB.")

            except Exception as e:
                logger.error(f"Error saving to CosmosDB: {str(e)}", exc_info=True)
                cosmos_error = str(e)

        return AnnotationSaveResponse(
            message="Annotations save process completed.", # Adjusted message
            cosmosDBSaved=cosmos_db_saved,
            cosmosDBError=cosmos_error
        )

    async def add_annotation(self, batch_id: str, image_id: str, annotation: AnnotationCreate) -> Dict[str, Any]:
        """
        Add a new annotation to an image's COCO data. (Existing method)
        """
        logger.debug(f"Granular add_annotation called for batch {batch_id}, image {image_id}")
        # Placeholder:
        raise NotImplementedError("Granular add_annotation not fully integrated with document-level operations yet.")

    async def update_annotation(self, batch_id: str, image_id: str, annotation_id: int, annotation: AnnotationUpdate) -> Dict[str, Any]:
        """
        Update an existing annotation within an image's COCO data. (Existing method)
        """
        logger.debug(f"Granular update_annotation called for batch {batch_id}, image {image_id}, annotation {annotation_id}")
        # Placeholder:
        raise NotImplementedError("Granular update_annotation not fully integrated with document-level operations yet.")

    async def delete_annotation(self, batch_id: str, image_id: str, annotation_id: int) -> Dict[str, Any]:
        """
        Delete an annotation from an image's COCO data. (Existing method)
        """
        logger.debug(f"Granular delete_annotation called for batch {batch_id}, image {image_id}, annotation {annotation_id}")
        # Placeholder:
        raise NotImplementedError("Granular delete_annotation not fully integrated with document-level operations yet.") 
