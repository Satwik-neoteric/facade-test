// canvas-manager.js - Canvas Operations
// Handles Fabric.js canvas initialization and operations

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry, getCategoryColorByName, generateObjectId } from './utilities.js';
import { selectPolygon, deselectActivePolygon } from './annotation-manager.js';
import { updateSelectedObjectDisplay, updateCoordinatesDisplay, updateZoomDisplay } from './ui-manager.js';

/**
 * Initialize Fabric.js canvas for annotation
 */
export function initCanvas() {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Initializing Fabric.js canvas");
        
        const canvasElement = document.getElementById('annotation-canvas');
        if (!canvasElement) {
            throw new Error("Canvas element not found");
        }
        
        // Initialize Fabric canvas
        const canvas = new fabric.Canvas('annotation-canvas', {
            selection: false,
            preserveObjectStacking: true
        });
        
        AppState.fabricCanvas = canvas;
        AppState.fabricInitialized = true;
        
        // Setup canvas events
        setupCanvasEvents(canvas);
        setupGlobalEventHandlers();
        
        // Initial canvas sizing - use resizeCanvas which calls centerCanvas
        setTimeout(() => {
            resizeCanvas();
            setupCanvasResize();
        }, 100);
        
        console.log("[DEBUG] Canvas initialized successfully");
        
    } catch (error) {
        console.error("[DEBUG] Error initializing canvas:", error);
        showMessage("Error initializing canvas. See console for details.", "error");
    }
}

/**
 * Setup canvas event handlers
 */
export function setupCanvasEvents(canvas) {
    if (!canvas) return;
    
    // Mouse events
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('mouse:wheel', handleMouseWheel);
    
    // Selection events
    canvas.on('selection:created', handleSelectionEvent);
    canvas.on('selection:updated', handleSelectionEvent);
    canvas.on('selection:cleared', handleSelectionCleared);
    
    // Object events
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectModified);
    
    console.log("[DEBUG] Canvas events setup complete");
}

/**
 * Setup global event handlers
 */
function setupGlobalEventHandlers() {
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Window events
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    console.log("[DEBUG] Global event handlers setup complete");
}

/**
 * Handle mouse down events
 */
function handleMouseDown(options) {
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
        default:
            console.log(`[DEBUG] Unhandled mode: ${AppState.currentMode}`);
    }
}

/**
 * Handle mouse move events
 */
function handleMouseMove(options) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const pointer = canvas.getPointer(options.e);
    
    // Update coordinates display
    updateCoordinatesDisplay(pointer.x, pointer.y);
    
    // Handle active drawing
    if (AppState.isDrawing && AppState.currentMode === 'polygon') {
        updateActivePolygon(pointer);
    }
}

/**
 * Handle mouse up events
 */
function handleMouseUp(options) {
    const AppState = getAppState();
    
    if (AppState.currentMode === 'polygon' && AppState.isDrawing) {
        // Continue polygon drawing
        return;
    }
    
    // Handle pan end
    if (AppState.isPanning) {
        handlePanEnd();
    }
}

/**
 * Handle double click events
 */
function handleDoubleClick(options) {
    const AppState = getAppState();
    
    if (AppState.currentMode === 'polygon' && AppState.isDrawing && AppState.polyPoints && AppState.polyPoints.length >= 3) {
        console.log("[DEBUG] Double click - completing polygon");
        completePolygon();
    }
}

/**
 * Handle key down events
 */
function handleKeyDown(event) {
    const AppState = getAppState();
    
    // Ignore if user is typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (event.key.toLowerCase()) {
        case 'enter':
            // Enter: Complete polygon if drawing
            if (AppState.isDrawing && AppState.currentMode === 'polygon' && AppState.polyPoints?.length >= 3) {
                event.preventDefault();
                completePolygon();
            }
            break;
            
        case 'escape':
            // Escape: Cancel current action
            event.preventDefault();
            handleEscapeKey();
            break;
            
        case 'shift':
            // Shift: Enable pan mode temporarily
            if (!AppState.isPanning && AppState.fabricCanvas) {
                AppState.fabricCanvas.defaultCursor = 'grab';
                AppState.fabricCanvas.hoverCursor = 'grab';
            }
            break;
    }
}

/**
 * Handle key up events
 */
function handleKeyUp(event) {
    const AppState = getAppState();
    
    switch (event.key.toLowerCase()) {
        case 'shift':
            // Shift released: Disable pan mode
            if (!AppState.isPanning && AppState.fabricCanvas) {
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
        cancelPolygon();
        addLogEntry("Cancelled polygon drawing");
    } else if (AppState.activePolygon) {
        // Deselect active polygon
        deselectActivePolygon();
    }
}

/**
 * Complete polygon drawing
 */
export function completePolygon() {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!AppState.isDrawing || !AppState.polyPoints || AppState.polyPoints.length < 3) {
        return;
    }
    
    try {
        // Remove temporary line
        if (AppState.activeLine) {
            canvas.remove(AppState.activeLine);
            AppState.activeLine = null;
        }
        
        console.log("[DEBUG] Completing polygon with canvas points:", AppState.polyPoints);
        console.log("[DEBUG] Current scale factor:", AppState.currentScale);
        console.log("[DEBUG] Original image dimensions:", {
            width: AppState.originalImageWidth,
            height: AppState.originalImageHeight
        });
        
        // Convert canvas coordinates to image coordinates for COCO format
        let imagePoints;
        
        if (AppState.currentScale && AppState.currentScale !== 1) {
            // Convert canvas coordinates to image coordinates using scale factor
            imagePoints = AppState.polyPoints.map(point => ({
                x: Math.round(point.x / AppState.currentScale),
                y: Math.round(point.y / AppState.currentScale)
            }));
            console.log("[DEBUG] Converted to image coordinates using scale", AppState.currentScale);
        } else {
            // No scaling applied - use canvas coordinates as image coordinates
            imagePoints = AppState.polyPoints.map(point => ({
                x: Math.round(point.x),
                y: Math.round(point.y)
            }));
            console.log("[DEBUG] No scaling applied - using canvas coordinates");
        }
        
        // Validate image coordinates are within bounds
        if (AppState.originalImageWidth && AppState.originalImageHeight) {
            imagePoints = imagePoints.map(point => ({
                x: Math.max(0, Math.min(point.x, AppState.originalImageWidth)),
                y: Math.max(0, Math.min(point.y, AppState.originalImageHeight))
            }));
            console.log("[DEBUG] Clamped coordinates to image bounds");
        }
        
        console.log("[DEBUG] Final image points for COCO format:", imagePoints);
        
        // Create final polygon with canvas coordinates (for display)
        const polygon = new fabric.Polygon(AppState.polyPoints, {
            fill: getCategoryColorByName(AppState.currentClass),
            stroke: getCategoryColorByName(AppState.currentClass),
            strokeWidth: 2,
            selectable: true,
            evented: true,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true
        });
        
        // Add class and metadata
        polygon.class = AppState.currentClass;
        polygon.customData = {
            class: AppState.currentClass,
            objectId: generateObjectId(AppState.currentClass),
            imagePoints: imagePoints, // Store image coordinates for COCO export
            canvasPoints: [...AppState.polyPoints], // Store canvas coordinates for editing
            created: new Date().toISOString()
        };
        
        // Add to canvas and annotations
        canvas.add(polygon);
        AppState.annotations.push(polygon);
        
        // Reset drawing state
        AppState.isDrawing = false;
        AppState.polyPoints = [];
        AppState.linePoints = [];
        AppState.currentMode = 'select';
        
        // Update mode display
        const modeStatus = document.getElementById('mode-status');
        if (modeStatus) {
            modeStatus.textContent = 'Select';
        }
        
        // Update annotation list
        if (window.modules?.annotationManager?.rebuildAnnotationList) {
            window.modules.annotationManager.rebuildAnnotationList();
        }
        
        // Update button states
        if (window.modules?.uiManager?.updateButtonStates) {
            window.modules.uiManager.updateButtonStates();
        }
        
        canvas.renderAll();
        addLogEntry(`Created ${AppState.currentClass} annotation`);
        
    } catch (error) {
        console.error("[DEBUG] Error completing polygon:", error);
        showMessage("Error creating annotation", "error");
    }
}

/**
 * Handle polygon drawing
 */
function handlePolygonDrawing(pointer) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!AppState.currentClass) {
        showMessage("Please select a class before drawing", "warning");
        return;
    }
    
    if (!AppState.isDrawing) {
        // Start new polygon
        AppState.isDrawing = true;
        AppState.polyPoints = [pointer];
        AppState.linePoints = [pointer.x, pointer.y];
        
        // Create temporary line to show progress
        AppState.activeLine = new fabric.Line(AppState.linePoints, {
            strokeWidth: 2,
            stroke: getCategoryColorByName(AppState.currentClass),
            selectable: false,
            evented: false
        });
        
        canvas.add(AppState.activeLine);
        addLogEntry(`Started drawing ${AppState.currentClass} polygon`);
    } else {
        // Check if clicking near first point to close polygon
        if (AppState.polyPoints.length >= 3) {
            const firstPoint = AppState.polyPoints[0];
            const distance = Math.sqrt(
                Math.pow(pointer.x - firstPoint.x, 2) + 
                Math.pow(pointer.y - firstPoint.y, 2)
            );
            
            // If clicked near first point (within 10 pixels), complete the polygon
            if (distance < 10) {
                completePolygon();
                return;
            }
        }
        
        // Add point to existing polygon
        AppState.polyPoints.push(pointer);
        AppState.linePoints.push(pointer.x, pointer.y);
        
        // Update active line
        canvas.remove(AppState.activeLine);
        AppState.activeLine = new fabric.Polyline(AppState.polyPoints, {
            strokeWidth: 2,
            stroke: getCategoryColorByName(AppState.currentClass),
            fill: 'transparent',
            selectable: false,
            evented: false
        });
        
        canvas.add(AppState.activeLine);
    }
    
    canvas.renderAll();
}

/**
 * Update active polygon during drawing
 */
function updateActivePolygon(pointer) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!AppState.activeLine || !AppState.isDrawing) return;
    
    // Create temporary points array with current mouse position
    const tempPoints = [...AppState.polyPoints, pointer];
    
    // Update active line
    canvas.remove(AppState.activeLine);
    AppState.activeLine = new fabric.Polyline(tempPoints, {
        strokeWidth: 2,
        stroke: '#ff0000',
        fill: 'transparent',
        selectable: false,
        evented: false
    });
    
    canvas.add(AppState.activeLine);
    canvas.renderAll();
}

/**
 * Cancel polygon drawing
 */
export function cancelPolygon() {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!AppState.isDrawing) return;
    
    // Remove temporary line
    if (AppState.activeLine) {
        canvas.remove(AppState.activeLine);
        AppState.activeLine = null;
    }
    
    // Reset drawing state
    AppState.isDrawing = false;
    AppState.polyPoints = [];
    AppState.linePoints = [];
    AppState.currentMode = 'select';
    
    // Update mode display
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = 'Select';
    }
    
    canvas.renderAll();
    console.log("[DEBUG] Polygon drawing cancelled");
}

/**
 * Handle selection events
 */
function handleSelectionEvent(options) {
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
 * Handle selection cleared
 */
function handleSelectionCleared() {
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
function highlightAnnotationInList(polygon) {
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
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Handle object moving
 */
function handleObjectMoving(options) {
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
 * Handle object modified
 */
function handleObjectModified(options) {
    const obj = options.target;
    
    if (!obj || !obj.customData) return;
    
    console.log(`[DEBUG] Object modified: ${obj.customData.objectId || 'unknown'}`);
    
    // Update coordinates
    obj.setCoords();
    
    // Mark as modified
    obj.customData.modified = new Date().toISOString();
    
    // Update annotation list
    if (window.modules?.annotationManager?.rebuildAnnotationList) {
        window.modules.annotationManager.rebuildAnnotationList();
    }
    
    addLogEntry(`Modified ${obj.customData.class || 'object'}: ${obj.customData.objectId || 'unknown'}`);
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
        polygon.setCoords();
    }
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
 * Handle pan end
 */
function handlePanEnd() {
    const AppState = getAppState();
    
    AppState.isPanning = false;
    
    // Reset cursor
    if (AppState.fabricCanvas) {
        AppState.fabricCanvas.defaultCursor = 'default';
        AppState.fabricCanvas.hoverCursor = 'move';
    }
}

/**
 * Handle mouse wheel for zoom
 */
function handleMouseWheel(opt) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    
    // Update zoom display
    updateZoomDisplay(zoom);
    
    opt.e.preventDefault();
    opt.e.stopPropagation();
}

/**
 * Handle window resize events
 */
function handleWindowResize() {
    // Debounce resize events
    clearTimeout(window.canvasResizeTimeout);
    window.canvasResizeTimeout = setTimeout(() => {
        resizeCanvas();
    }, 250);
    
    console.log("[DEBUG] Window resized, canvas will be resized");
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
 * Handle visibility change (tab focus/blur)
 */
function handleVisibilityChange() {
    if (document.hidden) {
        // Tab lost focus - save session state
        if (window.modules?.saveManager?.saveSessionState) {
            window.modules.saveManager.saveSessionState();
        }
        console.log("[DEBUG] Tab hidden, session state saved");
    } else {
        // Tab gained focus - update button states
        if (window.modules?.uiManager?.updateButtonStates) {
            window.modules.uiManager.updateButtonStates();
        }
        console.log("[DEBUG] Tab visible");
    }
}

// ... (keep all existing canvas management functions: centerCanvas, resizeCanvas, etc.)

/**
 * Center canvas in container
 */
export function centerCanvas() {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const canvasEl = document.getElementById('annotation-canvas');
    
    if (!canvasWrapper || !canvasEl) return;
    
    const wrapperWidth = canvasWrapper.offsetWidth;
    const wrapperHeight = canvasWrapper.offsetHeight;
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    
    // Calculate centering offsets
    const leftOffset = Math.max(0, (wrapperWidth - canvasWidth) / 2);
    const topOffset = Math.max(0, (wrapperHeight - canvasHeight) / 2);
    
    // Apply centering
    canvasEl.style.marginLeft = `${leftOffset}px`;
    canvasEl.style.marginTop = `${topOffset}px`;
    canvasEl.style.position = 'relative';
    
    console.log(`[DEBUG] Canvas centered: offset(${leftOffset}, ${topOffset})`);
}

/**
 * Resize canvas to fill available space dynamically
 */
export function resizeCanvas() {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;
    
    // Get actual container dimensions considering collapsed sidebars and bottom panel
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    const bottomPanel = document.getElementById('bottom-panel');
    
    // Calculate available space accounting for all panels
    let availableWidth = window.innerWidth;
    let availableHeight = window.innerHeight;
    
    // Subtract toolbar height (approximately 80px)
    availableHeight -= 120;
    
    // Account for left sidebar
    if (leftSidebar && !leftSidebar.classList.contains('collapsed')) {
        availableWidth -= leftSidebar.offsetWidth;
    } else if (leftSidebar && leftSidebar.classList.contains('collapsed')) {
        availableWidth -= 60; // Collapsed sidebar width
    }
    
    // Account for right sidebar
    if (rightSidebar && !rightSidebar.classList.contains('collapsed')) {
        availableWidth -= rightSidebar.offsetWidth;
    } else if (rightSidebar && rightSidebar.classList.contains('collapsed')) {
        availableWidth -= 60; // Collapsed sidebar width
    }
    
    
    
    // Use most of the available space (leaving small margins)
    const maxWidth = Math.max(600, availableWidth - 40);
    const maxHeight = Math.max(400, availableHeight - 40);
    
    // If there's a current image, maintain its aspect ratio
    if (AppState.currentImage) {
        const imageWidth = AppState.currentImage.width * AppState.currentImage.scaleX;
        const imageHeight = AppState.currentImage.height * AppState.currentImage.scaleY;
        
        // Scale to fit container while maintaining aspect ratio
        const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
        
        const canvasWidth = imageWidth * scale;
        const canvasHeight = imageHeight * scale;
        
        canvas.setDimensions({
            width: canvasWidth,
            height: canvasHeight
        });
    } else {
        // No image loaded, use most of available space
        canvas.setDimensions({
            width: Math.min(maxWidth, 1200),
            height: Math.min(maxHeight, 800)
        });
    }
    
    // Center the canvas
    centerCanvas();
    
    console.log(`[DEBUG] Canvas resized to: ${canvas.getWidth()}x${canvas.getHeight()}, available space: ${availableWidth}x${availableHeight}`);
}

/**
 * Setup window resize handler
 */
export function setupCanvasResize() {
    // Initial resize
    setTimeout(resizeCanvas, 100);
    
    // Sidebar collapse handlers
    setupSidebarResizeHandlers();
    
    console.log("[DEBUG] Canvas resize handler setup complete");
}

/**
 * Setup sidebar collapse/expand handlers to trigger canvas resize
 */
function setupSidebarResizeHandlers() {
    // Left sidebar collapse/expand
    const collapseLeftBtn = document.getElementById('collapse-left-sidebar');
    const expandLeftBtn = document.getElementById('expand-left-sidebar');
    
    if (collapseLeftBtn) {
        collapseLeftBtn.addEventListener('click', () => {
            setTimeout(resizeCanvas, 300); // Wait for animation
        });
    }
    
    if (expandLeftBtn) {
        expandLeftBtn.addEventListener('click', () => {
            setTimeout(resizeCanvas, 300); // Wait for animation
        });
    }
    
    // Right sidebar collapse/expand
    const collapseRightBtn = document.getElementById('collapse-right-sidebar');
    const expandRightBtn = document.getElementById('expand-right-sidebar');
    
    if (collapseRightBtn) {
        collapseRightBtn.addEventListener('click', () => {
            setTimeout(resizeCanvas, 300); // Wait for animation
        });
    }
    
    if (expandRightBtn) {
        expandRightBtn.addEventListener('click', () => {
            setTimeout(resizeCanvas, 300); // Wait for animation
        });
    }
    
    
    
    console.log("[DEBUG] Sidebar resize handlers setup complete");
}

/**
 * Clear all canvas content
 */
export function clearCanvas() {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    canvas.clear();
    AppState.annotations = [];
    AppState.activePolygon = null;
    AppState.currentImage = null;
    
    // Update displays
    if (window.modules?.annotationManager?.rebuildAnnotationList) {
        window.modules.annotationManager.rebuildAnnotationList();
    }
    
    updateSelectedObjectDisplay(null);
    
    console.log("[DEBUG] Canvas cleared");
}

/**
 * Zoom canvas by specified factor
 */
export function zoomCanvas(factor) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const center = canvas.getCenter();
    canvas.zoomToPoint(center, factor);
    
    updateZoomDisplay(factor);
}

/**
 * Reset zoom to 100%
 */
export function resetZoom() {
    zoomCanvas(1);
}

/**
 * Pan canvas by specified amount
 */
export function panCanvas(deltaX, deltaY) {
    const AppState = getAppState();
    const canvas = AppState.fabricCanvas;
    
    if (!canvas) return;
    
    const vpt = canvas.viewportTransform;
    vpt[4] += deltaX;
    vpt[5] += deltaY;
    canvas.setViewportTransform(vpt);
}


// function handleKeyDown(event) {
//     const AppState = getAppState();
    
//     // Ignore if user is typing in input fields
//     if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
//         return;
//     }
    
//     switch (event.key.toLowerCase()) {
//         case 'enter':
//             // Enter: Complete polygon if drawing
//             if (AppState.isDrawing && AppState.currentMode === 'polygon' && AppState.polyPoints?.length >= 3) {
//                 event.preventDefault();
//                 completePolygon();
//             }
//             break;
            
//         case 'escape':
//             // Escape: Cancel current action
//             event.preventDefault();
//             handleEscapeKey();
//             break;
            
//         case 'shift':
//             // Shift: Enable pan mode temporarily
//             if (!AppState.isPanning && AppState.fabricCanvas) {
//                 AppState.fabricCanvas.defaultCursor = 'grab';
//                 AppState.fabricCanvas.hoverCursor = 'grab';
//             }
//             break;

//         case 'z':
//             // Z: Zoom in
//             event.preventDefault();
//             {
//                 const canvas = AppState.fabricCanvas;
//                 if (canvas) {
//                     let zoom = canvas.getZoom();
//                     zoom = Math.min(zoom * 1.1, 20); // max zoom
//                     zoomCanvas(zoom);
//                 }
//             }
//             break;

//         case 'x':
//             // X: Zoom out
//             event.preventDefault();
//             {
//                 const canvas = AppState.fabricCanvas;
//                 if (canvas) {
//                     let zoom = canvas.getZoom();
//                     zoom = Math.max(zoom / 1.1, 0.01); // min zoom
//                     zoomCanvas(zoom);
//                 }
//             }
//             break;
//     }
// }

/**
 * Cleanup event handlers
 */
export function cleanupCanvasEvents() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    console.log("[DEBUG] Canvas event handlers cleaned up");
}