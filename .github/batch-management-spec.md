# Batch Management Feature Specification

## Overview
This specification outlines the implementation of batch management functionality in the admin page of the Facade AI Studio application. The feature will allow administrators to manage batches, including listing, creating, uploading images to, running inference on, and downloading images from batches.

## Architecture

### Frontend
- Add new batch management section to `admin.html`
- Implement modal forms for batch operations
- Create APIs to interact with backend Azure Functions

### Backend
- Utilize existing Azure Functions for batch operations
- Implement FastAPI endpoints to proxy requests to Azure Functions

## Function URLs
| Operation | URL | Description |
|-----------|-----|-------------|
| Register Batch | `https://batch.azurewebsites.net/api/blob2cosmos?code=<YOUR_FUNCTION_KEY>` | Create a new batch in the system |
| Download Images | `https://batch.azurewebsites.net/api/download?code=<YOUR_FUNCTION_KEY>` | Download images from a batch |
| Get Status | `https://batch.azurewebsites.net/api/status?code=<YOUR_FUNCTION_KEY>` | Check status of batch operations |
| Submit Job | `https://batch.azurewebsites.net/api/submit?code=<YOUR_FUNCTION_KEY>` | Submit a job for inference |
| Upload Images | `https://batch.azurewebsites.net/api/upload?code=<YOUR_FUNCTION_KEY>` | Upload images to a batch |

## UI Components

### 1. Batch Management Section
Add a new section to the admin page with the following components:
- **Section Title**: "Batch Management"
- **Description**: "Manage image batches for processing and annotation"
- **Batch Table**: Display list of all batches with key metadata
- **Action Buttons**: Buttons for batch operations

### 2. Batch Table
The batch table will display the following columns:
- Batch ID
- Creation Date
- Status
- Image Count
- Last Modified
- Actions (expand, download, delete)

### 3. Action Buttons
Place these buttons at the top right corner of the batch table:
- **Register Batch**: Create a new batch
- **Upload Images**: Add images to an existing batch
- **Run Inference**: Process a batch with AI models

### 4. Modal Forms

#### 4.1. Register Batch Modal
Fields:
- **Batch ID**: Text input (required)
- **Description**: Text input (optional)
- **Categories**: Multi-select dropdown (optional)
- **Submit Button**: To create the batch

#### 4.2. Upload Images Modal
Fields:
- **Batch ID**: Dropdown of existing batches (required)
- **File Upload**: Multi-file uploader for images (required)
- **Override Existing**: Checkbox (optional)
- **Submit Button**: To upload images

#### 4.3. Run Inference Modal
Fields:
- **Batch ID**: Dropdown of existing batches (required)
- **Model**: Dropdown of available models (required)
- **Parameters**: JSON editor for additional parameters (optional)
- **Submit Button**: To start inference

### 5. Batch Expansion Panel
When a batch is expanded, show:
- List of images in the batch with thumbnails
- Image metadata including filename, size, and format
- Download button for individual images

## API Endpoints

### FastAPI Routes to Implement

#### 1. List Batches
```python
@router.get("/api/admin/batches", response_model=List[BatchModel])
async def list_batches():
    # Get batches from CosmosDB or proxy to Azure Function
```

#### 2. Register Batch
```python
@router.post("/api/admin/batches", response_model=BatchModel)
async def create_batch(batch: BatchCreate):
    # Proxy request to blob2cosmos Azure Function
```

#### 3. Upload Images
```python
@router.post("/api/admin/batches/{batch_id}/images")
async def upload_images(batch_id: str, files: List[UploadFile] = File(...)):
    # Proxy request to upload_images Azure Function
```

#### 4. Run Inference
```python
@router.post("/api/admin/batches/{batch_id}/inference")
async def run_inference(batch_id: str, job_params: JobParameters):
    # Proxy request to submit_job Azure Function
```

#### 5. Get Batch Status
```python
@router.get("/api/admin/batches/{batch_id}/status")
async def get_batch_status(batch_id: str):
    # Proxy request to get_status Azure Function
```

#### 6. Download Batch Images
```python
@router.get("/api/admin/batches/{batch_id}/download")
async def download_batch_images(batch_id: str):
    # Proxy request to download_images Azure Function
```

#### 7. Get Batch Images
```python
@router.get("/api/admin/batches/{batch_id}/images")
async def get_batch_images(batch_id: str):
    # Get batch images from storage
```

## Data Models

### BatchModel
```python
class BatchModel(BaseModel):
    batch_id: str
    created_date: datetime
    status: str
    image_count: int
    last_modified: datetime
    description: Optional[str] = None
```

### BatchCreate
```python
class BatchCreate(BaseModel):
    batch_id: str
    description: Optional[str] = None
    categories: Optional[List[str]] = None
```

### JobParameters
```python
class JobParameters(BaseModel):
    model: str
    parameters: Optional[Dict[str, Any]] = None
```

## Implementation Guidelines

### 1. Frontend Development
- Use consistent styling with the existing admin page
- Reuse components where possible
- Ensure mobile responsiveness
- Add proper error handling and user feedback
- Use modular JavaScript to maintain clean code structure

### 2. Backend Development
- Implement proper error handling and logging
- Add authentication and authorization checks
- Use dependency injection for services
- Ensure proper validation of inputs
- Add rate limiting for API endpoints

### 3. Integration with Existing Code
- The batch table should match the style of existing tables
- Use the same color scheme and button styles
- Ensure proper navigation and state management
- Use existing authentication mechanisms
- Preserve all existing functionality

## Testing Plan
1. Unit tests for new API endpoints
2. Integration tests for Azure Function interactions
3. UI testing for new components
4. End-to-end testing for batch operations

## Security Considerations
1. Validate all user inputs
2. Implement proper authentication and authorization
3. Sanitize file uploads
4. Secure API keys and credentials
5. Add CSRF protection

---

## Implementation Phases

### Phase 1: Backend API Development
- Implement FastAPI endpoints
- Connect to Azure Functions
- Set up data models
- Test API functionality

### Phase 2: Frontend UI Development
- Add batch management section to admin page
- Create modal forms
- Implement batch table and expansion panels
- Style components

### Phase 3: Integration and Testing
- Connect frontend to backend
- Test batch operations end-to-end
- Fix bugs and optimize performance
- Finalize documentation
