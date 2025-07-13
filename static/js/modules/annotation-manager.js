// annotation-manager.js - Annotation Creation and Management
// Handles polygon creation, selection, editing, and manipulation

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry, generateObjectId, getCategoryColorByName } from './utilities.js';
import { updateSelectedObjectDisplay } from './ui-manager.js';

/**
 * Select a polygon for editing
 */
export function selectPolygon(polygon) {
    const AppState = getAppState();
    
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

/**
 * Deselect the active polygon
 */
export function deselectActivePolygon() {
    const AppState = getAppState();
    
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
        const selectedStatus = document.getElementById('selected-object-status');
        if (selectedStatus) {
            selectedStatus.textContent = 'None';
        }
        
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

/**
 * Create edit handles for a polygon
 */
export function createEditHandles(polygon) {
    const AppState = getAppState();
    
    console.log(`[DEBUG] Creating edit handles for polygon`);
    removeEditHandles();
    
    if (!polygon?.points) {
        console.warn("[DEBUG] No points found for creating edit handles");
        return;
    }
    
    // Ensure polygon coordinates are up-to-date
    polygon.setCoords();
    
    console.log(`[DEBUG] Polygon state: L=${polygon.left}, T=${polygon.top}, Angle=${polygon.angle}, ScaleX=${polygon.scaleX}`);
    
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
        
        console.log(`[DEBUG] Handle ${index}: Point at x:${absoluteX.toFixed(2)}, y:${absoluteY.toFixed(2)}`);
        
        // Create a handle at this absolute position
        const handle = new fabric.Circle({
            radius: 6,
            fill: getCategoryColorByName(polygon.class, false),
            stroke: '#fff',
            strokeWidth: 2,
            left: absoluteX,
            top: absoluteY,
            originX: 'center',
            originY: 'center',
            hasBorders: false,
            hasControls: false,
            hoverCursor: 'pointer',
            moveCursor: 'pointer',
            selectable: true,
            evented: true
        });
        
        // Add custom data to identify this handle
        handle.customData = {
            isEditHandle: true,
            polygonId: polygon.customData?.objectId || index,
            pointIndex: index,
            polygon: polygon
        };
        
        // Add the handle to canvas and tracking array
        AppState.fabricCanvas.add(handle);
        AppState.editHandles.push(handle);
        
        // Set up handle event listeners
        handle.on('moving', function(options) {
            handleObjectMoving(options);
        });
        
        handle.on('moved', function(options) {
            handleHandleMoved(options);
        });
    });
    
    // Bring handles to front
    AppState.editHandles.forEach(handle => {
        AppState.fabricCanvas.bringToFront(handle);
    });
    
    AppState.fabricCanvas.renderAll();
    console.log(`[DEBUG] Created ${AppState.editHandles.length} edit handles`);
}

/**
 * Remove edit handles from canvas
 */
export function removeEditHandles() {
    const AppState = getAppState();
    
    if (AppState.editHandles && AppState.editHandles.length > 0) {
        AppState.editHandles.forEach(handle => {
            AppState.fabricCanvas.remove(handle);
        });
        AppState.editHandles = [];
        AppState.fabricCanvas.renderAll();
    }
}

/**
 * Handle edit handle moving
 */
function handleObjectMoving(options) {
    const AppState = getAppState();
    const handle = options.target;
    
    if (!handle.customData?.isEditHandle) return;
    
    AppState.isMovingHandle = true;
    const polygon = handle.customData.polygon;
    const pointIndex = handle.customData.pointIndex;
    
    // Update the polygon point to match the handle position
    if (polygon && polygon.points && polygon.points[pointIndex]) {
        // Calculate relative position within the polygon
        const relativeX = handle.left - polygon.left;
        const relativeY = handle.top - polygon.top;
        
        // Update the point
        polygon.points[pointIndex].x = relativeX;
        polygon.points[pointIndex].y = relativeY;
        
        // Mark polygon as dirty and re-render
        polygon.dirty = true;
        AppState.fabricCanvas.renderAll();
    }
}

/**
 * Handle edit handle moved (after moving is complete)
 */
function handleHandleMoved(options) {
    const AppState = getAppState();
    const handle = options.target;
    
    if (!handle.customData?.isEditHandle) return;
    
    const polygon = handle.customData.polygon;
    
    if (polygon) {
        // Update polygon coordinates
        polygon.setCoords();
        
        // Mark as modified
        if (polygon.customData) {
            polygon.customData.modified = new Date().toISOString();
        }
        
        // Update annotation list
        if (window.rebuildAnnotationList) {
            window.rebuildAnnotationList();
        }
        
        addLogEntry(`Modified ${polygon.class || 'polygon'}`);
    }
    
    AppState.isMovingHandle = false;
}

/**
 * Delete the selected polygon
 */
export function deleteSelectedPolygon() {
    const AppState = getAppState();
    
    if (!AppState.activePolygon) {
        showMessage("No polygon selected", "warning");
        return;
    }
    
    const polygon = AppState.activePolygon;
    const objectId = polygon.customData?.objectId || 'unknown';
    
    // Remove from annotations array
    const index = AppState.annotations.indexOf(polygon);
    if (index > -1) {
        AppState.annotations.splice(index, 1);
    }
    
    // Remove edit handles
    removeEditHandles();
    
    // Remove from canvas
    AppState.fabricCanvas.remove(polygon);
    
    // Clear active polygon
    AppState.activePolygon = null;
    
    // Update displays
    if (window.rebuildAnnotationList) {
        window.rebuildAnnotationList();
    }
    
    // Update button states
    if (window.modules?.uiManager?.updateButtonStates) {
        window.modules.uiManager.updateButtonStates();
    }
    
    const selectedStatus = document.getElementById('selected-object-status');
    if (selectedStatus) {
        selectedStatus.textContent = 'None';
    }
    
    AppState.fabricCanvas.renderAll();
    
    addLogEntry(`Deleted ${polygon.class || 'polygon'} (${objectId})`);
    showMessage(`Deleted ${polygon.class || 'polygon'}`, "success");
}

/**
 * Initialize polygon with proper settings
 */
export function initializePolygon(polygon, className, points) {
    const AppState = getAppState();
    
    // Set basic properties
    polygon.set({
        strokeWidth: 2,
        stroke: getCategoryColorByName(className),
        fill: getCategoryColorByName(className),
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false
    });
    
    // Add custom data
    polygon.customData = {
        class: className,
        objectId: generateObjectId(className),
        created: new Date().toISOString(),
        imagePoints: points ? JSON.parse(JSON.stringify(points)) : null
    };
    
    // Add to annotations array
    AppState.annotations.push(polygon);
    
    console.log(`[DEBUG] Initialized polygon: ${polygon.customData.objectId}`);
    return polygon;
}

/**
 * Update mode display
 */
function updateModeDisplay() {
    const AppState = getAppState();
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = AppState.currentMode;
    }
}

/**
 * Create new polygon annotation
 */
export function createPolygonAnnotation(points, className) {
    const AppState = getAppState();
    
    if (!points || points.length < 3) {
        showMessage("Need at least 3 points to create a polygon", "warning");
        return null;
    }
    
    if (!className) {
        showMessage("Please select a class before creating annotation", "warning");
        return null;
    }
    
    // Create fabric polygon
    const polygon = new fabric.Polygon(points, {
        strokeWidth: 2,
        stroke: getCategoryColorByName(className),
        fill: getCategoryColorByName(className),
        selectable: true,
        evented: true,
        objectCaching: false,
        hasControls: false,
        hasBorders: false
    });
    
    // Initialize the polygon
    initializePolygon(polygon, className, points);
    
    // Add to canvas
    AppState.fabricCanvas.add(polygon);
    
    // Update annotation list
    if (window.rebuildAnnotationList) {
        window.rebuildAnnotationList();
    }
    
    // Update button states
    if (window.modules?.uiManager?.updateButtonStates) {
        window.modules.uiManager.updateButtonStates();
    }
    
    AppState.fabricCanvas.renderAll();
    
    addLogEntry(`Created ${className} annotation`);
    showMessage(`Created ${className} annotation`, "success");
    
    return polygon;
}

/**
 * Add annotation to the annotations list
 */
export function addAnnotationToList(annotation) {
    if (!annotation || !annotation.customData) return;
    
    const objectId = annotation.customData.objectId;
    const className = annotation.customData.class || 'Unknown';
    
    // Find or create annotation list
    const annotationList = document.getElementById('annotation-list');
    if (!annotationList) return;
    
    // Create list item
    const listItem = document.createElement('li');
    listItem.className = 'annotation-item p-2 border rounded mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700';
    listItem.dataset.objectId = objectId;
    
    listItem.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <div class="font-medium text-sm">${className}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${objectId}</div>
            </div>
            <div class="w-4 h-4 rounded" style="background-color: ${getCategoryColorByName(className)}"></div>
        </div>
    `;
    
    // Add click event to select annotation
    listItem.addEventListener('click', function() {
        selectPolygon(annotation);
    });
    
    annotationList.appendChild(listItem);
}

/**
 * Rebuild the entire annotation list
 */
export function rebuildAnnotationList() {
    const AppState = getAppState();
    const annotationList = document.getElementById('annotation-list');
    
    if (!annotationList) return;
    
    // Clear existing list
    annotationList.innerHTML = '';
    
    if (AppState.annotations.length === 0) {
        annotationList.innerHTML = '<li class="text-gray-500 dark:text-gray-400 text-sm p-2">No annotations</li>';
        return;
    }
    
    // Add each annotation to the list
    AppState.annotations.forEach(annotation => {
        addAnnotationToList(annotation);
    });
    
    console.log(`[DEBUG] Rebuilt annotation list with ${AppState.annotations.length} items`);
}

/**
 * Highlight annotation in list
 */
export function highlightAnnotationInList(polygon) {
    if (!polygon || !polygon.customData) return;
    
    const objectId = polygon.customData.objectId;
    const annotationItems = document.querySelectorAll('.annotation-item');
    
    // Remove highlight from all items
    annotationItems.forEach(item => {
        item.classList.remove('bg-blue-100', 'dark:bg-blue-900');
    });
    
    // Highlight the selected item
    const targetItem = document.querySelector(`[data-object-id="${objectId}"]`);
    if (targetItem) {
        targetItem.classList.add('bg-blue-100', 'dark:bg-blue-900');
    }
}

/**
 * Clear all annotations
 */
export function clearAllAnnotations() {
    const AppState = getAppState();
    
    // Remove all annotations from canvas
    AppState.annotations.forEach(annotation => {
        AppState.fabricCanvas.remove(annotation);
    });
    
    // Clear annotations array
    AppState.annotations = [];
    
    // Remove edit handles
    removeEditHandles();
    
    // Clear active polygon
    AppState.activePolygon = null;
    
    // Update displays
    rebuildAnnotationList();
    
    // Update button states
    if (window.modules?.uiManager?.updateButtonStates) {
        window.modules.uiManager.updateButtonStates();
    }
    
    const selectedStatus = document.getElementById('selected-object-status');
    if (selectedStatus) {
        selectedStatus.textContent = 'None';
    }
    
    AppState.fabricCanvas.renderAll();
    
    addLogEntry("Cleared all annotations");
}

/**
 * Hide all annotations
 */
export function hideAnnotations() {
    const AppState = getAppState();
    
    AppState.annotations.forEach(annotation => {
        annotation.set('visible', false);
    });
    
    removeEditHandles();
    AppState.annotationsHidden = true;
    AppState.fabricCanvas.renderAll();
    
    addLogEntry("Hidden all annotations");
}

/**
 * Show all annotations
 */
export function showAnnotations() {
    const AppState = getAppState();
    
    AppState.annotations.forEach(annotation => {
        annotation.set('visible', true);
    });
    
    AppState.annotationsHidden = false;
    AppState.fabricCanvas.renderAll();
    
    addLogEntry("Shown all annotations");
}