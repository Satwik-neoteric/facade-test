# Facade Studio Functions Documentation

This document provides an overview of the main functions and modules in the Facade Studio application.

## API Routes

### Batches API (`app/api/routes/batches.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_all_batches` | Retrieve a list of all available batch IDs | `/api/batches` | GET |
| `get_batch` | Get all images in a specific batch | `/api/batches/{batch_id}` | GET |
| `get_batch_image` | Get a specific image from a batch | `/api/batches/{batch_id}/{image_id}` | GET |

### Annotations API (`app/api/routes/annotations.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `create_annotation` | Add a new annotation to an image | `/api/annotations` | POST |
| `update_annotation` | Update an existing annotation | `/api/annotations/{annotation_id}` | PUT |
| `delete_annotation` | Delete an annotation | `/api/annotations/{annotation_id}` | DELETE |

### Images API (`app/api/routes/images.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_image_blob` | Retrieve an image from blob storage | `/api/images/blob/{container}/{blob_path}` | GET |
| `list_images` | List images in a blob container | `/api/images/list/{container}` | GET |
| `list_prefixes` | List virtual directories in a container | `/api/images/prefixes/{container}` | GET |

### Classes API (`app/api/routes/classes.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_categories` | Get all available annotation categories | `/api/classes` | GET |
| `add_category` | Add a new category (placeholder) | `/api/classes` | POST |

### Users API (`app/api/routes/users.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `login` | Authenticate a user and get an access token | `/api/users/token` | POST |
| `get_current_user` | Get the current authenticated user | `/api/users/me` | GET |
| `get_available_roles` | Get all available user roles | `/api/users/roles` | GET |

### Admin API (`app/api/routes/admin.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `list_users` | List all users (requires admin role) | `/api/admin/users` | GET |
| `create_user` | Create a new user (requires admin role) | `/api/admin/users` | POST |
| `update_user_roles` | Update a user's roles (requires admin role) | `/api/admin/users/{username}` | PUT |
| `delete_user` | Delete a user (requires admin role) | `/api/admin/users/{username}` | DELETE |

### Dashboard API (`app/api/routes/dashboard.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_dashboard_stats` | Get comprehensive statistics for the dashboard | `/api/dashboard/stats` | GET |
| `get_images_per_batch` | Get number of images per batch | `/api/dashboard/images-per-batch` | GET |
| `get_labels_per_batch` | Get label statistics per batch | `/api/dashboard/labels-per-batch` | GET |
| `get_user_activity` | Get user activity statistics | `/api/dashboard/user-activity` | GET |
| `get_review_status` | Get review status statistics | `/api/dashboard/review-status` | GET |

### Debug API (`app/api/routes/debug.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_debug_info` | Retrieve debugging information | `/api/debug/info` | GET |

### Legacy API (`app/api/routes/legacy.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `handle_legacy_request` | Handle requests for legacy endpoints | `/api/legacy/*path` | GET/POST |

### Sensor API (`app/api/routes/sensor.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_sensor_data` | Retrieve sensor data for an image | `/api/sensor/{image_id}` | GET |

### Statistics API (`app/api/routes/statistics.py`)

| Function | Description | Endpoint | Method |
|----------|-------------|----------|--------|
| `get_detailed_stats` | Retrieve detailed statistics | `/api/statistics/detailed` | GET |

## Services

### CosmosDB Service (`app/services/cosmos_service.py`)

| Function | Description |
|----------|-------------|
| `get_batches` | Get all batches from Cosmos DB |
| `get_batch` | Get all items with a specific batch ID |
| `get_batch_image` | Get a specific image from a batch |
| `update_item` | Update an item in Cosmos DB |

### Blob Service (`app/services/blob_storage_service.py`) 
*Note: Previously `blob_service.py`, now likely `blob_storage_service.py`.*

| Function | Description |
|----------|-------------|
| `get_blob` | Get a blob from Azure Blob Storage |
| `list_blobs` | List blobs in a container |
| `list_prefixes` | List prefixes (virtual directories) in a container |
| `upload_blob` | Upload a blob to Azure Blob Storage |

### Annotation Service (`app/services/annotation_service.py`)

| Function | Description |
|----------|-------------|
| `add_annotation` | Add a new annotation to an image |
| `update_annotation` | Update an existing annotation |
| `delete_annotation` | Delete an annotation |

### User Service (`app/services/user_service.py`)

| Function | Description |
|----------|-------------|
| `authenticate_user` | Authenticate a user with username and password |
| `create_access_token` | Create a JWT access token |
| `get_current_user` | Get the current user from a JWT token |
| `get_all_users` | Get all users |
| `create_user` | Create a new user |
| `update_user_roles` | Update a user's roles |
| `delete_user` | Delete a user |

### Statistics Service (`app/services/statistics_service.py`)

| Function | Description |
|----------|-------------|
| `get_dashboard_stats` | Get comprehensive statistics for the dashboard |
| `get_images_per_batch` | Get number of images per batch |
| `get_labels_per_batch` | Get label statistics per batch |
| `get_user_activity` | Get user activity statistics |
| `get_review_status` | Get review status statistics |

### Category Service (`app/services/category_service.py`)

| Function | Description |
|----------|-------------|
| `get_all_categories` | Retrieve all annotation categories |
| `add_new_category` | Add a new annotation category |

### System Service (`app/services/system_service.py`)

| Function | Description |
|----------|-------------|
| `get_system_health` | Check the health of system components |
| `get_system_config` | Retrieve system configuration details |

### System Status Service (`app/services/system_status_service.py`)

| Function | Description |
|----------|-------------|
| `get_current_status` | Get the current operational status of the application |
| `report_error` | Report a system error |

## Core Modules

### Configuration (`app/core/config.py`)

| Function | Description |
|----------|-------------|
| `get_settings` | Get application settings, cached for efficiency |

### Database (`app/core/database.py`)

| Function | Description |
|----------|-------------|
| `get_cosmos_client` | Get a singleton CosmosDB client instance |
| `get_cosmos_container` | Get a CosmosDB container instance |
| `get_blob_service_client` | Get a singleton Blob Service client instance |
| `get_blob_container_client` | Get a Blob Container client instance |

## Models

### Batch Models (`app/models/batch.py`)

| Model | Description |
|-------|-------------|
| `AdminMetadata` | Admin metadata for batch items |
| `SensorData` | Sensor data associated with images |
| `ImageInfo` | Image information in COCO format |
| `InfoData` | General information about a COCO annotation file |
| `CategoryData` | Category information in COCO format |
| `AnnotationData` | Annotation data in COCO format |
| `BatchModel` | Complete batch item model |
| `BatchInfoModel` | Simplified batch item model for lists |
| `BatchListResponse` | API response for batch list |

### Annotation Models (`app/models/annotation.py`)

| Model | Description |
|-------|-------------|
| `AnnotationBase` | Base model for annotations |
| `AnnotationCreate` | Model for creating annotations |
| `AnnotationUpdate` | Model for updating annotations |
| `AnnotationDelete` | Model for deleting annotations |
