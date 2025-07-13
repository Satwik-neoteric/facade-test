\
# app/api/routes/debug.py
from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import JSONResponse
import logging
import traceback

# Assuming CosmosServiceDep is correctly defined and accessible
# If not, it might need to be imported from app.core.dependencies
from app.core.dependencies import CosmosServiceDep, get_cosmos_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/route-map")
async def debug_route_map_in_router(request: Request):
    logger.info("Debug router: /route-map hit")
    try:
        routes_data = []
        for route in request.app.routes:
            routes_data.append({
                "path": route.path,
                "name": route.name,
                "methods": [method for method in route.methods] if hasattr(route, "methods") else [],
            })
        return {"routes": routes_data, "count": len(routes_data)}
    except Exception as e:
        logger.error(f"Error in /debug/route-map (router): {str(e)}\\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": "Failed to retrieve route map", "details": str(e)}
        )

@router.get("/cosmos")
async def debug_cosmos_in_router(cosmos_service: CosmosServiceDep):
    logger.info("Debug router: /cosmos hit")
    try:
        batches = await cosmos_service.get_batches()
        batch_ids = []
        if batches: # Ensure batches is not None
            for batch in batches:
                if isinstance(batch, dict) and "BatchID" in batch:
                    batch_ids.append(batch["BatchID"])
        
        unique_batch_ids = list(set(batch_ids))
        
        # Access endpoint through the container object
        endpoint_url = 'N/A'
        if hasattr(cosmos_service, 'container') and hasattr(cosmos_service.container, 'client_connection') and hasattr(cosmos_service.container.client_connection, 'url'):
            endpoint_url = cosmos_service.container.client_connection.url

        settings_data = {
            "endpoint": endpoint_url,
            "database_id": getattr(cosmos_service, 'database_id', 'N/A'), # This might still be an issue if not set on the service
            "batches_container_id": getattr(cosmos_service, 'batches_container_id', 'N/A'), # Same as above
        }

        return {
            "status": "connected",
            "settings": settings_data,
            "batch_count": len(batches) if batches else 0,
            "unique_batch_ids": unique_batch_ids,
            "sample_batches": batches[:3] if batches else []
        }
    except Exception as e:
        logger.error(f"Error in /debug/cosmos (router): {str(e)}\\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": "Failed to connect to CosmosDB or retrieve data", "details": str(e)}
        )

@router.get("/batch/{batch_id}")
async def debug_batch_id_in_router(batch_id: str, cosmos_service: CosmosServiceDep):
    logger.info(f"Debug router: /batch/{batch_id} hit")
    try:
        batch = await cosmos_service.get_batch(batch_id)
        if batch:
            return batch
        # Return 404 as JSON if batch is not found
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"status": "error", "message": f"Batch with ID '{batch_id}' not found."}
        )
    except Exception as e:
        logger.error(f"Error in /debug/batch/{batch_id} (router): {str(e)}\\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to retrieve batch {batch_id}", "details": str(e)}
        )
