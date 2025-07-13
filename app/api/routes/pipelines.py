# app/api/routes/pipelines.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import List

from app.models.pipeline import PipelineUpsertRequest, PipelineInDB # Your Pydantic models
from app.services.pipeline_service import PipelineService, get_pipeline_service # Your new service

router = APIRouter()

@router.post(
    "/inference",
    response_model=PipelineInDB, # What the API successfully returns
    summary="Upsert a pipeline document (creates or updates)",
    # Default status code will be 200 OK, we'll set 201 dynamically for creates
)
async def upsert_pipeline_endpoint(
    pipeline_data: PipelineUpsertRequest, # Request body validated by this model
    response: Response, # Inject FastAPI Response object to set status code dynamically
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    try:
        # The service method now returns the document and the correct status code
        upserted_pipeline, http_status_code = await pipeline_service.upsert_pipeline(pipeline_data)
        response.status_code = http_status_code
        return upserted_pipeline
    except HTTPException as e:
        # Re-raise HTTPExceptions (like 409 Conflict from service)
        raise e
    except Exception as e:
        # Log the full error e
        # logger.error(f"Error during pipeline upsert: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/inference", response_model=List[PipelineInDB], summary="List all pipelines")
async def list_pipelines_endpoint(
    skip: int = 0,
    limit: int = 100,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    return await pipeline_service.list_pipelines(skip=skip, limit=limit)

@router.get("/inference/{pipeline_id}", response_model=PipelineInDB, summary="Get a pipeline by its ID")
async def get_pipeline_endpoint(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    pipeline = await pipeline_service.get_pipeline_by_id(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return pipeline