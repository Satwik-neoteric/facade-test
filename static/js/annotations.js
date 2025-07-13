// annotations.js - Polygon annotation functionality for Facade Studio
// Handles creation, selection, and manipulation of annotations

// Global state reference
const AppState = window.AppState;

// Initialize object ID counter if not exists
if (typeof AppState.nextObjectId === 'undefined') {
    AppState.nextObjectId = 1;
}

// Select a polygon for editing
export function selectPolygon(polygon) {
    if (AppState.currentMode === 'create' || polygon === AppState.activePolygon) return;
    
    deselectActivePolygon();
    
    if (polygon && AppState.annotations.includes(polygon)) {
        // Immediately set properties that disable the default Fabric.js bounding box
        // This prevents the appearance of the standard Fabric.js bounding box
        polygon.set({ 
            hasControls: false,
            hasBorders: false,
            lockMovementX: true, 
            lockMovementY: true, 
            selectable: true, // Keep selectable to maintain the selection
            cornerColor: 'transparent', // Make corners transparent in case they appear briefly
            borderColor: 'transparent', // Make borders transparent in case they appear briefly
            hoverCursor: 'default'
        });
        
        // Force an immediate render to apply these changes before proceeding
        AppState.fabricCanvas.renderAll();
        
        // Now set as the active polygon
        AppState.activePolygon = polygon;
        
        // Get or generate object ID if missing
        if (!AppState.activePolygon.customData?.objectId) {
            AppState.activePolygon.customData = AppState.activePolygon.customData || {};
            AppState.activePolygon.customData.objectId = generateObjectId(polygon.class || 'unknown');
        }
        
        // Store complete original polygon state for later restoration if editing is canceled
        AppState.originalPolygonState = {
            points: JSON.parse(JSON.stringify(polygon.points)),
            left: polygon.left,
            top: polygon.top,
            width: polygon.width,
            height: polygon.height,
            angle: polygon.angle || 0,
            scaleX: polygon.scaleX || 1,
            scaleY: polygon.scaleY || 1
        };
        
        // Store original image points if they exist
        AppState.originalImagePoints = null;
        if (polygon.customData && polygon.customData.imagePoints) {
            AppState.originalImagePoints = JSON.parse(JSON.stringify(polygon.customData.imagePoints));
        }
        
        // Update status bar with object ID
        updateSelectedObjectDisplay(polygon);
        
        // Create the edit vertex handles
        createEditHandles(AppState.activePolygon);
        
        AppState.currentMode = 'edit';
        updateModeDisplay();
        
        // Force another render to ensure everything is drawn correctly
        AppState.fabricCanvas.requestRenderAll();
        
        addLogEntry(`Selected ${polygon.class || 'polygon'}`);
    }
}

// Deselect the active polygon
export function deselectActivePolygon() {
    removeEditHandles();
    
    if (AppState.activePolygon) {
        AppState.activePolygon.set({
            hasControls: true,
            lockMovementX: false,
            lockMovementY: false,
            selectable: true,
            evented: true
        });
        AppState.activePolygon.setCoords();
        
        // Clear selected object ID from status
        $('#selected-object-status').text('None');
        
        AppState.activePolygon = null;
    }
    
    if (AppState.fabricCanvas) {
        AppState.fabricCanvas.discardActiveObject();
        AppState.fabricCanvas.renderAll();
    }
    
    if (AppState.currentMode === 'edit') {
        AppState.currentMode = 'select';
    }
    
    updateModeDisplay();
}

// Create edit handles for a polygon
export function createEditHandles(polygon) {
    console.group(`[DEBUG] createEditHandles: Polygon`);
    removeEditHandles();
    
    if (!polygon?.points) {
        console.warn("No points");
        console.groupEnd();
        return;
    }
    
    // Ensure polygon coordinates are up-to-date
    polygon.setCoords();
    
    console.log(` Poly State: L=${polygon.left}, T=${polygon.top}, Angle=${polygon.angle}, ScaleX=${polygon.scaleX}, PathOffset=(${polygon.pathOffset?.x},${polygon.pathOffset?.y})`);
    
    // Initialize editHandles array if it doesn't exist
    if (!AppState.editHandles) {
        AppState.editHandles = [];
    }
    
    // Create handles for each point of the polygon
    polygon.points.forEach((pt, index) => {
        // Calculate the correct absolute position of this point on the canvas
        let absoluteX, absoluteY;
        
        // The key fix: check if the polygon's left/top already includes the pathOffset
        // This happens when polygons are loaded from COCO files
        if (polygon.pathOffset && (Math.abs(polygon.left) > 0.1 || Math.abs(polygon.top) > 0.1)) {
            // Use canvas coordinates directly, without adding pathOffset twice
            absoluteX = pt.x - polygon.pathOffset.x + polygon.left + polygon.width/2;
            absoluteY = pt.y - polygon.pathOffset.y + polygon.top + polygon.height/2;
        } else {
            // Normal case for newly created polygons
            absoluteX = polygon.left + pt.x;
            absoluteY = polygon.top + pt.y;
        }
        
        console.log(` Handle ${index}: Point at x:${absoluteX.toFixed(2)}, y:${absoluteY.toFixed(2)}`);
        console.log(getCategoryColorByName(polygon.class, true));
        // Create a handle at this absolute position
        const handle = new fabric.Circle({
            radius: 5 / AppState.fabricCanvas.getZoom(),
            fill: getCategoryColorByName(polygon.class, true),
            stroke: '#fff',
            strokeWidth: 1 / AppState.fabricCanvas.getZoom(),
            left: absoluteX,
            top: absoluteY,
            originX: 'center',
            originY: 'center',
            selectable: true,
            hasBorders: false,
            hasControls: false,
            hoverCursor: 'move',
            customData: { isHandle: true, targetPolygon: polygon, pointIndex: index }
        });
        
        handle.on('mouseover', function() {
            this.set('fill', 'rgba(255,0,0,0.9)');
            AppState.fabricCanvas.renderAll();
        });
        
        handle.on('mouseout', function() {
            this.set('fill', 'rgba(0,180,255,0.8)');
            AppState.fabricCanvas.renderAll();
        });
        
        AppState.fabricCanvas.add(handle);
        AppState.editHandles.push(handle);
    });
    
    // Make sure handles are on top of other objects
    AppState.editHandles.forEach(h => h.bringToFront());
    
    console.log(` Created ${AppState.editHandles.length} handles.`);
    AppState.fabricCanvas.renderAll();
    console.groupEnd();
}

// Remove edit handles from canvas
export function removeEditHandles() {
    if (!AppState.editHandles) {
        AppState.editHandles = [];
        return;
    }
    
    if (AppState.editHandles.length > 0) {
        while(AppState.editHandles.length > 0) {
            const handle = AppState.editHandles.pop();
            if (handle && AppState.fabricCanvas) AppState.fabricCanvas.remove(handle);
        }
    }
}

// Delete the selected polygon
export function deleteSelectedPolygon() {
    if (!AppState.activePolygon) return;
    
    if (confirm(`Delete selected ${AppState.activePolygon.class || 'polygon'}?`)) {
        const index = AppState.annotations.indexOf(AppState.activePolygon);
        
        if (index > -1) {
            removeEditHandles();
            const polyToRemove = AppState.annotations.splice(index, 1)[0];
            
            if (polyToRemove && AppState.fabricCanvas) AppState.fabricCanvas.remove(polyToRemove);
            
            addLogEntry(`Deleted polygon ${index + 1}`, polyToRemove.customData?.objectId);
            
            AppState.activePolygon = null;
            AppState.currentMode = 'select';
            updateModeDisplay();
            
            // Update annotation list
            // Simplest way is to rebuild it
            rebuildAnnotationList();
            
            AppState.fabricCanvas.renderAll();
        }
    }
}

// Handle object moving event for edit handles
export function handleObjectMoving(options) {
    const target = options.target;
    
    if (target?.customData?.isHandle) {
        const { targetPolygon, pointIndex } = target.customData;
        
        // Get handle's current absolute canvas position
        const canvasPoint = { x: target.left, y: target.top };
        
        // Store the polygon's current position before making any changes
        const currentLeft = targetPolygon.left;
        const currentTop = targetPolygon.top;
        
        // Calculate the relative point position differently based on whether this is a 
        // reloaded polygon (has pathOffset) or a new polygon
        let relativePoint;
        
        // Check if this is a reloaded polygon by examining pathOffset and position
        const isReloadedPolygon = targetPolygon.pathOffset && 
                                (Math.abs(targetPolygon.left) > 0.1 || Math.abs(targetPolygon.top) > 0.1);
        
        if (isReloadedPolygon) {
            // For reloaded polygons, we need to account for pathOffset
            relativePoint = {
                x: canvasPoint.x - currentLeft - targetPolygon.width/2 + targetPolygon.pathOffset.x,
                y: canvasPoint.y - currentTop - targetPolygon.height/2 + targetPolygon.pathOffset.y
            };
        } else {
            // For new polygons, simple conversion works
            relativePoint = {
                x: canvasPoint.x - currentLeft,
                y: canvasPoint.y - currentTop
            };
        }
        
        // Update polygon points with the relative coordinates
        if (targetPolygon.points && targetPolygon.points[pointIndex]) {
            targetPolygon.points[pointIndex].x = relativePoint.x;
            targetPolygon.points[pointIndex].y = relativePoint.y;
            
            // Mark polygon as dirty
            targetPolygon.dirty = true;
            
            // IMPORTANT: Do not modify the polygon's position, just update the points
            targetPolygon.set({
                left: currentLeft,
                top: currentTop
            });
            
            // Make sure the internal coordinates are updated
            targetPolygon.setCoords();
            
            // Store the current handle for reference (we won't directly use it again)
            const handleBeingDragged = target;
            
            // Remove all existing edit handles
            removeEditHandles();
            
            // Create new handles with updated positions
            createEditHandles(targetPolygon);
            
            // Find the handle at the same index that's now being dragged
            // and make sure it's on top of all other objects
            if (AppState.editHandles && AppState.editHandles.length > pointIndex) {
                const newActiveHandle = AppState.editHandles[pointIndex];
                if (newActiveHandle && AppState.fabricCanvas) {
                    AppState.fabricCanvas.bringToFront(newActiveHandle);
                }
            }
            
            // Update image points if available
            if (targetPolygon.customData && targetPolygon.customData.imagePoints) {
                // Update the image point for this handle
                targetPolygon.customData.imagePoints[pointIndex] = {
                    x: canvasPoint.x / AppState.currentScale,
                    y: canvasPoint.y / AppState.currentScale
                };
            }
            
            // Force canvas render
            AppState.fabricCanvas.renderAll();
        }
    }
}



// Convert Fabric.js objects to COCO format
export function convertFabricToCoco() {
    console.group("[DEBUG] convertFabricToCoco");
    
    // Create base COCO structure - always return this even if no annotations
    const coco = {
        info: {
            description: "Facade Studio Annotations",
            date_created: new Date().toISOString()
        },
        images: [{
            id: AppState.currentImageId || 1,
            file_name: AppState.currentImage,
            width: AppState.originalImageWidth,
            height: AppState.originalImageHeight
        }],
        annotations: [], // This will be empty array if no annotations
        categories: []
    };
    
    if (!AppState.annotations || !Array.isArray(AppState.annotations) || AppState.annotations.length === 0) {
        console.log("[DEBUG] No annotations to convert - returning empty COCO structure");
        console.groupEnd();
        return coco; // Return empty structure instead of null
    }
    
    try {
        // Build categories dictionary
        const categoriesDict = {};
        let nextCategoryId = 1;
        
        console.log(`[DEBUG] Converting ${AppState.annotations.length} annotations to COCO format`);
        
        // Process each annotation
        AppState.annotations.forEach((obj, index) => {
            // Skip non-polygon objects
            if (!(obj.points && Array.isArray(obj.points) && obj.points.length >= 3)) {
                console.warn(`[DEBUG] Skipping non-polygon or invalid object at index ${index}`);
                return;
            }
            
            // Get or create category
            const className = obj.class || `Unknown_${index}`;
            let categoryId;
            
            if (categoriesDict[className]) {
                categoryId = categoriesDict[className];
            } else {
                categoryId = nextCategoryId++;
                categoriesDict[className] = categoryId;
                
                // Add to categories array
                coco.categories.push({
                    id: categoryId,
                    name: className,
                    supercategory: "Facade"
                });
            }
            
            // Get polygon coordinates in image space
            let imagePoints = [];
            
            // First try to get the pre-calculated image points from customData
            if (obj.customData && obj.customData.imagePoints && obj.customData.imagePoints.length >= 3) {
                console.log(`[DEBUG] Using pre-calculated imagePoints for polygon ${index} (${className})`);
                imagePoints = obj.customData.imagePoints;
            } else {
                // Fallback to calculating points from canvas coordinates
                console.log(`[DEBUG] Calculating imagePoints for polygon ${index} (${className})`);
                
                // Check if this is a reloaded polygon with pathOffset
                const isReloadedPolygon = obj.pathOffset && 
                                       (Math.abs(obj.left) > 0.1 || Math.abs(obj.top) > 0.1);
                
                imagePoints = obj.points.map(point => {
                    let canvasX, canvasY;
                    
                    // Different calculation based on polygon type
                    if (isReloadedPolygon) {
                        canvasX = point.x - obj.pathOffset.x + obj.left + obj.width/2;
                        canvasY = point.y - obj.pathOffset.y + obj.top + obj.height/2;
                    } else {
                        canvasX = obj.left + point.x;
                        canvasY = obj.top + point.y;
                    }
                    
                    // Convert canvas coords to original image coords
                    // Use the correct scale value from the application state
                    return {
                        x: canvasX / AppState.currentScale,
                        y: canvasY / AppState.currentScale
                    };
                });
            }
            
            // Debug log
            console.log(`[DEBUG] Polygon ${index} has ${imagePoints.length} points`);
            
            // Convert points to flat array for segmentation
            const segmentation = [
                imagePoints.reduce((flat, point) => {
                    flat.push(point.x, point.y);
                    return flat;
                }, [])
            ];
            
            // Calculate bounding box [x, y, width, height]
            const xs = imagePoints.map(p => p.x);
            const ys = imagePoints.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const bbox = [minX, minY, maxX - minX, maxY - minY];
            
            // Calculate area (approximate)
            const area = (maxX - minX) * (maxY - minY);
            
            // Create annotation object
            const annotation = {
                id: index + 1,
                image_id: AppState.currentImageId || 1,
                category_id: categoryId,
                segmentation: segmentation,
                area: area,
                bbox: bbox,
                iscrowd: 0,
                objectId: obj.customData?.objectId || (index + 1).toString()
            };
            
            // Add to annotations array
            coco.annotations.push(annotation);
        });
        
        console.log(`[DEBUG] Created COCO data with ${coco.annotations.length} annotations and ${coco.categories.length} categories`);
        console.groupEnd();
        return coco;
        
    } catch (error) {
        console.error("[DEBUG] Error converting to COCO format:", error);
        console.groupEnd();
        return coco; // Return empty structure instead of null on error
    }
}

// Save annotations to the server
export async function saveAnnotations() {
    console.group("[DEBUG] saveAnnotations: Start");

    try {
        if (!window.AppState.currentImage) {
            console.error("[DEBUG] saveAnnotations: No current image selected");
            showMessage("Error: No image selected", "error");
            console.groupEnd();
            return false;
        }

        // Show loading indicator
        showMessage("Saving annotations...", "info");
        const annotations = window.AppState.annotations || [];

        console.log(`[DEBUG] saveAnnotations: Found ${annotations.length} annotations to save`);

        // Convert annotations to COCO format (this will return empty structure if no annotations)
        const cocoData = convertFabricToCoco();

        if (!cocoData) {
            throw new Error("Failed to convert annotations to COCO format");
        }

        // Add extra metadata that might be needed by CosmosDB
        if (window.AppState.currentBatch) {
            cocoData.BatchID = window.AppState.currentBatch;
        }

        if (window.AppState.currentImageId) {
            cocoData.ImageID = window.AppState.currentImageId;
            // Set id field for CosmosDB
            cocoData.id = window.AppState.currentImageId;
        }

        // Set Status field to "Labelled" when submitted from regular annotation mode
        cocoData.Status = "Labelled";

        // Prepare the data to send with the structure expected by the server
        const dataToSend = {
            coco: cocoData,
            log: window.AppState.logEntries || []
        };

        // Debug log the payload
        console.log("[DEBUG] saveAnnotations: Payload structure", {
            batchId: window.AppState.currentBatch,
            imageId: window.AppState.currentImageId,
            hasAnnotations: cocoData.annotations && cocoData.annotations.length > 0,
            annotationCount: cocoData.annotations ? cocoData.annotations.length : 0,
            status: cocoData.Status
        });

        // Build URL with proper query parameters
        const batch_id = window.AppState.currentBatch || '';
        const image_id = window.AppState.currentImageId || '';

        const baseUrl = `/api/annotations/${encodeURIComponent(window.AppState.currentImage)}`;
        const url = `${baseUrl}?batch_id=${encodeURIComponent(batch_id)}&image_id=${encodeURIComponent(image_id)}`;

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
        console.log(`[DEBUG] saveAnnotations: Success - ${result.message || 'Annotations saved'}`);

        // Add success message to log based on whether we had annotations or not
        if (annotations.length > 0) {
            addLogEntry(`Saved ${annotations.length} annotations to CosmosDB with status 'Labelled'`);
            showMessage(`Saved ${annotations.length} annotations successfully`, "success");
        } else {
            addLogEntry(`Cleared annotations in CosmosDB (saved empty annotation set)`);
            showMessage("Annotations cleared successfully", "success");
        }

        // Reset dirty state
        if (window.AppState.isDirty !== undefined) {
            window.AppState.isDirty = false;
        }

        console.groupEnd();
        return true;
    } catch (error) {
        console.error("[DEBUG] saveAnnotations: Error", error);
        showMessage(`Error saving annotations: ${error.message}`, "error");
        console.groupEnd();
        return false;
    }
}

// Initialize a polygon with custom settings to ensure proper selection behavior
export function initializePolygon(polygon) {
    // Set basic properties for proper rendering and interaction
    polygon.set({
        fill: polygon.fill || 'rgba(0, 150, 255, 0.3)',
        stroke: polygon.stroke || 'rgba(0, 150, 255, 0.9)',
        strokeWidth: 2,
        objectCaching: false,
        transparentCorners: false,
        cornerStyle: 'circle',
        perPixelTargetFind: true, // Only respond to clicks on the actual polygon, not its bounding box
        selectionBackgroundColor: 'rgba(255, 255, 255, 0.3)',
        cornerColor: 'rgba(0, 150, 255, 0.8)',
        borderColor: 'rgba(0, 150, 255, 0.8)',
        cornerSize: 8,
        padding: 0, // Remove padding to ensure tighter hit testing
        hasBorders: false, // Hide borders by default
        hasControls: false, // Hide controls by default
    });

    // Apply the initialized polygon
    polygon.setCoords();
    
    return polygon;
}

// Helper function to show messages
function showMessage(message, type = 'info') {
    // Define which message patterns should be shown
    const allowedMessagePatterns = [
        // Image loading related
        /image(s)?\s+(loaded|loading)/i,
        /(loading|loaded)\s+image/i,
        
        // Saving related
        /(saved|saving|save)\s+(annotation|image)/i,
        /(annotation|image)\s+(saved|saving|save)/i,
        
        // Class related
        /class(es)?\s+(added|updated|edited|deleted)/i,
        /(added|updated|edited|deleted)\s+class/i,
        
        // Action related
        /(submitted|deleted|skipped|action)/i,
        
        // Validation state
        /(accepted|rejected|skipped|validate)/i,
        
        // Error messages should always be shown
        /error/i
    ];
    
    // Check if the message matches any of the allowed patterns
    const shouldShow = type === 'error' || allowedMessagePatterns.some(pattern => pattern.test(message));
    
    // If message doesn't match allowed patterns, only log to console and don't show UI notification
    if (!shouldShow) {
        console.log(`[${type.toUpperCase()}] ${message} (notification suppressed)`);
        return;
    }
    
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

// Helper functions 

// Generate an object ID
function generateObjectId(className) {
    // Get the next sequential ID and increment the counter
    const id = AppState.nextObjectId++;
    return id.toString();
}

// Add log entry
function addLogEntry(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const entry = `[${timestamp}] ${message}`;
    
    const logBox = $('#log-box');
    const logList = logBox.find('.log-list');
    
    if (logList.length === 0) {
        const newList = $('<ul>').addClass('log-list');
        const listItem = $('<li>').addClass('log-entry').text(entry);
        newList.append(listItem);
        logBox.empty().append(newList);
    } else {
        const listItem = $('<li>').addClass('log-entry').text(entry);
        logList.append(listItem);
    }
    
    // Scroll to bottom
    logBox.scrollTop(logBox[0].scrollHeight);
    
    return entry;
}

// Update mode display
function updateModeDisplay() {
    const modeText = AppState.currentMode.charAt(0).toUpperCase() + AppState.currentMode.slice(1);
    $('#mode-status').text(modeText);
}

// Update selected object display
function updateSelectedObjectDisplay(obj) {
    if (!obj) {
        $('#selected-object-status').text('None');
        return;
    }
    
    let displayText = '';
    const className = obj.class || 'Unknown';
    
    // Get the sequential ID from the annotations array position
    const index = AppState.annotations.indexOf(obj);
    const id = index > -1 ? (index + 1) : '?';
    
    // Show the sequential ID (from COCO record) instead of the objectId timestamp
    displayText = `${id}: ${className}`;
    
    $('#selected-object-status').text(displayText);
}

// Rebuild the annotation list
function rebuildAnnotationList() {
    const list = $('#annotation-list');
    list.empty();
    
    AppState.annotations.forEach(obj => {
        const className = obj.class || `Category ${obj.category_id}`;
        
        // Get the annotation ID from all possible sources, with priority order
        const annotationId = obj.id || obj.customData?.objectId || '';
        
        const listItem = $('<li>').addClass('annotation-item');
        listItem.attr('data-id', obj.id || obj.customData?.objectId || '');
        
        // Display the annotation ID before the class name for consistent identification
        listItem.html(`<span class="annotation-color" style="background-color: ${obj.stroke};"></span> ${annotationId}: ${className}`);
        
        // Click handler to select the corresponding object on canvas
        listItem.on('click', function() {
            AppState.fabricCanvas.discardActiveObject();
            AppState.fabricCanvas.setActiveObject(obj);
            AppState.fabricCanvas.renderAll();
        });
        
        list.append(listItem);
    });
}

// Helper function to get color for a category by name with optional transparency
function getCategoryColorByName(className, asTransparentFill = false) {
    if (!className || !AppState.classes) return asTransparentFill ? 'rgba(0, 0, 0, 0.2)' : 'rgb(0, 0, 0)';

    const classData = AppState.classes.find(cls => cls.name === className);
    const color = classData ? classData.color : 'rgb(0, 0, 0)';
    console.log(`[DEBUG] getCategoryColorByName: className=${className}, color=${color}, asTransparentFill=${asTransparentFill}`);
    // if (asTransparentFill) {
    //     // Convert rgb color to rgba with 0.3 opacity
    //     return color.replace('rgb', 'rgba').replace(')', ', 0.3)');
    // }

    return color;
}