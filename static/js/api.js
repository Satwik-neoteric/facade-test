// api.js - API communication for Facade Studio
// Handles all server requests, data loading and saving

// Access state and elements from window instead of importing
const state = window.state;
const elements = window.elements;

import { 
  renderImageList, updateSelectedImageUI, renderAnnotationList, 
  renderLog, addLogEntry, renderMetadata, updateButtonStates 
} from './ui.js';
import { resetStateBeforeLoad, clearCanvasAndState } from './state.js';

// Fetch list of images from server with pagination support
export async function fetchImageList(loadFirstImage = false) {
  console.log("[DEBUG] fetchImageList: Starting with pagination");
  try {
    // Show loading indicator
    elements.imageListElement.innerHTML = '<li class="loading">Loading images...</li>';
    
    // Initialize the image list if it doesn't exist
    if (!state.imageList) {
      state.imageList = [];
    }
    
    // First check if there are folders/prefixes available
    const prefixResponse = await fetch('/api/images?prefixes_only=true');
    if (prefixResponse.ok) {
      const prefixData = await prefixResponse.json();
      state.imagePrefixes = prefixData.prefixes || [];
      console.log("[DEBUG] fetchImageList: Received prefixes:", state.imagePrefixes);
    }
    
    // Determine if we're looking at a specific prefix/folder
    const currentPrefix = state.currentPrefix || '';
    
    // Get the first page of images (30 max)
    const url = '/api/images?page=1' + (currentPrefix ? `&prefix=${currentPrefix}` : '');
    const response = await fetch(url);
    console.log("[DEBUG] fetchImageList: Fetch response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const images = data.images || [];
    console.log(`[DEBUG] fetchImageList: Received ${images.length} images (page 1)`);
    
    // Store the images in state
    state.imageList = images;
    
    // Store pagination info
    state.imagePagination = {
      currentPage: 1,
      totalPages: data.pages || 1,
      totalImages: data.total || images.length,
      pageSize: 30,
      hasMorePages: data.isPartialList || false
    };
    
    // Render the first page of images with pagination and folder controls
    renderImageList(true);
    
    // Show loading progress if there are more pages
    if (state.imagePagination.totalPages > 1) {
      updateLoadingStatus();
    }
    
    // Only select and load the first image if requested
    if (loadFirstImage && state.imageList && state.imageList.length > 0) {
      selectImage(state.imageList[0]);
    } else if (state.imageList.length === 0) {
      console.log("[DEBUG] fetchImageList: No images found.");
      elements.logBox.textContent = "No images found.";
      if (elements.imageNameStatus) {
        elements.imageNameStatus.textContent = 'None';
      }
      clearCanvasAndState();
    }
    
    return state.imageList;
  } catch (error) {
    console.error('[DEBUG] Error fetching image list:', error);
    elements.imageListElement.innerHTML = '<li class="error">Failed to load images</li>';
    elements.logBox.textContent = `Error: ${error.message}`;
    return [];
  }
}

// Load more images (used for pagination)
export async function loadMoreImages(silentPreload = false) {
  if (!state.imagePagination || state.imagePagination.currentPage >= state.imagePagination.totalPages) {
    console.log("[DEBUG] loadMoreImages: No more pages to load");
    return;
  }
  
  try {
    // Only add loading indicator if this is not a silent preload
    if (!silentPreload) {
      // Update the "Load More" button to show loading
      const loadMoreButton = document.querySelector('.load-more-button');
      if (loadMoreButton) {
        const nextPage = state.imagePagination.currentPage + 1;
        loadMoreButton.textContent = `Loading page ${nextPage}...`;
        loadMoreButton.disabled = true;
      }
    }
    
    // Determine which page to load next
    const nextPage = state.imagePagination.currentPage + 1;
    const currentPrefix = state.currentPrefix || '';
    
    // Make a request to the server for the next page
    const url = `/api/images?page=${nextPage}` + (currentPrefix ? `&prefix=${currentPrefix}` : '');
    console.log(`[DEBUG] loadMoreImages: Requesting page ${nextPage} from server: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const nextBatchImages = data.images || [];
    
    console.log(`[DEBUG] loadMoreImages: Loaded page ${nextPage}/${data.pages || state.imagePagination.totalPages} with ${nextBatchImages.length} more images`);
    
    // Update pagination info
    state.imagePagination.currentPage = nextPage;
    state.imagePagination.totalPages = data.pages || state.imagePagination.totalPages;
    state.imagePagination.totalImages = data.total || state.imagePagination.totalImages;
    state.imagePagination.hasMorePages = data.isPartialList || false;
    
    // Append the new images to the existing list for display
    state.imageList = [...state.imageList, ...nextBatchImages];
    
    // Only update the UI if this is not a silent preload
    if (!silentPreload) {
      // Render the updated image list but maintain the current selection
      const selectedItem = elements.imageListElement.querySelector('.selected');
      const selectedFilename = selectedItem ? selectedItem.dataset.filename : null;
      
      renderImageList(false, selectedFilename);
      
      // Update the loading progress indicator
      updateLoadingStatus();
    }
    
    return nextBatchImages;
  } catch (error) {
    console.error('[DEBUG] Error loading more images:', error);
    if (!silentPreload) {
      const loadMoreButton = document.querySelector('.load-more-button');
      if (loadMoreButton) {
        loadMoreButton.textContent = 'Error loading more images';
        loadMoreButton.className = 'load-more-button error';
      }
    }
    return [];
  }
}

// Set the current folder/prefix and reload images
export function setCurrentPrefix(prefix) {
  console.log("[DEBUG] setCurrentPrefix:", prefix);
  state.currentPrefix = prefix;
  
  // Reset pagination and image list
  state.imagePagination = null;
  state.imageList = [];
  state.allImageFilenames = null; // Reset the complete file list as well
  
  // Reload image list with the new prefix
  return fetchImageList(false);
}

// Navigate up one level in the folder hierarchy
export function navigateUp() {
  console.log("[DEBUG] navigateUp from:", state.currentPrefix);
  state.currentPrefix = null;
  
  // Reset pagination and image list
  state.imagePagination = null;
  state.imageList = [];
  state.allImageFilenames = null; // Reset the complete file list as well
  
  // Reload image list from the root level
  return fetchImageList(false);
}

// Update loading status in the UI
function updateLoadingStatus() {
  // Find existing progress indicator or create one
  let progressIndicator = elements.imageListElement.querySelector('.loading-progress');
  if (!progressIndicator) {
    progressIndicator = document.createElement('li');
    progressIndicator.className = 'loading-progress';
    elements.imageListElement.appendChild(progressIndicator);
  }
  
  progressIndicator.textContent = 
    `Loaded page ${state.imagePagination.currentPage}/${state.imagePagination.totalPages} (${state.imageList.length}/${state.imagePagination.totalImages} images)`;
}

// Check if we should preload the next batch based on threshold
function shouldPreloadNextBatch() {
  if (!state.imagePagination) return false;
  
  const { currentPage, totalPages, pageSize, totalImages, preloadThreshold } = state.imagePagination;
  
  // If we're on the last page, no need to preload
  if (currentPage >= totalPages) return false;
  
  // If we have fewer images left than the threshold, preload next batch
  const remainingInBatch = (currentPage * pageSize + preloadThreshold) - state.imageList.length;
  return remainingInBatch <= preloadThreshold;
}

// Fetch list of all available annotation classes from the server
export async function fetchClassList() {
  console.log("[DEBUG] fetchClassList: Requesting class list from server");
  try {
    const response = await fetch('/api/classes');
    
    if (!response.ok) {
      // Handle 404 errors with specific messaging without duplicating error logs
      if (response.status === 404) {
        console.log("[DEBUG] fetchClassList: API endpoint '/api/classes' not found on server (404). Falling back to UI extraction.");
      } else {
        console.error(`[DEBUG] Error fetching class list: Error: HTTP error! status: ${response.status}`);
      }
      
      // Instead of throwing, directly go to fallback
      return extractClassesFromUI();
    }
    
    const data = await response.json();
    console.log(`[DEBUG] fetchClassList: Received ${data.classes ? data.classes.length : 0} classes`);
    
    // If the server doesn't provide classes, try to extract from class buttons
    if (!data.classes || data.classes.length === 0) {
      console.log("[DEBUG] fetchClassList: No classes from server, extracting from UI");
      return extractClassesFromUI();
    }
    
    return data.classes;
  } catch (error) {
    // This will now only catch network errors, not HTTP status errors
    console.error('[DEBUG] Error fetching class list:', error);
    console.log('[DEBUG] fetchClassList: Network error, falling back to extracting classes from UI');
    return extractClassesFromUI();
  }
}

// Fetch class configurations from the server
export async function fetchClassConfig() {
    try {
        const response = await fetch('/api/classes');
        if (!response.ok) {
            throw new Error(`Failed to fetch class config: ${response.status}`);
        }
        const data = await response.json();
        return data.classes;
    } catch (error) {
        console.error('Error fetching class config:', error);
        return [];
    }
}

// Select an image from the list and load it
export async function selectImage(filename) {
  console.log(`[DEBUG] selectImage: Loading image ${filename}`);
  try {
    resetStateBeforeLoad();
    
    // Update UI to reflect the selection
    state.currentImageFilename = filename;
    updateSelectedImageUI(filename);
    
    // Use the correct URL format that matches the Flask route: /api/image/<path:filename>
    const imageUrl = `/api/image/${encodeURIComponent(filename)}`;
    
    console.log(`[DEBUG] Attempting to load image from: ${imageUrl}`);
    
    try {
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`HTTP error when loading image! status: ${imageResponse.status}`);
      }
      
      const imageBlob = await imageResponse.blob();
      loadImageIntoCanvas(imageBlob, filename);
      
      return URL.createObjectURL(imageBlob);
    } catch (error) {
      console.error(`[DEBUG] Error loading image ${filename}:`, error);
      addLogEntry(`Error loading image: ${error.message}`);
      return null;
    }
  } catch (error) {
    console.error(`[DEBUG] Error loading image ${filename}:`, error);
    addLogEntry(`Error loading image: ${error.message}`);
    return null;
  }
}

// Helper function to load an image blob into the canvas
function loadImageIntoCanvas(imageBlob, filename) {
  const imageURL = URL.createObjectURL(imageBlob);
  
  // Check if canvas is initialized
  if (!state.fabricCanvas) {
    console.error('[DEBUG] selectImage: Canvas not initialized!');
    addLogEntry('Error: Canvas not initialized');
    return;
  }
  
  // Load image into canvas
  fabric.Image.fromURL(imageURL, img => {
    // Store image dimensions for reference
    state.imageWidth = img.width;
    state.imageHeight = img.height;
    
    // Set the image as the canvas background
    state.fabricCanvas.setBackgroundImage(img, state.fabricCanvas.renderAll.bind(state.fabricCanvas), {
      scaleX: state.fabricCanvas.width / img.width,
      scaleY: state.fabricCanvas.height / img.height,
      originX: 'left',
      originY: 'top'
    });
    
    // Store initial scale and offset for coordinate transformations
    state.bgInitialScale = {
      x: state.fabricCanvas.width / img.width,
      y: state.fabricCanvas.height / img.height
    };
    state.bgInitialOffsetX = 0;
    state.bgInitialOffsetY = 0;
    
    // Reset zoom to fit the canvas
    import('./transformations.js').then(module => {
      module.resetZoom();
    });
    
    // Fetch annotations
    fetchAnnotations(filename);
    
    // Fetch log entries
    fetchLog(filename);
    
    // Fetch image metadata
    fetchMetadata(filename);
    
    // Log the action
    addLogEntry(`Loaded image: ${filename}`);
    
    // Reset the dirty state since we just loaded
    state.isDirty = false;
    updateButtonStates();
  });
} 

// Fetch annotations for an image from the server
export async function fetchAnnotations(filename) {
  console.log(`[DEBUG] fetchAnnotations: Loading annotations for ${filename}`);
  try {
    if (!filename) {
      console.error("[DEBUG] fetchAnnotations: No filename provided");
      addLogEntry("Error: No filename provided for fetching annotations");
      return null;
    }

    // Use the correct URL format for the annotations endpoint
    const url = `/api/annotations/${encodeURIComponent(filename)}`;
    
    console.log(`[DEBUG] fetchAnnotations: Requesting from ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[DEBUG] fetchAnnotations: HTTP error ${response.status}`);
      addLogEntry(`Error fetching annotations: HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.exists) {
      console.log(`[DEBUG] fetchAnnotations: Found annotations for ${filename} (source: ${data.source || 'unknown'})`);
      
      // Let the user know where the annotations were found
      if (data.source === 'local') {
        addLogEntry(`Loaded annotations from local Annotations directory`);
      } else {
        addLogEntry(`Loaded annotations from server`);
      }
      
      // Parse COCO annotations and add them to canvas
      if (data.coco) {
        const loadedPolygons = await parseCocoAnnotations(data.coco);
        
        console.log(`[DEBUG] fetchAnnotations: Parsed ${loadedPolygons.length} polygons`);
        
        // Add the polygons to state and canvas
        loadedPolygons.forEach(poly => {
          state.annotations.push(poly);
          state.fabricCanvas.add(poly);
        });
        
        // Update the annotation list in the UI
        renderAnnotationList();
        
        state.fabricCanvas.renderAll();
      }
      
      // Process logs if available
      if (data.log && data.log.length > 0) {
        renderLog(data.log);
      }
      
      return data;
    } else {
      console.log(`[DEBUG] fetchAnnotations: No annotations found for ${filename}`);
      addLogEntry("No existing annotations found");
      return null;
    }
  } catch (error) {
    console.error(`[DEBUG] fetchAnnotations: Error loading annotations for ${filename}:`, error);
    addLogEntry(`Error loading annotations: ${error.message}`);
    return null;
  }
}

// Fetch log entries for an image
export async function fetchLog(filename) {
  // The logs are fetched together with annotations in the fetchAnnotations function
  // This separate function exists for API completeness and future separation if needed
  console.log(`[DEBUG] fetchLog: Logs are fetched with annotations for ${filename}`);
  return null;
}

// Fetch metadata for an image from the server
export async function fetchMetadata(filename) {
  console.log(`[DEBUG] fetchMetadata: Getting metadata for ${filename}`);
  try {
    if (!filename) {
      console.error("[DEBUG] fetchMetadata: No filename provided");
      return null;
    }

    const url = `/api/metadata/${encodeURIComponent(filename)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[DEBUG] fetchMetadata: HTTP error ${response.status}`);
      return null;
    }
    
    const metadata = await response.json();
    console.log(`[DEBUG] fetchMetadata: Received metadata for ${filename}`, metadata);
    
    // Render the metadata in the UI
    renderMetadata(metadata);
    
    return metadata;
  } catch (error) {
    console.error(`[DEBUG] fetchMetadata: Error fetching metadata for ${filename}:`, error);
    return null;
  }
}

// Save the current annotations to the server
export async function saveAnnotations() {
  console.log("[DEBUG] saveAnnotations: Saving current annotations");
  
  if (!state.currentImageFilename) {
    console.error("[DEBUG] saveAnnotations: No current image selected");
    addLogEntry("Error: No image selected");
    return false;
  }
  
  try {
    // Import the convertFabricToCoco function to properly convert all annotations
    const cocoData = await import('./annotations.js').then(module => {
      return module.convertFabricToCoco();
    });
    
    if (!cocoData) {
      throw new Error("Failed to convert annotations to COCO format");
    }
    
    // Prepare the data to send
    const dataToSend = {
      coco: cocoData,
      log: state.logEntries || []
    };
    
    // Send to server
    const url = `/api/annotations/${encodeURIComponent(state.currentImageFilename)}`;
    console.log(`[DEBUG] saveAnnotations: Sending to ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSend)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`[DEBUG] saveAnnotations: Success - ${result.message}`);
    
    // Add success message to log
    addLogEntry(`Saved ${state.annotations.length} annotations`);
    
    // Reset dirty state
    state.isDirty = false;
    updateButtonStates();
    
    return true;
  } catch (error) {
    console.error("[DEBUG] saveAnnotations: Error", error);
    addLogEntry(`Error saving annotations: ${error.message}`);
    return false;
  }
}

// Load annotations and logs for the current image
export async function loadAnnotationsAndLogs(imagePath) {
    console.group("[DEBUG] loadAnnotationsAndLogs:", imagePath);
    
    if (!imagePath) {
        console.error("[DEBUG] loadAnnotationsAndLogs: No image path provided");
        console.groupEnd();
        return Promise.reject(new Error("No image path provided"));
    }
    
    try {
        // Get the batch ID and image ID from the window.AppState
        const batchId = window.AppState.currentBatch;
        const imageId = window.AppState.currentImageId;
        
        if (!batchId || !imageId) {
            console.warn("[DEBUG] loadAnnotationsAndLogs: Missing batch_id or image_id");
        }
        
        // Build the API URL with query parameters
        const apiUrl = `/api/annotations/${imagePath}?batch_id=${batchId || ""}&image_id=${imageId || ""}`;
        console.log(`[DEBUG] loadAnnotationsAndLogs: Requesting from ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`[DEBUG] No annotations found for ${imagePath}`);
                console.groupEnd();
                showMessage(`No annotations found for this image. Sometimes no annotations will be available in the cosmos coco file`, "info");
                return;
            }
            
            throw new Error(`Failed to load annotations: ${response.statusText}`);
        }
        
        const data = await response.json();
        const cocoData = data.coco;
        
        if (!cocoData || !cocoData.annotations || cocoData.annotations.length === 0) {
            console.log(`[DEBUG] No annotations in COCO data for ${imagePath}`);
            console.groupEnd();
            showMessage(`No annotations found in COCO data for this image`, "info");
            return;
        }
        
        // Parse COCO data and create annotations
        parseCocoAnnotations(cocoData);
        
        // Render the annotation list
        window.AppState.annotations.forEach(annotation => {
            addAnnotationToList(annotation);
        });
        
        // Check for and display logs if available
        if (data.log && Array.isArray(data.log) && data.log.length > 0) {
            console.log(`[DEBUG] Found ${data.log.length} log entries`);
            
            // Add log entries to the UI
            data.log.forEach(entry => {
                addLogEntry(entry);
            });
        }
        
        showMessage(`Loaded ${window.AppState.annotations.length} annotations for ${imagePath}`, "success");
        window.AppState.fabricCanvas.renderAll();
        
    } catch (error) {
        console.error("[DEBUG] Error loading annotations:", error);
        showMessage(`Error loading annotations for ${imagePath}. ${error.message}`, "warning");
        console.groupEnd();
        return Promise.reject(error);
    }
    
    console.groupEnd();
}

// Parse COCO annotations and create Fabric.js objects
function parseCocoAnnotations(cocoData) {
    console.group("[DEBUG] parseCocoAnnotations");
    
    // Build category map for looking up class names
    const categoryMap = {};
    if (cocoData.categories) {
        cocoData.categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });
    }
    
    console.log(`[DEBUG] Category map:`, categoryMap);
    console.log(`[DEBUG] Processing ${cocoData.annotations?.length || 0} annotations`);
    
    if (!cocoData.annotations || !Array.isArray(cocoData.annotations)) {
        console.warn("[DEBUG] No valid annotations array in COCO data");
        console.groupEnd();
        return;
    }
    
    // Process each annotation
    cocoData.annotations.forEach((ann, index) => {
        try {
            // Validate segmentation data
            if (!ann.segmentation || !Array.isArray(ann.segmentation) || !ann.segmentation[0]) {
                console.warn(`[DEBUG] Skip ann ${index}: Invalid segmentation data`);
                return;
            }
            
            const seg = ann.segmentation[0];
            
            // Check segmentation format
            if (!Array.isArray(seg) || seg.length < 6) {
                console.warn(`[DEBUG] Skip ann ${index}: Bad segmentation format (need at least 3 points)`);
                return;
            }
            
            // Build points array from segmentation data
            const points = [];
            for (let i = 0; i < seg.length; i += 2) {
                if (typeof seg[i] !== 'number' || typeof seg[i+1] !== 'number') {
                    console.warn(`[DEBUG] Invalid coordinate at position ${i}`);
                    continue;
                }
                
                // Convert image coordinates to canvas coordinates
                const canvasX = seg[i] * window.AppState.currentScale;
                const canvasY = seg[i+1] * window.AppState.currentScale;
                
                points.push({ x: canvasX, y: canvasY });
            }
            
            // Need at least 3 valid points to create a polygon
            if (points.length < 3) {
                console.warn(`[DEBUG] Skip ann ${index}: Not enough valid points (${points.length})`);
                return;
            }
            
            // Get class name from category
            const categoryId = ann.category_id;
            const className = categoryMap[categoryId] || `Category ${categoryId}`;
            
            // Create the polygon
            const polygon = new fabric.Polygon(points, {
                stroke: getCategoryColorByName(className),
                strokeWidth: 2,
                fill: 'rgba(0, 0, 0, 0.2)',
                objectCaching: false,
                transparentCorners: false,
                cornerColor: 'rgba(255, 255, 255, 0.8)',
                selectable: true,
                // Disable default controls/borders to prevent bounding box from flashing
                hasControls: false,
                hasBorders: false,
                perPixelTargetFind: true,
                // Set the ID from the COCO annotation 
                id: ann.id
            });
            
            // Store class and category information
            polygon.class = className;
            polygon.category_id = categoryId;
            
            // Store original points for saving later
            polygon.customData = {
                class: className,
                objectId: ann.objectId || `obj-${Date.now()}-${index}`,
                imagePoints: seg.reduce((arr, val, i) => {
                    if (i % 2 === 0) {
                        arr.push({ x: seg[i], y: seg[i+1] });
                    }
                    return arr;
                }, [])
            };
            
            // Add to canvas and annotations array
            window.AppState.fabricCanvas.add(polygon);
            window.AppState.annotations.push(polygon);
            
            console.log(`[DEBUG] Added polygon ${index} of class ${className}`);
            
        } catch (error) {
            console.error(`[DEBUG] Error processing annotation ${index}:`, error);
        }
    });
    
    console.log(`[DEBUG] Successfully added ${window.AppState.annotations.length} annotations`);
    console.groupEnd();
}

// Utility function to show messages
function showMessage(message, type = 'info') {
    // Create message container if it doesn't exist
    let messageContainer = $('#message-container');
    if (messageContainer.length === 0) {
        messageContainer = $('<div>').attr('id', 'message-container');
        $('body').append(messageContainer);
    }
    
    // Create message element
    const messageElement = $('<div>')
        .addClass('message')
        .addClass(type)
        .text(message);
    
    // Add to container
    messageContainer.append(messageElement);
    
    // Auto-remove after delay
    setTimeout(() => {
        messageElement.fadeOut(500, function() {
            $(this).remove();
        });
    }, 5000);
    
    // Log to console as well
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Get color for a category
function getCategoryColorByName(className) {
    if (!className) return 'rgb(0,0,0)';

    const classConfig = window.AppState?.classes || [];
    const classEntry = classConfig.find(cls => cls.name === className);
    console.log(`[DEBUG] Fetching color for class '${className}': ${color}`);

    return classEntry?.color || 'rgb(0,0,0)';
}

// Add annotation to the list display
function addAnnotationToList(obj) {
    const list = $('#annotation-list');
    const className = obj.class || `Category ${obj.category_id}`;
    // Use the annotation ID (from COCO) as first priority
    // This comes from the id property set during parseCocoAnnotations
    const annotationId = obj.id || '';
    
    const listItem = $('<li>').addClass('annotation-item');
    listItem.attr('data-id', annotationId);
    // Display the annotation ID and class name
    listItem.html(`<span class="annotation-color" style="background-color: ${obj.stroke};"></span> ${annotationId}: ${className}`);
    
    // Click handler to select the corresponding object on canvas
    listItem.on('click', function() {
        window.AppState.fabricCanvas.discardActiveObject();
        window.AppState.fabricCanvas.setActiveObject(obj);
        window.AppState.fabricCanvas.renderAll();
    });
    
    list.append(listItem);
}

// Delete the current image - updates the Status to 'Deleted' in CosmosDB
export async function deleteCurrentImage() {
  console.log("[DEBUG] deleteCurrentImage: Starting");
  
  // Get current image path and ID
  const currentImage = window.AppState ? window.AppState.currentImage : state.currentImageFilename;
  const currentImageId = window.AppState?.currentImageId || '';
  
  if (!currentImage) {
    console.error("[DEBUG] deleteCurrentImage: No current image selected");
    return;
  }
  
  // Ask for confirmation
  if (!confirm(`Delete ${currentImage}? This will mark the image as deleted.`)) {
    return;
  }
  
  // Disable delete button to prevent multiple clicks
  const deleteBtn = $('#delete-btn');
  deleteBtn.prop('disabled', true);
  
  try {
    console.log("[DEBUG] deleteCurrentImage: Preparing to mark image as deleted");
    
    // Get batch and image IDs from the current state if available
    const batchId = window.AppState?.currentBatch || '';
    const imageId = currentImageId || currentImage.split('/').pop().split('.')[0]; // Try to extract ID from filename as backup
    
    console.log(`[DEBUG] deleteCurrentImage: Using batchId=${batchId}, imageId=${imageId}`);
    
    // If batch ID and image ID are available, update the Status field in CosmosDB
    if (batchId && imageId) {
      // First get the current annotation data
      const apiUrl = `/api/annotations/${currentImage}?batch_id=${batchId}&image_id=${imageId}`;
      console.log(`[DEBUG] deleteCurrentImage: Fetching annotations from ${apiUrl}`);
      
      const annotationsResponse = await fetch(apiUrl);
      
      if (annotationsResponse.ok) {
        const annotationsData = await annotationsResponse.json();
        
        if (annotationsData && annotationsData.coco) {
          // Update the coco data to mark as deleted
          const cocoData = annotationsData.coco;
          
          console.log(`[DEBUG] deleteCurrentImage: Current Status=${cocoData.Status || 'undefined'}`);
          
          // Set Status field to "Deleted"
          cocoData.Status = "Deleted";
          
          // Initialize or update admin_metadata to include deletion date
          if (!cocoData.admin_metadata) {
            cocoData.admin_metadata = {};
          }
          cocoData.admin_metadata.Deletion_Date = new Date().toISOString();
          
          console.log("[DEBUG] deleteCurrentImage: Set Status=Deleted and added Deletion_Date");
          
          // Make sure ID fields are correctly set
          if (!cocoData.BatchID) cocoData.BatchID = batchId;
          if (!cocoData.ImageID) cocoData.ImageID = imageId;
          if (!cocoData.id) cocoData.id = imageId;
          
          // Create the payload with all necessary fields for the API
          const payload = {
            coco: cocoData,
            log: annotationsData.log || [],
            batch_id: batchId,
            image_id: imageId
          };
          
          console.log("[DEBUG] deleteCurrentImage: Saving updated record with deletion status");
          
          // Save the updated annotation data
          const saveResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (!saveResponse.ok) {
            let errorText = saveResponse.statusText;
            try {
              const errorData = await saveResponse.json();
              errorText = errorData.error || errorData.message || JSON.stringify(errorData);
            } catch(e) { /* Use status text if JSON parsing fails */ }
            
            throw new Error(`Failed to save deleted status: ${errorText}`);
          }
          
          const saveResult = await saveResponse.json();
          console.log("[DEBUG] deleteCurrentImage: CosmosDB update result:", saveResult);
          
          // Double-check the save was successful
          if (saveResult.cosmosDBSaved) {
            console.log("[DEBUG] deleteCurrentImage: Successfully updated CosmosDB status to Deleted");
          } else {
            console.warn("[DEBUG] deleteCurrentImage: CosmosDB save may not have succeeded, falling back to local save");
          }
          
          // Add log entry
          addLogEntry(`Image marked as deleted: ${currentImage}`);
          
          // Update the image list UI
          const currentImageItem = $('#image-list .image-item.active');
          if (currentImageItem.length) {
            currentImageItem.attr('data-status', 'Deleted');
            currentImageItem.addClass('deleted');
            
            // If not showing deleted images, hide this item
            if (!window.filterState?.showDeleted) {
              currentImageItem.hide();
            }
          } else {
            console.warn("[DEBUG] deleteCurrentImage: Could not find active image item in UI");
          }
          
          // Set the image name in the status bar to show Deleted
          $('#image-name-status').text(`${currentImage} (Deleted)`);
          
          // Show success message
          showMessage("Image marked as deleted successfully", "success");
          
          // Navigate to the next image
          import('./main.js').then(module => {
            if (module.navigateToNextImage) {
              module.navigateToNextImage();
            }
          });
          
          // Re-enable delete button
          deleteBtn.prop('disabled', false);
          return;
        } else {
          console.warn("[DEBUG] deleteCurrentImage: No COCO data found in annotations response");
        }
      } else {
        console.warn(`[DEBUG] deleteCurrentImage: Failed to fetch annotations: ${annotationsResponse.status} - ${annotationsResponse.statusText}`);
      }
    } else {
      console.warn(`[DEBUG] deleteCurrentImage: Missing batch_id or image_id, cannot update status in CosmosDB`);
    }
    
    // If we get here, either there was an issue using the CosmosDB approach or
    // batch_id/image_id weren't available. Fall back to the traditional approach.
    console.log("[DEBUG] deleteCurrentImage: Falling back to traditional blob storage approach");
    
    // Call the API endpoint that moves the image to the delete container
    const response = await fetch(`/api/delete/${currentImage}`, {
      method: 'POST'
    });
    
    console.log("[DEBUG] deleteCurrentImage: Fetch response status:", response.status);
    
    if (!response.ok) {
      let errorText = response.statusText;
      try {
        const data = await response.json();
        errorText = data.error || JSON.stringify(data);
      } catch(e) { /* Use status text if JSON parsing fails */ }
      
      throw new Error(`Delete failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(result.message);
    
    // Add log entry
    addLogEntry(`Image deleted: ${currentImage}`);
    
    // For older code versions
    const index = state?.imageList?.indexOf(currentImage);
    if (index > -1) {
      // Don't remove from the list, just update the UI
      renderImageList();
    }
    
    clearCanvasAndState();
    
    // Load next image if available
    let nextIndex = -1;
    if (state?.imageList?.length > 0) {
      nextIndex = (index === -1 || index >= state.imageList.length) ? 0 : index;
      selectImage(state.imageList[nextIndex]);
    } else {
      if (elements?.imageNameStatus) {
        elements.imageNameStatus.textContent = 'None';
      }
      updateButtonStates();
    }
    
    // Show success message
    showMessage("Image deleted successfully", "success");
    
  } catch (error) {
    console.error('[DEBUG] Error deleting image:', error);
    addLogEntry(`ERROR deleting: ${error.message}`);
    showMessage(`Failed to delete image: ${error.message}`, "error");
  } finally {
    // Re-enable delete button
    deleteBtn.prop('disabled', false);
    
    // Update button states
    if (typeof updateButtonStates === 'function') {
      updateButtonStates();
    }
  }
}