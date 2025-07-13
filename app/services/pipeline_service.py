# app/services/pipeline_service.py
import uuid
import logging # Make sure logging is imported
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from app.services.cosmos_service import CosmosDbService # Your existing service
from app.models.pipeline import PipelineUpsertRequest, PipelineInDB # Your Pydantic models
from app.core.dependencies import get_cosmos_service # Your existing dependency
from fastapi import Depends
from app.core.dependencies import get_pipelines_container_service

logger = logging.getLogger(__name__)

# Configuration for the pipelines container
PIPELINES_CONTAINER_NAME = "pipelines" # Or fetch from settings.PIPELINES_CONTAINER

class PipelineService:
    def __init__(self, cosmos_service: CosmosDbService):
        # This cosmos_service instance is expected to be configured for the PIPELINES_CONTAINER_NAME
        # by the dependency injector (get_pipeline_service)
        self.cosmos_service = cosmos_service
        # The container_name argument to cosmos_service methods will be PIPELINES_CONTAINER_NAME
        # if the methods in CosmosDbService strictly use the passed container_name to select a container.
        # However, your CosmosDbService mostly uses self.container and warns if container_name differs.
        # So, the key is that the injected self.cosmos_service.container IS the pipelines container.

    async def _get_existing_by_name_version(self, name: str, version: str) -> Optional[PipelineInDB]:
        """Helper to check for duplicates by name and version."""
        query = "SELECT * FROM c WHERE c.name = @name AND c.version = @version"
        parameters = [
            {"name": "@name", "value": name},
            {"name": "@version", "value": version}
        ]
        # Pass the specific container name for clarity, though your CosmosDbService might default
        items_dict_list = await self.cosmos_service.query_items( # Renamed from query_items_async for consistency
            query=query,
            parameters=parameters,
            container_name=PIPELINES_CONTAINER_NAME
        )
        if items_dict_list:
            # Ensure the dict matches PipelineInDB fields.
            # Cosmos DB returns dicts, Pydantic model needs to be initialized.
            return PipelineInDB(**items_dict_list[0])
        return None

    async def upsert_pipeline(self, pipeline_data: PipelineUpsertRequest) -> Tuple[PipelineInDB, int]:
        item_id_for_operation = pipeline_data.id

        # 1. Check for (name, version) collision
        existing_by_name_version = await self._get_existing_by_name_version(
            pipeline_data.name, pipeline_data.version
        )
        if existing_by_name_version and \
           (item_id_for_operation is None or existing_by_name_version.id != item_id_for_operation):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pipeline with this name and version already exists."
            )

        # 2. Determine if update or create, and finalize ID
        is_update = False
        if item_id_for_operation:
            # If ID is provided, check if it truly exists to confirm it's an update
            # Assuming /id is partition key for get_item_async
            existing_item_with_id_dict = await self.cosmos_service.read_item( # Using read_item from CosmosDbService
                item_id=item_id_for_operation,
                partition_key=item_id_for_operation, # IMPORTANT: Use correct partition key
                container_name=PIPELINES_CONTAINER_NAME
            )
            if existing_item_with_id_dict:
                is_update = True
        else:
            item_id_for_operation = str(uuid.uuid4()) # Generate ID for new item

        # 3. Prepare the document for Cosmos DB using PipelineInDB model
        document_to_store = PipelineInDB(
            id=item_id_for_operation,
            name=pipeline_data.name,
            version=pipeline_data.version,
            aml_id=pipeline_data.aml_id # From PipelineBase, attribute is aml_id
        )

        # 4. Perform the upsert using the method in CosmosDbService
        # The document_to_store.dict(by_alias=True) is crucial if Cosmos stores camelCase keys like 'amlId'
        # If Cosmos stores snake_case keys like 'aml_id', then use .dict() or .dict(by_alias=False)
        # Given PipelineBase's Field(alias="amlId"), dict(by_alias=True) yields {"amlId": ...}
        # If your Cosmos DB stores fields as they are in Python (aml_id), use dict()
        try:
            # Assuming your CosmosDbService.upsert_item_async expects the body as a dict
            # and handles the 'id' field correctly for upsertion.
            # Also assuming its 'container_name' param is respected or the service instance is for 'pipelines'.
            upserted_item_dict = await self.cosmos_service.upsert_item_async( # Ensure this method exists
                body=document_to_store.dict(by_alias=True), # To match JSON field 'amlId'
                container_name=PIPELINES_CONTAINER_NAME
            )
        except HTTPException as e: # Catch specific HTTPExceptions from cosmos_service
            raise e
        except Exception as e: # Catch other errors during upsert
            logger.error(f"Unexpected error during upsert_item_async: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error saving pipeline data.")


        # 5. Construct the response model
        # The upserted_item_dict from Cosmos DB should be convertible to PipelineInDB
        final_document = PipelineInDB(**upserted_item_dict)

        http_status_code = status.HTTP_200_OK if is_update else status.HTTP_201_CREATED
        return final_document, http_status_code

    async def list_pipelines(self, skip: int = 0, limit: int = 100) -> List[PipelineInDB]:
        # Cosmos DB OFFSET LIMIT is generally not recommended for large datasets due to RU cost.
        # Consider continuation tokens for true pagination if scale is a concern.
        query = f"SELECT * FROM c OFFSET {skip} LIMIT {limit}"
        items_dict_list = await self.cosmos_service.query_items( # Renamed from query_items_async
            query=query,
            parameters=[], # No parameters for this simple query
            container_name=PIPELINES_CONTAINER_NAME
        )
        return [PipelineInDB(**item) for item in items_dict_list]

    async def get_pipeline_by_id(self, pipeline_id: str) -> Optional[PipelineInDB]:
        # Assuming /id is the partition key for simplicity
        item_dict = await self.cosmos_service.read_item( # Using read_item from CosmosDbService
            item_id=pipeline_id,
            partition_key=pipeline_id, # Pass the correct partition key for your container
            container_name=PIPELINES_CONTAINER_NAME
        )
        if item_dict:
            return PipelineInDB(**item_dict)
        return None

# Dependency function to get an instance of PipelineService
# Dependency function to get an instance of PipelineService
def get_pipeline_service(
    # NOW USING the service specifically configured for the 'pipelines' container
    cosmos_service_for_pipelines: CosmosDbService = Depends(get_pipelines_container_service)
) -> PipelineService:
    logger.info(f"PipelineService initialized with CosmosDbService for container: {cosmos_service_for_pipelines.container.id}") # Optional: Add a log to confirm
    return PipelineService(cosmos_service_for_pipelines)