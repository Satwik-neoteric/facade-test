from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any

from app.models.model import ModelInDB, ModelUpsertRequest, ModelResponse
from app.services.model_service import ModelService
from app.core.dependencies import get_cosmos_service

router = APIRouter()

@router.get("", response_model=List[ModelResponse])
async def get_models(model_service: ModelService = Depends(ModelService)):
    """
    Get all AI models
    """
    return await model_service.get_models()

@router.get("/dropdown", response_model=List[Dict[str, Any]])
async def get_models_for_dropdown(model_service: ModelService = Depends(ModelService)):
    """
    Get all AI models formatted for frontend dropdowns
    """
    return await model_service.get_models_for_dropdown()

@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, model_service: ModelService = Depends(ModelService)):
    """
    Get a specific AI model by ID
    """
    return await model_service.get_model_by_id(model_id)

@router.post("", response_model=ModelResponse)
async def upsert_model(model_data: ModelUpsertRequest, model_service: ModelService = Depends(ModelService)):
    """
    Create or update an AI model
    """
    return await model_service.upsert_model(model_data)

@router.delete("/{model_id}", response_model=Dict[str, Any])
async def delete_model(model_id: str, model_service: ModelService = Depends(ModelService)):
    """
    Delete an AI model by ID
    """
    return await model_service.delete_model(model_id)

@router.get("/dropdown", response_model=List[Dict[str, Any]])
async def get_models_for_dropdown(model_service: ModelService = Depends(ModelService)):
    """
    Get all AI models formatted for frontend dropdowns
    """
    return await model_service.get_models_for_dropdown()
