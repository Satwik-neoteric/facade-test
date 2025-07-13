from pathlib import Path
import os
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List
from functools import lru_cache

class Settings:
    def __init__(self):
        # Debug settings
        # self.DEBUG = False # Replaced by DEBUG_MODE
        self.DEBUG_MODE: bool = False # For general debug features
        self.USE_DEV_USER_PROFILE: bool = False # For /users/me dev mock
        
        # API settings
        self.API_BASE_URL: str = "/api"
        self.BASE_URL: str = "http://localhost:8000"  # Base URL for internal requests
        
        # Azure Blob Storage settings
        self.AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
        self.AZURE_STORAGE_ACCOUNT: Optional[str] = None
        self.AZURE_STORAGE_KEY: Optional[str] = None
        self.AZURE_INPUT_CONTAINER: str = "input"
        self.AZURE_ANNOTATIONS_CONTAINER: str = "annotations"
        self.AZURE_DELETE_CONTAINER: str = "delete"
        
        # Azure Cosmos DB settings
        self.COSMOS_ENDPOINT: Optional[str] = None
        self.COSMOS_KEY: Optional[str] = None
        self.COSMOS_DATABASE: str = "InputImages"
        self.COSMOS_CONTAINER: str = "batches"
        
        # Azure AD settings (placeholders, actual integration might need more)
        self.AZURE_AD_TENANT_ID: Optional[str] = None
        self.AZURE_AD_CLIENT_ID: Optional[str] = None
        self.AZURE_AD_CLIENT_SECRET: Optional[str] = None # For app permissions / client credentials flow
        self.AZURE_AD_SCOPE: str = "User.Read email" # Default scope
        self.AZURE_AD_AUTHORITY: str = "https://login.microsoftonline.com" # Default authority
        self.AZURE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback" # Default redirect URI
        # self.AZURE_AD_APP_SECRET: Optional[str] = None # Ensure consistency if used elsewhere
        
        # User roles (ensure these match UserRole model if defined there)
        self.ADMIN_ROLE: str = "Administrator"
        self.LABELLER_ROLE: str = "Labeller"
        self.REVIEWER_ROLE: str = "Reviewer"
        
        # JWT / Authentication settings
        # This is for your internal web session JWT (after Microsoft login)
        # self.APP_SECRET_KEY: str = "a_very_secure_temporary_dev_app_secret_key_please_change_me" 
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 # Default expiry for web session JWT AND API tokens
        
        # This is for your API tokens (traditional username/password login)
        self.JWT_SECRET_KEY: str = "a_very_secure_temporary_dev_jwt_secret_key_please_change_me"
        self.JWT_ALGORITHM: str = "HS256"

        self.TOKEN_URL: str = "/api/users/token" # Default token URL
        self.DEV_ADMIN_PASSWORD: str = "adminpassword" # Default password for dev admin user

        # Cache settings
        self.CACHE_EXPIRY_SECONDS: int = 300
        self.IMAGE_PREFIXES_CACHE_EXPIRY_SECONDS: int = 600
        
        # Image settings
        self.ALLOWED_EXTENSIONS: List[str] = ["png", "jpg", "jpeg"]
        
        # Database settings for new features
        self.DASHBOARD_STATS_CONTAINER: str = "dashboard_stats"
        self.USER_ACTIVITY_CONTAINER: str = "user_activity"

        # Azure Cosmos DB specific settings
        self.AZURE_COSMOSDB_DATABASE: Optional[str] = "InputImages"
        self.AZURE_COSMOSDB_ADMIN_DATABASE: Optional[str] = "Admin"  # Database for admin-related collections like models
        self.AZURE_COSMOSDB_CONTAINER_BATCHES: Optional[str] = "batches"
        self.AZURE_COSMOSDB_CONTAINER_CLASSES: Optional[str] = "classes"
        self.AZURE_COSMOSDB_CONTAINER_MODELS: Optional[str] = "Models"  # Container for AI models
        self.AZURE_COSMOSDB_ENABLE_CLIENT_LOGGING: bool = False

        # For local file storage (annotations, logs)
        # Default to project root. Assumes config.py is in app/core/
        # Adjust the number of .parent calls if the project structure is different.
        _project_root_path = Path(__file__).resolve().parent.parent.parent
        self.BASE_DIR: str = os.getenv("BASE_DIR", str(_project_root_path))


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings, cached for efficiency.
    Uses python-dotenv to load .env file, which safely ignores extra variables.
    
    Returns:
        Settings: Application configuration settings
    """
    # Explicitly load .env from project root
    # Find the project root by looking for the .env file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = current_dir
    
    # Go up directories until we find .env or reach the root
    while project_root != os.path.dirname(project_root):
        env_file = os.path.join(project_root, '.env')
        if os.path.exists(env_file):
            break
        project_root = os.path.dirname(project_root)
    
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path, override=True)
    
    # Initialize settings
    settings = Settings()
    
    # Load environment variables directly
    settings.DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() in ("true", "1", "t")
    settings.USE_DEV_USER_PROFILE = os.getenv("USE_DEV_USER_PROFILE", "False").lower() in ("true", "1", "t")

    # Azure Blob Storage settings
    settings.AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    settings.AZURE_STORAGE_ACCOUNT = os.getenv("AZURE_STORAGE_ACCOUNT")
    settings.AZURE_STORAGE_KEY = os.getenv("AZURE_STORAGE_KEY")
    settings.AZURE_INPUT_CONTAINER = os.getenv("AZURE_INPUT_CONTAINER", settings.AZURE_INPUT_CONTAINER)
    settings.AZURE_ANNOTATIONS_CONTAINER = os.getenv("AZURE_ANNOTATIONS_CONTAINER", settings.AZURE_ANNOTATIONS_CONTAINER)
    settings.AZURE_DELETE_CONTAINER = os.getenv("AZURE_DELETE_CONTAINER", settings.AZURE_DELETE_CONTAINER)
    
    # Azure Cosmos DB settings
    settings.COSMOS_ENDPOINT = os.getenv("COSMOS_ENDPOINT")
    settings.COSMOS_KEY = os.getenv("COSMOS_KEY")
    settings.COSMOS_DATABASE = os.getenv("COSMOS_DATABASE", settings.COSMOS_DATABASE) 
    settings.COSMOS_CONTAINER = os.getenv("COSMOS_CONTAINER", settings.COSMOS_CONTAINER)
    if os.getenv("COSMOSDB_DATABASE_NAME") and not settings.COSMOS_DATABASE:
        settings.COSMOS_DATABASE = os.getenv("COSMOSDB_DATABASE_NAME")
    if os.getenv("COSMOSDB_CONTAINER_NAME") and not settings.COSMOS_CONTAINER:
        settings.COSMOS_CONTAINER = os.getenv("COSMOSDB_CONTAINER_NAME")
    
    # Azure AD settings
    settings.AZURE_AD_TENANT_ID = os.getenv("AZURE_AD_TENANT_ID")
    settings.AZURE_AD_CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID")
    settings.AZURE_AD_CLIENT_SECRET = os.getenv("AZURE_AD_CLIENT_SECRET")
    settings.AZURE_AD_SCOPE = os.getenv("AZURE_AD_SCOPE", settings.AZURE_AD_SCOPE) # Load from env, fallback to default
    settings.AZURE_AD_AUTHORITY = os.getenv("AZURE_AD_AUTHORITY", settings.AZURE_AD_AUTHORITY) # Load from env, fallback to default
    settings.AZURE_REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", settings.AZURE_REDIRECT_URI) # Load from env, fallback to default
    # settings.AZURE_AD_APP_SECRET = os.getenv("AZURE_AD_APP_SECRET", settings.AZURE_AD_CLIENT_SECRET)


    # JWT / Authentication settings
    # For internal web session JWT
    # settings.APP_SECRET_KEY = os.getenv("APP_SECRET_KEY", settings.APP_SECRET_KEY)
    settings.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(settings.ACCESS_TOKEN_EXPIRE_MINUTES)))
    
    # For API tokens
    settings.JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", settings.JWT_SECRET_KEY)
    settings.JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", settings.JWT_ALGORITHM) # Ensure this is consistent with your auth.py

    settings.TOKEN_URL = os.getenv("TOKEN_URL", settings.TOKEN_URL)
    settings.DEV_ADMIN_PASSWORD = os.getenv("DEV_ADMIN_PASSWORD", settings.DEV_ADMIN_PASSWORD)
    
    # DEBUG: Print CosmosDB settings to verify .env loading
    # print("[DEBUG] COSMOS_ENDPOINT:", settings.COSMOS_ENDPOINT)
    # print("[DEBUG] COSMOS_KEY:", settings.COSMOS_KEY) 
    # print("[DEBUG] COSMOS_DATABASE:", settings.COSMOS_DATABASE)
    # print("[DEBUG] COSMOS_CONTAINER:", settings.COSMOS_CONTAINER)
    # print("[DEBUG] DEBUG_MODE:", settings.DEBUG_MODE)
    # print("[DEBUG] JWT_SECRET_KEY:", settings.JWT_SECRET_KEY)

    # If connection string is not provided but account name and key are, construct it
    if (not settings.AZURE_STORAGE_CONNECTION_STRING and 
        settings.AZURE_STORAGE_ACCOUNT and 
        settings.AZURE_STORAGE_KEY):
        settings.AZURE_STORAGE_CONNECTION_STRING = (
            f"DefaultEndpointsProtocol=https;"
            f"AccountName={settings.AZURE_STORAGE_ACCOUNT};"
            f"AccountKey={settings.AZURE_STORAGE_KEY};"
            f"EndpointSuffix=core.windows.net" # Added EndpointSuffix
        )
    
    return settings

# For easy import:
# from app.core.config import get_settings
# settings = get_settings()

settings = get_settings() # Add this line to make settings directly importable
