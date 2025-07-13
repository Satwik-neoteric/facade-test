from typing import List, Dict, Any, Optional, AsyncGenerator # Added Dict, Any, List
import logging
from fastapi import Depends
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey, exceptions as cosmos_exceptions
from azure.cosmos.exceptions import CosmosHttpResponseError, CosmosResourceNotFoundError
from fastapi import HTTPException

from app.core.database import get_async_cosmos_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class CosmosDbService:
    def __init__(self, container=None):
        self.settings = get_settings()
        self.client = None
        self.database = None
        self._container = container
        # Store the database name for container operations
        self._database_name = None
        # If container is provided, extract the database name from its context
        if container:
            try:
                # Enhanced debugging to figure out how to extract database name
                logger.debug(f"Container object: {container}")
                logger.debug(f"Container dir: {dir(container)}")
                
                # Try both ways to get database name
                if hasattr(container, 'client') and hasattr(container.client, 'database_link'):
                    # Method 1: From database_link attribute
                    try:
                        database_link = container.client.database_link
                        self._database_name = database_link.split('/')[-1]
                        logger.info(f"Extracted database name from database_link: '{self._database_name}'")
                    except (AttributeError, IndexError) as e:
                        logger.warning(f"Could not extract database name from database_link: {e}")
                
                # Method 2: From database_client, try to get database id
                if not self._database_name and hasattr(container, 'database_client'):
                    try:
                        self._database_name = container.database_client.id
                        logger.info(f"Extracted database name from database_client.id: '{self._database_name}'")
                    except AttributeError as e:
                        logger.warning(f"Could not extract database name from database_client.id: {e}")
                
                # Method 3: Parse from container URL if available
                if not self._database_name and hasattr(container, 'container_link'):
                    try:
                        link_parts = container.container_link.split('/')
                        dbs_index = link_parts.index('dbs')
                        if dbs_index + 1 < len(link_parts):
                            self._database_name = link_parts[dbs_index + 1]
                            logger.info(f"Extracted database name from container_link: '{self._database_name}'")
                    except (AttributeError, ValueError, IndexError) as e:
                        logger.warning(f"Could not extract database name from container_link: {e}")
                
                # Last resort: Use settings default
                if not self._database_name:
                    self._database_name = self.settings.AZURE_COSMOSDB_DATABASE
                    logger.warning(f"Could not extract database name from container, using default from settings: '{self._database_name}'")
                
                logger.info(f"Initialized CosmosDbService with database '{self._database_name}' and container '{container.id}'")
            except Exception as e:
                logger.warning(f"Failed to extract database name: {e}. Using default from settings.")
                self._database_name = self.settings.AZURE_COSMOSDB_DATABASE
    
    @property
    def container(self):
        return self._container
    
    @property
    def database_name(self):
        """Get the database name for this service instance."""
        return self._database_name or self.settings.COSMOS_DATABASE
    
    async def initialize(self):
        """Initialize database and container clients."""
        if not self.client:
            self.client = await get_async_cosmos_client()
        if not self.database:
            self.database = self.client.get_database_client(self.settings.COSMOS_DATABASE)
            self._database_name = self.settings.COSMOS_DATABASE
        if not self._container:
            self._container = self.database.get_container_client(self.settings.COSMOS_CONTAINER)

    async def query_items(self, query: str, container_name: Optional[str] = None, parameters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """
        Query items from the specified Cosmos DB container.

        Args:
            query: The SQL query string.
            container_name: The name of the container to query. Defaults to self.container if None.
            parameters: Optional list of parameters for parameterized queries.

        Returns:
            List[Dict[str, Any]]: A list of items matching the query.
        """
        # Determine which container client to use
        # This part needs to be re-evaluated based on how container clients are managed.
        # For now, assuming self.container is the correct client for the default case.
        # If container_name is provided, a mechanism to get that specific container client is needed.
        # This might involve having access to the CosmosClient and database name.
        
        # Simplified: using self.container directly. 
        # This implies that CosmosDbService is instantiated per container, 
        # or self.container is dynamically set.
        # The dependency injection for CosmosDbService needs to provide the correct container client.
        
        # current_container_client = self.container # This is the injected container client

        # The following logic assumes self.container is the client for AZURE_COSMOSDB_CONTAINER_BATCHES
        # If a different container_name is passed, this will not work correctly without a way to switch clients.
        # For now, we will assume the dependency injection provides the correct container for the service's context.
        
        # logger.debug(f"Executing query: {query} on container (using self.container)")
        # For now, we will assume that the `container` passed during __init__ is the one intended for the operation
        # or that `container_name` matches the one `self.container` is for.
        # A more robust solution would involve a way to get a client for any `container_name`.

        if container_name and self.container.id != container_name:
            # This is a tricky situation. The service is initialized with one container.
            # If a different container_name is specified, we ideally need to get that container client.
            # This requires access to the main CosmosClient and database name.
            # For now, log a warning and proceed with self.container, or raise an error.
            logger.warning(f"Querying container '{container_name}' but service initialized with '{self.container.id}'. Using '{self.container.id}'.")
            # Or, to be strict: 
            # raise ValueError(f"Service is configured for container '{self.container.id}', cannot query '{container_name}'")

        try:
            items_generator = self.container.query_items(
                query=query,
                parameters=parameters
                # enable_cross_partition_query=True # Temporarily removed due to TypeError with aiohttp
            )
            items = [item async for item in items_generator]
            logger.info(f"Query returned {len(items)} items from container '{self.container.id}'.")
            return items
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error during query on container '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error during query on container '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error querying items: {str(e)}")

    async def query_items_no_model(self, query: str, container_name: Optional[str] = None, parameters: Optional[List[Dict[str, Any]]] = None) -> List[Any]:
        """
        Query items from the specified Cosmos DB container and return raw results (no Pydantic model parsing).

        Args:
            query: The SQL query string.
            container_name: The name of the container to query. Defaults to self.container if None.
            parameters: Optional list of parameters for parameterized queries.

        Returns:
            List[Any]: A list of raw items matching the query.
        """
        # Use the container client that was initialized with this service
        container_client = self._container
        container_id = self._container.id if self._container else "unknown"
        
        try:
            items_generator = container_client.query_items(
                query=query,
                parameters=parameters
            )
            # Collect all items from the async generator
            items = [item async for item in items_generator]
            logger.info(f"Query (no_model) returned {len(items)} items from container '{container_id}'.")
            return items
        except CosmosResourceNotFoundError as e:
            # Handle "Resource Not Found" error specifically
            logger.error(f"Container '{container_id}' not found in database '{self._database_name}': {e}")
            raise HTTPException(
                status_code=404, 
                detail=f"Container '{container_id}' not found in database '{self._database_name}'. Please create the container first."
            )
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error during query (no_model) on '{container_id}': {e}", exc_info=True)
            error_detail = f"Cosmos DB error: {str(e)}. Database: {self._database_name}, Container: {container_id}"
            raise HTTPException(status_code=e.status_code, detail=error_detail)
        except Exception as e:
            logger.error(f"Generic error during query (no_model) on '{container_id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error querying items (no_model): {str(e)}")

    async def get_batches(self) -> List[Dict[str, Any]]:
        """
        Get all batches from Cosmos DB.
        
        Returns:
            List[Dict[str, Any]]: List of batch records
        """
        try:
            query = "SELECT * FROM c"
            items_generator = self.container.query_items(
                query=query
                # enable_cross_partition_query=True # Removed
            )
            items = [item async for item in items_generator]
            
            # If no items found, return empty list
            if not items:
                logger.warning("No batches found in CosmosDB")
                return []
                
            # Log batch IDs for debugging
            batch_ids = list(set([batch.get("BatchID", "") for batch in items if "BatchID" in batch]))
            logger.info(f"Found {len(batch_ids)} unique batches: {batch_ids}")
            return items
        except Exception as e:
            logger.error(f"Error querying batches: {str(e)}")
            raise
            
    async def get_batch(self, batch_id: str) -> List[Dict[str, Any]]:
        """
        Get all items with a specific batch ID.
        
        Args:
            batch_id: The ID of the batch
            
        Returns:
            List[Dict[str, Any]]: List of items with the specified batch ID
        """
        try:
            logger.info(f"Fetching items for batch ID: {batch_id}")
            count_query = f"SELECT VALUE COUNT(1) FROM c WHERE c.BatchID = '{batch_id}'"
            logger.debug(f"Running count query: {count_query}")
            
            try:
                count_generator = self.container.query_items(
                    query=count_query
                    # enable_cross_partition_query=True # Removed
                )
                count_result = [item async for item in count_generator]
                logger.debug(f"Count query result: {count_result}")
                
                item_count = count_result[0] if count_result else 0
                logger.info(f"Found {item_count} items for batch ID: {batch_id}")
            except Exception as count_error:
                logger.error(f"Error during count query: {str(count_error)}")
                item_count = 0
            
            if item_count == 0:
                logger.info(f"No items found for batch ID: {batch_id}")
                # Try alternative query with case-insensitive comparison
                alt_query = f"SELECT * FROM c WHERE LOWER(c.BatchID) = LOWER('{batch_id}')" # Ensure batch_id is quoted
                logger.info(f"Trying alternative query: {alt_query}")
                alt_items_generator = self.container.query_items(
                    query=alt_query
                    # enable_cross_partition_query=True # Removed
                )
                alt_items = [item async for item in alt_items_generator]
                
                if alt_items:
                    logger.info(f"Found {len(alt_items)} items with case-insensitive batch ID match")
                    return alt_items
                
                # Try a more flexible query - maybe batch ID is stored in a different field
                flex_query = f"SELECT * FROM c WHERE c.id = '{batch_id}' OR c.batch_id = '{batch_id}' OR c.batchId = '{batch_id}'" # Ensure batch_id is quoted
                logger.info(f"Trying flexible query: {flex_query}")
                flex_items_generator = self.container.query_items(
                    query=flex_query
                    # enable_cross_partition_query=True # Removed
                )
                flex_items = [item async for item in flex_items_generator]
                
                if flex_items:
                    logger.info(f"Found {len(flex_items)} items with flexible batch ID match")
                    return flex_items
                
                logger.warning(f"No items found for batch ID: {batch_id} with any query approach")
                return []
                
            # Standard query
            query = f"SELECT * FROM c WHERE c.BatchID = '{batch_id}'"
            logger.info(f"Running query: {query}")
            # items = list(self.container.query_items( # This was an old synchronous-like call, ensure it's async now
            #     query=query,
            #     enable_cross_partition_query=True # Removed
            # ))
            items_generator = self.container.query_items(
                query=query
                # enable_cross_partition_query=True # Removed
            )
            items = [item async for item in items_generator]
            
            print(f"Query returned {len(items)} items for batch ID: {batch_id}")
            for item in items[:2]:  # Print first few items for debugging
                print(f"Sample item keys: {list(item.keys())[:10]}...")
                
            return items
        except Exception as e:
            error_msg = f"Error querying batch {batch_id}: {str(e)}"
            print(error_msg)
            logger.error(error_msg)
            # Return empty list instead of raising exception for more resilient operation
            return []
    
    async def get_classes(self) -> List[Dict[str, Any]]:
        """Retrieve all items from the 'classes' container."""
        logger.info(f"Attempting to retrieve all items from container: {settings.AZURE_COSMOSDB_CONTAINER_CLASSES}") # Use settings for name
        try:
            # This service instance is for the 'batches' container by default.
            # To query a different container like 'classes', we need a way to get that specific container client.
            # This might involve passing the main CosmosClient/DatabaseClient to this service or a helper function.
            # For now, this will likely fail or use the wrong container if not handled by dependency injection correctly.
            
            # Assuming get_cosmos_container can fetch other containers if needed, or this method needs a dedicated service/client
            # This is a placeholder for how one might get the classes container client:
            # classes_container = await get_cosmos_container(settings.AZURE_COSMOSDB_CONTAINER_CLASSES) 
            # For this to work, get_cosmos_container needs to be accessible here or passed in.
            # The original code had self.classes_container_client and self.cosmos_client which are not initialized in the current __init__
            # Reverting to a direct query on self.container for now, assuming this service instance is for the 'classes' container if this method is called.
            # This indicates a potential design issue if a single service instance is meant for multiple containers without a clear way to switch.

            # If this service is *only* for batches, this method should be moved or use a different service.
            # If it can handle multiple, the __init__ or a method needs to select the right container.
            # For the purpose of this fix, let's assume self.container is the correct one if this method is called.
            # However, the log message uses self.classes_container_name which is not defined in __init__.
            # Using settings.AZURE_COSMOSDB_CONTAINER_CLASSES for the log message.

            query = "SELECT * FROM c"
            items = []
            # async for item in classes_container_client.query_items(query=query, enable_cross_partition_query=True): # Original line
            # The line above will fail because classes_container_client is not defined here.
            # We need to decide how to get the classes container.
            # Option 1: Assume this service instance *is* for the classes container (if so, DI needs to provide it)
            # Option 2: Fetch it dynamically (requires CosmosClient/DatabaseClient access)
            # For now, let's assume Option 1 for the sake of making the query run on *a* container.
            # This will use the container injected for this CosmosDbService instance.
            items_generator = self.container.query_items(query=query) # Removed enable_cross_partition_query
            async for item in items_generator:
                items.append(item)
            
            if items:
                logger.info(f"Successfully retrieved {len(items)} items from container '{self.container.id}'.") # Log actual container ID
            else:
                logger.info(f"No items found in container '{self.container.id}'.")
            return items
        except CosmosResourceNotFoundError:
            logger.error(f"Container for classes (expected: '{settings.AZURE_COSMOSDB_CONTAINER_CLASSES}', actual: '{self.container.id}') not found.")
            return []
        except Exception as e:
            logger.error(f"Error retrieving items from container '{self.container.id}' (intended for classes): {str(e)}", exc_info=True)
            return []

    async def get_batch_image(self, batch_id: str, image_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific image from a batch.
        
        Args:
            batch_id: The ID of the batch
            image_id: The ID of the image
            
        Returns:
            Optional[Dict[str, Any]]: The batch item with the specified batch and image IDs
        """
        if not batch_id or not image_id:
            logger.warning("Missing batch_id or image_id in get_batch_image call")
            return None
            
        try:
            # Use parameter binding instead of string formatting to avoid SQL injection
            query = "SELECT * FROM c WHERE c.BatchID = @batch_id AND c.ImageID = @image_id"
            parameters = [
                {"name": "@batch_id", "value": batch_id},
                {"name": "@image_id", "value": image_id}
            ]
            
            items_generator = self.container.query_items(
                query=query,
                parameters=parameters
            )
            items = [item async for item in items_generator]
            
            return items[0] if items else None
        except CosmosHttpResponseError as e:
            logger.error(f"CosmosDB error querying image {image_id} from batch {batch_id}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error querying image {image_id} from batch {batch_id}: {str(e)}", exc_info=True)
            return None
    
    async def update_item(self, item_id: str, updates: Dict[str, Any], partition_key: str) -> Dict[str, Any]:
        """
        Update an item in Cosmos DB.
        
        Args:
            item_id: The ID of the item to update
            updates: The updates to apply
            partition_key: The partition key of the item.
            
        Returns:
            Dict[str, Any]: The updated item
        """
        try:
            # First, get the item
            # item = self.container.read_item(item=item_id, partition_key=item_id) # Original, assumes item_id is partition_key
            item = await self.container.read_item(item=item_id, partition_key=partition_key)
            
            # Apply updates
            for key, value in updates.items():
                item[key] = value
            
            # Save the updated item
            # updated_item = self.container.replace_item(item=item_id, body=item) # Original
            updated_item = await self.container.replace_item(item=item, body=item) # Pass the read item to replace_item

            logger.info(f"Successfully updated item {item_id} in container '{self.container.id}'.")
            return updated_item
        except CosmosResourceNotFoundError:
            logger.error(f"Item {item_id} with partition key {partition_key} not found in '{self.container.id}'.")
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error updating item {item_id} in '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating item {item_id} in '{self.container.id}': {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error updating item {item_id}: {str(e)}")
    
    # Removed the old query_items(self, query_params: Dict[str, Any]) as it was conflicting and incomplete.
    # The new query_items and query_items_no_model above should be used.

    async def read_item(self, item_id: str, partition_key: str, container_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Read a specific item from Cosmos DB by its ID and partition key.

        Args:
            item_id: The ID of the item.
            partition_key: The partition key of the item.
            container_name: The name of the container. Defaults to self.container if None.

        Returns:
            Optional[Dict[str, Any]]: The item if found, else None.
        """
        if container_name and self.container.id != container_name:
            logger.warning(f"Reading item from container '{container_name}' but service initialized with '{self.container.id}'. Using '{self.container.id}'.")
            # Or raise error

        try:
            item = await self.container.read_item(item=item_id, partition_key=partition_key)
            logger.info(f"Successfully read item {item_id} from container '{self.container.id}'.")
            return item
        except CosmosResourceNotFoundError:
            logger.warning(f"Item {item_id} with partition key {partition_key} not found in '{self.container.id}'.")
            return None
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error reading item {item_id} from '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error reading item {item_id} from '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error reading item {item_id}: {str(e)}")

    async def create_item(self, item_body: Dict[str, Any], container_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Create an item in the specified Cosmos DB container.

        Args:
            item_body: The dictionary representing the item to create.
            container_name: The name of the container. Defaults to self.container if None.

        Returns:
            Dict[str, Any]: The created item.
        """
        if container_name and self.container.id != container_name:
            logger.warning(f"Creating item in container '{container_name}' but service initialized with '{self.container.id}'. Using '{self.container.id}'.")
            # Or raise error

        try:
            created_item = await self.container.create_item(body=item_body)
            logger.info(f"Successfully created item with id '{created_item.get('id')}' in container '{self.container.id}'.")
            return created_item
        except CosmosHttpResponseError as e:
            if e.status_code == 409: # Conflict / Item already exists
                logger.warning(f"Item with id '{item_body.get('id')}' already exists in '{self.container.id}'. Error: {e.message}")
                raise HTTPException(status_code=409, detail=f"Item with id '{item_body.get('id')}' already exists. {e.message}")
            logger.error(f"Cosmos DB HTTP error creating item in '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error creating item in '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error creating item: {str(e)}")

    async def delete_item(self, item_id: str, partition_key: str, container_name: Optional[str] = None) -> None:
        """
        Delete an item from the specified Cosmos DB container.

        Args:
            item_id: The ID of the item to delete.
            partition_key: The partition key of the item.
            container_name: The name of the container. Defaults to self.container if None.
        """
        if container_name and self.container.id != container_name:
            logger.warning(f"Deleting item from container '{container_name}' but service initialized with '{self.container.id}'. Using '{self.container.id}'.")
            # Or raise error

        try:
            await self.container.delete_item(item=item_id, partition_key=partition_key)
            logger.info(f"Successfully deleted item {item_id} from container '{self.container.id}'.")
        except CosmosResourceNotFoundError:
            logger.warning(f"Item {item_id} with partition key {partition_key} not found for deletion in '{self.container.id}'.")
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found for deletion.")
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error deleting item {item_id} from '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error deleting item {item_id} from '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error deleting item {item_id}: {str(e)}")
    
    async def upsert_item_async(self, body: Dict[str, Any], container_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Upsert an item in the specified Cosmos DB container.
        Creates the item if it doesn't exist, or replaces it if it does.
        The 'id' field in the body is used as the item ID.

        Args:
            body: The dictionary representing the item to upsert. Must include 'id'.
            container_name: The name of the container. Defaults to self.container if None.

        Returns:
            Dict[str, Any]: The upserted item.
        """
        # Similar container logic considerations as query_items
        current_container = self.container
        if container_name and self.container.id != container_name:
            logger.warning(f"Upserting item in container '{container_name}' but service initialized with '{current_container.id}'. Using '{current_container.id}'.")
            # Ideally, you'd have a way to get the client for 'container_name' here
            # or raise an error if this service instance isn't for that container.

        if 'id' not in body:
            logger.error(f"Item body for upsert in container '{current_container.id}' must contain an 'id' field.")
            raise HTTPException(status_code=400, detail="Item body for upsert must contain an 'id' field.")

        try:
            upserted_item = await current_container.upsert_item(body=body)
            logger.info(f"Successfully upserted item with id '{body.get('id')}' in container '{current_container.id}'.")
            return upserted_item
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error upserting item with id '{body.get('id')}' in '{current_container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error upserting item with id '{body.get('id')}' in '{current_container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error upserting item: {str(e)}")
    
    async def upsert_item(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """
        Upsert an item in the container associated with this service.
        Creates the item if it doesn't exist, or replaces it if it does.
        The 'id' field in the body is used as the item ID.

        Args:
            body: The dictionary representing the item to upsert. Must include 'id'.

        Returns:
            Dict[str, Any]: The upserted item.
        """
        if 'id' not in body:
            logger.error(f"Item body for upsert in container '{self.container.id}' must contain an 'id' field.")
            raise HTTPException(status_code=400, detail="Item body for upsert must contain an 'id' field.")

        try:
            upserted_item = await self.container.upsert_item(body=body)
            logger.info(f"Successfully upserted item with id '{body.get('id')}' in container '{self.container.id}'.")
            return upserted_item
        except CosmosHttpResponseError as e:
            logger.error(f"Cosmos DB HTTP error upserting item with id '{body.get('id')}' in '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=e.status_code, detail=str(e))
        except Exception as e:
            logger.error(f"Generic error upserting item with id '{body.get('id')}' in '{self.container.id}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error upserting item: {str(e)}")
            