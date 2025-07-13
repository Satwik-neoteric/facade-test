from fastapi import Depends, HTTPException, status
from typing import Dict, List, Any
import logging
import os
import json
from azure.cosmos import exceptions as cosmos_exceptions
from azure.storage.blob import exceptions as blob_exceptions

from app.core.config import get_settings
from app.core.database import get_cosmos_container, get_blob_service_client
from app.services.cosmos_service import CosmosService
from app.services.blob_service import BlobService

logger = logging.getLogger(__name__)
settings = get_settings()

class SystemService:
    def __init__(
        self,
        cosmos_service: CosmosService = Depends(),
        blob_service: BlobService = Depends()
    ):
        self.cosmos_service = cosmos_service
        self.blob_service = blob_service
        self.settings = get_settings()

    async def get_system_status(self) -> Dict[str, Any]:
        """
        Get the status of all system components.
        
        Returns:
            Dict containing the status of Cosmos DB, Blob Storage, and Azure AD
        """
        # Get status in parallel
        cosmos_status = await self._check_cosmos_status()
        blob_status = await self._check_blob_status()
        aad_status = await self._check_aad_status()
        
        return {
            "cosmos": cosmos_status,
            "blob": blob_status,
            "aad": aad_status
        }
        
    async def _check_cosmos_status(self) -> Dict[str, Any]:
        """
        Check Cosmos DB status.
        """
        status = "ok"
        connection = "Connected"
        database = self.settings.cosmos_database
        container = self.settings.cosmos_container
        details = {}
        
        try:
            # Try to get a single document to verify connection
            container_client = get_cosmos_container()
            batches = list(container_client.query_items(
                query="SELECT TOP 1 * FROM c",
                enable_cross_partition_query=True
            ))
            
            # Add some details
            details["record_count"] = len(batches)
            
        except cosmos_exceptions.CosmosHttpResponseError as e:
            status = "error"
            connection = f"Error: {str(e)}"
            logger.error(f"Cosmos DB connection error: {e}")
        except Exception as e:
            status = "error"
            connection = f"Unknown error: {str(e)}"
            logger.error(f"Unknown Cosmos DB error: {e}")
            
        return {
            "status": status,
            "connection": connection,
            "database": database,
            "container": container,
            "details": details
        }
        
    async def _check_blob_status(self) -> Dict[str, Any]:
        """
        Check Azure Blob Storage status.
        """
        status = "ok"
        connection = "Connected"
        containers = [
            self.settings.azure_input_container, 
            self.settings.azure_annotations_container,
            self.settings.azure_delete_container
        ]
        details = {}
        
        try:
            # Try to list containers to verify connection
            blob_service_client = get_blob_service_client()
            container_list = [c.name for c in blob_service_client.list_containers()]
            
            # Check if our containers exist
            for container in containers:
                if container not in container_list:
                    status = "warning"
                    connection = f"Warning: Container '{container}' not found"
            
            # Add some details
            details["all_containers"] = container_list
            
        except blob_exceptions.ServiceResponseError as e:
            status = "error"
            connection = f"Error: {str(e)}"
            logger.error(f"Blob Storage connection error: {e}")
        except Exception as e:
            status = "error"
            connection = f"Unknown error: {str(e)}"
            logger.error(f"Unknown Blob Storage error: {e}")
            
        return {
            "status": status,
            "connection": connection,
            "containers": containers,
            "details": details
        }
        
    async def _check_aad_status(self) -> Dict[str, Any]:
        """
        Check Azure Active Directory status.
        
        Note: This is a simplified check since we're not actually
        connecting to AAD in the development environment.
        """
        # Check if AAD configuration variables are set
        tenant_id = os.environ.get("AZURE_AD_TENANT_ID", "")
        client_id = os.environ.get("AZURE_AD_CLIENT_ID", "")
        client_secret = os.environ.get("AZURE_AD_CLIENT_SECRET", "")
        
        if tenant_id and client_id and client_secret:
            status = "ok"
            connection = "Configured"
            tenant = tenant_id
        elif self.settings.debug:
            status = "warning"
            connection = "Debug mode - Using mock auth"
            tenant = "Development"
        else:
            status = "error"
            connection = "Not configured"
            tenant = "Unknown"
            
        return {
            "status": status,
            "connection": connection,
            "tenant": tenant
        }
