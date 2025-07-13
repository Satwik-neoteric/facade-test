import logging
from typing import Optional
# Use the asynchronous client from azure.cosmos.aio
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient 
from azure.cosmos import PartitionKey, exceptions as cosmos_exceptions
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient # For consistency, make blob client async too
from functools import lru_cache

from app.core.config import get_settings

# Configure logger
logger = logging.getLogger(__name__)

# Store async clients globally to be managed by lifespan events if needed, or use lru_cache carefully
_async_cosmos_client: Optional[AsyncCosmosClient] = None
_async_blob_service_client: Optional[AsyncBlobServiceClient] = None
_async_cosmos_container = None

# It's generally better to manage async client lifecycles with FastAPI's lifespan events
# For simplicity here, we'll initialize them on first use via lru_cache or a simple global.
# lru_cache is not ideal for async clients that need explicit closing.
# A lifespan manager would be:
# async def lifespan(app: FastAPI):
#     global _async_cosmos_client, _async_blob_service_client
#     settings = get_settings()
#     _async_cosmos_client = AsyncCosmosClient(url=settings.COSMOS_ENDPOINT, credential=settings.COSMOS_KEY)
#     _async_blob_service_client = AsyncBlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
#     yield
#     await _async_cosmos_client.close()
#     await _async_blob_service_client.close()
# app = FastAPI(lifespan=lifespan)

# Using lru_cache for simplicity, but be aware of potential issues with async client closing.
@lru_cache()
def get_settings_cached(): # Helper to cache settings for functions below
    return get_settings()

async def get_async_cosmos_client() -> AsyncCosmosClient:
    """
    Get a singleton asynchronous CosmosDB client instance.
    """
    global _async_cosmos_client
    if _async_cosmos_client is None:
        settings = get_settings_cached()
        if not settings.COSMOS_ENDPOINT or not settings.COSMOS_KEY:
            logger.error("CosmosDB credentials not configured")
            raise ValueError("CosmosDB credentials not configured")
        try:            
            _async_cosmos_client = AsyncCosmosClient(
                url=settings.COSMOS_ENDPOINT, 
                credential=settings.COSMOS_KEY)
            logger.info("Successfully initialized asynchronous Cosmos DB client")
        except Exception as e:
            logger.error(f"Failed to initialize asynchronous Cosmos DB client: {e}")
            raise
        return _async_cosmos_client
    return _async_cosmos_client

async def get_cosmos_container(database_name: Optional[str] = None, container_name: Optional[str] = None): # Made async
    """
    Get an asynchronous CosmosDB container instance.
    """
    settings = get_settings_cached()
    client = await get_async_cosmos_client() # Use the async client and await it
    
    db_name = database_name or settings.COSMOS_DATABASE
    container_id = container_name or settings.COSMOS_CONTAINER # Renamed to avoid conflict
    
    try:
        database_client = client.get_database_client(db_name)
        # For async, creating database/container if not exists needs to be async
        # However, the SDK might handle this transparently or require explicit async calls.
        # Let's assume get_container_client works or we might need to create them explicitly if they don't exist.
        # The sync SDK's .read() to check existence isn't directly available/needed in the same way for async.
        # Often, you'd just try to get the client and handle exceptions if it doesn't exist.
        # For simplicity, we'll assume they exist or are created elsewhere, 
        # or rely on later operations to fail if they don't.
        # A more robust approach would be to explicitly check and create if needed using async methods.
        
        container_client = database_client.get_container_client(container_id)
        # To verify existence with async client, you might try a lightweight operation like reading container properties
        # await container_client.read() # This would be an async call
        logger.info(f"Retrieved async container client for: {db_name}/{container_id}")
        return container_client
    except cosmos_exceptions.CosmosResourceNotFoundError:
        logger.error(f"Database '{db_name}' or container '{container_id}' not found.")
        # If auto-creation is desired, it needs to be implemented with async calls:
        # db = await client.create_database_if_not_exists(id=db_name)
        # cont = await db.create_container_if_not_exists(id=container_id, partition_key=PartitionKey(path="/id"))
        # return cont
        raise
    except Exception as e:
        logger.error(f"Error getting async CosmosDB container {db_name}/{container_id}: {e}")
        raise

def get_async_blob_service_client() -> AsyncBlobServiceClient:
    """
    Get a singleton asynchronous Blob Service client instance.
    """
    global _async_blob_service_client
    if _async_blob_service_client is None:
        settings = get_settings_cached()
        if not settings.AZURE_STORAGE_CONNECTION_STRING:
            logger.error("Azure Blob Storage connection string not configured")
            raise ValueError("Azure Blob Storage connection string not configured")
        try:
            _async_blob_service_client = AsyncBlobServiceClient.from_connection_string(
                settings.AZURE_STORAGE_CONNECTION_STRING
            )
            logger.info("Successfully initialized asynchronous Azure Blob Storage client")
        except Exception as e:
            logger.error(f"Failed to initialize asynchronous Azure Blob Storage client: {e}")
            raise
    return _async_blob_service_client

# The old synchronous functions are removed or commented out to avoid confusion
# @lru_cache()
# def get_cosmos_client() -> CosmosClient: ...
# def get_cosmos_container(...) -> Container: ... (sync version)
# @lru_cache()
# def get_blob_service_client() -> BlobServiceClient: ...

# Note: Proper async client lifecycle management (startup/shutdown) is recommended
# using FastAPI's lifespan events, especially for production.
# The global instance approach here is simplified.
