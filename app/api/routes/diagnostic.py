from fastapi import APIRouter, Depends, Response, Request
from typing import Dict, Any, List, Optional
import logging
import time
import platform
import os
import sys
from pydantic import BaseModel

from app.core.dependencies import get_cosmos_service
from app.services.cosmos_service import CosmosDbService

router = APIRouter()
logger = logging.getLogger(__name__)

class DiagnosticInfo(BaseModel):
    api_status: str
    timestamp: str
    python_info: Dict[str, str]
    routes_info: Dict[str, str]
    database_check: Dict[str, Any]

@router.get("/api-health", response_model=DiagnosticInfo)
async def api_health(
    request: Request,
    cosmos_service: CosmosDbService = Depends(get_cosmos_service)
):
    """
    Comprehensive API health check that tests connectivity to dependencies
    and provides diagnostic information
    """
    logger.info("API health diagnostic endpoint called")
    
    # Test database connectivity
    db_status = {"status": "unknown", "message": "Not checked"}
    try:
        # Simple check if we can connect to CosmosDB
        await cosmos_service.initialize()
        db_status = {
            "status": "connected", 
            "message": "Successfully connected to CosmosDB"
        }
    except Exception as e:
        db_status = {
            "status": "error", 
            "message": f"Failed to connect to CosmosDB: {str(e)}"
        }
    
    # Get info about registered routes
    from fastapi import FastAPI
    app = request.app  # Get the FastAPI app instance from the request
    
    # Extract route paths from app
    routes_info = {}
    if hasattr(app, 'routes'):
        for route in app.routes:
            if hasattr(route, 'path'):
                path = route.path
                methods = getattr(route, 'methods', ['GET'])
                if path not in routes_info:
                    routes_info[path] = f"Methods: {', '.join(methods)}"
    
    # Add our key API endpoints
    api_routes = {
        "/api/batches": "Main batches endpoint",
        "/api/statistics": "Main statistics endpoint",
        "/api/statistics/offline": "Fallback statistics endpoint",
        "/api/classes": "Classes/categories endpoint"
    }
    
    # Merge specific API routes with detected routes
    for path, desc in api_routes.items():
        if path in routes_info:
            routes_info[path] += f" - {desc}"
        else:
            routes_info[path] = f"NOT REGISTERED - {desc}"
    
    return DiagnosticInfo(
        api_status="ok",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
        python_info={
            "version": platform.python_version(),
            "platform": platform.platform(),
            "hostname": platform.node()
        },
        routes_info=routes_info,
        database_check=db_status
    )

@router.get("/route-test", tags=["diagnostic"])
async def route_test():
    """
    Test if routes are correctly registered and responding
    """
    return {
        "status": "ok",
        "test_routes": {
            "batches": "/api/batches",
            "statistics": "/api/statistics",
            "classes": "/api/classes"
        },
        "message": "Use these routes to test API endpoints"
    }
