// utils.js - Utility functions for Facade Studio

// Access state from window instead of importing
const state = window.state;

/**
 * Get the color for a specific class
 * @param {string} className - The class name
 * @param {boolean} includeAlpha - Whether to include alpha in the color
 * @returns {string} - The color string (rgba or rgb)
 */
export function getClassColor(className, includeAlpha = true) {
  const defaultColor = includeAlpha ? 'rgba(128,128,128,0.5)' : 'rgb(128,128,128)';

  // Ensure AppState.classes is loaded
  if (!window.AppState || !window.AppState.classes) {
    console.error('AppState.classes is not defined');
    return defaultColor;
  }

  // Find the class in AppState.classes
  const classConfig = window.AppState.classes.find(cls => cls.name === className);

  if (!classConfig) {
    console.warn(`Class ${className} not found in AppState.classes`);
    return defaultColor;
  }

  // Return the color dynamically
  return includeAlpha ? classConfig.color : classConfig.solidColor;
}

/**
 * Transform an image point to a canvas point
 * @param {Object} imagePoint - The point in image coordinates
 * @param {number|Object} scale - The scale factor (can be number or {x,y} object)
 * @param {number} offsetX - The X offset
 * @param {number} offsetY - The Y offset
 * @returns {Object} - The point in canvas coordinates
 */
export function transformImagePointToCanvasPoint(imagePoint, scale, offsetX, offsetY) {
  // Handle different formats of scale (number or object with x,y properties)
  let scaleX, scaleY;
  
  if (typeof scale === 'object' && scale !== null) {
    // Extract x and y scale values from the object
    scaleX = scale.x || 0;
    scaleY = scale.y || 0;
  } else {
    // Use the same scale value for both dimensions
    scaleX = scaleY = scale || 0;
  }
  
  // First scale the point, then add the offset
  const canvasX = (imagePoint.x * scaleX) + offsetX;
  const canvasY = (imagePoint.y * scaleY) + offsetY;
  
  if (isNaN(canvasX) || isNaN(canvasY)) { 
    console.error("[DEBUG] transformImagePointToCanvasPoint NaN", {
      imagePoint, scale, scaleX, scaleY, offsetX, offsetY
    });
    return {x:0, y:0};
  }
  return { x: canvasX, y: canvasY };
}

/**
 * Transform a canvas point to an image point
 * @param {Object} canvasPoint - The point in canvas coordinates
 * @param {number|Object} scale - The scale factor (can be number or {x,y} object)
 * @param {number} offsetX - The X offset
 * @param {number} offsetY - The Y offset
 * @returns {Object} - The point in image coordinates
 */
export function transformCanvasPointToImagePoint(canvasPoint, scale, offsetX, offsetY) {
  // Handle different formats of scale (number or object with x,y properties)
  let scaleX, scaleY;
  
  if (typeof scale === 'object' && scale !== null) {
    // Extract x and y scale values from the object
    scaleX = scale.x || 0;
    scaleY = scale.y || 0;
  } else {
    // Use the same scale value for both dimensions
    scaleX = scaleY = scale || 0;
  }
  
  // Safety check to prevent division by zero
  if (scaleX === 0 || scaleY === 0) { 
    console.error("transformCanvasPointToImagePoint Error: Scale 0");
    return { x: 0, y: 0 }; 
  }
  
  // First subtract the offset, then divide by scale
  const imgX = (canvasPoint.x - offsetX) / scaleX;
  const imgY = (canvasPoint.y - offsetY) / scaleY;
  
  if (isNaN(imgX) || isNaN(imgY)) { 
    console.error("transformCanvasPointToImagePoint NaN:", canvasPoint, {scale, scaleX, scaleY, offsetX, offsetY});
    return {x:0, y:0};
  }
  return { x: Math.round(imgX), y: Math.round(imgY) };
}

/**
 * Cleans up temporary drawing elements from the canvas
 */
export function cleanupDrawingAids() {
  if (state.fabricCanvas) {
    const toRemove = state.fabricCanvas.getObjects().filter(o => o.temporary);
    state.fabricCanvas.remove(...toRemove);
    
    if (state.tempLine) {
      state.fabricCanvas.remove(state.tempLine);
      state.tempLine = null;
    }
  }
  
  state.tempPoints = [];
}

/**
 * Generate a unique object ID for a polygon based on class
 * @param {string} className - The class name
 * @returns {string} - The generated object ID
 */
export function generateObjectId(className) {
  // Find highest existing number across all annotations
  let highestNum = 0;
  
  if (state.annotations) {
    state.annotations.forEach(poly => {
      if (poly.customData && poly.customData.objectId) {
        // Try to parse the object ID as an integer
        const num = parseInt(poly.customData.objectId, 10);
        if (!isNaN(num) && num > highestNum) {
          highestNum = num;
        }
      }
    });
  }
  
  // Create new ID with incremented number (just an integer)
  const newId = `${highestNum + 1}`;
  console.log(`[DEBUG] Generated new object ID: ${newId}`);
  return newId;
}

/**
 * Parse COCO annotations and add them to the canvas
 * @param {Object} cocoData - The COCO format data
 */
export function parseCocoAnnotations(cocoData) {
    console.group("[DEBUG] parseCocoAnnotations");

    // Build category map for looking up class names
    const categoryMap = {};
    if (cocoData.categories) {
        cocoData.categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });
    }

    console.log(`[DEBUG] Category map:`, categoryMap);
    console.log(`[DEBUG] Processing ${cocoData.annotations?.length || 0} annotations`);

    if (!cocoData.annotations || !Array.isArray(cocoData.annotations)) {
        console.warn("[DEBUG] No valid annotations array in COCO data");
        console.groupEnd();
        return;
    }

    // Process each annotation
    cocoData.annotations.forEach((ann, index) => {
        try {
            // Validate segmentation data
            if (!ann.segmentation || !Array.isArray(ann.segmentation) || !ann.segmentation[0]) {
                console.warn(`[DEBUG] Skip ann ${index}: Invalid segmentation data`);
                return;
            }

            const seg = ann.segmentation[0];

            // Check segmentation format
            if (!Array.isArray(seg) || seg.length < 6) {
                console.warn(`[DEBUG] Skip ann ${index}: Bad segmentation format (need at least 3 points)`);
                return;
            }

            // Build points array from segmentation data
            const points = [];
            for (let i = 0; i < seg.length; i += 2) {
                if (typeof seg[i] !== 'number' || typeof seg[i+1] !== 'number') {
                    console.warn(`[DEBUG] Invalid coordinate at position ${i}`);
                    continue;
                }

                // Convert image coordinates to canvas coordinates
                const canvasX = seg[i] * window.AppState.currentScale;
                const canvasY = seg[i+1] * window.AppState.currentScale;

                points.push({ x: canvasX, y: canvasY });
            }

            // Need at least 3 valid points to create a polygon
            if (points.length < 3) {
                console.warn(`[DEBUG] Skip ann ${index}: Not enough valid points (${points.length})`);
                return;
            }

            // Get class name from category
            const categoryId = ann.category_id;
            const className = categoryMap[categoryId] || `Category ${categoryId}`;

            // Ensure AppState.classes is loaded
            if (!window.AppState || !window.AppState.classes) {
                console.error('AppState.classes is not defined');
                return;
            }

            // Find the class in AppState.classes
            const classConfig = window.AppState.classes.find(cls => cls.name === className);

            if (!classConfig) {
                console.warn(`Class ${className} not found in AppState.classes`);
                return;
            }

            // Get stroke and fill colors based on class
            const strokeColor = classConfig.solidColor;
            // Ensure transparency in annotations by using RGBA colors with alpha
            const fillColor = classConfig.color; // RGBA color with transparency

            // Debug log for fill property
            console.log(`[DEBUG] Creating polygon with fill color: ${fillColor}`);

            // Create the polygon with disabled controls to prevent bounding box flashing
            const polygon = new fabric.Polygon(points, {
                stroke: strokeColor,
                strokeWidth: 2,
                fill: fillColor, // Apply transparency
                objectCaching: false,
                transparentCorners: false,
                cornerColor: 'transparent', // Make corners transparent
                borderColor: 'transparent', // Make borders transparent
                selectable: true,
                hasControls: false, // Disable controls to prevent bounding box
                hasBorders: false,  // Disable borders to prevent bounding box
                perPixelTargetFind: true, // Enable precise hit testing
                padding: 0, // Remove extra padding around the polygon
                lockMovementX: false,
                lockMovementY: false,
                // Set the ID from the COCO annotation
                id: ann.id
            });

            // Override the containsPoint method to use a more strict hit test
            polygon._containsOriginal = polygon.containsPoint;
            polygon.containsPoint = function(point, lines, absolute) {
                // First check if the point is on the polygon border with a tolerance
                if (isPointOnPolygonPath(this, point, 5)) {
                    return true;
                }

                // For clicks inside the polygon, use the original containsPoint method 
                // which correctly detects if a point is inside the polygon
                const isInsidePolygon = this._containsOriginal(point, lines, absolute);

                // Check if the current action is "selecting a polygon" versus "drawing a new polygon"
                // If the user is actively drawing a polygon or we're in "create" mode,
                // we don't want to select existing polygons on clicks within the polygon
                if (isInsidePolygon) {
                    if (window.AppState.isDrawing || window.AppState.currentMode === 'create') {
                        return false;
                    }
                    return true;
                }

                // Not inside polygon
                return false;
            };

            // Store class and category information
            polygon.class = className;
            polygon.category_id = categoryId;

            // Store original points for saving later
            polygon.customData = {
                class: className,
                objectId: ann.objectId || `obj-${Date.now()}-${index}`,
                imagePoints: seg.reduce((arr, val, i) => {
                    if (i % 2 === 0) {
                        arr.push({ x: seg[i], y: seg[i+1] });
                    }
                    return arr;
                }, [])
            };

            // Add to canvas and annotations array
            window.AppState.fabricCanvas.add(polygon);
            window.AppState.annotations.push(polygon);

            console.log(`[DEBUG] Added polygon ${index} of class ${className}`);

        } catch (error) {
            console.error(`[DEBUG] Error processing annotation ${index}:`, error);
        }
    });

    console.log(`[DEBUG] Successfully added ${window.AppState.annotations.length} annotations`);
    console.groupEnd();
}