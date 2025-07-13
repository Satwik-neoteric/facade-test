// debug-helper.js - Helps diagnose issues with Facade Studio
// Provides console output for troubleshooting

console.log('[DEBUG] Debug helper loaded');

// Function to debug batch loading
function debugBatchLoading() {
    console.log('[DEBUG] Testing batch loading functionality');
    
    // Test the API endpoint directly
    fetch('/api/batches')
        .then(response => {
            console.log('[DEBUG] Batch API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('[DEBUG] Batch API response data:', data);
        })
        .catch(error => {
            console.error('[DEBUG] Batch API error:', error);
        });
}

// Function to debug CosmosDB connectivity
function debugCosmosConnectivity() {
    console.log('[DEBUG] Testing CosmosDB connectivity');
    
    // Test the health endpoint
    fetch('/health')
        .then(response => {
            console.log('[DEBUG] Health API response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('[DEBUG] Health API response data:', data);
        })
        .catch(error => {
            console.error('[DEBUG] Health API error:', error);
        });
}

// Debug state management
function debugStateManagement() {
    console.log('[DEBUG] Current AppState:', window.AppState);
    
    if (window.AppState) {
        console.log('[DEBUG] Current batch:', window.AppState.currentBatch);
        console.log('[DEBUG] Current image:', window.AppState.currentImage);
        console.log('[DEBUG] Classes loaded:', window.AppState.classes);
    } else {
        console.warn('[DEBUG] AppState not found');
    }
}

// Debug DOM elements
function debugDomElements() {
    const criticalElements = [
        'batch-selector',
        'image-list',
        'annotation-canvas',
        'batch-selection-container',
        'submit-btn',
        'skip-btn',
        'delete-btn'
    ];
    
    console.log('[DEBUG] Checking critical DOM elements');
    
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`[DEBUG] Element '${id}': ${element ? 'Found' : 'MISSING'}`);
    });
}

// Run debug tests on page load
document.addEventListener('DOMContentLoaded', function() {
    // Delay to allow other scripts to initialize
    setTimeout(() => {
        console.log('[DEBUG] Running diagnostic tests');
        debugDomElements();
        
        // Only run API tests if AppState exists
        if (window.AppState) {
            debugStateManagement();
            debugBatchLoading();
            debugCosmosConnectivity();
        }
    }, 1000);
});

// Make debug functions available globally
window.debugBatchLoading = debugBatchLoading;
window.debugCosmosConnectivity = debugCosmosConnectivity;
window.debugStateManagement = debugStateManagement;
window.debugDomElements = debugDomElements;
