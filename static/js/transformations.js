// transformations.js - Coordinate transformation utilities for Facade Studio
// Handles transformations between image and canvas coordinates

// Access state from window instead of importing
const state = window.state;

// Transform a point from image coordinates to canvas coordinates
export function transformImagePointToCanvasPoint(imagePoint) {
  // Check if scale values are properly defined
  let scaleX, scaleY;
  
  // Handle different possible formats of bgInitialScale
  if (typeof state.bgInitialScale === 'object') {
    scaleX = state.bgInitialScale.x || 0;
    scaleY = state.bgInitialScale.y || 0;
  } else {
    scaleX = scaleY = state.bgInitialScale || 0;
  }
  
  // First scale the image point based on the zoom/scale factor
  // Then add the offset to account for image position in canvas
  const canvasX = (imagePoint.x * scaleX) + state.bgInitialOffsetX;
  const canvasY = (imagePoint.y * scaleY) + state.bgInitialOffsetY;
  
  if (isNaN(canvasX) || isNaN(canvasY)) {
    console.error("[DEBUG] transformImagePointToCanvasPoint: NaN detected", {
      imagePoint, 
      bgInitialScale: state.bgInitialScale,
      scaleX,
      scaleY,
      bgInitialOffsetX: state.bgInitialOffsetX,
      bgInitialOffsetY: state.bgInitialOffsetY
    });
    return { x: 0, y: 0 };
  }
  
  return { x: canvasX, y: canvasY };
}

// Transform a point from canvas coordinates to image coordinates
export function transformCanvasPointToImagePoint(canvasPoint) {
  // Check if scale values are properly defined
  let scaleX, scaleY;
  
  // Handle different possible formats of bgInitialScale
  if (typeof state.bgInitialScale === 'object') {
    scaleX = state.bgInitialScale.x || 0;
    scaleY = state.bgInitialScale.y || 0;
  } else {
    scaleX = scaleY = state.bgInitialScale || 0;
  }
  
  // Safety check to prevent division by zero
  if (scaleX === 0 || scaleY === 0) {
    console.error("transformCanvasPointToImagePoint Error: Scale is zero or undefined", {
      bgInitialScale: state.bgInitialScale,
      scaleX, 
      scaleY
    });
    return { x: 0, y: 0 };
  }
  
  // First subtract the offset to get coordinates relative to image origin
  // Then divide by scale to get coordinates in image space
  const imgX = (canvasPoint.x - state.bgInitialOffsetX) / scaleX;
  const imgY = (canvasPoint.y - state.bgInitialOffsetY) / scaleY;
  
  if (isNaN(imgX) || isNaN(imgY)) {
    console.error("transformCanvasPointToImagePoint NaN:", canvasPoint, {
      bgInitialScale: state.bgInitialScale,
      scaleX,
      scaleY,
      bgInitialOffsetX: state.bgInitialOffsetX,
      bgInitialOffsetY: state.bgInitialOffsetY
    });
    return { x: 0, y: 0 };
  }
  
  return { x: Math.round(imgX), y: Math.round(imgY) };
}

// Reset zoom to fit the canvas to the image
export function resetZoom() {
  console.log("[DEBUG] resetZoom: Resetting zoom to fit image to canvas");
  
  // Make sure we have a valid canvas and image
  if (!state.fabricCanvas) {
    console.error("[DEBUG] resetZoom: No canvas available");
    return;
  }
  
  // Reset the zoom level to 1.0
  state.zoomLevel = 1.0;
  
  // Reset any pan/offset
  state.fabricCanvas.viewportTransform[4] = 0;
  state.fabricCanvas.viewportTransform[5] = 0;
  
  // Reset the canvas zoom
  state.fabricCanvas.setZoom(1.0);
  
  // Center the image in the canvas if possible
  const bg = state.fabricCanvas.backgroundImage;
  if (bg) {
    const canvasWidth = state.fabricCanvas.width;
    const canvasHeight = state.fabricCanvas.height;
    const imgWidth = bg.width * bg.scaleX;
    const imgHeight = bg.height * bg.scaleY;
    
    // Calculate center position
    const left = (canvasWidth - imgWidth) / 2;
    const top = (canvasHeight - imgHeight) / 2;
    
    if (left !== 0 || top !== 0) {
      bg.set({
        left: left,
        top: top
      });
    }
  }
  
  // Refresh the canvas
  state.fabricCanvas.renderAll();
  
  // Update the zoom status in the UI if possible
  try {
    const { updateZoomStatus } = require('./ui.js');
    if (typeof updateZoomStatus === 'function') {
      updateZoomStatus();
    }
  } catch (e) {
    console.log("[DEBUG] resetZoom: Could not update zoom status in UI", e);
  }
}