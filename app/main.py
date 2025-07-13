import os
import uuid
import json
import time
import uvicorn
import traceback
import logging
import io
import mimetypes
from datetime import datetime, timedelta # The datetime class is imported here
from typing import Optional, List, Dict, Any, Union, Callable
from fastapi import FastAPI, Request, Depends, HTTPException, status, Path, Query, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse, FileResponse, HTMLResponse
from typing import List
from app.models.category import CategoryModel
from dotenv import load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
# The datetime import is already here, which is great.

# Internal imports
from app.core.config import Settings, get_settings # Ensure Settings class is imported
from app.api.routes import sensor, users, annotations, classes, images, statistics
from app.api.routes.batches import router as batches_router
from app.api.routes.statistics_fixed import router as statistics_fixed_router # Using our fixed statistics router
from app.api.routes.fallback import router as fallback_router # Import the fallback router for emergency endpoints
from app.api.routes import debug as debug_router # Import the new debug router
from app.api.routes.legacy import router as legacy_router # Import the legacy router for Flask compatibility
from app.api.routes.auth_router import router as auth_router
from app.api.routes.models import router as models_router # Import the models router
from app.api.routes.batch_management import router as batch_management_router
from app.api.routes import buildings
from app.api.routes.buildings import router as buildings_router
from app.api.routes.admin import router as admin_router # Import the correct admin router

from app.services.graph_service import GraphService
from app.services.cosmos_service import CosmosDbService # Changed from CosmosService
from app.services.blob_service import BlobStorageService
from app.services.category_service import CategoryService
from app.api.routes.pipelines import router as pipelines_router
from app.core.middleware import RequestLoggerMiddleware
from app.core.middleware import DatabaseErrorMiddleware
from app.core.dependencies import get_cosmos_service, get_blob_storage_service, CosmosServiceDep, BlobStorageServiceDep
from app.core.auth import get_current_web_user, has_role # This is your dependency for protected routes
from app.utils.template_utils import process_template_context


# Configure logger
logger = logging.getLogger(__name__)

# Settings are loaded in get_settings() with dotenv
settings = get_settings()

# Initialize FastAPI app
app = FastAPI(
    title="Facade Studio",
    description="Facade Studio annotation and labeling application",
    version="1.0.0",
    debug=settings.DEBUG_MODE
)

# Get base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Set up path for static files and templates
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")

# Set up Jinja2 templates using the templates directory
templates = Jinja2Templates(directory=templates_dir)

# Load your landing page data from JSON
landing_page_data_path = os.path.join(BASE_DIR, "app", "landingPageData.json") # Assuming data file is in the 'app' directory
try:
    with open(landing_page_data_path, "r") as f:
        landing_page_data = json.load(f)
except FileNotFoundError:
    logger.error(f"landingPageData.json not found at {landing_page_data_path}. The intro page may not render correctly.")
    landing_page_data = {} # Use empty data to prevent crashes

# Add middleware
app.add_middleware(RequestLoggerMiddleware)
app.add_middleware(DatabaseErrorMiddleware)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
print(f"Static directory path: {static_dir}")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    print(f"Successfully mounted static directory: {static_dir}")
else:
    print(f"Error: Static directory not found at {static_dir}")

# --- Template Routes (Modified for Authentication and Data) ---
@app.get("/", response_class=HTMLResponse)
async def read_root_and_redirect(request: Request):
    """
    Checks for an active session. Redirects to home if logged in, else renders intro.html.
    This makes '/' the primary entry point controlling access.
    """
    app_token = request.cookies.get("app_access_token")
    if app_token:
        try:
            await get_current_web_user(request)
            return RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
        except HTTPException:
            # Token is invalid, fall through to render the intro page
            pass
            
    # Unauthenticated users get the intro page with the necessary data
    return templates.TemplateResponse("intro.html", {
        "request": request,
        "data": landing_page_data,
        "current_year": datetime.now().year  # <<< MODIFIED: Pass current year to template
    })

@app.get("/intro", response_class=HTMLResponse)
async def intro_page_direct(request: Request):
    """
    Direct access to the intro page.
    """
    # Pass the landing page data to the template
    return templates.TemplateResponse("intro.html", {
        "request": request,
        "data": landing_page_data,
        "current_year": datetime.now().year # <<< MODIFIED: Pass current year to template
    })

# --- PROTECTED TEMPLATE ROUTES (No changes needed here) ---
@app.get("/home", response_class=HTMLResponse)
async def home_page(
    request: Request,
    username: str = Depends(get_current_web_user),
    roles_ok: bool = Depends(has_role(['Administrator', 'Labeller', 'Reviewer']))
):
    is_admin = 'Administrator' in username.roles
    return templates.TemplateResponse("base.html", {"request": request, "username": username, "is_admin": is_admin})

@app.get("/label", response_class=HTMLResponse)
async def label_page(
    request: Request,
    username: str = Depends(get_current_web_user),
    roles_ok: bool = Depends(has_role(['Administrator', 'Labeller', 'Reviewer']))
):
    is_admin = 'Administrator' in username.roles
    return templates.TemplateResponse("label.html", {"request": request, "username": username, "is_admin": is_admin})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(
    request: Request,
    username: str = Depends(get_current_web_user),
    roles_ok: bool = Depends(has_role(['Administrator', 'Labeller', 'Reviewer']))
):
    is_admin = 'Administrator' in username.roles
    return templates.TemplateResponse("dashboard.html", {"request": request, "config": {"DEBUG_MODE": settings.DEBUG_MODE}, "username": username, "is_admin": is_admin})

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(
    request: Request,
    email: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    username: Any = Depends(get_current_web_user),
    roles_ok: bool = Depends(has_role(['Administrator']))
):
    is_admin = 'Administrator' in username.roles if hasattr(username, 'roles') else False
    
    # Check if email and role were provided in query params - this means user addition was requested
    if email and role and is_admin:
        try:
            logger.info(f"Admin page requested with email={email}, role={role}. Attempting to add user.")
            # Create a new GraphService instance and add the user
            graph_service = GraphService()
            result = await graph_service.add_user(email, role)
            logger.info(f"User {email} added with result: {result}")
        except Exception as e:
            logger.error(f"Error adding user from query params: {str(e)}")
            # Continue to render the page even if there was an error
    
    return templates.TemplateResponse("admin.html", {"request": request, "username": username, "is_admin": is_admin})

@app.get("/pipelines-admin", response_class=HTMLResponse)
async def pipelines_admin_page(
    request: Request,
    username: str = Depends(get_current_web_user) # Assuming this should be protected
):
    context = process_template_context(request)
    return templates.TemplateResponse("pipelines.html", context)


@app.get("/diagnostic-tool", response_class=HTMLResponse)
async def diagnostic_page(request: Request):
    logger.info("Diagnostic tool page accessed")
    return templates.TemplateResponse("diagnostic.html", {"request": request, "config": {"DEBUG_MODE": settings.DEBUG_MODE}})


# --- API ROUTERS (Fixed duplicate buildings router) ---
app.include_router(sensor.router, prefix="/api/sensor", tags=["sensor"])
app.include_router(batches_router, prefix="/api", tags=["batches"])
app.include_router(admin_router, prefix="/api", tags=["admin"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(annotations.router, prefix="/api/annotations", tags=["annotations"])
app.include_router(classes.router, prefix="/api", tags=["classes"])
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(statistics.router, prefix="/api", tags=["statistics"])
app.include_router(statistics_fixed_router, prefix="/api", tags=["statistics_fixed"])
app.include_router(fallback_router, prefix="/api", tags=["fallback"])
app.include_router(debug_router.router, prefix="/debug", tags=["debug"])
from app.api.routes.debug_cosmos import router as debug_cosmos_router
app.include_router(debug_cosmos_router, prefix="/debug", tags=["debug_cosmos"])
app.include_router(pipelines_router, prefix="/api/pipelines", tags=["Pipelines"])
app.include_router(models_router, prefix="/api/models", tags=["Models"])
app.include_router(auth_router)
app.include_router(batch_management_router, prefix="/api", tags=["batch_management"])
app.include_router(buildings_router, prefix="/api", tags=["buildings"])

from app.api.routes.healthcheck import router as healthcheck_router
app.include_router(healthcheck_router, prefix="/healthcheck", tags=["healthcheck"])

from app.api.routes.diagnostic import router as diagnostic_router
app.include_router(diagnostic_router, prefix="/diagnostic", tags=["diagnostic"])

router = APIRouter()

@router.get("/api/classes")
def get_classes():
    config_path = Path("app/config/class_config.json")
    with config_path.open() as f:
        class_config = json.load(f)
    print("DEBUG: Loaded class configuration:", class_config)
    return class_config

# Include the router in the main application
app.include_router(router)
