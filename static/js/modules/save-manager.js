// save-manager.js - Save Operations
// Handles saving annotations, auto-save, and data persistence

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry } from './utilities.js';
import { convertFabricToCoco } from './data-converter.js';

/**
 * Save annotations to the server
 */
export async function saveAnnotations(options = {}) {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Saving annotations");
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            throw new Error("No image loaded to save annotations for");
        }
        
        if (!AppState.annotations || AppState.annotations.length === 0) {
            if (!options.allowEmpty) {
                throw new Error("No annotations to save");
            }
        }
        
        // Convert annotations to COCO format
        const cocoPayload = convertFabricToCoco(AppState.annotations);

        // Validate cocoPayload structure before submission
        if (
            !cocoPayload ||
            typeof cocoPayload !== 'object' ||
            !Array.isArray(cocoPayload.images) ||
            !Array.isArray(cocoPayload.annotations) ||
            !Array.isArray(cocoPayload.categories)
        ) {
            throw new Error("COCO payload is missing required keys or is malformed");
        }
        
        // Prepare the payload for saving
        const payload = {
            coco: cocoPayload, // Should be a dict with keys: images, annotations, categories
            log: [`Submitted ${AppState.annotations.length} annotations at ${new Date().toISOString()}`],
            admin_metadata: {} // Add this if your backend expects it, even if empty
        };
        
        console.log("[DEBUG] Saving annotations payload:", payload);
        
        // Build the correct API URL with image path and query parameters
        const imagePath = `${AppState.currentBatch}/cam/${AppState.currentImageId}.jpg`;
        const apiUrl = `/api/annotations/${imagePath}?batch_id=${AppState.currentBatch}&image_id=${AppState.currentImageId}`;
        
        console.log("[DEBUG] Saving to URL:", apiUrl);
        
        // Save to server using the correct endpoint format
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[DEBUG] Save successful:", result);
        
        // Update last saved timestamp
        AppState.lastSaved = new Date().toISOString();
        
        // Mark annotations as saved
        AppState.annotations.forEach(annotation => {
            if (annotation.customData) {
                annotation.customData.saved = true;
                annotation.customData.lastSaved = AppState.lastSaved;
            }
        });
        
        const message = options.autoSave ? 
            `Auto-saved ${AppState.annotations.length} annotations` :
            `Saved ${AppState.annotations.length} annotations`;
            
        addLogEntry(message);
        
        if (!options.silent) {
            showMessage(message, "success");
        }
        
        return result;
        
    } catch (error) {
        console.error("[DEBUG] Error saving annotations:", error);
        
        if (!options.silent) {
            showMessage(`Error saving annotations: ${error.message}`, "error");
        }
        
        throw error;
    }
}

/**
 * Auto-save annotations periodically
 */
export function enableAutoSave(intervalMinutes = 5) {
    const AppState = getAppState();
    
    // Clear existing auto-save interval
    if (AppState.autoSaveInterval) {
        clearInterval(AppState.autoSaveInterval);
    }
    
    const intervalMs = intervalMinutes * 60 * 1000;
    
    AppState.autoSaveInterval = setInterval(async () => {
        if (hasUnsavedChanges()) {
            try {
                await saveAnnotations({
                    autoSave: true,
                    silent: true,
                    allowEmpty: true
                });
                console.log("[DEBUG] Auto-save completed");
            } catch (error) {
                console.warn("[DEBUG] Auto-save failed:", error);
            }
        }
    }, intervalMs);
    
    console.log(`[DEBUG] Auto-save enabled with ${intervalMinutes} minute interval`);
}

/**
 * Disable auto-save
 */
export function disableAutoSave() {
    const AppState = getAppState();
    
    if (AppState.autoSaveInterval) {
        clearInterval(AppState.autoSaveInterval);
        AppState.autoSaveInterval = null;
        console.log("[DEBUG] Auto-save disabled");
    }
}

/**
 * Check if there are unsaved changes
 */
export function hasUnsavedChanges() {
    const AppState = getAppState();
    
    if (!AppState.annotations || AppState.annotations.length === 0) {
        return false;
    }
    
    // Check if any annotation has been modified since last save
    return AppState.annotations.some(annotation => {
        if (!annotation.customData) return true;
        
        const modified = annotation.customData.modified;
        const lastSaved = annotation.customData.lastSaved || AppState.lastSaved;
        
        // If no modification time, consider it unsaved
        if (!modified) return !annotation.customData.saved;
        
        // If no last saved time, consider it unsaved
        if (!lastSaved) return true;
        
        // Check if modified after last save
        return new Date(modified) > new Date(lastSaved);
    });
}

/**
 * Save current session state
 */
export function saveSessionState() {
    const AppState = getAppState();
    
    try {
        const sessionState = {
            currentBatch: AppState.currentBatch,
            currentImageId: AppState.currentImageId,
            currentImagePath: AppState.currentImagePath,
            currentMode: AppState.currentMode,
            currentClass: AppState.currentClass,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('facade_session_state', JSON.stringify(sessionState));
        console.log("[DEBUG] Session state saved");
        
    } catch (error) {
        console.warn("[DEBUG] Failed to save session state:", error);
    }
}

/**
 * Restore session state
 */
export function restoreSessionState() {
    try {
        const savedState = localStorage.getItem('facade_session_state');
        if (!savedState) return null;
        
        const sessionState = JSON.parse(savedState);
        
        // Check if session is not too old (24 hours)
        const sessionAge = Date.now() - new Date(sessionState.timestamp).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge > maxAge) {
            localStorage.removeItem('facade_session_state');
            return null;
        }
        
        console.log("[DEBUG] Session state restored:", sessionState);
        return sessionState;
        
    } catch (error) {
        console.warn("[DEBUG] Failed to restore session state:", error);
        localStorage.removeItem('facade_session_state');
        return null;
    }
}

/**
 * Clear session state
 */
export function clearSessionState() {
    try {
        localStorage.removeItem('facade_session_state');
        console.log("[DEBUG] Session state cleared");
    } catch (error) {
        console.warn("[DEBUG] Failed to clear session state:", error);
    }
}

/**
 * Create backup of current annotations
 */
export function createAnnotationBackup() {
    const AppState = getAppState();
    
    try {
        if (!AppState.annotations || AppState.annotations.length === 0) {
            return null;
        }
        
        const backup = {
            annotations: AppState.annotations.map(annotation => ({
                type: annotation.type,
                points: annotation.points ? JSON.parse(JSON.stringify(annotation.points)) : null,
                customData: annotation.customData ? JSON.parse(JSON.stringify(annotation.customData)) : null,
                left: annotation.left,
                top: annotation.top,
                width: annotation.width,
                height: annotation.height,
                angle: annotation.angle,
                scaleX: annotation.scaleX,
                scaleY: annotation.scaleY
            })),
            batchId: AppState.currentBatch,
            imageId: AppState.currentImageId,
            timestamp: new Date().toISOString()
        };
        
        // Store in memory for undo functionality
        if (!AppState.annotationBackups) {
            AppState.annotationBackups = [];
        }
        
        AppState.annotationBackups.push(backup);
        
        // Keep only last 10 backups
        if (AppState.annotationBackups.length > 10) {
            AppState.annotationBackups = AppState.annotationBackups.slice(-10);
        }
        
        console.log("[DEBUG] Annotation backup created");
        return backup;
        
    } catch (error) {
        console.error("[DEBUG] Failed to create annotation backup:", error);
        return null;
    }
}

/**
 * Restore from annotation backup
 */
export function restoreFromBackup(backupIndex = -1) {
    const AppState = getAppState();
    
    try {
        if (!AppState.annotationBackups || AppState.annotationBackups.length === 0) {
            throw new Error("No backups available");
        }
        
        // Get backup (default to most recent)
        const backup = backupIndex >= 0 ? 
            AppState.annotationBackups[backupIndex] : 
            AppState.annotationBackups[AppState.annotationBackups.length - 1];
            
        if (!backup) {
            throw new Error("Backup not found");
        }
        
        // Clear current annotations
        AppState.annotations.forEach(annotation => {
            AppState.fabricCanvas.remove(annotation);
        });
        AppState.annotations = [];
        
        // Restore annotations from backup
        backup.annotations.forEach(annotationData => {
            if (annotationData.type === 'polygon' && annotationData.points) {
                const polygon = new fabric.Polygon(annotationData.points, {
                    strokeWidth: 2,
                    stroke: annotationData.customData?.color || '#007bff',
                    fill: annotationData.customData?.fillColor || 'rgba(0, 123, 255, 0.3)',
                    selectable: true,
                    evented: true,
                    left: annotationData.left,
                    top: annotationData.top,
                    width: annotationData.width,
                    height: annotationData.height,
                    angle: annotationData.angle || 0,
                    scaleX: annotationData.scaleX || 1,
                    scaleY: annotationData.scaleY || 1
                });
                
                polygon.customData = annotationData.customData;
                
                AppState.fabricCanvas.add(polygon);
                AppState.annotations.push(polygon);
            }
        });
        
        // Rebuild annotation list
        if (window.modules?.annotationManager?.rebuildAnnotationList) {
            window.modules.annotationManager.rebuildAnnotationList();
        }
        
        AppState.fabricCanvas.renderAll();
        
        addLogEntry(`Restored ${backup.annotations.length} annotations from backup`);
        showMessage("Annotations restored from backup", "success");
        
        console.log("[DEBUG] Annotations restored from backup");
        
    } catch (error) {
        console.error("[DEBUG] Failed to restore from backup:", error);
        showMessage(`Error restoring backup: ${error.message}`, "error");
    }
}

/**
 * Export annotations to file
 */
export function exportAnnotations(format = 'json') {
    const AppState = getAppState();
    
    try {
        if (!AppState.annotations || AppState.annotations.length === 0) {
            showMessage("No annotations to export", "warning");
            return;
        }
        
        let data, filename, mimeType;
        
        switch (format.toLowerCase()) {
            case 'json':
                const cocoData = convertFabricToCoco(AppState.annotations);
                data = JSON.stringify(cocoData, null, 2);
                filename = `annotations_${AppState.currentImageId || 'export'}_${Date.now()}.json`;
                mimeType = 'application/json';
                break;
                
            case 'csv':
                data = convertAnnotationsToCSV(AppState.annotations);
                filename = `annotations_${AppState.currentImageId || 'export'}_${Date.now()}.csv`;
                mimeType = 'text/csv';
                break;
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
        
        // Create download
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        addLogEntry(`Exported ${AppState.annotations.length} annotations to ${format.toUpperCase()}`);
        showMessage(`Annotations exported to ${filename}`, "success");
        
    } catch (error) {
        console.error("[DEBUG] Export failed:", error);
        showMessage(`Export failed: ${error.message}`, "error");
    }
}

/**
 * Convert annotations to CSV format
 */
function convertAnnotationsToCSV(annotations) {
    const headers = ['Object ID', 'Class', 'Points', 'Bounding Box', 'Area', 'Created', 'Modified'];
    const rows = [headers.join(',')];
    
    annotations.forEach(annotation => {
        if (annotation.customData) {
            const objectId = annotation.customData.objectId || '';
            const className = annotation.customData.class || '';
            const points = annotation.points ? 
                annotation.points.map(p => `${p.x},${p.y}`).join(';') : '';
            const bbox = annotation.customData.bbox ? 
                annotation.customData.bbox.join(',') : '';
            const area = annotation.customData.area || '';
            const created = annotation.customData.created || '';
            const modified = annotation.customData.modified || '';
            
            const row = [objectId, className, points, bbox, area, created, modified]
                .map(field => `"${field}"`)
                .join(',');
            rows.push(row);
        }
    });
    
    return rows.join('\n');
}

/**
 * Setup save-related event handlers
 */
export function setupSaveEventHandlers() {
    // Save on Ctrl+S
    document.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            saveAnnotations().catch(error => {
                console.error("[DEBUG] Manual save failed:", error);
            });
        }
    });
    
    // Auto-save before page unload
    window.addEventListener('beforeunload', function(event) {
        if (hasUnsavedChanges()) {
            // Save session state
            saveSessionState();
            
            // Show warning
            const message = 'You have unsaved changes. Are you sure you want to leave?';
            event.returnValue = message;
            return message;
        }
    });
    
    console.log("[DEBUG] Save event handlers setup complete");
}