// canvas-manager.js - Canvas Operations
// Handles Fabric.js canvas initialization and operations

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry, getCategoryColorByName, generateObjectId } from './utilities.js';

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
    
    // Mouse down event
    canvas.on('mouse:down', handleMouseDown);
    
    // Mouse move event
    canvas.on('mouse:move', handleMouseMove);
    
    // Mouse up event
    canvas.on('mouse:up', handleMouseUp);
    
    // Double click to complete polygon
    canvas.on('mouse:dblclick', handleDoubleClick);
    
    // Selection events
    canvas.on('selection:created', handleSelectionEvent);
    canvas.on('selection:updated', handleSelectionEvent);
    canvas.on('selection:cleared', handleSelectionCleared);
    
    // Object events
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectModified);
    
    // Zoom and pan events
    canvas.on('mouse:wheel', handleMouseWheel);
    
    console.log("[DEBUG] Canvas events setup complete");
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
    const coordsStatus = document.getElementById('coords-status');
    if (coordsStatus) {
        coordsStatus.textContent = `(${Math.round(pointer.x)}, ${Math.round(pointer.y)})`;
    }
    
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
        
        // Create final polygon
        const polygon = new fabric.Polygon(AppState.polyPoints, {
            left: 0,
            top: 0,
            fill: getCategoryColorByName(AppState.currentClass, true),
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
            objectId: generateObjectId(AppState.currentClass),
            imagePoints: [...AppState.polyPoints] // Copy the points
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
            stroke: '#ff0000',
            selectable: false,
            evented: false
        });
        
        canvas.add(AppState.activeLine);
    } else {
        // Add point to existing polygon
        AppState.polyPoints.push(pointer);
        AppState.linePoints.push(pointer.x, pointer.y);
        
        // Update active line
        canvas.remove(AppState.activeLine);
        AppState.activeLine = new fabric.Polyline(AppState.polyPoints, {
            strokeWidth: 2,
            stroke: '#ff0000',
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
    
    canvas.renderAll();
    console.log("[DEBUG] Polygon drawing cancelled");
}

/**
 * Handle selection events
 */
function handleSelectionEvent(options) {
    const AppState = getAppState();
    
    if (options.selected && options.selected.length > 0) {
        const obj = options.selected[0];
        AppState.activePolygon = obj;
        
        // Update selected object display
        const selectedStatus = document.getElementById('selected-object-status');
        if (selectedStatus) {
            const objectId = obj.customData?.objectId || 'Unknown';
            selectedStatus.textContent = objectId;
        }
        
        // Highlight in annotation list
        if (window.highlightAnnotationInList) {
            window.highlightAnnotationInList(obj);
        }
    }
}

/**
 * Handle selection cleared
 */
function handleSelectionCleared() {
    const AppState = getAppState();
    AppState.activePolygon = null;
    
    const selectedStatus = document.getElementById('selected-object-status');
    if (selectedStatus) {
        selectedStatus.textContent = 'None';
    }
}

/**
 * Handle object moving
 */
function handleObjectMoving(options) {
    const obj = options.target;
    if (obj && obj.customData) {
        // Update last modified timestamp
        obj.customData.modified = new Date().toISOString();
    }
}

/**
 * Handle object modified
 */
function handleObjectModified(options) {
    const obj = options.target;
    if (obj && obj.customData) {
        // Update last modified timestamp
        obj.customData.modified = new Date().toISOString();
        
        // Update annotation list
        if (window.rebuildAnnotationList) {
            window.rebuildAnnotationList();
        }
    }
}

/**
 * Handle mouse wheel for zoom
 */
function handleMouseWheel(opt) {
    const delta = opt.e.deltaY;
    let zoom = AppState.fabricCanvas.getZoom();
    zoom *= 0.999 ** delta;
    
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    
    AppState.fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    
    // Update zoom display
    updateZoomDisplay(zoom);
    
    opt.e.preventDefault();
    opt.e.stopPropagation();
}

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
    
    // Get actual container dimensions considering collapsed sidebars
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    
    // Calculate available space accounting for sidebars
    let availableWidth = window.innerWidth;
    let availableHeight = window.innerHeight;
    
    // Subtract toolbar height (approximately 80px)
    availableHeight -= 120;
    
    // Account for sidebars
    if (leftSidebar && !leftSidebar.classList.contains('collapsed')) {
        availableWidth -= leftSidebar.offsetWidth;
    } else if (leftSidebar && leftSidebar.classList.contains('collapsed')) {
        availableWidth -= 60; // Collapsed sidebar width
    }
    
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
    
    // Setup resize listener
    window.addEventListener('resize', () => {
        // Debounce resize events
        clearTimeout(window.canvasResizeTimeout);
        window.canvasResizeTimeout = setTimeout(() => {
            resizeCanvas();
        }, 250);
    });
    
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
    if (window.rebuildAnnotationList) {
        window.rebuildAnnotationList();
    }
    
    const selectedStatus = document.getElementById('selected-object-status');
    if (selectedStatus) {
        selectedStatus.textContent = 'None';
    }
    
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

/**
 * Update zoom display
 */
function updateZoomDisplay(zoom) {
    const zoomStatus = document.getElementById('zoom-status');
    if (zoomStatus) {
        zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
    }
}

/**
 * Helper function to get category color
 */
// function getCategoryColorByName(className, asTransparentFill = false) {
//     if (window.getCategoryColorByName) {
//         return window.getCategoryColorByName(className, asTransparentFill);
//     }
//     return asTransparentFill ? 'rgba(0, 123, 255, 0.3)' : '#007bff';
// }

/**
 * Helper function to generate object ID
 */
// function generateObjectId(className) {
//     if (window.generateObjectId) {
//         return window.generateObjectId(className);
//     }
//     return `${className}_001`;
// }