"""
Dependency injection functions for FastAPI.
"""
import logging
from typing import Annotated
from fastapi import Depends, HTTPException

# Ensure we are importing the async versions or functions that return async clients/containers
from app.core.database import get_cosmos_container, get_async_blob_service_client
from app.services.cosmos_service import CosmosDbService 
from app.services.blob_storage_service import BlobStorageService # Corrected import name
from app.core.config import get_settings

from typing import AsyncGenerator
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError


settings = get_settings()
DEFAULT_CONTAINER_NAME = settings.AZURE_COSMOSDB_CONTAINER_BATCHES # Or settings.COSMOS_CONTAINER if that's the general default

PIPELINES_CONTAINER_NAME = "pipelines" # Or from settings.PIPELINES_CONTAINER_NAME

async def get_cosmos_service() -> AsyncGenerator[CosmosDbService, None]: # For the default container
    """
    Dependency function to provide a CosmosDbService instance configured
    for the DEFAULT_CONTAINER_NAME.
    Uses COSMOS_ENDPOINT and COSMOS_KEY from settings.
    """
    if not settings.COSMOS_ENDPOINT or not settings.COSMOS_KEY:
        raise ValueError("COSMOS_ENDPOINT and COSMOS_KEY must be set in settings for Cosmos DB connection.")
    if not settings.AZURE_COSMOSDB_DATABASE:
        raise ValueError("AZURE_COSMOSDB_DATABASE must be set in settings.")
    if not DEFAULT_CONTAINER_NAME:
        raise ValueError("A default container name (e.g., from settings) must be specified for get_cosmos_service.")

    async with AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY) as client:
        database = client.get_database_client(settings.AZURE_COSMOSDB_DATABASE)
        default_container_client = database.get_container_client(DEFAULT_CONTAINER_NAME)
        
        service_instance = CosmosDbService(container=default_container_client)
        try:
            yield service_instance
        finally:
            # Cleanup for service_instance if any; client is handled by 'async with'
            pass

async def get_pipelines_container_service() -> AsyncGenerator[CosmosDbService, None]: # For the "pipelines" container
    """
    Dependency function to provide a CosmosDbService instance configured
    for the 'pipelines' container.
    Uses COSMOS_ENDPOINT and COSMOS_KEY from settings.
    """
    if not settings.COSMOS_ENDPOINT or not settings.COSMOS_KEY:
        raise ValueError("COSMOS_ENDPOINT and COSMOS_KEY must be set in settings for Cosmos DB connection.")
    if not settings.AZURE_COSMOSDB_DATABASE:
        raise ValueError("AZURE_COSMOSDB_DATABASE must be set in settings.")

    async with AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY) as client:
        database = client.get_database_client(settings.AZURE_COSMOSDB_DATABASE)
        pipelines_container_client = database.get_container_client(PIPELINES_CONTAINER_NAME)
        
        service_instance = CosmosDbService(container=pipelines_container_client)
        try:
            yield service_instance
        finally:
            # Cleanup for service_instance if any; client is handled by 'async with'
            pass

async def get_models_container_service() -> AsyncGenerator[CosmosDbService, None]: # For the "models" container
    """
    Dependency function to provide a CosmosDbService instance configured
    for the 'models' container in the Admin database.
    Uses COSMOS_ENDPOINT and COSMOS_KEY from settings.
    """
    if not settings.COSMOS_ENDPOINT or not settings.COSMOS_KEY:
        raise ValueError("COSMOS_ENDPOINT and COSMOS_KEY must be set in settings for Cosmos DB connection.")

    # Use Admin database from settings for models
    admin_db_name = settings.AZURE_COSMOSDB_ADMIN_DATABASE
    models_container_name = settings.AZURE_COSMOSDB_CONTAINER_MODELS
    
    logging.info(f"[MODELS SERVICE] Connecting to '{admin_db_name}' database for '{models_container_name}' container")
    logging.debug(f"[MODELS SERVICE] Using endpoint: {settings.COSMOS_ENDPOINT}")

    async with AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY) as client:
        try:
            database = client.get_database_client(admin_db_name)
            logging.info(f"[MODELS SERVICE] Got database client for '{admin_db_name}'")
            
            # Add detailed info about the database
            database_properties = await database.read()
            logging.info(f"[MODELS SERVICE] Database properties: {database_properties}")
            
            models_container_client = database.get_container_client(models_container_name)
            logging.info(f"[MODELS SERVICE] Got container client for '{models_container_name}' in database '{admin_db_name}'")
            
            # Check if container exists by attempting to read its properties
            try:
                container_properties = await models_container_client.read()
                logging.info(f"[MODELS SERVICE] Container exists. Properties: {container_properties}")
            except CosmosResourceNotFoundError:
                logging.warning(f"[MODELS SERVICE] Container '{models_container_name}' not found in database '{admin_db_name}'. Returning client anyway.")
                logging.info(f"[MODELS SERVICE] You may need to create the container for models service to work properly.")
            
            service_instance = CosmosDbService(container=models_container_client)
            logging.info(f"[MODELS SERVICE] Created CosmosDbService instance for container: {models_container_name}")
            
            try:
                yield service_instance
            finally:
                # Cleanup for service_instance if any; client is handled by 'async with'
                pass
        except CosmosResourceNotFoundError:
            logging.error(f"[MODELS SERVICE] Database '{admin_db_name}' not found.")
            raise HTTPException(status_code=404, detail=f"Database '{admin_db_name}' not found.")
        except Exception as e:
            logging.error(f"[MODELS SERVICE] Error creating CosmosDbService for models: {str(e)}", exc_info=True)
            raise

async def get_blob_storage_service() -> BlobStorageService:
    """
    Get an instance of BlobStorageService.
    BlobStorageService is designed to initialize its own async client.
    """
    # BlobStorageService initializes its own async client using settings
    # It might need to be adjusted if it expects a client to be passed.
    # Based on previous fixes, it initializes its own client.
    # If get_async_blob_service_client() is to be used, BlobStorageService needs to accept it.
    # For now, assuming BlobStorageService handles its own async client init.
    return BlobStorageService() 

async def get_cosmos_service_classes() -> CosmosDbService:
    """
    Get an instance of CosmosDbService configured for the classes container.
    """
    container = await get_cosmos_container(
        database_name=settings.COSMOS_DATABASE,
        container_name=settings.AZURE_COSMOSDB_CONTAINER_CLASSES
    )
    return CosmosDbService(container)

# Create typed dependencies
CosmosServiceDep = Annotated[CosmosDbService, Depends(get_cosmos_service)]
BlobStorageServiceDep = Annotated[BlobStorageService, Depends(get_blob_storage_service)]

# Example of a dependency that provides the raw async blob client if needed elsewhere
# async def get_raw_blob_client() -> AsyncBlobServiceClient:
#     return get_async_blob_service_client()
# RawBlobClientDep = Annotated[AsyncBlobServiceClient, Depends(get_raw_blob_client)]