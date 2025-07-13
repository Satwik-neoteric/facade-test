# Plan to Implement Flask Functions and Routes in ASP.NET

## Overview
This plan outlines the step-by-step process to implement the functionality of `app.py` from the original Python/Flask project into the ASP.NET project. Each function and route will be implemented one at a time to ensure the build remains error-free.

## Step-by-Step Plan

### Utility Functions
1. **`allowed_file(filename)`**
   - Implement as a utility method in ASP.NET.
   - Purpose: Check if a file has an allowed extension.

2. **`extract_image_metadata(blob_client)`**
   - Implement as a utility method.
   - Purpose: Extract metadata from an image blob.

3. **`get_blob_prefixes(container_name)`**
   - Implement as a service method.
   - Purpose: Retrieve prefixes from a blob container.

4. **`list_blobs(container_name, prefix=None, max_results=None)`**
   - Implement as a service method.
   - Purpose: List blobs in a container.

5. **`get_blob_client(container_name, blob_name)`**
   - Implement as a service method.
   - Purpose: Get a blob client for a specific blob.

6. **`blob_exists(container_name, blob_name)`**
   - Implement as a service method.
   - Purpose: Check if a blob exists.

### Route Handlers
7. **`index()`**
   - Implement as a controller method.
   - Purpose: Serve the index page.

8. **`get_image_list()`**
   - Implement as a controller method.
   - Purpose: Retrieve a list of images.

9. **`get_image(filename)`**
   - Implement as a controller method.
   - Purpose: Retrieve an image by filename.

10. **`annotations(filename)`**
    - Implement as a controller method.
    - Purpose: Handle annotations for an image.

11. **`delete_image(filename)`**
    - Implement as a controller method.
    - Purpose: Delete an image.

12. **`get_filtered_images()`**
    - Implement as a controller method.
    - Purpose: Retrieve filtered images.

13. **`get_image_metadata(filename)`**
    - Implement as a controller method.
    - Purpose: Retrieve metadata for an image.

14. **`get_classes()`**
    - Implement as a controller method.
    - Purpose: Retrieve classes for annotations.

### CosmosDB Operations
15. **`initialize_cosmos_client()`**
    - Implement as a service method.
    - Purpose: Initialize the CosmosDB client.

16. **`get_batch_ids_from_cosmos()`**
    - Implement as a service method.
    - Purpose: Retrieve batch IDs from CosmosDB.

17. **`get_image_ids_by_batch(batch_id)`**
    - Implement as a service method.
    - Purpose: Retrieve image IDs for a batch.

18. **`get_coco_from_cosmos(batch_id, image_id)`**
    - Implement as a service method.
    - Purpose: Retrieve COCO data from CosmosDB.

19. **`save_coco_to_cosmos(coco_data, log_data=None)`**
    - Implement as a service method.
    - Purpose: Save COCO data to CosmosDB.

### Sensor Data
20. **`get_sensor_data(filename)`**
    - Implement as a controller method.
    - Purpose: Retrieve sensor data for a file.

## Implementation Strategy
- Implement each function and route one at a time.
- After implementing each function, run `dotnet build` to ensure there are no warnings or errors.
- Test each function individually to verify its functionality.

## Next Step
Start with Step 1: Implementing `allowed_file(filename)` as a utility method in ASP.NET.
