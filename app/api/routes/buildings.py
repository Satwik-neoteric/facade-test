from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import uuid4
import logging
from fastapi import Body
from app.services.cosmos_service import CosmosDbService
from app.core.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)

settings = get_settings()

class BuildingCreate(BaseModel):
    name: str
    address: str

@router.get("/buildings")
async def get_buildings():
    """Get all buildings from the database"""
    logger.info("Getting buildings from database")
    
    db_name = "Admin"
    container_name = "Buildings"
    
    try:
        cosmos_service = CosmosDbService()
        await cosmos_service.initialize()
        cosmos_service.database = cosmos_service.client.get_database_client(db_name)
        cosmos_service._container = cosmos_service.database.get_container_client(container_name)
        
        query = "SELECT * FROM c"
        buildings = await cosmos_service.query_items(query=query)
        
        logger.info(f"Successfully retrieved {len(buildings)} buildings")
        return buildings
        
    except HTTPException as he:
        if he.status_code == 404 and "not found in database" in he.detail.lower():
            logger.warning(f"{container_name} container not found in {db_name} database. Returning empty list.")
            return []
        raise he
    except Exception as e:
        logger.error(f"Error querying buildings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/buildings")
async def create_building(building_data: BuildingCreate = Body(...)):
    """Create a new building"""
    logger.info(f"Creating new building: {building_data.name}")
    
    try:
        new_building = {
            "id": str(uuid4()),
            "name": building_data.name,
            "address": building_data.address
        }
        
        cosmos_service = CosmosDbService()
        await cosmos_service.initialize()
        
        # Ensure the database and container exist
        db_name = "Admin"
        container_name = "Buildings"
        
        # Get or create database
        # ✅ Correct version — use this instead
        cosmos_service.database = await cosmos_service.client.create_database_if_not_exists(id=db_name)

        cosmos_service._container = await cosmos_service.database.create_container_if_not_exists(
            id=container_name,
            partition_key="/id",
            offer_throughput=400
        )

        
        # Create the building item
        result = await cosmos_service.create_item(new_building)
        # print("➡️ Parsed building:", building_data)
        logger.info(f"Successfully created building with ID: {new_building['id']}")
        return {"status": "success", "building": new_building}
    
        
    except Exception as e:
        logger.error(f"Error creating building: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
