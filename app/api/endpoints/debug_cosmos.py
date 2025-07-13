"""
Debug endpoints for Cosmos DB inspection
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
import logging

from app.core.config import get_settings
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

@router.get("/check-cosmos-containers")
async def check_cosmos_containers(database_name: Optional[str] = None):
    """
    Check if the specified database and its containers exist
    """
    db_name = database_name or settings.AZURE_COSMOSDB_ADMIN_DATABASE or "Admin"
    logger.info(f"Checking Cosmos DB database: {db_name}")
    
    try:
        async with AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY) as client:
            # Check if the database exists
            try:
                database = client.get_database_client(db_name)
                database_info = await database.read()
                logger.info(f"Database '{db_name}' exists: {database_info}")
                
                # List all containers in the database
                containers = []
                async for container in database.list_containers():
                    containers.append(container)
                    logger.info(f"Found container: {container}")
                
                return {
                    "database_exists": True,
                    "database_info": database_info,
                    "containers": containers
                }
                
            except Exception as db_error:
                logger.error(f"Error checking database '{db_name}': {db_error}")
                return {
                    "database_exists": False,
                    "error": str(db_error)
                }
            
    except Exception as e:
        logger.error(f"Error connecting to Cosmos DB: {e}")
        return {
            "error": str(e)
        }

@router.post("/create-models-container")
async def create_models_container():
    """
    Create the models container in the Admin database if it doesn't exist
    """
    db_name = settings.AZURE_COSMOSDB_ADMIN_DATABASE or "Admin"
    container_name = settings.AZURE_COSMOSDB_CONTAINER_MODELS or "models"
    
    try:
        async with AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY) as client:
            database = client.get_database_client(db_name)
            
            # Check if container exists
            containers = []
            container_exists = False
            async for container in database.list_containers():
                containers.append(container['id'])
                if container['id'] == container_name:
                    container_exists = True
            
            if container_exists:
                return {
                    "status": "Container already exists",
                    "database": db_name,
                    "container": container_name,
                    "all_containers": containers
                }
                
            # Create container with /id as partition key
            container_info = await database.create_container(
                id=container_name,
                partition_key="/id"
            )
            
            return {
                "status": "Container created successfully",
                "database": db_name,
                "container": container_name,
                "container_info": container_info,
                "all_containers": containers + [container_name]
            }
            
    except Exception as e:
        logger.error(f"Error creating container: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
