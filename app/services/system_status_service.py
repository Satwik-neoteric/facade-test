import logging
from fastapi import Depends
from app.services.blob_service import BlobStorageService
from app.services.cosmos_service import CosmosDbService  # Changed from CosmosService
from app.core.config import get_settings, Settings

logger = logging.getLogger(__name__)

class SystemStatusService:
    def __init__(
        self,
        blob_service: BlobStorageService = Depends(),
        cosmos_service: CosmosDbService = Depends(),  # Changed from CosmosService
        settings: Settings = Depends(get_settings),
    ):
        self.blob_service = blob_service
        self.cosmos_service = cosmos_service
        self.settings = settings

    async def get_system_status(self) -> dict:
        status_results = {}

        # Check Azure Storage connection
        status_results["azureStorage"] = await self._check_azure_storage_status()

        # Check Cosmos DB connection
        status_results["cosmosDb"] = await self._check_cosmos_db_status()

        # Check Azure AD connection (Basic check based on configuration presence)
        status_results["azureActiveDirectory"] = self._check_azure_ad_status()

        return status_results

    async def _check_azure_storage_status(self) -> dict:
        try:
            # Attempt a simple operation, like listing containers (limited to 1)
            # The BlobStorageService should have a client
            if not self.blob_service.blob_service_client:
                 return {"isHealthy": False, "details": "BlobServiceClient is not initialized."}
            
            async for _ in self.blob_service.blob_service_client.list_containers(results_per_page=1):
                break 
            return {"isHealthy": True, "details": "Successfully connected to Azure Storage."}
        except Exception as e:
            logger.error(f"Azure Storage connection check failed: {e}", exc_info=True)
            return {"isHealthy": False, "details": f"Failed to connect to Azure Storage: {str(e)}"}

    async def _check_cosmos_db_status(self) -> dict:
        try:
            if not self.cosmos_service.client:
                return {"isHealthy": False, "details": "CosmosClient is not initialized."}
            
            # Attempt to read database properties as a connectivity check
            db = self.cosmos_service.client.get_database_client(self.cosmos_service.database_name)
            await db.read()
            return {"isHealthy": True, "details": f"Successfully connected to Cosmos DB Database '{self.cosmos_service.database_name}'."}
        except Exception as e:
            logger.error(f"Cosmos DB connection check failed: {e}", exc_info=True)
            return {"isHealthy": False, "details": f"Failed to connect to Cosmos DB: {str(e)}"}

    def _check_azure_ad_status(self) -> dict:
        configured = bool(
            self.settings.AZURE_AD_CLIENT_ID
            and self.settings.AZURE_AD_TENANT_ID
            and self.settings.AZURE_AD_APP_SECRET # Assuming APP_SECRET is also a sign of config
        )

        if configured:
            return {"isHealthy": True, "details": "Azure AD is configured in application settings."}
        else:
            logger.warning("Azure AD connection check: Azure AD is not configured in application settings.")
            return {"isHealthy": False, "details": "Azure AD is not configured in application settings."}
