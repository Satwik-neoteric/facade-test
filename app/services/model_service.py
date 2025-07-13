from typing import List, Dict, Any, Optional
from fastapi import HTTPException, Depends
import logging
from datetime import datetime
import uuid

from app.core.dependencies import get_models_container_service
from app.services.cosmos_service import CosmosDbService
from app.models.model import ModelInDB, ModelUpsertRequest

logger = logging.getLogger(__name__)

class ModelService:
    """Service for handling AI model data operations"""
    def __init__(self, cosmos_service: CosmosDbService = Depends(get_models_container_service)):
        self.cosmos = cosmos_service
        
    async def ensure_container_exists(self):
        """
        Handle the case where the models container doesn't exist
        Since we can't directly create containers from this service,
        we'll return empty results and log the issue
        """
        try:
            # Log information about the current container
            container_id = self.cosmos.container.id if self.cosmos.container else "unknown"
            database_name = self.cosmos.database_name
            logger.info(f"Using container '{container_id}' in database '{database_name}'")
            
            # We don't actually have a container_exists method, so we'll handle this differently
            logger.info(f"Note: Container '{container_id}' in database '{database_name}' may not exist.")
            logger.info(f"If this app is in development, consider creating the '{container_id}' container in the '{database_name}' database manually in Cosmos DB.")
            logger.info(f"For now, we'll try to run the operation and handle any errors appropriately.")
            
            return True
        except Exception as e:
            logger.error(f"Error checking container existence: {str(e)}", exc_info=True)
            return False
            
    async def get_models(self) -> List[ModelInDB]:
        """
        Retrieve all AI models from the database
        """
        try:
            # Try to ensure container exists first
            await self.ensure_container_exists()
            
            try:
                query = "SELECT * FROM c"
                items = await self.cosmos.query_items_no_model(
                    query=query
                )
            except HTTPException as he:
                # Check if this is a 404 error indicating container doesn't exist
                if he.status_code == 404 and "not found in database" in he.detail.lower():
                    container_id = self.cosmos.container.id if self.cosmos.container else "models"
                    database_name = self.cosmos.database_name if self.cosmos.database_name else "Admin"
                    
                    # You might consider automatically creating the container here
                    # if you have the appropriate permissions
                    
                    logger.warning(f"Container '{container_id}' not found in database '{database_name}'. Returning empty list.")
                    
                    # Provide a helpful error message for development
                    logger.info(f"""
                    To create the container, you can use the Azure Portal or Azure CLI:
                    
                    Azure CLI:
                    az cosmosdb sql container create --account-name YOUR_COSMOS_ACCOUNT --database-name {database_name} --name {container_id} --partition-key-path "/id"
                    
                    Or use the Azure Portal to create the container manually.
                    """)
                    
                    return []
                else:
                    # Re-raise other errors
                    raise
            except Exception as query_error:
                logger.error(f"Unexpected error querying models: {query_error}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to retrieve models: {str(query_error)}")
            
            # Handle the case where no models exist yet
            if not items:
                logger.info("No models found in database")
                return []
                
            # Try to convert dictionary items to Pydantic models
            # Filter out items that don't match our model structure
            models = []
            for item in items:
                try:
                    if all(field in item for field in ["ModelName", "AzureModelName", "Confidence", "ModelAccuracy", "categoryNo"]):
                        models.append(ModelInDB(**item))
                    else:
                        logger.warning(f"Skipping model with insufficient fields. Required fields: ['ModelName', 'AzureModelName', 'Confidence', 'ModelAccuracy', 'categoryNo'], Found fields: {list(item.keys())}")
                except Exception as model_error:
                    logger.warning(f"Skipping invalid model data: {str(model_error)}")
                    
            logger.info(f"Retrieved {len(models)} models from database")
            return models
        except Exception as e:
            logger.error(f"Error retrieving models: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to retrieve models: {str(e)}")
        
    async def get_model_by_id(self, model_id: str) -> ModelInDB:
        """
        Retrieve a specific AI model by ID
        """
        try:
            query = "SELECT * FROM c WHERE c.id = @id"
            parameters = [{"name": "@id", "value": model_id}]
            
            items = await self.cosmos.query_items_no_model(
                query=query,
                parameters=parameters
            )
            
            if not items:
                logger.warning(f"Model with ID {model_id} not found")
                raise HTTPException(status_code=404, detail=f"Model with ID {model_id} not found")
            
            model = ModelInDB(**items[0])
            logger.info(f"Retrieved model {model_id} from database")
            return model
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving model {model_id}: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to retrieve model: {str(e)}")
    
    async def upsert_model(self, model_data: ModelUpsertRequest) -> ModelInDB:
        """
        Create or update an AI model
        """
        try:
            # Check if this is an update (id provided) or create operation
            is_update = model_data.id is not None and model_data.id.strip() != ""
            
            # For update operations, verify the model exists
            existing_model = None
            if is_update:
                try:
                    existing_model = await self.get_model_by_id(model_data.id)
                except HTTPException as he:
                    if he.status_code == 404:
                        logger.warning(f"Attempted to update non-existent model: {model_data.id}")
                    raise
            
            # Get Organisation safely (might be None in ModelUpsertRequest)
            organisation = getattr(model_data, 'Organisation', "Default")
            if not organisation:
                organisation = "Default"
            
            # Generate unique ID for new models
            if not is_update:
                # Use a combination of timestamp, organisation, and model name to ensure uniqueness
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                model_id = f"{organisation}_{model_data.ModelName}_{timestamp}"
            else:
                model_id = model_data.id
                
            # Create the document for Cosmos DB
            now = datetime.now()
            document = {
                "id": model_id,
                "Organisation": organisation,
                "ModelName": model_data.ModelName,
                "AzureModelName": model_data.AzureModelName,
                "Confidence": model_data.Confidence,
                "ModelAccuracy": model_data.ModelAccuracy,
                "categoryNo": model_data.categoryNo,
                # Update the ModifiedDate for existing models, set both for new models
                "ModifiedDate": now.isoformat(),
                "CreatedDate": existing_model.CreatedDate.isoformat() if existing_model else now.isoformat()
            }
            
            # Save to database using the container client directly
            result = await self.cosmos.upsert_item(document)
            
            # Convert result to model
            saved_model = ModelInDB(**result)
            
            action = "updated" if is_update else "created"
            logger.info(f"Successfully {action} model: {saved_model.id}")
            
            return saved_model
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error upserting model: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save model: {str(e)}")
    
    async def delete_model(self, model_id: str) -> Dict[str, Any]:
        """
        Delete an AI model by ID
        """
        try:
            # First check if the model exists
            await self.get_model_by_id(model_id)
            
            # DEBUG: List all model IDs and partition keys before attempting deletion
            all_models = await self.get_models()
            for m in all_models:
                logger.info(f"Model in DB: id={m.id}, Organisation={getattr(m, 'Organisation', None)}")
            
            # Retrieve the model to get the Organisation (partition key)
            model = await self.get_model_by_id(model_id)
            organisation = getattr(model, "Organisation", "Default")
            # Pass both item_id and partition_key to the delete_item method
            await self.cosmos.delete_item(item_id=model_id, partition_key=organisation)
            
            logger.info(f"Successfully deleted model: {model_id}")
            return {"message": f"Model {model_id} deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting model {model_id}: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")
    
    async def get_models_for_dropdown(self) -> List[Dict[str, Any]]:
        """
        Get all models formatted for frontend dropdowns
        Returns simplified model information suitable for populating dropdowns
        """
        try:
            # Get all models from the database
            models = await self.get_models()
            
            # Format for dropdowns
            dropdown_models = []
            for model in models:
                dropdown_models.append({
                    "id": model.AzureModelName,
                    "name": model.ModelName,
                    "display_name": f"{model.AzureModelName}"
                })
            
            # If no models found, return some defaults for testing
            if not dropdown_models:
                logger.warning("No models found in database, returning default models")
                dropdown_models = [
                    {"id": "Mechanical-Faults", "name": "Mechanical-Faults", "display_name": "Mechanical Faults Detector v1", "version": "1"},
                    {"id": "Stonework-Fractures", "name": "Stonework-Fractures", "display_name": "Stonework Fractures Analyzer v2", "version": "2"}
                ]
                
            return dropdown_models
            
        except Exception as e:
            logger.error(f"Error getting models for dropdown: {str(e)}")
            # Fall back to default models
            return [
                {"id": "Mechanical-Faults", "name": "Mechanical-Faults", "display_name": "Mechanical Faults Detector v1", "version": "1"},
                {"id": "Stonework-Fractures", "name": "Stonework-Fractures", "display_name": "Stonework Fractures Analyzer v2", "version": "2"}
            ]
