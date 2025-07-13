# Facade Studio - User Instructions

## Overview

Facade Studio is a web-based annotation tool built for creating and managing polygon annotations on facade images. It allows users to precisely mark elements such as windows, doors, and walls on building facade images using a browser interface. The tool saves annotations in COCO format, making it compatible with machine learning workflows.

## Main Features

- Load and annotate facade images
- Create polygon annotations with precise point placement
- Edit existing annotations (move, reshape, delete)
- Categorize annotations by class (Window Pane, Door, Wall)
- Save annotations in industry-standard COCO format
- Manage images (skip, delete)
- Track annotation history with a log system
- Zoom and pan images for detailed work

## Backend Architecture (FastAPI)

The backend of Facade Studio is built using FastAPI, a modern Python web framework. It handles API requests, interacts with the database (Cosmos DB), manages blob storage, and performs business logic.

For a detailed breakdown of API endpoints, services, and models, please refer to the `functions.md` document in the root of this project.

### Key Backend Components:

-   **API Routes (`app/api/routes/`)**: Define the different API endpoints for functionalities like managing batches, images, annotations, users, etc.
-   **Services (`app/services/`)**: Contain the business logic for interacting with data sources (e.g., Cosmos DB, Azure Blob Storage) and performing operations.
-   **Models (`app/models/`)**: Define the data structures (using Pydantic) used throughout the application, including request/response bodies and database schemas.
-   **Core (`app/core/`)**: Includes core functionalities like configuration management, database connections, and authentication.

## Directory Structure (FastAPI Project)

-   `app/`: Main directory for the FastAPI application code.
    -   `main.py`: Entry point for the FastAPI application.
    -   `api/`: Contains API route definitions.
    -   `core/`: Core components like configuration, authentication, database connections.
    -   `models/`: Pydantic models for data validation and serialization.
    -   `services/`: Business logic and service layer.
    -   `utils/`: Utility functions.
-   `static/`: Contains static files served directly by the application.
    -   `css/`: CSS stylesheets.
    -   `images/`: Static images used by the UI.
    -   `js/`: JavaScript files for frontend functionality (e.g., `main.js`).
-   `templates/`: HTML templates rendered by the FastAPI application.
-   `Annotations/`: (Assumed) Default location for storing annotation files (e.g., COCO format) and logs.
-   `Input/`: (Assumed) Default source folder for facade images to be processed.
-   `delete/`: (Assumed) Default storage for images (and their annotations) that have been marked for deletion.
-   `requirements.txt`: Lists Python package dependencies.
-   `Dockerfile`: For building the application container.
-   `.env`: (Recommended) For storing environment variables locally (not committed to Git).

## Frontend Functions (main.js)

### Image Management

- `fetchImageList()`: Loads the list of available images from the server
- `selectImage(filename)`: Loads a specific image and its annotations
- `deleteCurrentImage()`: Moves the current image to the delete folder
- `loadNextImage()`: Navigates to the next image in the list

### Annotation Creation

- `startDrawing(pointer)`: Initiates polygon creation mode
- `addDrawingPoint(pointer)`: Adds a new point to the current polygon
- `completeDrawing()`: Finalizes polygon creation after points are added
- `cancelDrawing()`: Cancels polygon creation
- `cleanupDrawingAids()`: Removes temporary drawing elements

### Annotation Editing

- `selectPolygon(polygon)`: Activates edit mode for a polygon
- `deselectActivePolygon()`: Exits edit mode
- `createEditHandles(polygon)`: Creates drag handles for polygon points
- `removeEditHandles()`: Removes edit handles
- `handleObjectMoving(options)`: Updates polygon when dragging points
- `deleteSelectedPolygon()`: Removes the selected polygon

### Canvas Management

- `initFabricCanvas()`: Sets up the Fabric.js canvas for annotations
- `resizeCanvas()`: Adjusts canvas size on window resize
- `centerAndFitImage()`: Positions and scales the image to fit the canvas
- `repositionAnnotations()`: Updates annotation positions after canvas changes
- `zoomCanvas(factor, centerPoint)`: Changes zoom level
- `resetZoom()`: Returns to default zoom level

### Data Transformation

- `parseCocoAnnotations(cocoData)`: Converts COCO format data to Fabric.js objects
- `convertFabricToCoco()`: Converts Fabric.js objects to COCO format for saving
- `transformImagePointToCanvasPoint(imagePoint)`: Converts image coordinates to canvas coordinates
- `transformCanvasPointToImagePoint(canvasPoint)`: Converts canvas coordinates to image coordinates

### UI Updates

- `renderImageList()`: Displays the list of available images
- `renderAnnotationList()`: Shows current annotations in the sidebar
- `renderLog()`: Updates the log display
- `addLogEntry(message)`: Adds a new entry to the annotation log
- `updateModeStatus()`, `updateZoomStatus()`, `updateCoordsStatus()`: Update UI indicators
- `updateButtonStates()`: Enables/disables UI controls based on current state
- `updateClassSelectionUI()`: Highlights the selected annotation class

## Working with the Application

### Basic Workflow

1. The application loads with a list of images from the Input folder
2. Select an image to annotate from the left panel
3. Choose an annotation class (Window Pane, Door, or Wall) from the bottom panel
4. Create annotations by clicking points on the image (click near the start point to close the polygon)
5. Edit existing annotations by selecting them and using the handle points
6. Press Submit to save annotations and move to the next image
7. Use Skip to move to the next image without saving
8. Use Delete to remove the current image from the collection

### Keyboard Shortcuts

- `Z`: Zoom in
- `X`: Zoom out
- `Escape`: Cancel current action or deselect
- `Enter`: Complete current action
- `Delete/Backspace`: Delete selected polygon

## Data Format

Annotations are saved in COCO format, which includes:
- Image information (dimensions, filename)
- Category definitions (Window Pane, Door, Wall)
- Annotation data (polygons with point coordinates)
- Each annotation includes class, points, and metadata

Log files track all annotation activities with timestamps.