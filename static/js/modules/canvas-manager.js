// canvas-manager.js - Canvas Operations
// Handles Fabric.js canvas initialization and operations

import { getAppState } from './app-state.js';
import { showMessage } from './utilities.js';

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
        
        // Initial canvas sizing
        centerCanvas();
        
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
    
    const container = canvas.getElement().parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const canvasElement = canvas.getElement();
    
    // Center the canvas element
    canvasElement.style.position = 'absolute';
    canvasElement.style.left = '50%';
    canvasElement.style.top = '50%';
    canvasElement.style.transform = 'translate(-50%, -50%)';
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
function getCategoryColorByName(className, asTransparentFill = false) {
    if (window.getCategoryColorByName) {
        return window.getCategoryColorByName(className, asTransparentFill);
    }
    return asTransparentFill ? 'rgba(0, 123, 255, 0.3)' : '#007bff';
}

/**
 * Helper function to generate object ID
 */
function generateObjectId(className) {
    if (window.generateObjectId) {
        return window.generateObjectId(className);
    }
    return `${className}_001`;
}