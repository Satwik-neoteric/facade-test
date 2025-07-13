import logging, asyncio
from typing import List, Optional, Iterator, Tuple, AnyStr, IO
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient, ContentSettings
from azure.core.exceptions import ResourceNotFoundError, AzureError
from ..core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class BlobStorageService:
    def __init__(self, *, client: Optional[BlobServiceClient] = None): # client is keyword-only
        # VERY IMPORTANT: THIS IS THE LATEST VERSION OF __INIT__
        print("<<<<< BlobStorageService __init__ v_MAY13_REFINED >>>>>") # Distinctive print
        logger.info("BlobStorageService __init__ called (v_MAY13_REFINED with keyword-only client and unified client logic).")
        
        self._blob_service_client: Optional[BlobServiceClient] = None

        if client:
            logger.info("BlobStorageService: Initializing with provided client instance.")
            self._blob_service_client = client
        elif settings.AZURE_STORAGE_CONNECTION_STRING:
            logger.info("BlobStorageService: Initializing with connection string.")
            try:
                # Configure connection pooling for better performance
                self._blob_service_client = BlobServiceClient.from_connection_string(
                    settings.AZURE_STORAGE_CONNECTION_STRING,
                    max_single_get_size=32*1024*1024,  # 32MB chunks
                    max_chunk_get_size=4*1024*1024,    # 4MB per chunk
                    max_single_put_size=64*1024*1024,  # 64MB single upload
                    max_block_size=4*1024*1024,        # 4MB block size
                    timeout=300                         # 5 minute timeout
                )
                logger.info("BlobStorageService: BlobServiceClient created successfully from connection string.")
            except ValueError as e:
                logger.error(f"BlobStorageService: Invalid Azure Storage connection string: {e}")
                # Allow _blob_service_client to remain None, handled by checks using the client
            except AzureError as e:
                logger.error(f"BlobStorageService: Azure SDK error during BlobServiceClient creation: {e}")
                # Allow _blob_service_client to remain None
        else:
            logger.warning("BlobStorageService: Neither client instance provided nor Azure Storage connection string configured. Service may not function as expected.")
        
        # Use AZURE_INPUT_CONTAINER as the default container for this service instance
        self.container_name = settings.AZURE_INPUT_CONTAINER
        if not self.container_name:
            logger.error("AZURE_INPUT_CONTAINER is not set in settings. BlobStorageService cannot determine a default container.")
            # This was previously a ValueError. Depending on usage, service might be partially usable
            # or this might be a critical failure. For now, log and proceed; calling code must check client/container.
            # raise ValueError("Azure Storage input container name (AZURE_INPUT_CONTAINER) is not configured.")
        
        logger.info(f"BlobStorageService initialized for default container: '{self.container_name}'. Client is {'set' if self._blob_service_client else 'not set'}.")

    @property
    def client(self) -> Optional[BlobServiceClient]:
        """The active BlobServiceClient instance."""
        return self._blob_service_client

    @property
    def blob_service_client(self) -> Optional[BlobServiceClient]:
        """Provides access to the BlobServiceClient. Consider using the .client property."""
        return self._blob_service_client

    def get_container_client(self, container_name: Optional[str] = None) -> Optional[ContainerClient]:
        effective_container_name = container_name if container_name else self.container_name
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot get container client.")
            return None
        if not effective_container_name:
            logger.error("Container name not specified and default container name is not set. Cannot get container client.")
            return None
        try:
            return self._blob_service_client.get_container_client(effective_container_name)
        except AzureError as e:
            logger.error(f"Error getting container client for '{effective_container_name}': {e}")
            return None

    def get_blob_client(self, blob_name: str, container_name: Optional[str] = None) -> Optional[BlobClient]:
        effective_container_name = container_name if container_name else self.container_name
        if not effective_container_name:
            logger.error("Container name not specified and default container name is not set. Cannot get blob client.")
            return None
            
        container_client = self.get_container_client(effective_container_name)
        if not container_client:
            return None
        try:
            return container_client.get_blob_client(blob_name)
        except AzureError as e:
            logger.error(f"Error getting blob client for '{effective_container_name}/{blob_name}': {e}")
            return None

    async def list_prefixes(self, container_name: Optional[str] = None, name_starts_with: Optional[str] = None) -> List[str]:
        effective_container_name = container_name if container_name else self.container_name
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot list prefixes.")
            return []
        if not effective_container_name:
            logger.error("Container name not specified and default container name is not set. Cannot list prefixes.")
            return []
        
        container_client = self.get_container_client(effective_container_name)
        if not container_client:
            return []

        prefixes: List[str] = []
        try:
            # Using walk_blobs with a delimiter is a common way to find "virtual folders" / prefixes
            # For this example, we'll iterate and extract unique parent paths if a delimiter isn't explicitly used.
            # This mimics some patterns but might need adjustment based on exact prefix definition.
            blob_iter = container_client.list_blobs(name_starts_with=name_starts_with)
            seen_prefixes = set()
            for blob in blob_iter:
                if '/' in blob.name:
                    prefix = blob.name.split('/')[0]
                    if prefix not in seen_prefixes:
                        prefixes.append(prefix)
                        seen_prefixes.add(prefix)
            return prefixes
        except AzureError as e:
            logger.error(f"Error listing prefixes in container '{effective_container_name}': {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing prefixes in container '{effective_container_name}': {e}", exc_info=True)
            return []

    async def list_blobs(self, container_name: Optional[str] = None, name_starts_with: Optional[str] = None) -> List[str]:
        effective_container_name = container_name if container_name else self.container_name
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot list blobs.")
            return []
        if not effective_container_name:
            logger.error("Container name not specified and default container name is not set. Cannot list blobs.")
            return []

        container_client = self.get_container_client(effective_container_name)
        if not container_client:
            return []

        blob_names: List[str] = []
        try:
            blob_iter = container_client.list_blobs(name_starts_with=name_starts_with)
            for blob in blob_iter:
                blob_names.append(blob.name)
            return blob_names
        except AzureError as e:
            logger.error(f"Error listing blobs in container '{effective_container_name}': {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing blobs in container '{effective_container_name}': {e}", exc_info=True)
            return []

    def upload_blob(self, container_name: str, blob_name: str, data: IO[AnyStr], content_type: Optional[str] = None) -> Optional[str]:
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot upload blob.")
            return None
        
        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return None

        try:
            content_settings = ContentSettings(content_type=content_type) if content_type else None
            blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
            logger.info(f"Successfully uploaded blob: {container_name}/{blob_name}")
            return blob_client.url
        except ResourceNotFoundError:
            logger.error(f"Container '{container_name}' not found for upload.")
            return None
        except AzureError as e:
            logger.error(f"Azure error uploading blob '{container_name}/{blob_name}': {e}")
            return None
        except Exception as e: # Catch any other unexpected errors during upload
            logger.error(f"Unexpected error uploading blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return None

    def download_blob(self, container_name: str, blob_name: str) -> Optional[bytes]:
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot download blob.")
            return None

        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return None
        try:
            download_stream = blob_client.download_blob()
            return download_stream.readall()
        except ResourceNotFoundError:
            logger.warning(f"Blob '{container_name}/{blob_name}' not found for download.")
            return None
        except AzureError as e:
            logger.error(f"Azure error downloading blob '{container_name}/{blob_name}': {e}")
            return None
        except Exception as e: # Catch any other unexpected errors during download
            logger.error(f"Unexpected error downloading blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return None

    def delete_blob(self, container_name: str, blob_name: str) -> bool:
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot delete blob.")
            return False
        
        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return False
        try:
            blob_client.delete_blob()
            logger.info(f"Successfully deleted blob: {container_name}/{blob_name}")
            return True
        except ResourceNotFoundError:
            logger.warning(f"Blob '{container_name}/{blob_name}' not found for deletion.")
            return False # Or True if "delete if exists" behavior is desired and not finding is success
        except AzureError as e:
            logger.error(f"Azure error deleting blob '{container_name}/{blob_name}': {e}")
            return False
        except Exception as e: # Catch any other unexpected errors
            logger.error(f"Unexpected error deleting blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return False
            
    def get_blob_properties(self, container_name: str, blob_name: str) -> Optional[dict]:
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot get blob properties.")
            return None

        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return None
        try:
            properties = blob_client.get_blob_properties()
            return {
                "name": properties.name,
                "container": properties.container,
                "size": properties.size,
                "last_modified": properties.last_modified,
                "content_type": properties.content_settings.content_type,
                "etag": properties.etag
            }
        except ResourceNotFoundError:
            logger.warning(f"Blob '{container_name}/{blob_name}' not found when getting properties.")
            return None
        except AzureError as e:
            logger.error(f"Azure error getting properties for blob '{container_name}/{blob_name}': {e}")
            return None
        except Exception as e: # Catch any other unexpected errors
            logger.error(f"Unexpected error getting properties for blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return None

    def allowed_file(self, filename: str, allowed_extensions: Optional[List[str]] = None) -> bool:
        """Checks if a filename has an allowed extension."""
        if allowed_extensions is None:
            allowed_extensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"] # Default image extensions
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in [ext.lstrip('.').lower() for ext in allowed_extensions]

    async def download_blob_content(self, container_name: str, blob_name: str) -> Optional[bytes]:
        """Asynchronous version of download_blob."""
        import asyncio
        
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot download blob.")
            return None

        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return None
        
        try:
            # Run the synchronous download in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            download_stream = await loop.run_in_executor(
                None, 
                blob_client.download_blob
            )
            # Read the content in the executor as well to avoid blocking
            content = await loop.run_in_executor(
                None,
                download_stream.readall
            )
            return content
        except ResourceNotFoundError:
            logger.warning(f"Blob '{container_name}/{blob_name}' not found for download.")
            return None
        except AzureError as e:
            logger.error(f"Azure error downloading blob '{container_name}/{blob_name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error downloading blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return None
        
    async def blob_exists(self, container_name: str, blob_name: str) -> bool:
        """
        Check if a blob exists in the specified container.
        
        Args:
            container_name: The name of the container
            blob_name: The name of the blob to check
            
        Returns:
            bool: True if the blob exists, False otherwise
        """
        
        if not self._blob_service_client:
            logger.error("BlobServiceClient not initialized. Cannot check if blob exists.")
            return False
            
        blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
        if not blob_client:
            return False
            
        try:
            # Run the synchronous call in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                blob_client.get_blob_properties
            )
            return True
        except ResourceNotFoundError:
            logger.debug(f"Blob '{container_name}/{blob_name}' does not exist.")
            return False
        except AzureError as e:
            logger.error(f"Azure error checking existence of blob '{container_name}/{blob_name}': {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error checking existence of blob '{container_name}/{blob_name}': {e}", exc_info=True)
            return False

    async def get_blob_properties_async(self, container_name: str, blob_name: str) -> Optional[dict]:
        """
        Get properties of a blob asynchronously (wrapper for synchronous method).
        
        Args:
            container_name: The name of the container
            blob_name: The name of the blob to check
            
        Returns:
            Optional[dict]: Dictionary with blob properties or None if blob not found
        """
        # This is a wrapper around the sync method. In a true async implementation,
        # you would use an async Azure SDK client.
        return self.get_blob_properties(container_name, blob_name)