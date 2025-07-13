// data-converter.js - Data Conversion Functions
// Handles conversion between different data formats (COCO, Fabric.js, etc.)

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry, getCategoryColorByName } from './utilities.js';
import { initializePolygon } from './annotation-manager.js';

/**
 * Parse COCO annotations and convert to Fabric.js objects
 */
export function parseCocoAnnotations(cocoData) {
    const AppState = getAppState();
    
    console.log("[DEBUG] Parsing COCO annotations:", cocoData);
    
    if (!cocoData || !cocoData.annotations || !Array.isArray(cocoData.annotations)) {
        console.warn("[DEBUG] No valid annotations found in COCO data");
        return;
    }
    
    // Clear existing annotations
    AppState.annotations.forEach(annotation => {
        AppState.fabricCanvas.remove(annotation);
    });
    AppState.annotations = [];
    
    try {
        cocoData.annotations.forEach((annotation, index) => {
            console.log(`[DEBUG] Processing annotation ${index}:`, annotation);
            
            // Get category information
            const category = cocoData.categories?.find(cat => cat.id === annotation.category_id);
            const className = category?.name || 'unknown';
            
            // Handle segmentation data
            if (annotation.segmentation && annotation.segmentation.length > 0) {
                const segmentation = annotation.segmentation[0]; // Take first segmentation
                
                if (Array.isArray(segmentation) && segmentation.length >= 6) {
                    // Convert flat array to points array with proper scaling
                    const points = [];
                    for (let i = 0; i < segmentation.length; i += 2) {
                        if (i + 1 < segmentation.length) {
                            // Apply scaling during conversion like original main.js
                            const canvasX = segmentation[i] * (AppState.currentScale || 1);
                            const canvasY = segmentation[i + 1] * (AppState.currentScale || 1);
                            
                            points.push({
                                x: canvasX,
                                y: canvasY
                            });
                        }
                    }
                    
                    console.log(`[DEBUG] Converted ${points.length} points for ${className} with scale ${AppState.currentScale}`);
                    
                    if (points.length >= 3) {
                        // Get proper colors
                        const strokeColor = getCategoryColorByName(className);
                        const fillColor = getCategoryColorByName(className, true);
                        
                        console.log(`[DEBUG] Colors for ${className}: stroke=${strokeColor}, fill=${fillColor}`);
                        
                        // Create Fabric.js polygon with same settings as original main.js
                        const polygon = new fabric.Polygon(points, {
                            stroke: strokeColor,
                            strokeWidth: 2,
                            fill: fillColor,
                            objectCaching: false,
                            transparentCorners: false,
                            cornerColor: 'transparent',
                            borderColor: 'transparent',
                            selectable: true,
                            hasControls: false,
                            hasBorders: false,
                            perPixelTargetFind: true,
                            padding: 0,
                            lockMovementX: false,
                            lockMovementY: false,
                            id: annotation.id
                        });
                        
                        // Store class and category information like original
                        polygon.class = className;
                        polygon.category_id = annotation.category_id;
                        
                        // Add custom data with image points (original coordinates)
                        polygon.customData = {
                            class: className,
                            objectId: annotation.objectId || `obj-${Date.now()}-${index}`,
                            created: new Date().toISOString(),
                            imagePoints: segmentation.reduce((arr, val, i) => {
                                if (i % 2 === 0) {
                                    arr.push({ x: segmentation[i], y: segmentation[i + 1] });
                                }
                                return arr;
                            }, []),
                            cocoId: annotation.id,
                            categoryId: annotation.category_id,
                            area: annotation.area,
                            bbox: annotation.bbox
                        };
                        
                        // Add to canvas and annotations array
                        AppState.fabricCanvas.add(polygon);
                        AppState.annotations.push(polygon);
                        
                        // Respect current annotation visibility state
                        if (AppState.annotationsHidden) {
                            polygon.set({ visible: false });
                        }
                        
                        console.log(`[DEBUG] Created polygon for ${className} with ${points.length} points`);
                    } else {
                        console.warn(`[DEBUG] Not enough points for polygon: ${points.length}`);
                    }
                } else {
                    console.warn("[DEBUG] Invalid segmentation format:", segmentation);
                }
            } else {
                console.warn("[DEBUG] No segmentation data found for annotation:", annotation);
            }
        });
        
        // Rebuild annotation list
        if (window.rebuildAnnotationList) {
            window.rebuildAnnotationList();
        }
        
        // Update button states after loading annotations
        if (window.modules?.uiManager?.updateButtonStates) {
            window.modules.uiManager.updateButtonStates();
        }
        
        // Render canvas
        AppState.fabricCanvas.renderAll();
        
        addLogEntry(`Loaded ${AppState.annotations.length} annotations from COCO data`);
        console.log(`[DEBUG] Successfully parsed ${AppState.annotations.length} annotations`);
        
    } catch (error) {
        console.error("[DEBUG] Error parsing COCO annotations:", error);
        showMessage("Error parsing annotations", "error");
    }
}

/**
 * Convert Fabric.js objects to COCO format
 */
export function convertFabricToCoco(annotations) {
    const AppState = getAppState();
    
    console.log("[DEBUG] Converting Fabric.js annotations to COCO format");
    
    if (!annotations || !Array.isArray(annotations)) {
        console.warn("[DEBUG] No valid annotations provided for conversion");
        return null;
    }
    
    try {
        // Create COCO structure
        const coco = {
            info: {
                description: "Facade Studio Annotations",
                version: "1.0",
                year: new Date().getFullYear(),
                date_created: new Date().toISOString()
            },
            images: [],
            annotations: [],
            categories: AppState.classes || []
        };
        
        // Add current image info if available
        if (AppState.currentImageId && AppState.currentImagePath) {
            coco.images.push({
                id: AppState.currentImageId,
                file_name: AppState.currentImagePath,
                width: AppState.currentImage?.width || 0,
                height: AppState.currentImage?.height || 0
            });
        }
        
        // Convert each annotation
        annotations.forEach((obj, index) => {
            if (obj.type !== 'polygon') {
                console.warn(`[DEBUG] Skipping non-polygon object at index ${index}`);
                return;
            }
            
            const className = obj.customData?.class || 'unknown';
            
            // Find category ID
            const category = AppState.classes?.find(cat => cat.name === className);
            const categoryId = category?.id || 1;
            
            // Get polygon points
            let imagePoints = [];
            
            if (obj.customData?.imagePoints) {
                // Use stored image points if available
                imagePoints = obj.customData.imagePoints;
            } else {
                // Convert current polygon points to image coordinates
                if (obj.points && Array.isArray(obj.points)) {
                    imagePoints = obj.points.map(point => {
                        // Calculate canvas coordinates
                        const canvasX = obj.left + point.x;
                        const canvasY = obj.top + point.y;
                        
                        // Convert to image coordinates if scale is available
                        return {
                            x: AppState.currentScale ? canvasX / AppState.currentScale : canvasX,
                            y: AppState.currentScale ? canvasY / AppState.currentScale : canvasY
                        };
                    });
                }
            }
            
            if (imagePoints.length < 3) {
                console.warn(`[DEBUG] Not enough points for annotation ${index}: ${imagePoints.length}`);
                return;
            }
            
            // Convert to flat array for segmentation
            const segmentation = [
                imagePoints.reduce((flat, point) => {
                    flat.push(point.x, point.y);
                    return flat;
                }, [])
            ];
            
            // Calculate bounding box [x, y, width, height]
            const xs = imagePoints.map(p => p.x);
            const ys = imagePoints.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const bbox = [minX, minY, maxX - minX, maxY - minY];
            
            // Calculate area (approximate)
            const area = (maxX - minX) * (maxY - minY);
            
            // Create annotation object
            const annotation = {
                id: obj.customData?.cocoId || index + 1,
                image_id: AppState.currentImageId || 1,
                category_id: categoryId,
                segmentation: segmentation,
                area: area,
                bbox: bbox,
                iscrowd: 0,
                objectId: obj.customData?.objectId || `obj-${Date.now()}-${index}`,
                created: obj.customData?.created || new Date().toISOString(),
                modified: obj.customData?.modified || new Date().toISOString()
            };
            
            // Add to annotations array
            coco.annotations.push(annotation);
        });
        
        console.log(`[DEBUG] Converted ${coco.annotations.length} annotations to COCO format`);
        return coco;
        
    } catch (error) {
        console.error("[DEBUG] Error converting to COCO format:", error);
        showMessage("Error converting annotations", "error");
        return null;
    }
}

/**
 * Export annotations to JSON file
 */
export function exportAnnotationsAsJson() {
    const AppState = getAppState();
    
    if (!AppState.annotations || AppState.annotations.length === 0) {
        showMessage("No annotations to export", "warning");
        return;
    }
    
    try {
        const cocoData = convertFabricToCoco(AppState.annotations);
        
        if (!cocoData) {
            showMessage("Failed to convert annotations", "error");
            return;
        }
        
        // Create download link
        const dataStr = JSON.stringify(cocoData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `annotations_${AppState.currentImageId || 'export'}_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        addLogEntry(`Exported ${AppState.annotations.length} annotations to JSON`);
        showMessage("Annotations exported successfully", "success");
        
    } catch (error) {
        console.error("[DEBUG] Error exporting annotations:", error);
        showMessage("Error exporting annotations", "error");
    }
}

/**
 * Import annotations from JSON file
 */
export function importAnnotationsFromJson(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file provided"));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                if (!jsonData.annotations) {
                    reject(new Error("Invalid annotation file format"));
                    return;
                }
                
                // Parse the annotations
                parseCocoAnnotations(jsonData);
                
                addLogEntry(`Imported ${jsonData.annotations.length} annotations from JSON`);
                showMessage("Annotations imported successfully", "success");
                
                resolve(jsonData);
                
            } catch (error) {
                console.error("[DEBUG] Error importing annotations:", error);
                showMessage("Error importing annotations", "error");
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error("Error reading file"));
        };
        
        reader.readAsText(file);
    });
}

/**
 * Convert polygon points to different coordinate systems
 */
export function convertCoordinates(points, fromSystem, toSystem, imageWidth, imageHeight, canvasWidth, canvasHeight) {
    if (!points || !Array.isArray(points)) {
        return [];
    }
    
    return points.map(point => {
        let x = point.x;
        let y = point.y;
        
        // Convert from source system to normalized (0-1)
        if (fromSystem === 'image') {
            x = x / imageWidth;
            y = y / imageHeight;
        } else if (fromSystem === 'canvas') {
            x = x / canvasWidth;
            y = y / canvasHeight;
        }
        // 'normalized' stays as is
        
        // Convert from normalized to target system
        if (toSystem === 'image') {
            x = x * imageWidth;
            y = y * imageHeight;
        } else if (toSystem === 'canvas') {
            x = x * canvasWidth;
            y = y * canvasHeight;
        }
        // 'normalized' stays as is
        
        return { x, y };
    });
}

/**
 * Validate COCO annotation format
 */
export function validateCocoFormat(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
        errors.push("Data must be an object");
        return errors;
    }
    
    // Check required fields
    if (!data.annotations || !Array.isArray(data.annotations)) {
        errors.push("Missing or invalid 'annotations' array");
    }
    
    if (!data.categories || !Array.isArray(data.categories)) {
        errors.push("Missing or invalid 'categories' array");
    }
    
    // Validate annotations
    if (data.annotations) {
        data.annotations.forEach((annotation, index) => {
            if (!annotation.id) {
                errors.push(`Annotation ${index}: missing 'id' field`);
            }
            
            if (!annotation.category_id) {
                errors.push(`Annotation ${index}: missing 'category_id' field`);
            }
            
            if (!annotation.segmentation || !Array.isArray(annotation.segmentation)) {
                errors.push(`Annotation ${index}: missing or invalid 'segmentation' field`);
            }
            
            if (!annotation.bbox || !Array.isArray(annotation.bbox) || annotation.bbox.length !== 4) {
                errors.push(`Annotation ${index}: missing or invalid 'bbox' field`);
            }
        });
    }
    
    // Validate categories
    if (data.categories) {
        data.categories.forEach((category, index) => {
            if (!category.id) {
                errors.push(`Category ${index}: missing 'id' field`);
            }
            
            if (!category.name) {
                errors.push(`Category ${index}: missing 'name' field`);
            }
        });
    }
    
    return errors;
}

/**
 * Get annotation statistics
 */
export function getAnnotationStatistics(annotations) {
    if (!annotations || !Array.isArray(annotations)) {
        return {
            total: 0,
            byClass: {},
            averageArea: 0,
            totalArea: 0
        };
    }
    
    const stats = {
        total: annotations.length,
        byClass: {},
        averageArea: 0,
        totalArea: 0
    };
    
    let totalArea = 0;
    
    annotations.forEach(annotation => {
        const className = annotation.customData?.class || 'unknown';
        
        // Count by class
        if (!stats.byClass[className]) {
            stats.byClass[className] = 0;
        }
        stats.byClass[className]++;
        
        // Calculate area if available
        if (annotation.customData?.area) {
            totalArea += annotation.customData.area;
        } else if (annotation.customData?.bbox) {
            const bbox = annotation.customData.bbox;
            totalArea += bbox[2] * bbox[3]; // width * height
        }
    });
    
    stats.totalArea = totalArea;
    stats.averageArea = annotations.length > 0 ? totalArea / annotations.length : 0;
    
    return stats;
}