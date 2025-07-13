/**
 * Route Helper - Support for direct route access
 * Helps with API route compatibility between ASP.NET and FastAPI implementations
 */

// Create a helper singleton for handling routes
window.RouteHelper = {
    // Default routes
    routes: {
        batchImages: '/api/batch/{batchId}/images',   // First try API-prefixed route
        filteredImages: '/api/filtered-images',        // First try API-prefixed route
        annotations: '/api/annotations'
    },
    
    // Fallback routes (if primary fails)
    fallbacks: {
        batchImages: [
            '/batch/{batchId}/images',           // Try non-API prefixed route
            '/direct-batch/{batchId}/images'     // Try direct-prefixed route
        ],
        filteredImages: [
            '/filtered-images',                  // Try non-API prefixed route  
            '/direct-filtered-images'            // Try direct-prefixed route
        ],
        annotations: [
            '/annotations',
            '/api/annotation' // Singular version (common mistake)
        ]
    },
    
    // Get URL for batch images
    getBatchImagesUrl: function(batchId) {
        return this.routes.batchImages.replace('{batchId}', batchId);
    },
    
    // Fetch with fallback support
    fetchWithFallback: async function(routeKey, options = {}, pathParams = {}) {
        // Get the primary route
        let url = this.routes[routeKey];
        
        // Replace any path parameters
        if (pathParams) {
            Object.keys(pathParams).forEach(key => {
                url = url.replace(`{${key}}`, pathParams[key]);
            });
        }
        
        console.log(`Trying primary route: ${url}`);
        
        try {
            // Try the primary route first
            const response = await fetch(url, options);
            
            if (response.ok) {
                console.log(`Primary route ${url} succeeded`);
                return await response.json();
            }
            
            console.warn(`Primary route ${url} failed with status ${response.status}`);
            
            // Try fallbacks if available
            if (this.fallbacks[routeKey] && this.fallbacks[routeKey].length > 0) {
                for (const fallbackUrl of this.fallbacks[routeKey]) {
                    // Replace any path parameters in the fallback URL
                    let processedFallbackUrl = fallbackUrl;
                    if (pathParams) {
                        Object.keys(pathParams).forEach(key => {
                            processedFallbackUrl = processedFallbackUrl.replace(`{${key}}`, pathParams[key]);
                        });
                    }
                    
                    console.log(`Trying fallback route: ${processedFallbackUrl}`);
                    
                    try {
                        const fallbackResponse = await fetch(processedFallbackUrl, options);
                        
                        if (fallbackResponse.ok) {
                            console.log(`Fallback route ${processedFallbackUrl} succeeded`);
                            // If a fallback works, update the primary route for future requests
                            this.routes[routeKey] = fallbackUrl;
                            return await fallbackResponse.json();
                        }
                    } catch (fallbackError) {
                        console.warn(`Fallback route ${processedFallbackUrl} failed:`, fallbackError);
                    }
                }
            }
            
            // If we got here, none of the fallbacks worked either
            throw new Error(`All routes failed for ${routeKey}`);
        } catch (error) {
            console.error(`Error in fetchWithFallback for ${routeKey}:`, error);
            throw error;
        }
    },
    
    // Get batch images with fallback support
    getBatchImages: async function(batchId) {
        return await this.fetchWithFallback('batchImages', {}, { batchId });
    },
    
    // Get filtered images with fallback support
    getFilteredImages: async function(filterPayload) {
        return await this.fetchWithFallback('filteredImages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filterPayload)
        });
    }
};

// Document ready handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('Route Helper initialized');
    
    // Check for route compatibility by making a call to the route map endpoint
    fetch('/debug/route-map')
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('Route map endpoint not available');
        })
        .then(data => {
            console.log('Available routes:', data);
            
            // Look for the most reliable routes
            const routeMap = {};
            data.routes.forEach(route => {
                const path = route.path.toLowerCase();
                
                if (path.includes('batch') && path.includes('images')) {
                    routeMap.batchImages = route.path;
                }
                
                if (path.includes('filtered-images')) {
                    routeMap.filteredImages = route.path;
                }
            });
            
            console.log('Route map:', routeMap);
            
            // Update routes if better ones found
            if (routeMap.batchImages) {
                // Regex to capture (anything up to and including '/batch/') then (the batchId part) then ('/images')
                // Replaces the batchId part with '{batchId}'
                const genericPath = routeMap.batchImages.replace(/^(.*\/batch\/)(?:[^\/]+|\{[^}]+\})(\/images.*)$/, '$1{batchId}$2');
                console.log(`Using batch images route: ${genericPath}`);
                window.RouteHelper.routes.batchImages = genericPath;
            }
            
            if (routeMap.filteredImages) {
                console.log(`Using filtered images route: ${routeMap.filteredImages}`);
                window.RouteHelper.routes.filteredImages = routeMap.filteredImages;
            }
        })
        .catch(error => {
            console.warn('Route map check failed:', error);
        });
});
