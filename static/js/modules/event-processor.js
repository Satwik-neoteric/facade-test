// event-processor.js - Specialized Event Processing
// Handles event queuing, batch processing, and statistics

import { getAppState } from './app-state.js';
import { addLogEntry } from './utilities.js';

/**
 * Process batch events (delegated from canvas-manager)
 */
export function processBatchEvents(events) {
    console.log("[DEBUG] Processing batch events:", events.length);
    
    events.forEach(event => {
        switch (event.type) {
            case 'annotation_created':
                handleAnnotationCreated(event);
                break;
            case 'annotation_modified':
                handleAnnotationModified(event);
                break;
            case 'annotation_deleted':
                handleAnnotationDeleted(event);
                break;
            default:
                console.warn("[DEBUG] Unknown event type:", event.type);
        }
    });
}

/**
 * Handle annotation created event
 */
function handleAnnotationCreated(event) {
    const AppState = getAppState();
    
    // Mark data as dirty for auto-save
    if (AppState.autoSaveEnabled) {
        AppState.isDirty = true;
    }
    
    // Update statistics
    updateAnnotationStatistics();
    
    addLogEntry(`Annotation created: ${event.data?.class || 'unknown'}`);
}

/**
 * Handle annotation modified event
 */
function handleAnnotationModified(event) {
    const AppState = getAppState();
    
    // Mark data as dirty for auto-save
    if (AppState.autoSaveEnabled) {
        AppState.isDirty = true;
    }
    
    addLogEntry(`Annotation modified: ${event.data?.objectId || 'unknown'}`);
}

/**
 * Handle annotation deleted event
 */
function handleAnnotationDeleted(event) {
    const AppState = getAppState();
    
    // Mark data as dirty for auto-save
    if (AppState.autoSaveEnabled) {
        AppState.isDirty = true;
    }
    
    // Update statistics
    updateAnnotationStatistics();
    
    addLogEntry(`Annotation deleted: ${event.data?.objectId || 'unknown'}`);
}

/**
 * Update annotation statistics
 */
function updateAnnotationStatistics() {
    const AppState = getAppState();
    
    if (!AppState.annotations) return;
    
    const stats = {
        total: AppState.annotations.length,
        byClass: {}
    };
    
    AppState.annotations.forEach(annotation => {
        const className = annotation.customData?.class || 'unknown';
        stats.byClass[className] = (stats.byClass[className] || 0) + 1;
    });
    
    // Update UI display
    const statsElement = document.getElementById('annotation-stats');
    if (statsElement) {
        statsElement.textContent = `Total: ${stats.total}`;
    }
    
    console.log("[DEBUG] Annotation statistics updated:", stats);
}

/**
 * Process validation events
 */
export function processValidationEvents(validationResults) {
    console.log("[DEBUG] Processing validation events:", validationResults);
    
    validationResults.forEach(result => {
        if (!result.isValid) {
            console.warn("[DEBUG] Validation failed:", result.message);
            
            // Highlight problematic annotation if available
            if (result.annotationId) {
                highlightProblematicAnnotation(result.annotationId);
            }
        }
    });
}

/**
 * Highlight problematic annotation
 */
function highlightProblematicAnnotation(annotationId) {
    const AppState = getAppState();
    
    const annotation = AppState.annotations.find(ann => 
        ann.customData?.objectId === annotationId
    );
    
    if (annotation) {
        // Temporarily change color to indicate problem
        const originalStroke = annotation.stroke;
        annotation.set('stroke', '#ff0000');
        annotation.set('strokeWidth', 4);
        
        AppState.fabricCanvas.renderAll();
        
        // Restore original color after 3 seconds
        setTimeout(() => {
            annotation.set('stroke', originalStroke);
            annotation.set('strokeWidth', 2);
            AppState.fabricCanvas.renderAll();
        }, 3000);
    }
}

/**
 * Process save events
 */
export function processSaveEvents(saveResults) {
    console.log("[DEBUG] Processing save events:", saveResults);
    
    saveResults.forEach(result => {
        if (result.success) {
            addLogEntry(`Saved successfully: ${result.itemType}`);
        } else {
            console.error("[DEBUG] Save failed:", result.error);
            addLogEntry(`Save failed: ${result.error}`, 'error');
        }
    });
}

/**
 * Process load events
 */
export function processLoadEvents(loadResults) {
    console.log("[DEBUG] Processing load events:", loadResults);
    
    loadResults.forEach(result => {
        if (result.success) {
            addLogEntry(`Loaded successfully: ${result.itemType}`);
        } else {
            console.error("[DEBUG] Load failed:", result.error);
            addLogEntry(`Load failed: ${result.error}`, 'error');
        }
    });
}

/**
 * Debounce utility for event processing
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle utility for event processing
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Create event processor for specific event types
 */
export function createEventProcessor(eventType, handler) {
    return {
        type: eventType,
        handler: handler,
        process: function(event) {
            if (event.type === this.type) {
                this.handler(event);
                return true;
            }
            return false;
        }
    };
}

/**
 * Event queue for batch processing
 */
class EventQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }
    
    add(event) {
        this.queue.push({
            ...event,
            timestamp: Date.now()
        });
    }
    
    async process() {
        if (this.processing) return;
        
        this.processing = true;
        
        try {
            while (this.queue.length > 0) {
                const event = this.queue.shift();
                await this.processEvent(event);
            }
        } catch (error) {
            console.error("[DEBUG] Error processing event queue:", error);
        } finally {
            this.processing = false;
        }
    }
    
    async processEvent(event) {
        console.log("[DEBUG] Processing queued event:", event.type);
        
        switch (event.type) {
            case 'batch_annotation':
            case 'annotation_created':
            case 'annotation_modified':
            case 'annotation_deleted':
                await processBatchEvents([event]);
                break;
            case 'validation':
                await processValidationEvents([event]);
                break;
            case 'save':
                await processSaveEvents([event]);
                break;
            case 'load':
                await processLoadEvents([event]);
                break;
        }
    }
    
    clear() {
        this.queue = [];
    }
    
    size() {
        return this.queue.length;
    }
}

// Create global event queue
export const eventQueue = new EventQueue();

/**
 * Initialize event processor
 */
export function initializeEventProcessor() {
    console.log("[DEBUG] Event processor initialized");
    
    // Start processing queue periodically
    setInterval(() => {
        if (eventQueue.size() > 0) {
            eventQueue.process();
        }
    }, 1000);
}

/**
 * Cleanup event processor
 */
export function cleanupEventProcessor() {
    eventQueue.clear();
    console.log("[DEBUG] Event processor cleaned up");
}