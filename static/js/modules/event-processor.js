// event-processor.js - Event Processing
// Handles complex event processing, coordination, and state management

import { getAppState } from './app-state.js';
import { addLogEntry } from './utilities.js';
import { selectPolygon } from './annotation-manager.js';
import { updateSelectedObjectDisplay, updateCoordinatesDisplay } from './ui-display.js';

/**
 * Handle canvas selection events
 */
export function handleSelectionEvent(options) {
    const AppState = getAppState();
    
    console.log("[DEBUG] Selection event:", options);
    
    if (!options.selected || options.selected.length === 0) {
        return;
    }
    
    const selectedObject = options.selected[0];
    
    // Check if this is an annotation object
    if (AppState.annotations && AppState.annotations.includes(selectedObject)) {
        selectPolygon(selectedObject);
        highlightAnnotationInList(selectedObject);
        updateSelectedObjectDisplay(selectedObject);
        
        addLogEntry(`Selected ${selectedObject.customData?.class || 'object'}: ${selectedObject.customData?.objectId || 'unknown'}`);
    }
}

/**
 * Handle selection cleared events
 */
export function handleSelectionCleared() {
    const AppState = getAppState();
    
    if (AppState.activePolygon) {
        AppState.activePolygon = null;
        updateSelectedObjectDisplay(null);
        
        // Clear highlights in annotation list
        const annotationItems = document.querySelectorAll('.annotation-item');
        annotationItems.forEach(item => {
            item.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'selected');
        });
    }
}

/**
 * Highlight annotation in the list
 */
export function highlightAnnotationInList(polygon) {
    if (!polygon || !polygon.customData) return;
    
    const objectId = polygon.customData.objectId;
    const annotationItems = document.querySelectorAll('.annotation-item');
    
    // Remove highlight from all items
    annotationItems.forEach(item => {
        item.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'selected');
    });
    
    // Highlight the selected item
    const targetItem = document.querySelector(`[data-object-id="${objectId}"]`);
    if (targetItem) {
        targetItem.classList.add('bg-blue-100', 'dark:bg-blue-900', 'selected');
        
        // Scroll into view if needed
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Handle object moving events
 */
export function handleObjectMoving(options) {
    const obj = options.target;
    
    if (!obj || !obj.customData) return;
    
    // Update coordinates display
    updateCoordinatesDisplay(obj.left, obj.top);
    
    // If this is an edit handle, update the parent polygon
    if (obj.customData.isEditHandle) {
        updatePolygonFromHandle(obj);
    }
    
    // Mark object as modified
    if (obj.customData) {
        obj.customData.modified = new Date().toISOString();
    }
}

/**
 * Handle object moved events (after movement is complete)
 */
export function handleObjectMoved(options) {
    const obj = options.target;
    
    if (!obj || !obj.customData) return;
    
    console.log(`[DEBUG] Object moved: ${obj.customData.objectId || 'unknown'}`);
    
    // Update coordinates
    obj.setCoords();
    
    // Mark as modified
    obj.customData.modified = new Date().toISOString();
    
    // Update annotation list if needed
    if (window.modules?.annotationManager?.rebuildAnnotationList) {
        window.modules.annotationManager.rebuildAnnotationList();
    }
    
    addLogEntry(`Moved ${obj.customData.class || 'object'}: ${obj.customData.objectId || 'unknown'}`);
}

/**
 * Update polygon from edit handle movement
 */
function updatePolygonFromHandle(handle) {
    if (!handle.customData?.isEditHandle) return;
    
    const polygon = handle.customData.polygon;
    const pointIndex = handle.customData.pointIndex;
    
    if (!polygon || !polygon.points || pointIndex === undefined) return;
    
    // Calculate relative position within the polygon
    const relativeX = handle.left - polygon.left;
    const relativeY = handle.top - polygon.top;
    
    // Update the polygon point
    if (polygon.points[pointIndex]) {
        polygon.points[pointIndex].x = relativeX;
        polygon.points[pointIndex].y = relativeY;
        
        // Mark polygon as dirty for re-rendering
        polygon.dirty = true;
        
        // Update polygon coordinates
        polygon.setCoords();
    }
}

/**
 * Handle mouse move events on canvas
 */
export function handleMouseMove(options) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const pointer = canvas.getPointer(options.e);
    
    // Update coordinates display
    updateCoordinatesDisplay(pointer.x, pointer.y);
    
    // Handle drawing mode specific logic
    if (AppState.currentMode === 'polygon' && AppState.isDrawing) {
        updateActivePolygonPreview(pointer);
    }
}

/**
 * Update active polygon preview during drawing
 */
function updateActivePolygonPreview(pointer) {
    const AppState = getAppState();
    
    if (!AppState.activeLine || !AppState.isDrawing || !AppState.polyPoints) return;
    
    // Create temporary points array with current mouse position
    const tempPoints = [...AppState.polyPoints, pointer];
    
    // Update active line
    AppState.fabricCanvas.remove(AppState.activeLine);
    AppState.activeLine = new fabric.Polyline(tempPoints, {
        strokeWidth: 2,
        stroke: '#ff0000',
        fill: 'transparent',
        selectable: false,
        evented: false
    });
    
    AppState.fabricCanvas.add(AppState.activeLine);
    AppState.fabricCanvas.renderAll();
}

/**
 * Handle mouse down events on canvas
 */
export function handleMouseDown(options) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const pointer = canvas.getPointer(options.e);
    
    // Handle different modes
    switch (AppState.currentMode) {
        case 'polygon':
            handlePolygonDrawing(pointer);
            break;
        case 'select':
            // Selection handling is done by Fabric.js
            break;
        case 'pan':
            handlePanStart(pointer, options.e);
            break;
    }
}

/**
 * Handle polygon drawing
 */
function handlePolygonDrawing(pointer) {
    const AppState = getAppState();
    
    if (!AppState.currentClass) {
        showMessage("Please select a class before drawing", "warning");
        return;
    }
    
    if (!AppState.isDrawing) {
        // Start new polygon
        startPolygonDrawing(pointer);
    } else {
        // Add point to existing polygon
        addPolygonPoint(pointer);
    }
}

/**
 * Start polygon drawing
 */
function startPolygonDrawing(pointer) {
    const AppState = getAppState();
    
    AppState.isDrawing = true;
    AppState.polyPoints = [pointer];
    
    // Create temporary line to show progress
    AppState.activeLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        strokeWidth: 2,
        stroke: '#ff0000',
        selectable: false,
        evented: false
    });
    
    AppState.fabricCanvas.add(AppState.activeLine);
    AppState.fabricCanvas.renderAll();
    
    addLogEntry(`Started drawing ${AppState.currentClass} polygon`);
}

/**
 * Add point to polygon being drawn
 */
function addPolygonPoint(pointer) {
    const AppState = getAppState();
    
    // Check for double-click or close proximity to first point to complete polygon
    if (AppState.polyPoints.length >= 3) {
        const firstPoint = AppState.polyPoints[0];
        const distance = Math.sqrt(
            Math.pow(pointer.x - firstPoint.x, 2) + 
            Math.pow(pointer.y - firstPoint.y, 2)
        );
        
        // If clicked near first point (within 10 pixels), complete the polygon
        if (distance < 10) {
            completePolygonDrawing();
            return;
        }
    }
    
    // Add the point
    AppState.polyPoints.push(pointer);
    
    // Update active line
    AppState.fabricCanvas.remove(AppState.activeLine);
    AppState.activeLine = new fabric.Polyline(AppState.polyPoints, {
        strokeWidth: 2,
        stroke: '#ff0000',
        fill: 'transparent',
        selectable: false,
        evented: false
    });
    
    AppState.fabricCanvas.add(AppState.activeLine);
    AppState.fabricCanvas.renderAll();
}

/**
 * Complete polygon drawing
 */
function completePolygonDrawing() {
    const AppState = getAppState();
    
    if (!AppState.isDrawing || AppState.polyPoints.length < 3) {
        return;
    }
    
    // Remove temporary line
    if (AppState.activeLine) {
        AppState.fabricCanvas.remove(AppState.activeLine);
        AppState.activeLine = null;
    }
    
    // Create final polygon using annotation manager
    if (window.modules?.annotationManager?.createPolygonAnnotation) {
        window.modules.annotationManager.createPolygonAnnotation(
            AppState.polyPoints, 
            AppState.currentClass
        );
    }
    
    // Reset drawing state
    AppState.isDrawing = false;
    AppState.polyPoints = [];
    AppState.currentMode = 'select';
    
    // Update mode display
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = 'Select';
    }
    
    addLogEntry(`Completed ${AppState.currentClass} polygon`);
}

/**
 * Handle pan start
 */
function handlePanStart(pointer, event) {
    const AppState = getAppState();
    
    AppState.isPanning = true;
    AppState.panStartX = pointer.x;
    AppState.panStartY = pointer.y;
    
    // Store initial viewport transform
    AppState.panStartTransform = AppState.fabricCanvas.viewportTransform.slice();
    
    // Change cursor
    AppState.fabricCanvas.defaultCursor = 'grabbing';
    AppState.fabricCanvas.hoverCursor = 'grabbing';
}

/**
 * Handle key down events
 */
export function handleKeyDown(event) {
    const AppState = getAppState();
    
    // Ignore if user is typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (event.key.toLowerCase()) {
        case 'enter':
            // Enter: Complete polygon if drawing
            if (AppState.isDrawing && AppState.currentMode === 'polygon') {
                event.preventDefault();
                completePolygonDrawing();
            }
            break;
            
        case 'escape':
            // Escape: Cancel current action
            event.preventDefault();
            handleEscapeKey();
            break;
            
        case 'shift':
            // Shift: Enable pan mode temporarily
            if (!AppState.isPanning) {
                AppState.fabricCanvas.defaultCursor = 'grab';
                AppState.fabricCanvas.hoverCursor = 'grab';
            }
            break;
    }
}

/**
 * Handle key up events
 */
export function handleKeyUp(event) {
    const AppState = getAppState();
    
    switch (event.key.toLowerCase()) {
        case 'shift':
            // Shift released: Disable pan mode
            if (!AppState.isPanning) {
                AppState.fabricCanvas.defaultCursor = 'default';
                AppState.fabricCanvas.hoverCursor = 'move';
            }
            break;
    }
}

/**
 * Handle escape key
 */
function handleEscapeKey() {
    const AppState = getAppState();
    
    if (AppState.isDrawing) {
        // Cancel current drawing
        if (AppState.activeLine) {
            AppState.fabricCanvas.remove(AppState.activeLine);
            AppState.activeLine = null;
        }
        
        AppState.isDrawing = false;
        AppState.polyPoints = [];
        AppState.currentMode = 'select';
        
        addLogEntry("Cancelled polygon drawing");
    } else if (AppState.activePolygon) {
        // Deselect active polygon
        if (window.modules?.annotationManager?.deselectActivePolygon) {
            window.modules.annotationManager.deselectActivePolygon();
        }
    }
}

/**
 * Handle mouse wheel events for zooming
 */
export function handleMouseWheel(options) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const delta = options.e.deltaY;
    let zoom = canvas.getZoom();
    
    // Calculate new zoom level
    zoom *= 0.999 ** delta;
    
    // Limit zoom range
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    
    // Apply zoom
    canvas.zoomToPoint({ x: options.e.offsetX, y: options.e.offsetY }, zoom);
    
    // Update zoom display
    if (window.modules?.uiManager?.updateZoomDisplay) {
        window.modules.uiManager.updateZoomDisplay(zoom);
    }
    
    options.e.preventDefault();
    options.e.stopPropagation();
}

/**
 * Handle window resize events
 */
export function handleWindowResize() {
    const AppState = getAppState();
    
    if (AppState.fabricCanvas) {
        // Re-center canvas
        if (window.modules?.canvasManager?.centerCanvas) {
            window.modules.canvasManager.centerCanvas();
        }
        
        // Update UI button states
        if (window.modules?.uiManager?.updateButtonStates) {
            window.modules.uiManager.updateButtonStates();
        }
    }
    
    console.log("[DEBUG] Window resized, canvas re-centered");
}

/**
 * Handle visibility change (tab focus/blur)
 */
export function handleVisibilityChange() {
    const AppState = getAppState();
    
    if (document.hidden) {
        // Tab lost focus - save session state
        if (window.modules?.saveManager?.saveSessionState) {
            window.modules.saveManager.saveSessionState();
        }
        
        console.log("[DEBUG] Tab hidden, session state saved");
    } else {
        // Tab gained focus - check for updates
        console.log("[DEBUG] Tab visible");
        
        // Update button states in case something changed
        if (window.modules?.uiManager?.updateButtonStates) {
            window.modules.uiManager.updateButtonStates();
        }
    }
}

/**
 * Setup global event processors
 */
export function setupEventProcessors() {
    // Window events
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    console.log("[DEBUG] Global event processors setup complete");
}

/**
 * Handle before unload (page refresh/close)
 */
function handleBeforeUnload(event) {
    // Save session state
    if (window.modules?.saveManager?.saveSessionState) {
        window.modules.saveManager.saveSessionState();
    }
    
    // Check for unsaved changes
    if (window.modules?.saveManager?.hasUnsavedChanges && 
        window.modules.saveManager.hasUnsavedChanges()) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
    }
}

/**
 * Cleanup event processors
 */
export function cleanupEventProcessors() {
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    
    console.log("[DEBUG] Event processors cleaned up");
}