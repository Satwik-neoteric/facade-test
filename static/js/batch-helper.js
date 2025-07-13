/**
 * Batch Helper - Fixes issues with batch loading and processing for FastAPI version
 */

// Override the loadBatches function to correctly handle the batch API response
async function loadBatchesFixed() {
    console.log("Starting fixed loadBatches function");
    try {
        // First, check connectivity with debug endpoint
        console.log("Checking CosmosDB connection with debug endpoint");
        try {
            const debugResponse = await fetch('/debug/cosmos');
            const debugData = await debugResponse.json();
            console.log("CosmosDB Connection Debug:", debugData);
            
            // Direct batch loading for debugging
            if (debugData.unique_batch_ids && debugData.unique_batch_ids.length > 0) {
                console.log("Found batch IDs in debug endpoint:", debugData.unique_batch_ids);
            }
        } catch (debugError) {
            console.warn("Debug endpoint check failed:", debugError);
        }
          console.log("Fetching batches from /api/batches endpoint");
        const response = await fetch('/api/batches');
        console.log("Response received:", response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Error loading batches: ${response.statusText}`);
        }
        
        // Get the response data and handle potential JSON parsing errors
        let data;
        try {
            data = await response.json();
            console.log("Loaded batches data:", data);
        } catch (jsonError) {
            console.error("Error parsing JSON response:", jsonError);
            // Return empty data to prevent further errors
            data = { batches: [] };
        }
          // Extract batch IDs - handle various response formats
        let batchIds = [];
        if (Array.isArray(data)) {
            // Direct array of batch objects
            console.log("Response is an array, extracting BatchID properties");
            batchIds = data.map(batch => batch.BatchID || batch.batchId || batch.batch_id || batch.id);
        } else if (data && Array.isArray(data.batches)) {
            // Standard {batches:[...]} format with array
            console.log("Response has 'batches' array property");
            batchIds = data.batches;
        } else if (data && data.batches) {
            // Handle case where batches might not be an array
            console.log("Response has 'batches' non-array property, converting to array");
            try {
                batchIds = [].concat(data.batches);
            } catch (e) {
                console.error("Failed to convert batches to array:", e);
                batchIds = [];
            }
        } else if (data && data.batch_ids) {
            // Alternative property name
            console.log("Response has 'batch_ids' property");
            batchIds = data.batch_ids;
        }
        
        if (!batchIds || batchIds.length === 0) {
            console.warn("No batches found in CosmosDB");
            $('#image-list').empty().append('<li class="image-placeholder">No batches found</li>');
            return;
        }
        
        // Populate batch selector dropdown
        const batchSelector = $('#batch-selector');
        batchSelector.empty();
        
        // If more than one batch, add "Select Batch" option, otherwise select the only batch automatically
        if (batchIds.length > 1) {
            batchSelector.append('<option value="">Select Batch</option>');
            
            batchIds.forEach(batchId => {
                batchSelector.append(`<option value="${batchId}">${batchId}</option>`);
            });
            
            // Update the images panel text for multiple batches
            $('#image-list').empty().append('<li class="image-placeholder">Select Batch</li>');
        } else {
            // Only one batch - add it and select it automatically
            const singleBatch = batchIds[0];
            batchSelector.append(`<option value="${singleBatch}" selected>${singleBatch}</option>`);
            
            // Auto-select this batch
            console.log("[DEBUG] Auto-selecting the only batch:", singleBatch);
            if (typeof showMessage === 'function') {
                showMessage(`Auto-selecting batch: ${singleBatch}`, "info");
            } else {
                console.log(`Auto-selecting batch: ${singleBatch}`);
            }
            
            // Trigger batch selection handler
            setTimeout(() => {
                if (typeof handleBatchSelection === 'function') {
                    handleBatchSelection(singleBatch);
                } else if (typeof window.AppState !== 'undefined' && 
                           typeof window.AppState.handleBatchSelection === 'function') {
                    window.AppState.handleBatchSelection(singleBatch);
                } else {
                    console.warn("handleBatchSelection function not found");
                    // Fallback - try to simulate batch selection
                    batchSelector.val(singleBatch).trigger('change');
                }
            }, 100);
        }
        
        // Show batch selection UI
        $('#batch-selection-container').show();
        
    } catch (error) {
        console.error("Error loading batches:", error);
        if (typeof showMessage === 'function') {
            showMessage("Error loading batches. See console for details.", "error");
        }
        $('#image-list').empty().append('<li class="image-placeholder">Error loading batches</li>');
    }
}

// Wait for document ready and then patch the original loadBatches function
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content loaded - checking for loadBatches to patch");
    
    // Direct function overriding regardless of scope
    // This is more aggressive but ensures the function is patched
    window.loadBatches = loadBatchesFixed;
    
    // Define initApp if it doesn't exist - will be used by our module
    if (typeof window.initApp !== 'function') {
        window.initApp = async function() {
            console.log("Running initApp from batch-helper");
            await loadBatchesFixed();
            console.log("Batch loading completed from initApp");
        };
    }
    
    // Check if the original loadBatches function exists on window.AppState
    if (window.AppState) {
        console.log("AppState found, patching loadBatches immediately");
        window.AppState.loadBatches = loadBatchesFixed;
        
        // Also add initApp to AppState if it doesn't exist
        if (typeof window.AppState.initApp !== 'function') {
            window.AppState.initApp = window.initApp;
        }
    }
    
    // Try to patch it after a small delay in case AppState is initialized later
    setTimeout(() => {
        console.log("Delayed patch attempt - rechecking for loadBatches function");
        if (window.AppState) {
            console.log("AppState found after delay, patching loadBatches");
            window.AppState.loadBatches = loadBatchesFixed;
            
            // Also add initApp to AppState if it doesn't exist
            if (typeof window.AppState.initApp !== 'function') {
                window.AppState.initApp = window.initApp;
            }
            
            // Trigger batch loading directly
            loadBatchesFixed().then(() => {
                console.log("Batch loading completed from delayed patch");
            });
        }
    }, 1000);
    
    // Try calling loadBatchesFixed directly if jQuery is available
    if (typeof $ !== 'undefined' && $('#batch-selector').length) {
        console.log("jQuery and batch selector found, loading batches directly");
        loadBatchesFixed();
    }
});
