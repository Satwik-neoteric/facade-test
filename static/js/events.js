// events.js - Event handling for Facade Studio
// Manages keyboard, mouse, and canvas events

import { state, elements } from './main.js';
import { updateCoordsStatus, addLogEntry, updateButtonStates } from './ui.js';
import { zoomCanvas, panCanvas } from './canvas.js';
import { startDrawing, addDrawingPoint, completeDrawing, cancelDrawing } from './drawing.js';
import { deleteSelectedPolygon, deselectActivePolygon } from './annotations.js';
import { transformCanvasPointToImagePoint } from './utils.js';

// Combined setup function for all event listeners
export function setupEventListeners() {
  setupKeyboardEventListeners();
  setupCanvasEventListeners();
  setupClassButtonEventListeners(); // Added class button event listeners
  setupActionButtonEventListeners(); // Added action button event listeners
}

// Function to match the name expected in main.js
export function attachEventListeners() {
  console.log("[DEBUG] Attaching event listeners");
  setupEventListeners();
}

// Set up event listeners for action buttons (submit, skip, delete)
function setupActionButtonEventListeners() {
  // Submit button - Save annotations
  if (elements.submitBtn) {
    elements.submitBtn.addEventListener('click', () => {
      console.log("[DEBUG] Submit button clicked");
      import('./api.js').then(module => {
        module.saveAnnotations();
      });
    });
  }
  
  // Skip button - Load next image
  if (elements.skipBtn) {
    elements.skipBtn.addEventListener('click', () => {
      console.log("[DEBUG] Skip button clicked");
      import('./api.js').then(module => {
        module.loadNextImage();
      });
    });
  }
  
  // Delete button - Delete current image
  if (elements.deleteBtn) {
    elements.deleteBtn.addEventListener('click', () => {
      console.log("[DEBUG] Delete button clicked");
      import('./api.js').then(module => {
        module.deleteCurrentImage();
      });
    });
  }
}

// Set up keyboard event listeners
export function setupKeyboardEventListeners() {
  window.addEventListener('keydown', handleKeyDown);
}

// Handle keyboard events
function handleKeyDown(e) {
  // Get the key pressed
  const key = e.key.toLowerCase();
  let preventDefault = false;
  
  // Skip all keyboard shortcuts if an input is focused
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  // Arrow keys for panning when zoomed in
  if (state.zoomLevel > 1.0 && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    preventDefault = true;
    const panAmount = 50; // Fixed amount in pixels
    
    // Determine pan direction based on arrow key
    let deltaX = 0, deltaY = 0;
    
    if (key === 'arrowleft') deltaX = panAmount;
    if (key === 'arrowright') deltaX = -panAmount;
    if (key === 'arrowup') deltaY = panAmount;
    if (key === 'arrowdown') deltaY = -panAmount;
    
    // Use the existing panCanvas function to handle the panning
    import('./canvas.js').then(module => {
      if (typeof module.panCanvas === 'function') {
        module.panCanvas(deltaX, deltaY);
        console.log(`[DEBUG] Panned canvas using arrow keys: ${key}, delta=(${deltaX}, ${deltaY})`);
      }
    });
    
    // Don't process other keyboard shortcuts when panning
    e.preventDefault();
    return;
  }
  
  // Escape key - Cancel current action
  if (e.key === 'Escape') {
    if (state.currentMode === 'Edit' && state.activePolygon) {
      // Check if we have the original polygon state
      if (state.originalPolygonState && state.activePolygon.points) {
        console.log("[DEBUG] Escape pressed: Restoring original polygon state");
        
        // First remove all current edit handles to avoid any interactions during restoration
        import('./annotations.js').then(module => {
          module.removeEditHandles();
          
          // Now restore the original polygon properties from before editing
          // Use a timeout to ensure the handles are fully removed first
          setTimeout(() => {
            try {
              // Deep clone the original points to avoid reference issues
              state.activePolygon.points = JSON.parse(JSON.stringify(state.originalPolygonState.points));
              
              // Restore all original position and transformation properties
              state.activePolygon.set({
                left: state.originalPolygonState.left,
                top: state.originalPolygonState.top,
                width: state.originalPolygonState.width,
                height: state.originalPolygonState.height,
                angle: state.originalPolygonState.angle,
                scaleX: state.originalPolygonState.scaleX,
                scaleY: state.originalPolygonState.scaleY
              });
              
              // If we also have original image points, restore those too
              if (state.originalImagePoints && state.activePolygon.customData) {
                state.activePolygon.customData.imagePoints = JSON.parse(JSON.stringify(state.originalImagePoints));
              }
              
              // Update polygon on canvas
              state.activePolygon.dirty = true;
              state.activePolygon.setCoords();
              
              // Reset the edited flag
              state.pointsEdited = false;
              
              // Then recreate handles for the restored polygon
              module.createEditHandles(state.activePolygon);
              
              // Log a message about the cancellation
              addLogEntry('Edit cancelled - changes reverted', state.activePolygon.customData.objectId);
              
              // Force canvas render
              state.fabricCanvas.renderAll();
            } catch (error) {
              console.error('[DEBUG] Error restoring polygon state:', error);
              addLogEntry('Error restoring polygon state');
              
              // Fallback: just exit edit mode
              deselectActivePolygon();
            }
          }, 50); // Small delay to ensure proper timing
        });
      } else {
        // Just exit edit mode if no original points are available
        addLogEntry('Edit cancelled', state.activePolygon.customData.objectId);
        deselectActivePolygon();
      }
    } else if (state.zoomLevel !== 1.0) {
      import('./canvas.js').then(module => {
        module.resetZoom();
      });
    } else {
      deselectActivePolygon();
    }
  } 
  // Enter key - Complete current action
  else if (e.key === 'Enter') {
    preventDefault = true;
    
    if (state.currentMode === 'Edit' && state.activePolygon) {
      console.log("[DEBUG] Enter pressed while in Edit mode: Persisting coordinates");
      
      // Ensure any in-progress transformations are finalized
      if (state.fabricCanvas.getActiveObject()) {
        // Complete any active transformations
        state.fabricCanvas.getActiveObject().setCoords();
        state.fabricCanvas.renderAll();
      }

      // Make sure polygon points are fully up to date
      state.activePolygon.setCoords();
      
      // Use a small delay to ensure all rendering and updates are complete
      setTimeout(() => {
        if (state.activePolygon.points) {
          // Calculate and update the image points for storage
          import('./utils.js').then(utilsModule => {
            // Get all the updated points in IMAGE coordinates
            const updatedImagePoints = state.activePolygon.points.map((point, index) => {
              let canvasX, canvasY;
              
              // Different calculation based on polygon type
              const isReloadedPolygon = state.activePolygon.pathOffset && 
                                      (Math.abs(state.activePolygon.left) > 0.1 || Math.abs(state.activePolygon.top) > 0.1);
              
              if (isReloadedPolygon) {
                // For reloaded polygons (from COCO files), we need to account for pathOffset
                canvasX = point.x - state.activePolygon.pathOffset.x + 
                          state.activePolygon.left + state.activePolygon.width/2;
                canvasY = point.y - state.activePolygon.pathOffset.y + 
                          state.activePolygon.top + state.activePolygon.height/2;
              } else {
                // Simple calculation for newly created polygons
                canvasX = point.x + state.activePolygon.left;
                canvasY = point.y + state.activePolygon.top;
              }
              
              console.log(`[DEBUG] Point ${index}: Canvas coordinates (${canvasX.toFixed(2)}, ${canvasY.toFixed(2)})`);
              
              // Convert canvas coordinates to image coordinates
              const imagePoint = utilsModule.transformCanvasPointToImagePoint(
                { x: canvasX, y: canvasY },
                state.bgInitialScale,
                state.bgInitialOffsetX,
                state.bgInitialOffsetY
              );
              
              console.log(`[DEBUG] Point ${index}: Image coordinates (${imagePoint.x.toFixed(2)}, ${imagePoint.y.toFixed(2)})`);
              
              return imagePoint;
            });
            
            // Ensure the customData object exists
            if (!state.activePolygon.customData) {
              state.activePolygon.customData = {};
            }
            
            // Update the stored image points
            state.activePolygon.customData.imagePoints = updatedImagePoints;
            
            // Log the coordinates for debugging
            console.log("[DEBUG] Updated image points:", JSON.stringify(updatedImagePoints));
            
            // Mark as edited and dirty for saving
            state.isDirty = true;
            
            // Add log entry
            addLogEntry('Coordinates saved and polygon deselected', 
                      state.activePolygon.customData.objectId);
            
            // Update the UI
            import('./ui.js').then(uiModule => {
              uiModule.updateButtonStates();
            });
            
            // Deselect the polygon - this will also clean up the edit handles
            deselectActivePolygon();
            
            // Force a final render
            state.fabricCanvas.renderAll();
          });
        } else {
          console.error("[DEBUG] Cannot save coordinates: Polygon has no points array");
          deselectActivePolygon();
        }
      }, 50); // Short delay to ensure coordinates are stable
    } else if (state.currentMode === 'Create') {
      if (state.currentPolygonPoints.length >= 3) {
        completeDrawing();
      } else {
        console.log("Need >= 3 points");
      }
    }
  } 
  // Delete/Backspace - Delete selected polygon
  else if (key === 'delete' || key === 'backspace') {
    if (state.currentMode === 'Edit' && state.activePolygon) {
      preventDefault = true;
      deleteSelectedPolygon();
    }
  }
  
  if (preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// Set up canvas event listeners
export function setupCanvasEventListeners() {
  if (!state.fabricCanvas) return;
  
  state.fabricCanvas.on('mouse:down', handleMouseDown);
  state.fabricCanvas.on('mouse:move', handleMouseMove);
  state.fabricCanvas.on('mouse:up', handleMouseUp);
  state.fabricCanvas.on('selection:created', handleSelectionEvent);
  state.fabricCanvas.on('selection:updated', handleSelectionEvent);
  state.fabricCanvas.on('selection:cleared', handleSelectionCleared);
  state.fabricCanvas.on('object:modified', handleObjectModified);
  state.fabricCanvas.on('object:moving', handleObjectMoving);
}

// Handle mouse down event
function handleMouseDown(options) {
  if (!state.fabricCanvas) return;
  
  const pointer = state.fabricCanvas.getPointer(options.e);
  const target = options.target;

  console.log("[DEBUG] handleMouseDown called with currentMode:", state.currentMode);
  console.log("[DEBUG] Click target:", target ? 
    { type: target.type, class: target.class, id: target.id } : 
    "No target (clicked on empty space)");
  
  // Check if we're in validation mode
  import('./validation.js').then(module => {
    const isValidationMode = module.isInValidationMode();
    console.log("[DEBUG] Validation mode status:", isValidationMode);
    
    if (isValidationMode) {
      console.log("[DEBUG] Cannot draw in validation mode");
      return;
    }
    
    // Continue with normal handling if not in validation mode
    // If we're in Create mode, simply add a drawing point
    if (state.currentMode === 'Create') {
      console.log("[DEBUG] In Create mode, adding drawing point");
      addDrawingPoint(pointer);
      return;
    }
    
    // For Select mode, we need to decide whether to select an object or start drawing
    if (state.currentMode === 'Select') {
      // Check if background image was clicked
      const clickedOnBgImage = target && target.type === 'image' && 
                              (!state.annotations.includes(target));
      
      console.log("[DEBUG] clickedOnBgImage:", clickedOnBgImage);
      
      // If we clicked on an edit handle, just select it and exit
      if (target && target.customData?.isHandle) {
        console.log("[DEBUG] Clicked on edit handle");
        state.fabricCanvas.setActiveObject(target);
        return;
      }
      
      // IMPORTANT NEW CHECK: For polygon targets, verify if the click is directly on the polygon path
      // This ensures we only select when clicking on the actual polygon, not just its bounding box
      if (target && state.annotations.includes(target)) {
        // Check if the target is an annotation polygon
        if (target.type === 'polygon') {
          // Get the canvas context for hit testing
          const ctx = state.fabricCanvas.getContext('2d');
          
          // We'll do manual point-in-polygon test to make sure the click is actually on the polygon, not just the bbox
          const points = target.points;
          const absolutePoints = points.map(p => ({
            x: p.x + target.left - (target.pathOffset?.x || 0),
            y: p.y + target.top - (target.pathOffset?.y || 0)
          }));
          
          // Do a proper hit test with a small buffer radius
          const hitBuffer = 5; // 5px buffer for hit testing
          const isDirectHit = isPointNearPolygonPath(pointer, absolutePoints, hitBuffer);
          
          console.log(`[DEBUG] Polygon hit test: directHit=${isDirectHit}`);
          
          if (isDirectHit) {
            // It's a direct hit on the polygon path, so let regular selection happen
            console.log("[DEBUG] Direct hit on polygon path - selecting polygon");
            return;
          } else {
            // Click is inside bounding box but not on polygon path - start drawing instead
            console.log("[DEBUG] Click inside bounding box but not on polygon - starting drawing");
            startDrawing(pointer);
            return;
          }
        }
        
        // For non-polygon annotations or direct hits, allow normal selection
        console.log("[DEBUG] Clicked on annotation (not a polygon or direct hit) - normal selection");
        return;
      }
      
      // If we're clicking on the background image or empty space, start drawing
      if (!target || clickedOnBgImage) {
        console.log("[DEBUG] Starting drawing - clicked on", target ? target.type : "empty space");
        startDrawing(pointer);
        return;
      }
    }
  });
}

// Helper function to check if a point is near a polygon's path
function isPointNearPolygonPath(point, polyPoints, tolerance) {
  if (!polyPoints || polyPoints.length < 3) return false;
  
  // Check distance to each edge of the polygon
  for (let i = 0; i < polyPoints.length; i++) {
    const p1 = polyPoints[i];
    const p2 = polyPoints[(i + 1) % polyPoints.length];
    
    // Calculate distance from point to line segment
    const distance = distanceToLineSegment(point, p1, p2);
    
    // If point is close enough to any edge, it's a hit
    if (distance <= tolerance) {
      return true;
    }
  }
  
  return false;
}

// Calculate distance from point to line segment
function distanceToLineSegment(point, lineStart, lineEnd) {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;
  
  // Calculate line segment length squared
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  
  // If segment is just a point, return distance to that point
  if (lengthSquared === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  
  // Calculate projection of point onto line
  const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
  
  // Calculate nearest point on line segment
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  // Return distance from point to projection
  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
}

// Handle mouse move event
function handleMouseMove(options) {
  if (!state.fabricCanvas) return;
  
  const pointer = state.fabricCanvas.getPointer(options.e);
  updateCoordsStatus(options);
  
  if (state.isDrawing && state.currentMode === 'Create' && 
      state.currentPolygonPoints.length > 0 && state.tempLine) {
    state.tempLine.set({ x2: pointer.x, y2: pointer.y });
    state.fabricCanvas.renderAll();
  }
}

// Handle mouse up event
function handleMouseUp(options) {
  // Usually not needed, but can add specific behavior if required
}

// Handle selection event
function handleSelectionEvent(options) {
  const selected = options.selected;
  
  // If a handle is selected, don't change selection state
  if (selected && selected.length === 1 && selected[0].customData?.isHandle) {
    return;
  }
  
  // Check if we have active edit handles
  if (state.editHandles.length > 0) {
    // If selection changed to something not related to current editing, deselect
    if (!selected || selected.length === 0 || 
        !selected.find(obj => obj === state.activePolygon || obj.customData?.isHandle)) {
      deselectActivePolygon();
    } else {
      return; // Keep editing current polygon
    }
  }
  
  // Select a polygon if exactly one is selected and it's in our annotations array
  if (state.editHandles.length === 0 && selected && selected.length === 1) {
    const sel = selected[0];
    if (state.annotations.includes(sel)) {
      import('./annotations.js').then(module => {
        module.selectPolygon(sel);
      });
    } else {
      deselectActivePolygon();
    }
  } else if (!selected || selected.length === 0) {
    deselectActivePolygon();
  }
}

// Handle selection cleared event
function handleSelectionCleared(options) {
  if (state.activePolygon || state.editHandles.length > 0) {
    console.log("[DEBUG] Selection cleared event");
    deselectActivePolygon();
  }
}

// Handle object modified event
function handleObjectModified(options) {
  const target = options.target;
  if (!target) return;
  
  if (target.customData?.isHandle) {
    const { targetPolygon, pointIndex } = target.customData;
    const polyIndex = state.annotations.indexOf(targetPolygon);
    addLogEntry(`Point ${pointIndex + 1} moved.`);
    targetPolygon.setCoords();
    
    import('./ui.js').then(module => {
      module.renderAnnotationList();
      module.updateButtonStates();
    });
    
    state.fabricCanvas.renderAll();
  } else if (state.annotations.includes(target) && 
             target === state.activePolygon && 
             state.editHandles.length === 0) {
    console.log("[DEBUG] Polygon modified (e.g., moved)");
    state.isDirty = true;
    
    import('./ui.js').then(module => {
      module.updateButtonStates();
    });
    
    addLogEntry(`Modified polygon ${state.annotations.indexOf(target) + 1}`, 
                target.customData.objectId);
    
    import('./ui.js').then(module => {
      module.renderAnnotationList();
    });
    
    target.setCoords();
    state.fabricCanvas.renderAll();
  }
}

// Handle object moving event
function handleObjectMoving(options) {
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
      console.log(`[DEBUG] Handle moving on reloaded polygon: Point ${pointIndex}, ` +
                 `Absolute pos (${canvasPoint.x}, ${canvasPoint.y}), ` +
                 `Relative pos (${relativePoint.x}, ${relativePoint.y}), ` +
                 `PathOffset (${targetPolygon.pathOffset.x}, ${targetPolygon.pathOffset.y})`);
    } else {
      // For new polygons, simple conversion works
      relativePoint = {
        x: canvasPoint.x - currentLeft,
        y: canvasPoint.y - currentTop
      };
      console.log(`[DEBUG] Handle moving on new polygon: Point ${pointIndex}, ` +
                 `Absolute pos (${canvasPoint.x}, ${canvasPoint.y}), ` +
                 `Relative pos (${relativePoint.x}, ${relativePoint.y})`);
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
      
      // Update the edit handles to match the new polygon shape
      import('./annotations.js').then(module => {
        module.createEditHandles(targetPolygon);
      });
      
      // Mark as dirty for saving
      state.isDirty = true;
      
      // Flag to indicate that points have been edited (important for Escape/Enter handling)
      state.pointsEdited = true;
      
      // Request UI update
      import('./ui.js').then(module => {
        module.updateButtonStates();
      });
      
      // Force canvas render
      state.fabricCanvas.renderAll();
    } else {
      console.error(`Error: Invalid pointIndex ${pointIndex} for targetPolygon points array.`);
      return;
    }
  } else if (target === state.activePolygon && 
             state.editHandles.length === 0 && 
             !target.lockMovementX) {
    state.isDirty = true;
    state.pointsEdited = true; // Mark that the polygon has been edited
    
    import('./ui.js').then(module => {
      module.updateButtonStates();
    });
  }
}

// Set up event listeners for class selection buttons
function setupClassButtonEventListeners() {
  if (!elements.classButtons) return;
  
  elements.classButtons.forEach(button => {
    button.addEventListener('click', () => {
      const className = button.dataset.class;
      if (className) {
        state.activeObjectClass = className;
        
        // If there's an active polygon, update its class and color
        if (state.activePolygon) {
          const oldClass = state.activePolygon.customData.class;
          
          // Update the polygon's class
          state.activePolygon.customData.class = className;
          
          // Update the polygon's color based on the new class
          import('./utils.js').then(module => {
            const fillColor = module.getClassColor(className, true);
            const strokeColor = module.getClassColor(className, false);
            
            state.activePolygon.set({
              fill: fillColor,
              stroke: strokeColor
            });
            
            // Add a log entry for the class change
            import('./ui.js').then(uiModule => {
              uiModule.addLogEntry(`Changed class from "${oldClass}" to "${className}"`, state.activePolygon.customData.objectId);
              
              // Update the UI
              uiModule.updateClassSelectionUI();
              uiModule.renderAnnotationList();
              uiModule.updateSelectedObjectStatus(state.activePolygon);
              uiModule.updateButtonStates();
            });
            
            // Mark as dirty for saving
            state.isDirty = true;
            
            // Render the canvas to show the updated colors
            state.fabricCanvas.renderAll();
          });
        } else {
          // Just update the UI if no polygon is selected
          import('./ui.js').then(module => {
            module.updateClassSelectionUI();
          });
        }
        
        console.log(`[DEBUG] Class selected: ${className}`);
      }
    });
  });
}