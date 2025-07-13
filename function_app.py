# Import standard libraries for JSON handling, logging, OS/environment access, IO operations, and zipping files
import json  # For encoding/decoding JSON data
import logging  # For logging errors and critical events
import os  # For accessing environment variables
import io  # For in-memory byte streams (e.g., for zipping files)
import zipfile  # For creating ZIP archives
from typing import Dict, Any, List  # For type annotations

# Import Azure and third-party libraries
import azure.functions as func  # Azure Functions Python SDK
from azure.ai.ml import MLClient, Input, Output  # Azure ML SDK for client and data types
from azure.ai.ml.constants import AssetTypes  # Constants for asset types (e.g., URI_FOLDER)
from azure.ai.ml.dsl import pipeline  # For defining ML pipelines
from azure.ai.ml.entities import JobResourceConfiguration  # For configuring job resources
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential  # For Azure authentication
from azure.core.exceptions import ClientAuthenticationError  # For handling Azure auth errors
from azure.storage.blob import BlobServiceClient  # For interacting with Azure Blob Storage
from azure.cosmos import CosmosClient  # For interacting with Azure Cosmos DB
from PIL import Image  # For image processing (to get image dimensions)

# Create the Azure Function App instance
app = func.FunctionApp()

# --- Azure ML Batch Trigger Logic (from Function_facade) ---
class BatchTrigger:
    """
    Handles Azure ML pipeline job submission and status checking.
    Initializes MLClient using environment variables and Azure credentials.
    """
    def __init__(self):
        # Check for required environment variables
        required_vars = ["AZURE_SUBSCRIPTION_ID", "AZURE_RESOURCE_GROUP", "AZURE_WORKSPACE_NAME"]
        missing_vars = [var for var in required_vars if var not in os.environ]
        if missing_vars:
            error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
            logging.error(error_msg)
            raise ValueError(error_msg)
            
        # Read required Azure ML configuration from environment variables
        self.subscription_id = os.environ["AZURE_SUBSCRIPTION_ID"]
        self.resource_group = os.environ["AZURE_RESOURCE_GROUP"]
        self.workspace_name = os.environ["AZURE_WORKSPACE_NAME"]
        self.compute_target = os.environ.get("COMPUTE_TARGET", "cpu-cluster2")
        self.datastore_name = os.environ.get("DATASTORE_NAME", "facadestudio")
        self.component_name = os.environ.get("PIPELINE_COMPONENT_NAME", "facade_inference_component")
        self.component_version = os.environ.get("PIPELINE_COMPONENT_VERSION", "1.2")
        self.experiment_name = os.environ.get("EXPERIMENT_NAME", "facade_defect_detection_production")
        
        # Try multiple authentication methods with proper timeout handling
        logging.info("Initializing ML client with authentication...")
        try:
            # First try DefaultAzureCredential with timeout
            credential = DefaultAzureCredential(
                exclude_managed_identity_credential=False,
                exclude_shared_token_cache_credential=True,
                exclude_visual_studio_code_credential=True,
                exclude_environment_credential=False,
                timeout=30  # 30-second timeout for authentication requests
            )
            
            self.ml_client = MLClient(
                credential=credential,
                subscription_id=self.subscription_id,
                resource_group_name=self.resource_group,
                workspace_name=self.workspace_name
            )
            logging.info("Successfully authenticated with DefaultAzureCredential")
            
        except Exception as e:
            logging.warning(f"DefaultAzureCredential failed: {str(e)}")
            logging.info("Authentication with DefaultAzureCredential failed, ML client not initialized")
            self.ml_client = None

    def submit_pipeline_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submits a batch inference pipeline job to Azure ML.
        params: Dictionary of pipeline parameters with structure:
            - batch_id: Identifier for this batch processing job
            - models_to_run: Dict of models with path and name (like in combined_component)
            - key_vault_url: URL to Azure Key Vault 
            - compute_config: Optional compute configuration
            - inference_config: Optional inference configuration
            
        Returns job details (name, status, studio URL, batch_id)
        """
        # Get the latest version of the facade inference component (use from params if provided)
        component_name = params.get('component_name', self.component_name)
        component_version = params.get('component_version', self.component_version)
        experiment_name = params.get('experiment_name', self.experiment_name)
        
        parallel_component = self.ml_client.components.get(
            name=component_name, version=component_version
        )
        
        # Extract compute configuration parameters with defaults
        compute_config = params.get('compute_config', {})
        compute_target = compute_config.get('compute_target', self.compute_target)
        instance_count = int(compute_config.get('instance_count', 2))
        mini_batch_size = str(compute_config.get('mini_batch_size', "5"))
        max_concurrency = int(compute_config.get('max_concurrency_per_instance', 2))
        error_threshold = int(compute_config.get('error_threshold', -1))  # -1 means continue on error
        logging_level = compute_config.get('logging_level', "DEBUG")
        
        # Extract inference configuration
        inference_config = params.get('inference_config', {})
        key_vault_url = inference_config.get('key_vault_url', params.get('key_vault_url', ''))
        mode = inference_config.get('mode', params.get('mode', 'force'))
        window_size = int(inference_config.get('window_size', params.get('window_size', 512)))
        overlap = int(inference_config.get('overlap', params.get('overlap', 64)))
        confidence = int(inference_config.get('confidence', params.get('confidence', 50)))
        trace = bool(inference_config.get('trace', params.get('trace', True)))
        
        # Extract model configurations
        models_to_run = params.get('models_to_run', {})
        
        # For backward compatibility
        if not models_to_run and 'model_asset_path' in params:
            models_to_run = {
                "model1": {
                    "path": params['model_asset_path'],
                    "name": params.get('model_name', "model1")
                }
            }
        
        # Define the pipeline using the component and parameters        
        # @pipeline(default_compute=compute_target, description=f"Facade batch inference for {params['batch_id']}")
        def facade_defect_detection_pipeline(
            # Required arguments
            input_data: Input,
            batch_identifier: str,
            # Model inputs - we'll only pass the ones needed
            model1_path_input: Input = None,
            model2_path_input: Input = None,
            model3_path_input: Input = None,
            model4_path_input: Input = None,
            model5_path_input: Input = None,
            model6_path_input: Input = None,
            model7_path_input: Input = None,
            model8_path_input: Input = None,
            # Optional model names
            model1_name_input: str = None,
            model2_name_input: str = None,
            model3_name_input: str = None,
            model4_name_input: str = None,
            model5_name_input: str = None,
            model6_name_input: str = None,
            model7_name_input: str = None,
            model8_name_input: str = None
        ):
            # Create the parallel job with all parameters
            parallel_job = parallel_component(
                input_ds=input_data,
                batch_id=batch_identifier,
                # Model paths and names
                model1_path=model1_path_input,
                model1_name=model1_name_input,
                model2_path=model2_path_input,
                model2_name=model2_name_input,
                model3_path=model3_path_input,
                model3_name=model3_name_input,
                model4_path=model4_path_input,
                model4_name=model4_name_input, 
                model5_path=model5_path_input,
                model5_name=model5_name_input,
                model6_path=model6_path_input,
                model6_name=model6_name_input,
                model7_path=model7_path_input,
                model7_name=model7_name_input,
                model8_path=model8_path_input,
                model8_name=model8_name_input,
                # Other parameters
                key_vault_url=key_vault_url,
                mode=mode,
                window_size=window_size,
                overlap=overlap,
                confidence=confidence,
                trace=trace
            )
            
            # Set job resource configuration from parameters
            parallel_job.resources = JobResourceConfiguration(instance_count=instance_count)
            parallel_job.mini_batch_size = mini_batch_size
            parallel_job.max_concurrency_per_instance = max_concurrency
            parallel_job.error_threshold = error_threshold
            parallel_job.logging_level = logging_level
            
            return {"detection_results": parallel_job.outputs.output_data}
        
        # Construct input data URI for images in the batch
        batch_id = params['batch_id']
        path_in_datastore = f"{batch_id}/cam/"
        input_images_uri = f"azureml://datastores/{self.datastore_name}/paths/{path_in_datastore}"
        
        # Prepare pipeline inputs dictionary
        pipeline_inputs = {
            "input_data": Input(type=AssetTypes.URI_FOLDER, path=input_images_uri),
            "batch_identifier": batch_id
        }
        
        # Add models to inputs dictionary
        for i in range(1, 9):  # Support up to 8 models
            model_key = f'model{i}'
            if model_key in models_to_run:
                model_info = models_to_run[model_key]
                pipeline_inputs[f"model{i}_path_input"] = Input(
                    type=AssetTypes.MLFLOW_MODEL, path=model_info["path"]
                )
                pipeline_inputs[f"model{i}_name_input"] = model_info.get("name", model_key)
        
        # Create the pipeline job
        pipeline_job = facade_defect_detection_pipeline(**pipeline_inputs)
        
        # Define output location for detection results
        pipeline_job.outputs.detection_results = Output(
            type=AssetTypes.URI_FOLDER, 
            path=f"azureml://datastores/{self.datastore_name}/paths/batch_results/{batch_id}"
        )
        
        # Submit the job to Azure ML
        submitted_job = self.ml_client.jobs.create_or_update(
            pipeline_job, experiment_name=experiment_name
        )
        
        # Return job details
        return {
            'job_name': submitted_job.name, 
            'status': submitted_job.status,
            'studio_url': submitted_job.studio_url, 
            'batch_id': batch_id,
            'experiment_name': experiment_name,
            'component_name': component_name,
            'component_version': component_version
        }

    def get_job_status(self, job_name: str) -> Dict[str, Any]:
        """
        Retrieves the status of a submitted Azure ML job by name.
        Returns job name, status, and studio URL.
        """
        job = self.ml_client.jobs.get(job_name)
        return { 'job_name': job.name, 'status': job.status, 'studio_url': job.studio_url }

# Do NOT initialize batch_trigger at module load time
# This allows tests to set environment variables before initialization
batch_trigger = None  # Will hold the singleton BatchTrigger instance

def get_batch_trigger():
    """
    Returns the singleton BatchTrigger instance, initializing it if needed.
    This allows for lazy initialization and easier testing.
    """
    global batch_trigger
    if batch_trigger is None:
        try:
            batch_trigger = BatchTrigger()
        except Exception as e:
            logging.error(f"Failed to initialize BatchTrigger: {str(e)}")
            # Return None instead of raising to prevent repeated initialization attempts
            return None
    return batch_trigger

# --- Azure Function Endpoints ---

@app.route(route="submit", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def submit_job(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP POST endpoint to submit a new batch inference job.
    
    Expected JSON payload structure:
    {
        "batch_id": "your-batch-id",
        "models_to_run": {
            "model1": {
                "path": "azureml:model-name:version",
                "name": "model-display-name"
            },
            "model2": {
                "path": "azureml:another-model:version",
                "name": "another-model-name"
            }
        },
        "key_vault_url": "https://your-key-vault.vault.azure.net/",
        "compute_config": {
            "compute_target": "cpu-cluster2",
            "instance_count": 2,
            "mini_batch_size": "5",
            "max_concurrency_per_instance": 2,
            "error_threshold": -1,
            "logging_level": "DEBUG"
        },
        "inference_config": {
            "mode": "force",
            "window_size": 512,
            "overlap": 64,
            "confidence": 50,
            "trace": true
        },
        "component_name": "facade_inference_component",
        "component_version": "1.2",
        "experiment_name": "facade_defect_detection_runs"
    }
    
    Returns job details or error message.
    """
    trigger = get_batch_trigger()  # Get the BatchTrigger instance
    if not trigger:
        return func.HttpResponse("Function is not configured.", status_code=503)
    try:
        req_body = req.get_json()  # Parse JSON body
        if not req_body:
            return func.HttpResponse(json.dumps({'error': 'Request body is required'}), status_code=400, mimetype="application/json")
            
        # Validate required fields
        if 'batch_id' not in req_body:
            return func.HttpResponse(json.dumps({'error': 'batch_id is required'}), status_code=400, mimetype="application/json")
        
        # Legacy API support
        if 'model_asset_path' not in req_body and 'models_to_run' not in req_body:
            return func.HttpResponse(
                json.dumps({'error': 'Either model_asset_path or models_to_run is required'}), 
                status_code=400, 
                mimetype="application/json"
            )
            
        params = req_body  # Use the request body as parameters
        job_details = trigger.submit_pipeline_job(params)  # Submit the job
        return func.HttpResponse(json.dumps(job_details), status_code=202, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=400, mimetype="application/json")

@app.route(route="status", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def get_status(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP GET endpoint to check the status of a batch job.
    Expects a 'job_name' parameter in the query string.
    Returns job status or error message.
    """
    trigger = get_batch_trigger()  # Get the BatchTrigger instance
    if not trigger:
        return func.HttpResponse("Function is not configured.", status_code=503)
    job_name = req.params.get('job_name')  # Get job_name from query params
    if not job_name:
        return func.HttpResponse(json.dumps({'error': 'job_name parameter is required'}), status_code=400, mimetype="application/json")
    try:
        status_info = trigger.get_job_status(job_name)  # Get job status
        return func.HttpResponse(json.dumps(status_info), status_code=200, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=404, mimetype="application/json")

@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP GET endpoint for health checking.
    Returns a simple message indicating the function is healthy and connected to the workspace.
    """
    trigger = get_batch_trigger()  # Get the BatchTrigger instance
    if not trigger:
        return func.HttpResponse("Function is not configured.", status_code=503)
    return func.HttpResponse(f"Healthy. Connected to AML Workspace: {trigger.workspace_name}", status_code=200)

# --- Blob2Cosmos Endpoint ---
@app.route(route="blob2cosmos", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def blob2cosmos(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP POST endpoint to ingest images and sensor data from Blob Storage into Cosmos DB.
    Expects a JSON body with 'batch_id'.
    For each image in the batch, creates a COCO object and upserts it into Cosmos DB.
    Returns the number of processed and errored items.
    """
    import logging
    # At the top of your function_app.py
    from dotenv import load_dotenv
    load_dotenv()  # Load variables from .env file
    
    try:
        logging.info("=== Starting blob2cosmos function ===")
        
        # Parse request body
        logging.info("Parsing request body...")
        req_body = req.get_json()
        
        if req_body is None:
            logging.error("Request body is None or invalid JSON")
            return func.HttpResponse(json.dumps({'error': 'Request body is required'}), status_code=400, mimetype="application/json")
        
        logging.info(f"Request body received: {req_body}")
        
        batch_id = req_body.get('batch_id')
        if not batch_id:
            logging.error("batch_id is missing from request body")
            return func.HttpResponse(json.dumps({'error': 'batch_id is required'}), status_code=400, mimetype="application/json")
        
        logging.info(f"Processing batch_id: {batch_id}")
        
        # Get environment variables
        logging.info("Reading environment variables...")
        blob_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        cosmos_endpoint = os.getenv("COSMOS_ENDPOINT")
        logging.info({os.getenv("COSMOS_ENDPOINT")})
        cosmos_key = os.getenv("COSMOS_KEY")
        # logging.info({os.getenv("COSMOS_KEY")})

        cosmos_database = "InputImages"
        # os.getenv("COSMOS_DATABASE", "InputImages")
        cosmos_container = "batches"
        # os.getenv("COSMOS_CONTAINER", "batches")
        input_container = os.getenv("AZURE_INPUT_CONTAINER", "input")
        
        # Log environment variable status (without exposing sensitive data)
        logging.info(f"Environment variables status:")
        logging.info(f"  AZURE_STORAGE_CONNECTION_STRING: {'SET' if blob_connection_string else 'NOT SET'}")
        logging.info(f"  COSMOS_ENDPOINT: {'SET' if cosmos_endpoint else 'NOT SET'} - {cosmos_endpoint if cosmos_endpoint else 'None'}")
        logging.info(f"  COSMOS_KEY: {'SET' if cosmos_key else 'NOT SET'} - Length: {len(cosmos_key) if cosmos_key else 0}")
        logging.info(f"  COSMOS_KEY: {cosmos_key}")
        logging.info(f"  COSMOS_DATABASE: {cosmos_database}")
        logging.info(f"  COSMOS_CONTAINER: {cosmos_container}")
        logging.info(f"  AZURE_INPUT_CONTAINER: {input_container}")
        
        # Check for required connection settings
        if not blob_connection_string or not cosmos_endpoint or not cosmos_key:
            missing = []
            if not blob_connection_string:
                missing.append("AZURE_STORAGE_CONNECTION_STRING")
            if not cosmos_endpoint:
                missing.append("COSMOS_ENDPOINT")
            if not cosmos_key:
                missing.append("COSMOS_KEY")
            
            error_msg = f"Missing required connection settings: {', '.join(missing)}"
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({'error': error_msg}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        # Connect to Blob Storage
        logging.info("Connecting to Blob Storage...")
        try:
            blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
            container_client = blob_service_client.get_container_client(input_container)
            logging.info("Successfully connected to Blob Storage")
        except Exception as e:
            error_msg = f"Failed to connect to Blob Storage: {str(e)}"
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({'error': error_msg}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        # Connect to Cosmos DB
        logging.info("Connecting to Cosmos DB...")
        try:
            cosmos_client = CosmosClient(url=cosmos_endpoint, credential=cosmos_key)
            database = cosmos_client.get_database_client(cosmos_database)
            cosmos_container_client = database.get_container_client(cosmos_container)
            logging.info("Successfully connected to Cosmos DB")
        except Exception as e:
            error_msg = f"Failed to connect to Cosmos DB: {str(e)}"
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({'error': error_msg}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        # List all blobs in the batch's cam/ folder
        logging.info(f"Looking for images in path: {batch_id}/cam/")
        try:
            cam_prefix = f"{batch_id}/cam/"
            cam_blobs = [blob.name for blob in container_client.list_blobs(name_starts_with=cam_prefix)]
            logging.info(f"Found {len(cam_blobs)} total blobs with prefix '{cam_prefix}'")
            
            if cam_blobs:
                logging.info(f"Blob names: {cam_blobs[:5]}{'...' if len(cam_blobs) > 5 else ''}")  # Log first 5 blob names
            
            image_extensions = ['.jpg', '.jpeg', '.png']
            image_blobs = [blob for blob in cam_blobs if any(blob.lower().endswith(ext) for ext in image_extensions)]
            logging.info(f"Found {len(image_blobs)} image files after filtering by extensions {image_extensions}")
            
        except Exception as e:
            error_msg = f"Failed to list blobs from container '{input_container}' with prefix '{cam_prefix}': {str(e)}"
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({'error': error_msg}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        # If no images found, return error
        if not image_blobs:
            error_msg = f'No images found for batch_id: {batch_id} in container: {input_container} with prefix: {cam_prefix}'
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({'error': error_msg}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        processed_count = 0
        error_count = 0
        
        logging.info(f"Starting to process {len(image_blobs)} images...")
        
        for i, image_blob in enumerate(image_blobs):
            try:
                logging.info(f"Processing image {i+1}/{len(image_blobs)}: {image_blob}")
                
                from pathlib import Path
                image_path = Path(image_blob)
                image_id = image_path.stem
                sensor_blob_name = f"{batch_id}/sensor/{image_id}.json"
                
                logging.info(f"  Image ID: {image_id}")
                logging.info(f"  Looking for sensor data: {sensor_blob_name}")
                
                # Check if sensor file exists
                sensor_exists = False
                try:
                    sensor_blob_client = container_client.get_blob_client(sensor_blob_name)
                    sensor_blob_client.get_blob_properties()
                    sensor_exists = True
                    logging.info(f"  Sensor data found: {sensor_blob_name}")
                except Exception:
                    logging.info(f"  No sensor data found for: {sensor_blob_name}")
                
                # Get image dimensions
                logging.info(f"  Downloading image to get dimensions...")
                image_blob_client = container_client.get_blob_client(image_blob)
                blob_data = image_blob_client.download_blob().readall()
                
                with Image.open(io.BytesIO(blob_data)) as img:
                    width, height = img.width, img.height
                    logging.info(f"  Image dimensions: {width}x{height}")
                
                # Get sensor data if available
                sensor_data = {}
                if sensor_exists:
                    try:
                        blob_data = sensor_blob_client.download_blob().readall()
                        import json as _json
                        sensor_data = _json.loads(blob_data)
                        logging.info(f"  Sensor data loaded successfully, keys: {list(sensor_data.keys()) if isinstance(sensor_data, dict) else 'Not a dict'}")
                    except Exception as sensor_error:
                        logging.warning(f"  Failed to load sensor data: {str(sensor_error)}")
                
                # Create COCO object for this image
                coco_object = {
                    "BatchID": batch_id,
                    "ImageID": image_id,
                    "annotations": [],
                    "categories": [],
                    "images": [
                        {
                            "file_name": image_blob,
                            "height": height,
                            "id": 1,
                            "width": width
                        }
                    ],
                    "info": {
                        "date_created": "",
                        "description": "Facade Studio annotations"
                    },
                    "admin_metadata": {
                        "Validation_User": "",
                        "Validation_Date": "",
                        "Validation_Action": "",
                        "Notes": ""
                    },
                    "Sensor": sensor_data,
                    "id": image_id
                }
                
                # Upsert the COCO object into Cosmos DB
                logging.info(f"  Upserting to Cosmos DB...")
                cosmos_container_client.upsert_item(body=coco_object)
                processed_count += 1
                logging.info(f"  Successfully processed image {image_id}")
                
            except Exception as image_error:
                error_count += 1
                logging.error(f"  Failed to process image {image_blob}: {str(image_error)}")
        
        # Return summary of processing
        result = {"processed": processed_count, "errors": error_count}
        logging.info(f"Processing complete: {result}")
        return func.HttpResponse(json.dumps(result), status_code=200, mimetype="application/json")
        
    except Exception as e:
        error_msg = f"Unexpected error in blob2cosmos: {str(e)}"
        logging.error(error_msg)
        logging.error(f"Exception type: {type(e).__name__}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return func.HttpResponse(json.dumps({'error': error_msg}), status_code=400, mimetype="application/json")
    
# --- Upload Images Endpoint ---
@app.route(route="upload", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def upload_images(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP POST endpoint to upload images to Blob Storage for a given batch.
    Expects multipart/form-data with files and a 'batch_id' form field.
    Returns the number of images uploaded.
    """
    try:
        # Parse multipart/form-data
        form = req.files  # Uploaded files
        batch_id = req.form.get('batch_id')  # Get batch_id from form
        if not batch_id:
            return func.HttpResponse(json.dumps({'error': 'batch_id is required'}), status_code=400)
        blob_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")  # Blob Storage connection string
        input_container = os.getenv("AZURE_INPUT_CONTAINER", "input")  # Blob container name
        blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
        container_client = blob_service_client.get_container_client(input_container)
        uploaded = 0  # Counter for uploaded files
        for file_key in form:
            file = form[file_key]  # Each uploaded file
            filename = file.filename  # Original filename
            blob_path = f"{batch_id}/cam/{filename}"  # Path in blob storage
            blob_client = container_client.get_blob_client(blob_path)
            blob_client.upload_blob(file.stream.read(), overwrite=True)  # Upload file
            uploaded += 1
        return func.HttpResponse(json.dumps({"uploaded": uploaded}), status_code=200, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=400, mimetype="application/json")

# --- Download Images Endpoint ---
@app.route(route="download", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def download_images(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP POST endpoint to download images from Blob Storage as a ZIP file.
    Expects a JSON body with either 'batch_id' or a list of 'filenames'.
    Returns a ZIP file containing the requested images.
    """
    try:
        req_body = req.get_json()  # Parse JSON body
        if req_body is None:
            return func.HttpResponse(json.dumps({'error': 'Request body is required'}), status_code=400, mimetype="application/json")
        
        batch_id = req_body.get('batch_id')  # Get batch_id if provided
        filenames = req_body.get('filenames', [])  # Get filenames if provided
        
        # Must provide either batch_id or filenames
        if not batch_id and not filenames:
            return func.HttpResponse(
                json.dumps({'error': 'Either batch_id or filenames must be provided'}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        blob_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")  # Blob Storage connection string
        if not blob_connection_string:
            return func.HttpResponse(
                json.dumps({'error': 'Missing storage connection string'}), 
                status_code=400, 
                mimetype="application/json"
            )
        
        input_container = os.getenv("AZURE_INPUT_CONTAINER", "input")  # Blob container name
        blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
        container_client = blob_service_client.get_container_client(input_container)
        
        # If batch_id is provided, get all images in batch
        if batch_id:
            cam_prefix = f"{batch_id}/cam/"
            blobs = [blob.name for blob in container_client.list_blobs(name_starts_with=cam_prefix)]
            image_extensions = ['.jpg', '.jpeg', '.png']
            filenames = [os.path.basename(blob) for blob in blobs if any(blob.lower().endswith(ext) for ext in image_extensions)]
            
            if not filenames:
                return func.HttpResponse(
                    json.dumps({'error': f'No images found for batch_id: {batch_id}'}), 
                    status_code=400, 
                    mimetype="application/json"
                )
        
        # Download and zip the requested images
        zip_buffer = io.BytesIO()  # In-memory buffer for ZIP file
        with zipfile.ZipFile(zip_buffer, 'w') as zipf:
            processed_count = 0  # Counter for successfully zipped files
            for filename in filenames:
                blob_path = f"{batch_id}/cam/{filename}" if batch_id else filename  # Blob path
                blob_client = container_client.get_blob_client(blob_path)
                try:
                    data = blob_client.download_blob().readall()  # Download file
                    zipf.writestr(filename, data)  # Add to ZIP
                    processed_count += 1
                except Exception:
                    continue  # Skip files that can't be downloaded
            
            if processed_count == 0:
                return func.HttpResponse(
                    json.dumps({'error': 'No images could be downloaded'}), 
                    status_code=400, 
                    mimetype="application/json"
                )
        
        zip_buffer.seek(0)  # Rewind buffer to start
        headers = {
            "Content-Disposition": f"attachment; filename=images_{batch_id or 'download'}.zip"
        }
        return func.HttpResponse(body=zip_buffer.read(), status_code=200, headers=headers, mimetype="application/zip")
    except Exception as e:
        return func.HttpResponse(json.dumps({'error': str(e)}), status_code=400, mimetype="application/json")
