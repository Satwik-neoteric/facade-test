// main-refactored.js - Main Application Entry Point (Refactored)
// This file replaces the original main.js with modular imports

import { initAppState } from './modules/app-state.js';
import { initUserRole, initializeUserRoles, setupBasedOnRole } from './modules/user-roles.js';
import { loadBatches, loadClasses } from './modules/data-loader.js';
import { initCanvas } from './modules/canvas-manager.js';
import { showMessage } from './modules/utilities.js';
import { setupEventHandlers, setupNotesDialogHandlers, setupFilterDialogHandlers } from './modules/event-handlers.js';

$(document).ready(function() {
    // Import image preloader
    import('./image-preloader.js').then(({ ImagePreloader }) => {
        if (!window.AppState) window.AppState = {};
        if (!window.AppState.imagePreloader) {
            window.AppState.imagePreloader = new ImagePreloader();
        }
    }).catch(error => {
        console.warn("Could not load image preloader:", error);
    });

    // Initialize the application
    async function initApp() {
        try {
            console.log("[DEBUG] Starting application initialization");
            
            // Initialize application state
            initAppState();
            
            // Set up user role information
            initUserRole();
            
            // Initialize user roles from API
            await initializeUserRoles();
            
            // Setup UI based on user role
            await setupBasedOnRole();
            
            // Load batches from CosmosDB for selection
            await loadBatches();
            
            // Load available classes
            await loadClasses();
            
            // Setup event handlers
            setupEventHandlers();
            setupNotesDialogHandlers();
            setupFilterDialogHandlers();
            
            // Initialize canvas
            initCanvas();
            
            // Flag to track the first image load
            window.AppState.isFirstImageLoad = true;
            
            // Initialize validation module
            import('./validation.js').then(({ initValidation }) => {
                if (initValidation) {
                    initValidation();
                    console.log("[DEBUG] Validation module initialized");
                }
            }).catch(error => {
                console.error("[DEBUG] Error loading validation module:", error);
            });
            
            // Initialize filters module (only once)
            let filterModulePromise = import('./filter.js');
            window.filterModulePromise = filterModulePromise; // Store for reuse
            
            filterModulePromise.then(module => {
                if (module.initFilters) {
                    module.initFilters();
                    console.log("[DEBUG] Filters module initialized");
                    
                    // Store filter functions globally
                    window.filterModule = {
                        initFilters: module.initFilters,
                        openFilterDialog: module.openFilterDialog,
                        closeFilterDialog: module.closeFilterDialog,
                        applyFilters: module.applyFilters,
                        resetFilters: module.resetFilters
                    };
                } else {
                    console.warn("[DEBUG] initFilters function not found in filter.js");
                }
            }).catch(error => {
                console.error("[DEBUG] Error loading filters module:", error);
            });
            
            console.log("[DEBUG] Application initialization completed successfully");
            
        } catch (error) {
            console.error("Error initializing app:", error);
            showMessage("Error initializing application. See console for details.", "error");
        }
    }

    // Start the application
    initApp();
});

// Export functions that need to be globally accessible
window.initApp = initApp;

// Make the modules available globally for backward compatibility
// This allows existing code to continue working while we refactor
window.modules = {
    appState: null,
    userRoles: null,
    dataLoader: null,
    canvasManager: null,
    utilities: null
};

// Load modules dynamically and make them available globally
Promise.all([
    import('./modules/app-state.js'),
    import('./modules/user-roles.js'),
    import('./modules/data-loader.js'),
    import('./modules/canvas-manager.js'),
    import('./modules/utilities.js'),
    import('./modules/batch-manager.js'),
    import('./modules/annotation-manager.js'),
    import('./modules/data-converter.js'),
    import('./modules/event-handlers.js')
]).then(([appState, userRoles, dataLoader, canvasManager, utilities, batchManager, annotationManager, dataConverter, eventHandlers]) => {
    window.modules.appState = appState;
    window.modules.userRoles = userRoles;
    window.modules.dataLoader = dataLoader;
    window.modules.canvasManager = canvasManager;
    window.modules.utilities = utilities;
    window.modules.batchManager = batchManager;
    window.modules.annotationManager = annotationManager;
    window.modules.dataConverter = dataConverter;
    window.modules.eventHandlers = eventHandlers;
    
    console.log("[DEBUG] All modules loaded and available globally");
}).catch(error => {
    console.error("[DEBUG] Error loading modules:", error);
});

// Placeholder functions for functions that will be moved to modules later
// These will be removed as we complete the refactoring

async function handleBatchSelection(batchId) {
    console.log(`[DEBUG] Batch selected: ${batchId}`);
    // This function will be moved to batch-manager.js module
    // For now, keep the existing functionality
    if (window.handleBatchSelection) {
        return window.handleBatchSelection(batchId);
    }
}

// Additional placeholder functions will be added here as needed
// during the refactoring process