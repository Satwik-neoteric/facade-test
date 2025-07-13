# 4. Run Inference
@router.post("/admin/batches/{batch_id}/run-inference")
async def run_inference(
    batch_id: str,
    request_data: Dict[str, Any] = Body(...)
):
    """
    Run inference on a batch using the specified model and parameters.
    Accepts a structured JSON payload with all required parameters.
    
    The expected structure is:
    {
        "batch_id": "batch_name",
        "models_to_run": {
            "model1": {
                "path": "azureml:ModelName:1",
                "name": "ModelName"
            }
        },
        "key_vault_url": "https://example.vault.azure.net/",
        "compute_config": {
            "compute_target": "cluster-name",
            "instance_count": 1,
            ...
        },
        "inference_config": {
            "mode": "force",
            "window_size": 512,
            ...
        }
    }
    """
    # We already have the batch_id from the path, ensure it matches the payload
    request_data["batch_id"] = batch_id
    
    # Make sure key_vault_url is set (hardcoded for security)
    request_data["key_vault_url"] = "https://facadeaml8464799836.vault.azure.net/"
    logger.info(f"Running inference on batch {batch_id} with payload: {request_data}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Submitting inference job for batch {batch_id}")
            
            try:
                # First try to use the Azure Function
                response = await client.post(SUBMIT_JOB_URL, json=request_data)
                
                if response.status_code != 200:
                    logger.error(f"Error submitting job: {response.text}")
                    raise HTTPException(status_code=response.status_code, detail=response.text)
                
                response_data = response.json()
                logger.info(f"Successfully submitted inference job: {response_data}")
                return response_data
                
            except httpx.RequestError as e:
                # For demo/development, create a mock response when Azure Function is not available
                logger.warning(f"Azure Function connection error: {str(e)}. Using mock response.")
                
                # Generate a mock job ID
                import uuid
                mock_job_id = str(uuid.uuid4())
                
                # Update batch status in CosmosDB if possible
                try:
                    # This is a placeholder - in a real implementation, you would update the batch status
                    logger.info(f"Would update batch {batch_id} status to 'Processing' in CosmosDB")
                except Exception as db_err:
                    logger.warning(f"Could not update batch status: {str(db_err)}")
                
                # Return mock response
                mock_response = {
                    "job_id": mock_job_id,
                    "status": "started",
                    "message": "Job submitted (mock - Azure Function unavailable)",
                    "batch_id": batch_id,
                    "is_mock": True
                }
                
                return mock_response
                
    except Exception as e:
        logger.error(f"Unexpected error running inference: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to run inference: {str(e)}")
