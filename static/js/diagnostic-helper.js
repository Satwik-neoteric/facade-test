/**
 * Diagnostic Helper - Tools to identify and fix route issues
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create diagnostic controls
    console.log('Diagnostic helper initialized');
    
    // Add UI diagnostic elements to the page
    function addDiagnosticTools() {
        // Check if we're on the index/home page
        if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
            console.log('Adding diagnostic buttons to home page');
            addHomePageDiagnostics();
        }
    }
    
    function addHomePageDiagnostics() {
        // Create a diagnostic panel
        const panel = document.createElement('div');
        panel.className = 'diagnostic-panel';
        panel.innerHTML = `
            <h3>Diagnostic Tools</h3>
            <div class="button-group">
                <button id="check-cosmos-btn" class="btn btn-sm btn-info">Check CosmosDB</button>
                <button id="check-routes-btn" class="btn btn-sm btn-info">Check Routes</button>
                <button id="test-batch-btn" class="btn btn-sm btn-info">Test Batch Images</button>
                <button id="fix-routes-btn" class="btn btn-sm btn-warning">Fix Routes</button>
            </div>
            <div id="diagnostic-output" class="mt-2 p-2 bg-light" style="max-height: 200px; overflow-y: auto; font-size: 12px;"></div>
        `;
        
        // Style the panel
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(240, 240, 240, 0.9)',
            border: '1px solid #ccc',
            borderRadius: '5px',
            padding: '10px',
            zIndex: '1000',
            maxWidth: '400px',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)'
        });
        
        // Add to DOM
        document.body.appendChild(panel);
        
        // Set up button handlers
        document.getElementById('check-cosmos-btn').addEventListener('click', checkCosmosConnection);
        document.getElementById('check-routes-btn').addEventListener('click', checkRoutes);
        document.getElementById('test-batch-btn').addEventListener('click', testBatchImages);
        document.getElementById('fix-routes-btn').addEventListener('click', fixRoutes);
    }
    
    function logDiagnostic(message) {
        const output = document.getElementById('diagnostic-output');
        if (output) {
            const line = document.createElement('div');
            line.textContent = message;
            output.appendChild(line);
            
            // Auto-scroll to bottom
            output.scrollTop = output.scrollHeight;
        }
        console.log(`[DIAGNOSTIC] ${message}`);
    }
    
    // Check CosmosDB connection
    async function checkCosmosConnection() {
        logDiagnostic('Checking CosmosDB connection...');
        
        try {
            const response = await fetch('/debug/cosmos');
            const data = await response.json();
            
            logDiagnostic(`Status: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
            logDiagnostic(`Found ${data.count || 0} records`);
            
            if (data.unique_batch_ids && data.unique_batch_ids.length > 0) {
                logDiagnostic(`Batch IDs: ${data.unique_batch_ids.join(', ')}`);
            }
        } catch (error) {
            logDiagnostic(`Error: ${error.message}`);
        }
    }
    
    // Check available routes
    async function checkRoutes() {
        logDiagnostic('Checking available routes...');
        
        try {
            const response = await fetch('/debug/route-map');
            const data = await response.json();
            
            logDiagnostic(`Found ${data.count} routes`);
            
            // Find batch and filtered-images routes
            const batchRoutes = data.routes.filter(r => r.path.includes('batch') && r.path.includes('images'));
            const filteredRoutes = data.routes.filter(r => r.path.includes('filtered-images'));
            
            logDiagnostic(`Batch image routes: ${batchRoutes.length}`);
            batchRoutes.forEach(route => {
                logDiagnostic(`- ${route.path} (${route.methods.join(',')})`);
            });
            
            logDiagnostic(`Filtered image routes: ${filteredRoutes.length}`);
            filteredRoutes.forEach(route => {
                logDiagnostic(`- ${route.path} (${route.methods.join(',')})`);
            });
        } catch (error) {
            logDiagnostic(`Error: ${error.message}`);
        }
    }
    
    // Test batch images endpoint
    async function testBatchImages() {
        logDiagnostic('Testing batch images endpoint...');
        
        try {
            // Try to get a batch ID first
            const cosmosResponse = await fetch('/debug/cosmos');
            const cosmosData = await cosmosResponse.json();
            
            if (!cosmosData.unique_batch_ids || cosmosData.unique_batch_ids.length === 0) {
                logDiagnostic('No batch IDs found in CosmosDB');
                return;
            }
            
            const batchId = cosmosData.unique_batch_ids[0];
            logDiagnostic(`Testing with batch ID: ${batchId}`);
            
            // Try api-prefixed route
            logDiagnostic(`Trying /api/batch/${batchId}/images...`);
            try {
                const apiResponse = await fetch(`/api/batch/${batchId}/images`);
                if (apiResponse.ok) {
                    const apiData = await apiResponse.json();
                    logDiagnostic(`API route SUCCESS: Found ${apiData.images?.length || 0} images`);
                } else {
                    logDiagnostic(`API route FAILED: ${apiResponse.status} ${apiResponse.statusText}`);
                }
            } catch (error) {
                logDiagnostic(`API route ERROR: ${error.message}`);
            }
            
            // Try non-prefixed route
            logDiagnostic(`Trying /batch/${batchId}/images...`);
            try {
                const response = await fetch(`/batch/${batchId}/images`);
                if (response.ok) {
                    const data = await response.json();
                    logDiagnostic(`Route SUCCESS: Found ${data.images?.length || 0} images`);
                } else {
                    logDiagnostic(`Route FAILED: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                logDiagnostic(`Route ERROR: ${error.message}`);
            }
            
            // Try direct route
            logDiagnostic(`Trying /direct-batch/${batchId}/images...`);
            try {
                const directResponse = await fetch(`/direct-batch/${batchId}/images`);
                if (directResponse.ok) {
                    const directData = await directResponse.json();
                    logDiagnostic(`Direct route SUCCESS: Found ${directData.images?.length || 0} images`);
                } else {
                    logDiagnostic(`Direct route FAILED: ${directResponse.status} ${directResponse.statusText}`);
                }
            } catch (error) {
                logDiagnostic(`Direct route ERROR: ${error.message}`);
            }
        } catch (error) {
            logDiagnostic(`Overall test error: ${error.message}`);
        }
    }
    
    // Fix route issues by updating the client-side route helper
    async function fixRoutes() {
        logDiagnostic('Fixing route issues...');
        
        // Check which routes are working first
        try {
            const response = await fetch('/debug/route-map');
            if (!response.ok) {
                logDiagnostic('Could not get route map');
                return;
            }
            
            const data = await response.json();
            
            // Look for working routes
            const batchRoutes = data.routes.filter(r => r.path.includes('batch') && r.path.includes('images'));
            const filteredRoutes = data.routes.filter(r => r.path.includes('filtered-images'));
            
            // Find the first working batch route
            let workingBatchRoute = null;
            for (const route of batchRoutes) {
                logDiagnostic(`Testing ${route.path}...`);
                try {
                    // Extract parameters from path
                    const batchIdParam = route.path.includes('{batch_id}') ? 'B2' : 
                                         route.path.includes('{batchId}') ? 'B2' : 'B2';
                    
                    const testPath = route.path.replace('{batch_id}', batchIdParam)
                                              .replace('{batchId}', batchIdParam);
                    
                    const testResponse = await fetch(testPath);
                    if (testResponse.ok) {
                        workingBatchRoute = route.path;
                        logDiagnostic(`Found working batch route: ${workingBatchRoute}`);
                        break;
                    }
                } catch (error) {
                    // Ignore errors and continue testing
                }
            }
            
            // Find the first working filtered images route
            let workingFilteredRoute = null;
            for (const route of filteredRoutes) {
                logDiagnostic(`Testing ${route.path}...`);
                try {
                    const testResponse = await fetch(route.path, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ batchId: 'B2' })
                    });
                    
                    if (testResponse.ok) {
                        workingFilteredRoute = route.path;
                        logDiagnostic(`Found working filtered route: ${workingFilteredRoute}`);
                        break;
                    }
                } catch (error) {
                    // Ignore errors and continue testing
                }
            }
            
            // Update RouteHelper with working routes
            if (window.RouteHelper) {
                logDiagnostic('Updating RouteHelper with working routes...');
                
                if (workingBatchRoute) {
                    // Replace {batch_id} with {batchId} for consistency
                    const normalizedRoute = workingBatchRoute.replace('{batch_id}', '{batchId}');
                    window.RouteHelper.routes.batchImages = normalizedRoute;
                    logDiagnostic(`Set batchImages route to: ${normalizedRoute}`);
                }
                
                if (workingFilteredRoute) {
                    window.RouteHelper.routes.filteredImages = workingFilteredRoute;
                    logDiagnostic(`Set filteredImages route to: ${workingFilteredRoute}`);
                }
                
                logDiagnostic('RouteHelper updated!');
            } else {
                logDiagnostic('RouteHelper not available - cannot update routes');
            }
        } catch (error) {
            logDiagnostic(`Error fixing routes: ${error.message}`);
        }
    }
    
    // Initialize
    addDiagnosticTools();
});
