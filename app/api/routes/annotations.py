from fastapi import APIRouter, HTTPException, Depends, Path, Body, Query
from typing import List, Dict, Any, Optional
import logging
from pydantic import ValidationError
# Models for COCO document level operations
from app.models.coco import AnnotationGetResponse, AnnotationSaveRequest, AnnotationSaveResponse
from app.services.annotation_service import AnnotationService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get(
    "/{filename:path}", 
    response_model=AnnotationGetResponse,
    summary="Get annotations for a specific image",
    description="Retrieves annotation data (COCO format) and logs for a given image file. Tries CosmosDB first, then local files."
)
async def get_annotations_for_image(
    filename: str = Path(..., description="The path to the image file, e.g., 'B1/cam/image1.jpg'"),
    batch_id: Optional[str] = Query(None, description="The batch ID for CosmosDB lookup"),
    image_id: Optional[str] = Query(None, description="The image ID for CosmosDB lookup (often the document ID)"),
    annotation_service: AnnotationService = Depends()
):
    """
    Handle annotations for a specific image. Supports retrieval of annotation data.
    The `filename` parameter captures the full path passed in the URL.
    Example: `/api/annotations/B2/cam/cam1_1742977845.jpg?batch_id=B2&image_id=cam1_1742977845`
    """
    logger.info(f"GET /annotations/{filename} called with batch_id: {batch_id}, image_id: {image_id}")
    print("inszide get_annotations_for_image")
    # Log the request for debugging
    print(f"GET /annotations/{filename} called with batch_id: {batch_id}, image_id: {image_id}")
    try:
        response = await annotation_service.get_annotations_document(
            filename=filename, 
            batch_id=batch_id, 
            image_id=image_id
        )
        if not response.exists and response.error:
            # If exists is false and there is an error message, it implies an issue reading data
            raise HTTPException(status_code=500, detail=response.error)
        if not response.exists:
            # If exists is false and no error, it means not found, which is a valid 200 response with exists=false
            return response 
        return response
    except HTTPException as http_exc: # Re-raise HTTPExceptions directly
        raise http_exc
    except Exception as e:
        logger.error(f"Error in GET /annotations/{filename}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get annotations: {str(e)}")

@router.post(
    "/{filename:path}",
    response_model=AnnotationSaveResponse,
    summary="Save annotations for a specific image",
    description="Saves annotation data (COCO format) and logs for a given image file. Saves to CosmosDB and/or local files."
)
async def save_annotations_for_image(
    filename: str = Path(..., description="The path to the image file, e.g., 'B1/cam/image1.jpg'"),
    data: AnnotationSaveRequest = Body(...),
    batch_id: Optional[str] = Query(None, description="The batch ID for CosmosDB operation"),
    image_id: Optional[str] = Query(None, description="The image ID for CosmosDB operation (often the document ID)"),
    annotation_service: AnnotationService = Depends()
):
    """
    Handle saving annotations for a specific image.
    Enhanced with detailed logging for debugging.
    """
    logger.info(f"POST /annotations/{filename} called with batch_id: {batch_id}, image_id: {image_id}")
    
    # Enhanced request logging
    logger.info(f"Request details: filename={filename}, batch_id={batch_id}, image_id={image_id}")
    logger.info(f"Request data structure: has_coco={hasattr(data, 'coco')}, has_log={hasattr(data, 'log')}")
    
    if hasattr(data, 'coco') and data.coco:
        coco_data = data.coco
        logger.info(f"COCO data validation: "
                   f"has_annotations={hasattr(coco_data, 'annotations')}, "
                   f"annotation_count={len(coco_data.annotations) if hasattr(coco_data, 'annotations') and coco_data.annotations else 0}, "
                   f"has_categories={hasattr(coco_data, 'categories')}, "
                   f"category_count={len(coco_data.categories) if hasattr(coco_data, 'categories') and coco_data.categories else 0}, "
                   f"has_images={hasattr(coco_data, 'images')}, "
                   f"image_count={len(coco_data.images) if hasattr(coco_data, 'images') and coco_data.images else 0}")
        
        # Log each annotation for debugging
        if hasattr(coco_data, 'annotations') and coco_data.annotations:
            for i, annotation in enumerate(coco_data.annotations):
                logger.info(f"Annotation {i}: id={getattr(annotation, 'id', 'missing')}, "
                           f"category_id={getattr(annotation, 'category_id', 'missing')}, "
                           f"has_segmentation={hasattr(annotation, 'segmentation')}, "
                           f"segmentation_len={len(annotation.segmentation) if hasattr(annotation, 'segmentation') and annotation.segmentation else 0}")
    
    try:
        response = await annotation_service.save_annotations_document(
            filename=filename, 
            batch_id=batch_id, 
            image_id=image_id, 
            data=data
        )
        logger.info(f"Annotation service completed successfully: {response}")
        return response
    except ValidationError as ve:
        logger.error(f"Pydantic validation error in POST /annotations/{filename}: {str(ve)}")
        logger.error(f"Validation details: {ve.errors()}")
        raise HTTPException(status_code=422, detail=f"Validation error: {ve.errors()}")
    except HTTPException as http_exc:
        logger.error(f"HTTP exception in POST /annotations/{filename}: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in POST /annotations/{filename}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save annotations: {str(e)}")

@router.post(
    "/clear",
    summary="Clear annotations for a specific image",
    description="Clears/deletes all annotations for a given image. Accepts batch_id and image_id in request body."
)
async def clear_annotations_for_image(
    data: dict = Body(...),
    annotation_service: AnnotationService = Depends()
):
    """
    Clear all annotations for a specific image.
    Expects: {"batch_id": "B1", "image_id": "image_name"}
    """
    logger.info(f"POST /annotations/clear called with data: {data}")
    
    batch_id = data.get('batch_id')
    image_id = data.get('image_id')
    
    if not batch_id or not image_id:
        raise HTTPException(status_code=400, detail="batch_id and image_id are required")
    
    try:
        # Create an empty annotation save request to clear annotations
        empty_data = AnnotationSaveRequest(
            coco={
                "images": [],
                "annotations": [],
                "categories": []
            },
            admin_metadata={}
        )
        
        # Use the existing save method with empty data to clear annotations
        response = await annotation_service.save_annotations_document(
            filename=f"{batch_id}/{image_id}",
            batch_id=batch_id,
            image_id=image_id,
            data=empty_data
        )
        
        return {"message": "Annotations cleared successfully", "success": True}
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error in POST /annotations/clear: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clear annotations: {str(e)}")


@router.delete(
    "/{filename:path}",
    summary="Delete annotations for a specific image",
    description="Deletes all annotations for a given image file. Alternative to clear endpoint."
)
async def delete_annotations_for_image(
    filename: str = Path(..., description="The path to the image file, e.g., 'B1/cam/image1.jpg'"),
    batch_id: Optional[str] = Query(None, description="The batch ID for CosmosDB operation"),
    image_id: Optional[str] = Query(None, description="The image ID for CosmosDB operation"),
    annotation_service: AnnotationService = Depends()
):
    """
    Delete all annotations for a specific image.
    Example: `DELETE /api/annotations/B2/cam/cam1_1742977845.jpg?batch_id=B2&image_id=cam1_1742977845`
    """
    logger.info(f"DELETE /annotations/{filename} called with batch_id: {batch_id}, image_id: {image_id}")
    
    try:
        # Create an empty annotation save request to clear annotations
        empty_data = AnnotationSaveRequest(
            coco={
                "images": [],
                "annotations": [],
                "categories": []
            },
            admin_metadata={}
        )
        
        # Use the existing save method with empty data to delete annotations
        response = await annotation_service.save_annotations_document(
            filename=filename,
            batch_id=batch_id,
            image_id=image_id,
            data=empty_data
        )
        
        return {"message": "Annotations deleted successfully", "success": True}
    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error in DELETE /annotations/{filename}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete annotations: {str(e)}")


# --- Granular Annotation Routes (Commented out as per current focus) ---
# These routes manage individual annotations within a COCO document, 
# which is a different pattern than the C# AnnotationsController that manages the whole document.
# They can be re-enabled or adapted if needed.

# @router.post("/")
# async def create_annotation(
#     annotation: AnnotationCreate = Body(...),
#     batch_id: str = Body(...),
#     image_id: str = Body(...),
#     annotation_service: AnnotationService = Depends()
# ):
#     """
#     Add a new annotation to an image.
#     Args:
#         annotation: The annotation to add
#         batch_id: The ID of the batch
#         image_id: The ID of the image
#     Returns:
#         Dict[str, Any]: The updated batch item
#     """
#     try:
#         # This would need to call the granular add_annotation in the service
#         # result = await annotation_service.add_annotation(batch_id, image_id, annotation)
#         # return result
#         logger.warning("Granular create_annotation endpoint called but is currently not the primary focus.")
#         raise HTTPException(status_code=501, detail="Granular annotation creation not fully implemented in this context.")
#     except Exception as e:
#         logger.error(f"Error creating annotation: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to create annotation")

# @router.put("/{annotation_id}")
# async def update_annotation(
#     annotation_id: int = Path(..., description="The ID of the annotation to update"),
#     annotation: AnnotationUpdate = Body(...),
#     batch_id: str = Body(...),
#     image_id: str = Body(...),
#     annotation_service: AnnotationService = Depends()
# ):
#     """
#     Update an existing annotation.
#     Args:
#         annotation_id: The ID of the annotation to update
#         annotation: The updated annotation data
#         batch_id: The ID of the batch
#         image_id: The ID of the image
#     Returns:
#         Dict[str, Any]: The updated batch item
#     """
#     try:
#         # result = await annotation_service.update_annotation(
#         #     batch_id, image_id, annotation_id, annotation
#         # )
#         # return result
#         logger.warning(f"Granular update_annotation endpoint (ID: {annotation_id}) called but is currently not the primary focus.")
#         raise HTTPException(status_code=501, detail="Granular annotation update not fully implemented in this context.")
#     except Exception as e:
#         logger.error(f"Error updating annotation {annotation_id}: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to update annotation")

# @router.delete("/{annotation_id}")
# async def delete_annotation(
#     annotation_id: int = Path(..., description="The ID of the annotation to delete"),
#     batch_id: str = Body(...),
#     image_id: str = Body(...),
#     annotation_service: AnnotationService = Depends()
# ):
#     """
#     Delete an annotation.
#     Args:
#         annotation_id: The ID of the annotation to delete
#         batch_id: The ID of the batch
#         image_id: The ID of the image
#     Returns:
#         Dict[str, Any]: The updated batch item
#     """
#     try:
#         # result = await annotation_service.delete_annotation(batch_id, image_id, annotation_id)
#         # return result
#         logger.warning(f"Granular delete_annotation endpoint (ID: {annotation_id}) called but is currently not the primary focus.")
#         raise HTTPException(status_code=501, detail="Granular annotation deletion not fully implemented in this context.")
#     except Exception as e:
#         logger.error(f"Error deleting annotation {annotation_id}: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to delete annotation")
