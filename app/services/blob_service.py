from typing import List, Dict, Any, Optional, Tuple
import logging
import io
import os
from datetime import datetime, timedelta
from fastapi import Depends
import mimetypes
from azure.storage.blob import BlobServiceClient, ContentSettings, generate_blob_sas, BlobSasPermissions

from app.core.database import get_async_blob_service_client as get_blob_service_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize cache
IMAGE_LIST_CACHE = {
    'data': None,
    'timestamp': None,
    'expiry': settings.CACHE_EXPIRY_SECONDS
}

IMAGE_PREFIXES_CACHE = {
    'data': None,
    'timestamp': None,
    'expiry': settings.IMAGE_PREFIXES_CACHE_EXPIRY_SECONDS
}

class BlobService:
    def __init__(
        self,
        blob_service_client=Depends(get_blob_service_client)
    ):
        self.blob_service_client = blob_service_client
    
    async def get_blob(self, container_name: str, blob_path: str) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Get a blob from Azure Blob Storage.
        
        Args:
            container_name: The name of the container
            blob_path: The path to the blob within the container
            
        Returns:
            Tuple[Optional[bytes], Optional[str]]: The blob data and content type
        """
        try:
            container_client = self.blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_path)
            
            # Download the blob
            blob_data = blob_client.download_blob().readall()
            
            # Get content type
            properties = blob_client.get_blob_properties()
            content_type = properties.content_settings.content_type
            
            # If content type not set, guess based on file extension
            if not content_type:
                content_type, _ = mimetypes.guess_type(blob_path)
            
            return blob_data, content_type
        except Exception as e:
            logger.error(f"Error downloading blob {blob_path} from container {container_name}: {str(e)}")
            return None, None
    
    async def list_blobs(self, container_name: str, prefix: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List blobs in a container.
        
        Args:
            container_name: The name of the container
            prefix: Optional prefix to filter blobs
            
        Returns:
            List[Dict[str, Any]]: List of blobs and their metadata
        """
        # Check cache if no prefix provided
        if prefix is None and IMAGE_LIST_CACHE['data'] is not None:
            now = datetime.now()
            if (now - IMAGE_LIST_CACHE['timestamp']).total_seconds() < IMAGE_LIST_CACHE['expiry']:
                logger.info("Using cached blob list")
                return IMAGE_LIST_CACHE['data']
        
        try:
            container_client = self.blob_service_client.get_container_client(container_name)
            blobs = []
            
            # List blobs with the specified prefix
            for blob in container_client.list_blobs(name_starts_with=prefix):
                # Extract file name from path
                file_name = os.path.basename(blob.name)
                
                # Get blob properties
                blob_client = container_client.get_blob_client(blob.name)
                properties = blob_client.get_blob_properties()
                
                # Generate SAS URL for direct access
                sas_token = generate_blob_sas(
                    account_name=self.blob_service_client.account_name,
                    container_name=container_name,
                    blob_name=blob.name,
                    account_key=self.blob_service_client.credential.account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.utcnow() + timedelta(hours=1)
                )
                
                blob_info = {
                    "name": blob.name,
                    "file_name": file_name,
                    "size": properties.size,
                    "content_type": properties.content_settings.content_type,
                    "created_on": properties.creation_time,
                    "last_modified": properties.last_modified,
                    "url": f"{blob_client.url}?{sas_token}"
                }
                blobs.append(blob_info)
            
            # Update cache if no prefix
            if prefix is None:
                IMAGE_LIST_CACHE['data'] = blobs
                IMAGE_LIST_CACHE['timestamp'] = datetime.now()
            
            return blobs
        except Exception as e:
            logger.error(f"Error listing blobs in container {container_name}: {str(e)}")
            raise
    
    async def list_prefixes(self, container_name: str) -> List[str]:
        """
        List prefixes (virtual directories) in a container.
        
        Args:
            container_name: The name of the container
            
        Returns:
            List[str]: List of prefixes in the container
        """
        # Check cache
        if IMAGE_PREFIXES_CACHE['data'] is not None:
            now = datetime.now()
            if (now - IMAGE_PREFIXES_CACHE['timestamp']).total_seconds() < IMAGE_PREFIXES_CACHE['expiry']:
                logger.info("Using cached prefix list")
                return IMAGE_PREFIXES_CACHE['data']
        
        try:
            container_client = self.blob_service_client.get_container_client(container_name)
            
            # Get all blobs
            all_blobs = list(container_client.list_blobs())
            
            # Extract unique directories
            prefixes = set()
            for blob in all_blobs:
                path_parts = blob.name.split('/')
                
                # Add each directory level
                for i in range(len(path_parts) - 1):
                    prefixes.add('/'.join(path_parts[:i+1]) + '/')
            
            prefixes_list = sorted(list(prefixes))
            
            # Update cache
            IMAGE_PREFIXES_CACHE['data'] = prefixes_list
            IMAGE_PREFIXES_CACHE['timestamp'] = datetime.now()
            
            return prefixes_list
        except Exception as e:
            logger.error(f"Error listing prefixes in container {container_name}: {str(e)}")
            raise
    
    async def upload_blob(self, container_name: str, blob_path: str, data: bytes, content_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload a blob to Azure Blob Storage.
        
        Args:
            container_name: The name of the container
            blob_path: The path to the blob within the container
            data: The blob data
            content_type: Optional content type
            
        Returns:
            Dict[str, Any]: Information about the uploaded blob
        """
        try:
            container_client = self.blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_path)
            
            # If content type not provided, guess based on file extension
            if not content_type:
                content_type, _ = mimetypes.guess_type(blob_path)
            
            # Set content settings
            content_settings = ContentSettings(content_type=content_type)
            
            # Upload the blob
            blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
            
            # Clear caches
            IMAGE_LIST_CACHE['data'] = None
            IMAGE_PREFIXES_CACHE['data'] = None
            
            return {
                "name": blob_path,
                "file_name": os.path.basename(blob_path),
                "size": len(data),
                "content_type": content_type,
                "url": blob_client.url
            }
        except Exception as e:
            logger.error(f"Error uploading blob {blob_path} to container {container_name}: {str(e)}")
            raise

class BlobStorageService:
    """Service for accessing Azure Blob Storage."""
    
    def __init__(self, client):
        self.client = client
        
    async def get_blob(self, container_name: str, blob_path: str) -> Optional[Tuple[bytes, Optional[str]]]:
        """
        Get a blob from Azure Blob Storage.
        
        Args:
            container_name: The name of the container
            blob_path: The path to the blob within the container
            
        Returns:
            Optional[Tuple[bytes, Optional[str]]]: The blob data and content type if found, None otherwise
        """
        try:
            # Log debug info
            logger.info(f"Retrieving blob: container={container_name}, path={blob_path}")
            
            # Get container client
            container_client = self.client.get_container_client(container_name)
            
            # Get blob client
            blob_client = container_client.get_blob_client(blob_path)
            
            try:
                # Check if blob exists
                if not blob_client.exists():
                    logger.warning(f"Blob {blob_path} not found in container {container_name}")
                    
                    # Try multiple alternative paths
                    alt_paths = []
                    
                    # If path is B2/image.jpg, try B2/cam/image.jpg, B2/images/image.jpg
                    if '/' in blob_path:
                        parts = blob_path.split('/')
                        if len(parts) == 2:
                            batch_id, image_name = parts
                            alt_paths.extend([
                                f"{batch_id}/cam/{image_name}",
                                f"{batch_id}/images/{image_name}",
                                f"{batch_id}/data/{image_name}"
                            ])
                    
                    # If path is B2/cam/image.jpg, try cam/image.jpg
                    if '/' in blob_path:
                        parts = blob_path.split('/')
                        if len(parts) > 2:
                            alt_path = '/'.join(parts[1:])
                            alt_paths.append(alt_path)
                    
                    # Add without extension if it has one
                    if '.' in blob_path:
                        base_path = blob_path.rsplit('.', 1)[0]
                        for ext in ['.jpg', '.jpeg', '.png']:
                            alt_paths.append(f"{base_path}{ext}")
                    
                    # Try each alternative path
                    for alt_path in alt_paths:
                        logger.info(f"Trying alternative blob path: {alt_path}")
                        alt_blob_client = container_client.get_blob_client(alt_path)
                        if alt_blob_client.exists():
                            logger.info(f"Found blob using alternative path: {alt_path}")
                            blob_client = alt_blob_client
                            break
                    
                    # If no alternative paths worked, return None
                    if not blob_client.exists():
                        logger.warning(f"Blob not found after trying all alternative paths")
                        return None
                
                # Download the blob
                blob_data = blob_client.download_blob().readall()
                
                # Get content type
                properties = blob_client.get_blob_properties()
                content_type = properties.content_settings.content_type
                
                # If content type not set, guess based on file extension
                if not content_type:
                    content_type, _ = mimetypes.guess_type(blob_path)
                    
                    # If still no content type, check for common image extensions
                    if not content_type:
                        if blob_path.lower().endswith(('.jpg', '.jpeg')):
                            content_type = 'image/jpeg'
                        elif blob_path.lower().endswith('.png'):
                            content_type = 'image/png'
                        elif blob_path.lower().endswith('.gif'):
                            content_type = 'image/gif'
                        else:
                            content_type = 'application/octet-stream'
                
                logger.info(f"Successfully retrieved blob {blob_path} ({len(blob_data)} bytes), content type: {content_type}")
                return blob_data, content_type
            except Exception as e:
                logger.warning(f"Blob {blob_path} not found in container {container_name}: {str(e)}")
                return None
                
        except Exception as e:
            logger.error(f"Error downloading blob {blob_path} from container {container_name}: {str(e)}")
            return None
            
    async def list_blobs(self, container_name: str, prefix: Optional[str] = None) -> List[str]:
        """
        List blobs in a container.
        
        Args:
            container_name: The name of the container
            prefix: Optional prefix to filter blobs
            
        Returns:
            List[str]: List of blob paths
        """
        try:
            # Get container client
            container_client = self.client.get_container_client(container_name)
            
            # List blobs with the specified prefix
            blob_list = []
            for blob in container_client.list_blobs(name_starts_with=prefix):
                blob_list.append(blob.name)
                
            return blob_list
        except Exception as e:
            logger.error(f"Error listing blobs in container {container_name}: {str(e)}")
            return []
