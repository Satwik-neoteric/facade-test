import logging
import time
from fastapi import Request
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

logger = logging.getLogger(__name__)

class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()

        # Extract the request body safely
        body_bytes = await request.body()
        content_type = request.headers.get("content-type", "")

        # Log request
        logger.info(f"REQ: {request.method} {request.url.path} {content_type}")

        if "application/json" in content_type:
            try:
                body_str = body_bytes.decode("utf-8")
                logger.debug(f"Request Body: {body_str}")
            except Exception as e:
                logger.warning(f"Failed to decode request body: {str(e)}")

        # Reconstruct request with new body
        async def receive():
            return {"type": "http.request", "body": body_bytes}

        request = StarletteRequest(request.scope, receive)

        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(f"RESP: {request.method} {request.url.path} {response.status_code} ({process_time:.4f}s)")
            return response

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"ERROR: {request.method} {request.url.path} {str(e)} ({process_time:.4f}s)")
            raise


class DatabaseErrorMiddleware(BaseHTTPMiddleware):
    """
    Middleware to catch database-related exceptions and handle them gracefully.
    For critical APIs that need to continue functioning even if the database is down,
    it will redirect to fallback static endpoints.
    """
    
    async def dispatch(self, request: Request, call_next):
        # These paths have fallback routes available
        critical_paths = {
            "/api/batches": "/api/batches/offline",
            "/api/batches/": "/api/batches/offline/",
            "/api/statistics": "/api/statistics/offline",
            "/api/statistics/": "/api/statistics/offline/"
        }
        
        try:
            # First try the normal route
            response = await call_next(request)
            
            # If the response is a 500 or 503 error on a critical path, redirect to fallback
            if response.status_code in (500, 503) and request.url.path in critical_paths:
                logger.warning(f"Database error detected on {request.url.path}, redirecting to fallback")
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=critical_paths[request.url.path])
                
            return response
            
        except Exception as e:
            # If there was an exception on a critical path, redirect to fallback
            if request.url.path in critical_paths:
                logger.error(f"Exception in {request.url.path}, redirecting to fallback: {str(e)}")
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=critical_paths[request.url.path])
            
            # For all other paths, just log and re-raise
            logger.exception(f"Unhandled exception in {request.url.path}: {str(e)}")
            raise
