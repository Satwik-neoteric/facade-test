import logging
from fastapi import APIRouter, Request, Depends, Query, Response, HTTPException
from typing import Dict, Any

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/healthcheck")
async def healthcheck(request: Request):
    """
    Endpoint to check the health of the API and report on available endpoints.
    """
    # Get all registered routes
    routes = []
    for route in request.app.routes:
        route_info = {
            "path": getattr(route, "path", "unknown"),
            "name": getattr(route, "name", "unnamed"),
            "methods": getattr(route, "methods", set()),
        }
        routes.append(route_info)
    
    # Count by prefix
    prefix_counts = {}
    for route in routes:
        path = route["path"]
        prefix = path.split("/")[1] if path.startswith("/") and len(path.split("/")) > 1 else "root"
        prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1
    
    # Create a readable report
    report = {
        "status": "ok",
        "route_count": len(routes),
        "prefix_counts": prefix_counts,
        "api_routes": [r for r in routes if "/api/" in r["path"] or r["path"].startswith("/api")],
    }
    
    return report

@router.get("/test-error")
async def test_error():
    """
    Endpoint to test error handling middleware.
    """
    raise HTTPException(status_code=500, detail="Test error")

@router.get("/test-redirect")
async def test_redirect():
    """
    Endpoint to test the middleware redirect functionality.
    """
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/debug/healthcheck")
