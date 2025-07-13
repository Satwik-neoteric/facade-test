@echo off
echo Starting Facade Studio in debug mode
call .\venv\Scripts\activate
set DEBUG=true
set COSMOS_ENDPOINT=your_cosmos_endpoint_here
set COSMOS_KEY=your_cosmos_key_here
set COSMOS_DATABASE=InputImages
set COSMOS_CONTAINER=batches
set BLOB_STORAGE_CONNECTION_STRING=your_blob_connection_string_here
set BLOB_STORAGE_CONTAINER=images
uvicorn app.main:app --reload --port 8000
