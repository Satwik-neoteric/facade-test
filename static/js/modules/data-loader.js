// data-loader.js - Data Loading Functions
// Handles loading of batches, classes, images, annotations, metadata, and sensor data

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry } from './utilities.js';

/**
 * Load batches from CosmosDB for selection
 */
export async function loadBatches() {
    try {
        console.log("[DEBUG] Loading batches from server");
        const response = await fetch('/api/batches');
        
        if (!response.ok) {
            throw new Error(`Failed to load batches: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[DEBUG] Batches loaded successfully:", data);
        
        // Populate batch selector
        const batchSelector = document.getElementById('batch-selector');
        if (batchSelector) {
            batchSelector.innerHTML = '<option value="">Select Batch</option>';
            
            data.batches.forEach(batch => {
                const option = document.createElement('option');
                // Handle both string batches and object batches
                const batchId = typeof batch === 'string' ? batch : batch.batch_id;
                option.value = batchId;
                option.textContent = batchId;
                batchSelector.appendChild(option);
            });
        }
        
        addLogEntry(`Loaded ${data.batches.length} batches`);
        return data.batches;
        
    } catch (error) {
        console.error("[DEBUG] Error loading batches:", error);
        showMessage("Error loading batches. See console for details.", "error");
        throw error;
    }
}


/**
 * Load available classes/categories
 */
export async function loadClasses() {
    try {
        console.log("[DEBUG] Loading classes from server");
        const response = await fetch('/api/classes');
        
        if (!response.ok) {
            throw new Error(`Failed to load classes: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[DEBUG] Classes loaded successfully:", data);
        
        const AppState = getAppState();
        AppState.classes = data.classes;
        
       
        
        addLogEntry(`Loaded ${data.classes.length} annotation classes`);
        return data.classes;
        
    } catch (error) {
        console.error("[DEBUG] Error loading classes:", error);
        showMessage("Error loading classes. See console for details.", "error");
        throw error;
    }
}

/**
 * Load specific image for annotation
 */
export async function loadImage(imagePath, loadId = null) {
    const AppState = getAppState();
    
    // Check if this load is still expected (prevent race conditions)
    if (loadId && AppState.expectedLoadId !== loadId) {
        console.log(`[DEBUG] Cancelling load for ${imagePath} - newer request exists`);
        return;
    }
    
    try {
        console.log(`[DEBUG] Loading image: ${imagePath}`);
        AppState.loading = true;
        
        // Show loading indicator
        const canvas = AppState.fabricCanvas;
        if (canvas) {
            canvas.clear();
            // Add loading text to canvas
            const loadingText = new fabric.Text('Loading image...', {
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                fontSize: 20,
                fill: '#666'
            });
            canvas.add(loadingText);
            canvas.renderAll();
        }
        
        // Create image element
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = async function() {
                try {
                    // Final race condition check
                    if (loadId && AppState.expectedLoadId !== loadId) {
                        console.log(`[DEBUG] Load cancelled during image load for ${imagePath}`);
                        resolve();
                        return;
                    }
                    
                    console.log(`[DEBUG] Image loaded successfully: ${img.naturalWidth}x${img.naturalHeight}`);
                    
                    if (canvas) {
                        // Clear canvas
                        canvas.clear();
                        
                        // Calculate canvas size to fit image
                        const containerWidth = canvas.getElement().parentElement.clientWidth;
                        const containerHeight = canvas.getElement().parentElement.clientHeight;
                        
                        const maxWidth = Math.min(containerWidth * 0.9, img.naturalWidth);
                        const maxHeight = Math.min(containerHeight * 0.9, img.naturalHeight);
                        
                        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
                        
                        const canvasWidth = img.naturalWidth * scale;
                        const canvasHeight = img.naturalHeight * scale;
                        
                        // Set canvas dimensions
                        canvas.setDimensions({
                            width: canvasWidth,
                            height: canvasHeight
                        });
                        
                        // Create fabric image
                        const fabricImg = new fabric.Image(img, {
                            selectable: false,
                            evented: false,
                            scaleX: scale,
                            scaleY: scale
                        });
                        
                        // Add image to canvas
                        canvas.add(fabricImg);
                        canvas.sendToBack(fabricImg);
                        
                        // Update state
                        AppState.currentImage = fabricImg;
                        AppState.currentImagePath = imagePath;
                        
                        // Load annotations for this image
                        await loadAnnotations(imagePath);
                        
                        // Load metadata
                        await loadMetadata(imagePath);
                        
                        // Update status
                        const imageNameStatus = document.getElementById('image-name-status');
                        if (imageNameStatus) {
                            imageNameStatus.textContent = imagePath.split('/').pop();
                        }
                        
                        canvas.renderAll();
                        addLogEntry(`Image loaded: ${imagePath.split('/').pop()}`);
                    }
                    
                    AppState.loading = false;
                    resolve(img);
                    
                } catch (error) {
                    console.error(`[DEBUG] Error processing loaded image:`, error);
                    AppState.loading = false;
                    reject(error);
                }
            };
            
            img.onerror = function() {
                console.error(`[DEBUG] Failed to load image: ${imagePath}`);
                AppState.loading = false;
                reject(new Error(`Failed to load image: ${imagePath}`));
            };
            
            // Start loading
            img.src = imagePath;
        });
        
    } catch (error) {
        console.error(`[DEBUG] Error loading image ${imagePath}:`, error);
        AppState.loading = false;
        showMessage(`Error loading image: ${error.message}`, "error");
        throw error;
    }
}

/**
 * Load existing annotations for current image
 */
export async function loadAnnotations(imagePath) {
    const AppState = getAppState();
    
    try {
        console.log(`[DEBUG] Loading annotations for image: ${imagePath}`);
        
        const batchId = AppState.currentBatch;
        const imageId = AppState.currentImageId;
        
        if (!batchId || !imageId) {
            console.log("[DEBUG] No batch or image ID available for loading annotations");
            return [];
        }
        
        const response = await fetch(`/api/annotations/${batchId}/${imageId}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`[DEBUG] Loaded ${data.annotations?.length || 0} annotations`);
            
            if (data.annotations && data.annotations.length > 0) {
                // Parse and display annotations
                if (window.parseCocoAnnotations) {
                    window.parseCocoAnnotations(data.annotations);
                }
                addLogEntry(`Loaded ${data.annotations.length} annotations`);
                return data.annotations;
            }
        } else if (response.status === 404) {
            console.log("[DEBUG] No annotations found for this image");
        } else {
            console.warn(`[DEBUG] Failed to load annotations: ${response.status}`);
        }
        
        return [];
        
    } catch (error) {
        console.error("[DEBUG] Error loading annotations:", error);
        return [];
    }
}

/**
 * Load image metadata information
 */
export async function loadMetadata(imagePath) {
    try {
        console.log(`[DEBUG] Loading metadata for: ${imagePath}`);
        
        const response = await fetch(`/api/metadata?image_path=${encodeURIComponent(imagePath)}`);
        
        if (response.ok) {
            const metadata = await response.json();
            console.log("[DEBUG] Metadata loaded:", metadata);
            
            // Display metadata
            displayMetadata(metadata);
            return metadata;
        } else {
            console.warn(`[DEBUG] Failed to load metadata: ${response.status}`);
        }
        
    } catch (error) {
        console.error("[DEBUG] Error loading metadata:", error);
    }
    
    return null;
}

/**
 * Display metadata in the metadata panel
 */
function displayMetadata(metadata) {
    const metadataBox = document.getElementById('metadata-box');
    if (!metadataBox) return;
    
    if (!metadata || Object.keys(metadata).length === 0) {
        metadataBox.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No metadata available</p>';
        return;
    }
    
    let html = '<div class="space-y-2 text-sm">';
    
    // Format common metadata fields
    if (metadata.filename) {
        html += `<div><strong>Filename:</strong> ${metadata.filename}</div>`;
    }
    if (metadata.size) {
        html += `<div><strong>Size:</strong> ${formatFileSize(metadata.size)}</div>`;
    }
    if (metadata.dimensions) {
        html += `<div><strong>Dimensions:</strong> ${metadata.dimensions.width} × ${metadata.dimensions.height}</div>`;
    }
    if (metadata.format) {
        html += `<div><strong>Format:</strong> ${metadata.format}</div>`;
    }
    if (metadata.created_date) {
        html += `<div><strong>Created:</strong> ${formatDate(metadata.created_date)}</div>`;
    }
    if (metadata.modified_date) {
        html += `<div><strong>Modified:</strong> ${formatDate(metadata.modified_date)}</div>`;
    }
    
    // Add any additional metadata
    Object.keys(metadata).forEach(key => {
        if (!['filename', 'size', 'dimensions', 'format', 'created_date', 'modified_date'].includes(key)) {
            html += `<div><strong>${key}:</strong> ${JSON.stringify(metadata[key])}</div>`;
        }
    });
    
    html += '</div>';
    metadataBox.innerHTML = html;
}

/**
 * Load sensor data associated with image
 */
export async function loadSensorData(batchId, imageId) {
    try {
        console.log(`[DEBUG] Loading sensor data for batch: ${batchId}, image: ${imageId}`);
        
        const response = await fetch(`/api/sensor-data/${batchId}/${imageId}`);
        
        if (response.ok) {
            const sensorData = await response.json();
            console.log("[DEBUG] Sensor data loaded:", sensorData);
            
            // Display sensor data
            displaySensorData(sensorData);
            return sensorData;
        } else if (response.status === 404) {
            console.log("[DEBUG] No sensor data found");
            displaySensorData(null);
        } else {
            console.warn(`[DEBUG] Failed to load sensor data: ${response.status}`);
        }
        
    } catch (error) {
        console.error("[DEBUG] Error loading sensor data:", error);
        displaySensorData(null);
    }
    
    return null;
}

/**
 * Display sensor data in the sensor panel
 */
function displaySensorData(sensorData) {
    const sensorTable = document.getElementById('sensor-data-table');
    if (!sensorTable) return;
    
    if (!sensorData || Object.keys(sensorData).length === 0) {
        sensorTable.innerHTML = '<tr><td colspan="2" class="p-3 text-center text-gray-500 dark:text-gray-400">No sensor data available</td></tr>';
        return;
    }
    
    let html = '';
    Object.keys(sensorData).forEach(key => {
        const value = sensorData[key];
        html += `
            <tr class="border-b border-gray-200 dark:border-gray-600">
                <td class="p-2 font-medium text-gray-700 dark:text-gray-300">${key}</td>
                <td class="p-2 text-gray-600 dark:text-gray-400">${formatSensorValue(value)}</td>
            </tr>
        `;
    });
    
    sensorTable.innerHTML = html;
}

/**
 * Format sensor value for display
 */
function formatSensorValue(value) {
    if (typeof value === 'number') {
        return value.toFixed(2);
    } else if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Helper function to format date
 */
function formatDate(date) {
    if (!date) return 'Unknown';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}