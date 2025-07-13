// canvas.js - Core canvas manipulation functionality

import { state } from './main.js';
import * as ui from './ui.js';
import { transformImagePointToCanvasPoint, transformCanvasPointToImagePoint } from './utils.js';

// Initialize the Fabric.js canvas
export function initFabricCanvas(canvasElement, canvasContainer) {
  console.log("[DEBUG] initFabricCanvas: Initializing");
  
  // Store both container and wrapper in state for easier access
  state.canvasContainer = canvasContainer;
  state.canvasWrapper = document.getElementById('canvas-wrapper');
  
  state.fabricCanvas = new fabric.Canvas(canvasElement, {
    backgroundColor: '#222', 
    selection: true, 
    preserveObjectStacking: true,
    stopContextMenu: true, 
    fireRightClick: true,
    // Add willReadFrequently attribute to optimize canvas readback operations
    willReadFrequently: true
  });
  
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) { 
      if (entry.target === canvasContainer) { 
        resizeCanvas(); 
      } 
    }
  });
  
  resizeObserver.observe(canvasContainer);
  console.log("[DEBUG] initFabricCanvas: Resizing initially");
  resizeCanvas();
}

// Resize the canvas to fit the container
export function resizeCanvas() {
  console.log("[DEBUG] resizeCanvas: Starting");
  if (!state.fabricCanvas || !state.canvasContainer) { 
    console.log("[DEBUG] resizeCanvas: Aborting - canvas/container not ready"); 
    return; 
  }
  
  const containerWidth = state.canvasContainer.offsetWidth;
  const containerHeight = state.canvasContainer.offsetHeight;
  console.log(`[DEBUG] resizeCanvas: Container W=${containerWidth}, H=${containerHeight}`);
  
  state.fabricCanvas.setWidth(containerWidth);
  state.fabricCanvas.setHeight(containerHeight);
  
  // Only center and fit the background image if it exists
  if (state.fabricCanvas.backgroundImage) {
    centerAndFitImage();
  }
  
  console.log("[DEBUG] resizeCanvas: Rendering after resize");
  state.fabricCanvas.renderAll();
}

// Center and fit the background image in the canvas
export function centerAndFitImage() {
  console.group("[DEBUG] centerAndFitImage: Start");
  
  if (!state.fabricCanvas || !state.fabricCanvas.backgroundImage) { 
    console.warn("[DEBUG] centerAndFitImage: Abort - Canvas/BG missing"); 
    console.groupEnd(); 
    return; 
  }
  
  const bgImage = state.fabricCanvas.backgroundImage;
  const canvasWidth = state.fabricCanvas.getWidth();
  const canvasHeight = state.fabricCanvas.getHeight();
  const imageWidth = bgImage.originalWidth || bgImage.width;
  const imageHeight = bgImage.originalHeight || bgImage.height;
  
  if (!imageWidth || !imageHeight) { 
    console.warn("[DEBUG] centerAndFitImage: Abort - Invalid image dims"); 
    console.groupEnd(); 
    return; 
  }

  // Calculate scaling factor to fit image to canvas
  const scaleX = canvasWidth / imageWidth;
  const scaleY = canvasHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate image position to center it
  const calculatedLeft = (canvasWidth - imageWidth * scale) / 2;
  const calculatedTop = 0; // Set top to 0 instead of centering vertically
  
  console.log(`[DEBUG] centerAndFitImage: Canvas=(${canvasWidth}x${canvasHeight}), Image=(${imageWidth}x${imageHeight})`);
  console.log(`[DEBUG] centerAndFitImage: Calculated scale=${scale.toFixed(4)}, left=${calculatedLeft.toFixed(2)}, top=${calculatedTop.toFixed(2)}`);

  // Store global values for coordinate transforms
  state.bgInitialScale = scale;
  state.bgInitialOffsetX = calculatedLeft;
  state.bgInitialOffsetY = calculatedTop;
  console.log(`[DEBUG] centerAndFitImage: Stored Globals -> Scale=${state.bgInitialScale.toFixed(4)}, OffsetX=${state.bgInitialOffsetX.toFixed(2)}, OffsetY=${state.bgInitialOffsetY.toFixed(2)}`);

  // Apply transformation to the background image
  bgImage.set({ 
    scaleX: scale, 
    scaleY: scale, 
    top: calculatedTop, 
    left: calculatedLeft, 
    originX: 'left', 
    originY: 'top' 
  });
  bgImage.setCoords();
  
  // Resize canvas to match image size - so clicking on edges works correctly
  const scaledWidth = Math.ceil(imageWidth * scale);
  const scaledHeight = Math.ceil(imageHeight * scale);
  
  if (state.canvasWrapper) {
    state.canvasWrapper.style.width = `${scaledWidth}px`;
    state.canvasWrapper.style.height = `${scaledHeight}px`;
  }

  repositionAnnotations(); // Reposition existing annotations based on NEW globals
  console.groupEnd();
}

// Reposition annotations when canvas is resized or image is loaded
export function repositionAnnotations() {
  console.group("[DEBUG] repositionAnnotations: Start (Full Recalc based on stored Image Points)...");
  if (!state.fabricCanvas || !state.fabricCanvas.backgroundImage) { 
    console.warn("[DEBUG] Reposition: Abort - Canvas/BG missing"); 
    console.groupEnd(); 
    return; 
  }
  
  console.log(`[DEBUG] Reposition: Processing ${state.annotations.length} annotations.`);
  console.log(`[DEBUG] Reposition: Using Globals -> Scale=${state.bgInitialScale.toFixed(4)}, OffsetX=${state.bgInitialOffsetX.toFixed(2)}, OffsetY=${state.bgInitialOffsetY.toFixed(2)}`);

  state.annotations.forEach((poly, index) => {
    console.group(`[DEBUG] Reposition Poly ${index}, Class: ${poly?.customData?.class}`);
    if (!poly.customData || !poly.customData.originalPoints) {
      console.warn("[DEBUG] Reposition Skip: Missing custom data or original points.");
      console.groupEnd(); 
      return;
    }

    // 1. Get original IMAGE points stored previously
    const originalImagePoints = poly.customData.originalPoints;
    console.log("[DEBUG] Reposition: Original Image Points:", JSON.stringify(originalImagePoints));

    // 2. Calculate TARGET CANVAS points based on CURRENT background transform (using globals)
    const targetCanvasPoints = originalImagePoints.map(p => 
      transformImagePointToCanvasPoint(
        p, 
        state.bgInitialScale, 
        state.bgInitialOffsetX, 
        state.bgInitialOffsetY
      )
    );
    
    if (targetCanvasPoints.some(p => isNaN(p.x) || isNaN(p.y))) {
      console.error(`[DEBUG] Reposition Skip ${index}: NaN detected during target canvas point calculation.`);
      console.groupEnd(); 
      return;
    }
    console.log("[DEBUG] Reposition: Target Canvas Points:", JSON.stringify(targetCanvasPoints));

    // 3. Find Top-Left bounding box corner (minX, minY) of the TARGET CANVAS points
    let minX = Infinity, minY = Infinity;
    targetCanvasPoints.forEach(p => { 
      minX = Math.min(minX, p.x); 
      minY = Math.min(minY, p.y); 
    });
    
    if (minX === Infinity || minY === Infinity) {
      console.error(`[DEBUG] Reposition Skip ${index}: Could not determine bounding box.`);
      console.groupEnd(); 
      return;
    }
    console.log(`[DEBUG] Reposition: Calculated Target minX=${minX.toFixed(2)}, minY=${minY.toFixed(2)}`);

    // 4. Calculate LOCAL points relative to this Top-Left corner (minX, minY)
    const localPoints = targetCanvasPoints.map(p => ({ x: p.x - minX, y: p.y - minY }));
    console.log("[DEBUG] Reposition: Calculated Local Points:", JSON.stringify(localPoints));

    // 5. Manually SET the polygon's state based on these calculations
    console.log(`[DEBUG] Reposition Poly ${index}: Current state before set L=${poly.left?.toFixed(2)}, T=${poly.top?.toFixed(2)}`);
    poly.set({
      left: minX,
      top: minY,
      points: localPoints, // Set the internal points relative to new left/top
      originX: 'left',   // Ensure origin is correct
      originY: 'top'
    });
    
    poly.setCoords(); // IMPORTANT: Update coordinates AND pathOffset etc. after changing points/position
    console.log(`[DEBUG] Reposition Poly ${index}: State AFTER set L=${poly.left?.toFixed(2)}, T=${poly.top?.toFixed(2)}`);
    console.groupEnd(); // End polygon group
  }); 

  // Reposition handles if they exist (based on the now-adjusted polygon state)
  if(state.editHandles.length > 0 && state.activePolygon){
    console.log("[DEBUG] Reposition: Repositioning edit handles...");
    // Using imports here would cause circular dependency, so we'll handle it from the annotations module
    if (typeof window.repositionEditHandles === 'function') {
      window.repositionEditHandles();
    }
  }

  state.fabricCanvas.renderAll();
  console.log("[DEBUG] Finished repositioning annotations (Full Recalc).");
  console.groupEnd(); // End function group
}

// Reset the zoom level
export function resetZoom() {
  if (!state.fabricCanvas || state.zoomLevel === 1.0) return;
  console.log("[DEBUG] Resetting Zoom");
  
  // Store current center point before zoom reset
  const center = state.fabricCanvas.getCenter();
  const centerPoint = new fabric.Point(center.left, center.top);
  
  // Reset zoom to 1.0 while maintaining center position
  state.fabricCanvas.zoomToPoint(centerPoint, 1);
  
  state.zoomLevel = 1.0;
  
  // Make all annotations visible
  state.annotations.forEach(p => p.set({ visible: true }));
  
  // We'll handle recreating edit handles elsewhere to avoid circular dependencies
  ui.updateZoomStatus();
  state.fabricCanvas.renderAll();
}

// Zoom the canvas
export function zoomCanvas(factor, centerPoint = null) {
  if (!state.fabricCanvas) return;
  const newZoom = state.fabricCanvas.getZoom() * factor;
  
  // Determine zoom center point
  let point;
  if (centerPoint) {
    point = centerPoint;
  } else if (state.activePolygon) {
    point = state.activePolygon.getCenterPoint();
  } else {
    point = { 
      x: state.fabricCanvas.getWidth() / 2, 
      y: state.fabricCanvas.getHeight() / 2 
    };
  }
  
  // Handle visibility of annotations during zooming
  if (newZoom !== 1.0 && state.activePolygon && state.editHandles.length > 0) {
    state.annotations.forEach(p => { 
      p.set({ visible: p === state.activePolygon }); 
    });
  } else {
    state.annotations.forEach(p => { 
      p.set({ visible: true }); 
    });
  }
  
  state.fabricCanvas.zoomToPoint(point, newZoom);
  state.zoomLevel = newZoom;
  
  // Update handle sizes for new zoom level
  state.editHandles.forEach(handle => {
    handle.set({
      radius: 5 / newZoom,
      strokeWidth: 1 / newZoom
    });
  });
  
  ui.updateZoomStatus();
  state.fabricCanvas.renderAll();
}

// Pan the canvas by deltaX and deltaY
export function panCanvas(deltaX, deltaY) {
  if (!state.fabricCanvas) return;
  
  console.log(`[DEBUG] panCanvas: Moving by deltaX=${deltaX}, deltaY=${deltaY}`);
  
  // Get the current viewport transformation in Fabric.js
  const vpt = state.fabricCanvas.viewportTransform;
  if (!vpt) {
    console.error("[DEBUG] panCanvas: No viewport transform available");
    return;
  }
  
  // Apply the delta to the viewport transform
  vpt[4] += deltaX;
  vpt[5] += deltaY;
  
  // Apply the new transform to the canvas
  state.fabricCanvas.setViewportTransform(vpt);
  
  // If we have edit handles, update their positions
  if (state.editHandles && state.editHandles.length > 0) {
    import('./annotations.js').then(module => {
      if (typeof module.createEditHandles === 'function' && state.activePolygon) {
        module.createEditHandles(state.activePolygon);
      }
    });
  }
  
  // Force canvas to render with new transform
  state.fabricCanvas.renderAll();
}

// Helper function to update the UI with the current image position
function updateImagePositionDisplay(x, y) {
  // If we have a UI element for displaying image position, update it here
  // This is optional but helps provide feedback to users
  if (state.elements && state.elements.positionStatus) {
    state.elements.positionStatus.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
  }
}