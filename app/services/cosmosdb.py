import os
import uuid
import logging
from azure.cosmos import CosmosClient, PartitionKey, exceptions

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cosmos DB configuration
COSMOS_ENDPOINT = os.environ.get("COSMOS_ENDPOINT")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
DATABASE_NAME = os.environ.get("DATABASE_NAME")
CONTAINER_NAME = os.environ.get("CONTAINER_NAME")

# Initialize Cosmos DB client
client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
database = client.get_database_client(DATABASE_NAME)
container = database.get_container_client(CONTAINER_NAME)

async def cosmosdb_get_batch(batch_id: str):
    try:
        logger.info(f"Fetching batch with id: {batch_id}")
        response = container.read_item(item=batch_id, partition_key=batch_id)
        logger.info(f"Batch fetched successfully: {response}")
        return response
    except exceptions.CosmosResourceNotFoundError:
        logger.warning(f"Batch with id {batch_id} not found")
        return None
    except Exception as e:
        logger.error(f"An error occurred while fetching the batch: {e}")
        raise

async def cosmosdb_update_batch(batch_id: str, batch_record: dict):
    try:
        logger.info(f"Updating batch with id: {batch_id}")
        container.upsert_item(body=batch_record)
        logger.info(f"Batch updated successfully")
    except Exception as e:
        logger.error(f"An error occurred while updating the batch: {e}")
        raise