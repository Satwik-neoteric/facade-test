// drawing.js - Drawing functionality for Facade Studio
// Handles polygon creation and drawing features

// Global state reference - we'll access this from the window object as in the current implementation
const AppState = window.AppState;

// Start drawing a new polygon
export function startDrawing(pointer) {
    console.log("[DEBUG] startDrawing called with pointer:", pointer);
    
    // Deselect any active polygon
    deselectActivePolygon();
    
    // Store the current mode and set to drawing
    AppState.previousMode = AppState.currentMode;
    AppState.currentMode = 'create';
    AppState.isDrawing = true;
    AppState.currentPolygonPoints = [];
    AppState.tempPoints = [];
    
    // Update UI
    updateModeDisplay();
    
    // Add the first point
    addDrawingPoint(pointer);
}

// Add a point to the current polygon being drawn
export function addDrawingPoint(pointer) {
    if (!AppState.isDrawing || AppState.currentMode !== 'create') return;
    
    const x = pointer.x;
    const y = pointer.y;
    
    console.log(`[DEBUG] addDrawingPoint: Canvas Click @ (${x.toFixed(1)}, ${y.toFixed(1)})`);
    console.log("[DEBUG] addDrawingPoint: Current Polygon Points:", JSON.stringify(AppState.currentPolygonPoints));
    console.log("[DEBUG] addDrawingPoint: Current Class:", AppState.currentClass);
    console.log(
        "color:", getCategoryColorByName(AppState.currentClass, true),
    )
    // Check if we're closing the polygon (clicking near the first point)
    if (AppState.currentPolygonPoints.length >= 2) {
        const p1 = AppState.currentPolygonPoints[0];
        const distSq = (x - p1.x) ** 2 + (y - p1.y) ** 2;
        const thresh = 10 / AppState.fabricCanvas.getZoom();
        
        if (distSq < thresh * thresh) {
            console.log("[DEBUG] addDrawingPoint: Closing polygon.");
            completeDrawing();
            return;
        }
    }
    
    // Add the point to the current polygon
    AppState.currentPolygonPoints.push({ x, y });
    addLogEntry(`Added point ${AppState.currentPolygonPoints.length} at (${Math.round(x)}, ${Math.round(y)})`);
    
    // Create a point marker
    const r = 3 / AppState.fabricCanvas.getZoom();
    // Ensure transparency in temporary points and lines
    const c = new fabric.Circle({
        radius: r,
        fill: getCategoryColorByName(AppState.currentClass, true), // Use RGBA color with transparency
        stroke: '#fff',
        strokeWidth: 1 / AppState.fabricCanvas.getZoom(),
        left: x - r,
        top: y - r,
        selectable: false,
        evented: false,
        originX: 'left',
        originY: 'top',
        temporary: true
    });
    
    AppState.tempPoints.push(c);
    AppState.fabricCanvas.add(c);
    
    // If we have at least 2 points, draw a line between the last two points
    if (AppState.currentPolygonPoints.length > 1) {
        const p2 = AppState.currentPolygonPoints[AppState.currentPolygonPoints.length - 2];
        // Ensure transparency in temporary points and lines
        const l = new fabric.Line([p2.x, p2.y, x, y], {
            stroke: getCategoryColorByName(AppState.currentClass, true), // Use RGBA color with transparency
            strokeWidth: 1 / AppState.fabricCanvas.getZoom(),
            selectable: false,
            evented: false,
            temporary: true
        });
        
        AppState.tempPoints.push(l);
        AppState.fabricCanvas.add(l);
    }
    
    // Update or create the temporary line that follows the cursor
    if (AppState.tempLine) {
        AppState.tempLine.set({ x1: x, y1: y, x2: x, y2: y });
    } else {
        AppState.tempLine = new fabric.Line([x, y, x, y], {
            stroke: getCategoryColorByName(AppState.currentClass, true), // Use RGBA color with transparency
            strokeDashArray: [5, 5],
            strokeWidth: 1 / AppState.fabricCanvas.getZoom(),
            selectable: false,
            evented: false,
            temporary: true
        });
        
        AppState.fabricCanvas.add(AppState.tempLine);
    }
    
    AppState.fabricCanvas.renderAll();
}

// Complete the current polygon drawing
export function completeDrawing() {
    console.group("[DEBUG] completeDrawing: Start");
    
    if (!AppState.isDrawing || AppState.currentMode !== 'create' || AppState.currentPolygonPoints.length < 3) {
        console.warn("[DEBUG] completeDrawing: Abort - invalid state.");
        cancelDrawing();
        console.groupEnd();
        return;
    }
    
    // Use the captured canvas points directly for creation
    const canvasPoints = AppState.currentPolygonPoints.map(p => ({ x: p.x, y: p.y }));
    console.log("[DEBUG] completeDrawing: Captured Canvas Points:", JSON.stringify(canvasPoints));
    
    // Convert canvas points to image points for storage
    const imagePoints = canvasPoints.map(p => ({
        x: p.x / AppState.currentScale,
        y: p.y / AppState.currentScale
    }));
    
    if (imagePoints.some(p => isNaN(p.x) || isNaN(p.y))) {
        console.error("[DEBUG] completeDrawing: Error transforming points for storage. Aborting.");
        cancelDrawing();
        console.groupEnd();
        return;
    }
    
    console.log("[DEBUG] completeDrawing: Calc Image Points for storage:", JSON.stringify(imagePoints));
    
    // Find Top-Left bounding box corner of canvas points
    let minX = Infinity, minY = Infinity;
    canvasPoints.forEach(p => { 
        minX = Math.min(minX, p.x); 
        minY = Math.min(minY, p.y); 
    });
    
    // Calculate local points relative to the top-left corner
    const localPoints = canvasPoints.map(p => ({ x: p.x - minX, y: p.y - minY }));
    
    let polygon = null;
    
    try {
        // Create the Fabric Polygon using local points and top-left position
        polygon = new fabric.Polygon(canvasPoints, {
            stroke: getCategoryColorByName(AppState.currentClass),
            strokeWidth: 2,
            fill: getCategoryColorByName(AppState.currentClass, true),
            objectCaching: false,
            transparentCorners: false,
            cornerColor: 'rgba(255, 255, 255, 0.8)',
            selectable: true,
            hasControls: true
        });
        
        // Debug log for polygon rendering
        console.log(`[DEBUG] Rendering polygon with fill color: ${getCategoryColorByName(AppState.currentClass, true)}`);
        
        // Import the annotations module to initialize the polygon with per-pixel hit testing
        import('./annotations.js').then(module => {
            // Use the new initializePolygon function to properly set up the polygon
            // This ensures we can only select by clicking directly on the polygon, not its bounding box
            if (typeof module.initializePolygon === 'function') {
                polygon = module.initializePolygon(polygon);
                console.log("[DEBUG] Polygon initialized with per-pixel hit testing");
            }
        });
        
        // Add class information to the polygon
        polygon.class = AppState.currentClass;
        
        // Add category ID if we can find one
        const categoryMap = new Map();
        AppState.classes.forEach((className, index) => {
            categoryMap.set(className, index + 1);
        });
        
        if (categoryMap.has(AppState.currentClass)) {
            polygon.category_id = categoryMap.get(AppState.currentClass);
        } else {
            polygon.category_id = categoryMap.size + 1;
        }
        
        // Store original image coordinates for better saving/loading
        polygon.customData = {
            class: AppState.currentClass,
            objectId: Date.now().toString(), // Generate a unique ID
            imagePoints: imagePoints
        };
        
        console.log(`[DEBUG] completeDrawing: Created Polygon W=${polygon.width?.toFixed(2)}, H=${polygon.height?.toFixed(2)}`);
    } catch (creationError) {
        console.error("[DEBUG] completeDrawing: CRITICAL ERROR during new fabric.Polygon():", creationError);
        showMessage("Error creating polygon shape.", "error");
        cancelDrawing();
        console.groupEnd();
        return;
    }
    
    if (polygon) {
        // Clean up temporary drawing elements
        cleanupDrawingAids();
        
        // Add to canvas
        AppState.fabricCanvas.add(polygon);
        
        // Add to annotations array
        AppState.annotations.push(polygon);
        
        // Add to annotations list
        addAnnotationToList(polygon);
        
        // Reset state
        AppState.isDrawing = false;
        AppState.currentPolygonPoints = [];
        AppState.tempPoints = [];
        AppState.tempLine = null;
        
        // Add log entry
        addLogEntry(`Added ${AppState.currentClass} polygon annotation`);
        
        // Exit polygon mode and return to select mode
        AppState.polygonMode = false;
        AppState.currentMode = 'select';
        updateModeDisplay();
        
        AppState.fabricCanvas.renderAll();
        console.log("[DEBUG] completeDrawing: Successfully switched to Select mode");
    }
    
    console.groupEnd();
}

// Cancel the current polygon drawing
export function cancelDrawing() {
    if (!AppState.isDrawing) return;
    
    console.log("[DEBUG] Cancelling draw.");
    addLogEntry('Draw cancelled.');
    cleanupDrawingAids();
    AppState.isDrawing = false;
    AppState.currentPolygonPoints = [];
    AppState.tempPoints = [];
    AppState.tempLine = null;
    
    // Return to previous mode
    AppState.currentMode = 'select';
    updateModeDisplay();
    
    AppState.fabricCanvas.renderAll();
    showMessage("Polygon drawing canceled", "info");
}

// Clean up temporary drawing aids
function cleanupDrawingAids() {
    // Remove temporary drawing elements
    if (AppState.tempLine) {
        AppState.fabricCanvas.remove(AppState.tempLine);
        AppState.tempLine = null;
    }
    
    // Remove all temporary points
    if (AppState.tempPoints && AppState.tempPoints.length > 0) {
        AppState.tempPoints.forEach(obj => {
            if (obj) AppState.fabricCanvas.remove(obj);
        });
        AppState.tempPoints = [];
    }
    
    // Remove active shape if exists
    if (AppState.activeShape) {
        AppState.fabricCanvas.remove(AppState.activeShape);
        AppState.activeShape = null;
    }
    
    AppState.fabricCanvas.renderAll();
}

// Helper functions that reference the current implementation

// Update mode display in status bar
function updateModeDisplay() {
    const modeText = AppState.currentMode.charAt(0).toUpperCase() + AppState.currentMode.slice(1);
    $('#mode-status').text(modeText);
}

// Get color for a category by name with optional transparency
function getCategoryColorByName(className, asTransparentFill = false) {
    if (!className || !AppState.classes) {
        return asTransparentFill ? 'rgba(0, 0, 0, 0.2)' : 'rgb(0, 0, 0)';
    }

    const classData = AppState.classes.find(cls => cls.name === className);
    const color = classData ? classData.color : 'rgb(0, 0, 0)';

    // Correct debug log to avoid recursive calls
    console.log(`[DEBUG] Fetching color for class '${className}': ${color}`);

    if (asTransparentFill) {
        // Check if color is already in RGBA format
        if (color.startsWith('rgba')) {
            return color;
        }
        // Convert rgb color to rgba with 0.5 opacity
        return color.replace('rgb', 'rgba').replace(')', ', 0.5)');
    }

    return color;
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

// Add annotation to list display
function addAnnotationToList(obj) {
    const list = $('#annotation-list');
    const className = obj.class || `Category ${obj.category_id}`;
    
    const listItem = $('<li>').addClass('annotation-item');
    listItem.attr('data-id', obj.id);
    listItem.html(`<span class="annotation-color" style="background-color: ${obj.stroke};"></span> ${className}`);
    
    // Click handler to select the corresponding object on canvas
    listItem.on('click', function() {
        AppState.fabricCanvas.discardActiveObject();
        AppState.fabricCanvas.setActiveObject(obj);
        AppState.fabricCanvas.renderAll();
    });
    
    list.append(listItem);
}

// Deselect active polygon
function deselectActivePolygon() {
    if (AppState.activePolygon) {
        // Set the active polygon back to normal state
        AppState.activePolygon.set({
            hasControls: true,
            lockMovementX: false,
            lockMovementY: false,
            selectable: true,
            evented: true
        });
        
        // Remove all edit handles
        const handles = AppState.fabricCanvas.getObjects().filter(obj => obj.customData?.isHandle);
        if (handles.length > 0) {
            AppState.fabricCanvas.remove(...handles);
        }
        
        // Clear active polygon reference
        AppState.activePolygon = null;
        
        // Switch back to select mode
        AppState.currentMode = 'select';
        updateModeDisplay();
        
        // Update status display
        $('#selected-object-status').text('None');
        
        AppState.fabricCanvas.renderAll();
    }
}

// Show message in UI
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
