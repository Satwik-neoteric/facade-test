// app-state.js - Application State Management
// Centralizes all application state and makes it globally accessible

/**
 * Initialize and manage global application state
 */
export function initAppState() {
    // Global state management
    const AppState = {
        currentImage: null,
        currentBatch: null,
        currentImageId: null,
        annotations: [],
        classes: [],
        validationStatus: "",
        fabricInitialized: false,
        canvasInitialized: false,
        loading: false,
        fabricCanvas: null,
        // Drawing state variables
        currentMode: 'select', // 'select', 'polygon', 'rectangle', etc.
        currentClass: null,
        drawingPoints: [],
        isDrawing: false,
        currentPolygon: null,
        polygonMode: false,
        polyPoints: [],
        linePoints: [],
        activeLine: null,
        activeShape: null,
        activePolygon: null,
        originalPolygonState: null,
        originalImagePoints: null,
        // Elements cache
        elements: {
            submitBtn: document.getElementById('submit-btn'),
            deleteBtn: document.getElementById('delete-btn'),
            skipBtn: document.getElementById('skip-btn'),
            acceptBtn: document.getElementById('accept-btn'),
            rejectBtn: document.getElementById('reject-btn'),
            modeStatus: document.getElementById('mode-status'),
            zoomStatus: document.getElementById('zoom-status')
        },
        // Validation state
        editHandles: [],
        isMovingHandle: false, // Add this flag
        logEntries: [],
        // Annotation visibility state
        annotationsHidden: false,
        // Simple navigation throttling
        navigationThrottle: {
            lastAction: 0,
            minInterval: 200 // Simple throttling to prevent abuse
        },
        // Debounced loading for rapid skips
        debouncedLoading: {
            timeoutId: null,
            delay: 2000, // Wait 2 seconds after last skip before loading image
            isSkipLoad: false, // Flag to track if current load is from skip operation
            expectedImageId: null // Track the expected image to prevent race conditions
        },
        // Global expected image tracking for all loads (prevents any race conditions)
        expectedImageId: null,
        // Unique load ID system to prevent any race conditions
        currentLoadId: 0,
        expectedLoadId: null,
        // User information
        user: {
            name: 'User1',
            role: 'Default Admin', // 'Default Admin' or 'Reviewer'
            canLabel: true,
            canValidate: true
        },
        // Flag to track the first image load
        isFirstImageLoad: true,
        // Object ID counter for annotations
        nextObjectId: 1,
        // Image scaling and dimension tracking
        currentScale: 1,
        originalImageWidth: null,
        originalImageHeight: null
    };
    
    // Make AppState globally accessible for modules
    window.AppState = AppState;
    
    // Make state and elements available for module imports (instead of export)
    window.state = window.AppState;
    window.elements = window.AppState.elements;
    
    console.log("[DEBUG] Application state initialized");
    return AppState;
}

/**
 * Get the current application state
 */
export function getAppState() {
    return window.AppState || initAppState();
}

/**
 * Update a specific property in the application state
 */
export function updateAppState(key, value) {
    if (!window.AppState) {
        initAppState();
    }
    window.AppState[key] = value;
}

/**
 * Reset application state to initial values
 */
export function resetAppState() {
    return initAppState();
}

/**
 * Get elements cache from state
 */
export function getElements() {
    return window.AppState?.elements || {};
}