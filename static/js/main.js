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
        expectedLoadId: null
    };
    
    // Make AppState globally accessible for modules
    window.AppState = AppState;
    
    // Make state and elements available for module imports (instead of export)
    window.state = window.AppState;
    window.elements = window.AppState.elements;
    
    // Utility function to throttle navigation actions
    function canNavigate() {
        const now = Date.now();
        const timeSinceLastAction = now - AppState.navigationThrottle.lastAction;
        
        if (timeSinceLastAction < AppState.navigationThrottle.minInterval) {
            console.log(`[DEBUG] Navigation throttled. ${AppState.navigationThrottle.minInterval - timeSinceLastAction}ms remaining`);
            return false;
        }
        
        AppState.navigationThrottle.lastAction = now;
        return true;
    }
    
    // Initialize the application
    async function initApp() {
        try {
            // Set up user role information
            initUserRole();
            
            // Load batches from CosmosDB for selection
            await loadBatches();
            
            // Load available classes
            await loadClasses();
            
            // Setup event handlers
            setupEventHandlers();
            
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
            });            // Initialize filters module (only once)
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
            
        } catch (error) {
            console.error("Error initializing app:", error);
            showMessage("Error initializing application. See console for details.", "error");
        }
    }
    
    initApp();
    
    // Initialize user role information
    function initUserRole() {
        // Set default user data in AppState
        window.AppState.user = {
            name: 'User1',
            role: 'Default Admin', // 'Default Admin' or 'Reviewer'
            canLabel: true,
            canValidate: true
        };
        
        // Check if user is a Reviewer
        const isReviewer = window.AppState.user.role === 'Reviewer';
        
        // Set toggle state and options based on role
        const modeToggle = $('#mode-toggle-switch');
        
        if (isReviewer) {
            // Reviewers should only see Validate state
            modeToggle.prop('checked', true); // Set to Validate state
            modeToggle.prop('disabled', true); // Disable the toggle
            
            // Hide label-only buttons
            $('#submit-btn').hide();
            $('#delete-btn').hide();
            
            // Show validation buttons
            $('#accept-btn').show();
            $('#reject-btn').show();
            $('#skip-btn').addClass('validation-btn');
            
            // Set app state to validation mode
            toggleValidationMode(true);
            
            console.log('[DEBUG] User is a Reviewer, validation mode enabled by default');
        } else {
            // Default to Label state for Admin and other roles
            modeToggle.prop('checked', false); // Set to Label state
            modeToggle.prop('disabled', false); // Enable the toggle
            
            // Show label buttons
            $('#submit-btn').show();
            $('#delete-btn').show();
            
            // Hide validation buttons
            $('#accept-btn').hide();
            $('#reject-btn').hide();
            
            console.log('[DEBUG] User is Admin, label mode enabled by default');
        }
    }
    
    async function loadBatches() {
        try {
            const response = await fetch('/api/batches');
            if (!response.ok) {
                throw new Error(`Error loading batches: ${response.statusText}`);
            }
            
            const data = await response.json();
            const batches = data.batches || [];
            
            if (batches.length === 0) {
                console.warn("No batches found in CosmosDB");
                return;
            }
            
            // Populate batch selector dropdown
            const batchSelector = $('#batch-selector');
            batchSelector.empty();
            
            // If more than one batch, add "Select Batch" option, otherwise select the only batch automatically
            if (batches.length > 1) {
                batchSelector.append('<option value="">Select Batch</option>');
                
                batches.forEach(batch => {
                    batchSelector.append(`<option value="${batch}">${batch}</option>`);
                });
                
                // Update the images panel text for multiple batches
                $('#image-list').empty().append('<li class="image-placeholder">Select Batch</li>');
            } else {
                // Only one batch - add it and select it automatically
                const singleBatch = batches[0];
                batchSelector.append(`<option value="${singleBatch}" selected>${singleBatch}</option>`);
                
                // Auto-select this batch
                console.log("[DEBUG] Auto-selecting the only batch:", singleBatch);
                showMessage(`Auto-selecting batch: ${singleBatch}`, "info");
                
                // Trigger batch selection handler
                setTimeout(() => {
                    handleBatchSelection(singleBatch);
                }, 100);
            }
            
            // Show batch selection UI
            $('#batch-selection-container').show();
            
        } catch (error) {
            console.error("Error loading batches:", error);
            showMessage("Error loading batches. See console for details.", "error");
        }
    }
      // Load class information from the server
    async function loadClasses() {
        try {
            const response = await fetch('/api/classes');
            if (!response.ok) {
                throw new Error(`Error loading classes: ${response.statusText}`);
            }
            
            // Handle potential JSON parsing errors
            let data;
            try {
                data = await response.json();
                window.AppState.classes = data.classes || [];
                console.log("Loaded classes:", window.AppState.classes);
            } catch (jsonError) {
                console.error("Error parsing JSON response:", jsonError);
                throw jsonError; // Re-throw to use default classes
            }
            
        } catch (error) {
            console.error("Error loading classes:", error);
            showMessage("Error loading class definitions. Using defaults.", "warning");
            
            // Use default classes if API fails
            window.AppState.classes = [
                'Short-Gasket', 'Defective-Mastic', 'Glazing-Defects', 
                'Stonework-Faults', 'Stonework-Fracture', 'Cladding-Disengaged', 
                'Mechanical-Faults', 'Gaskets-Disengaged', 'WindowPane-Mask', 
                'Human-Mask', 'Privacy-Mask'
            ];
        }
    }
    
    // Handler for batch selection
    async function handleBatchSelection(batchId) {
        if (!batchId) return;
        
        try {
            // Clear image cache when switching batches
            if (window.AppState.imagePreloader) {
                window.AppState.imagePreloader.clearCache();
            }
            
            // Save current batch ID in application state
            window.AppState.currentBatch = batchId;
            
            // Show loading indicator
            $('#image-list').html('<li class="loading">Loading images...</li>');
              // Initialize filter state with default values (hide deleted images)
            import('./filter.js').then(module => {
                if (module.resetFilters) {
                    // Reset filters and initialize default filter state
                    module.resetFilters();
                }
            }).catch(error => {
                console.warn("[DEBUG] Could not reset filters:", error);
            });
            
            // Fetch images for this batch using filter API instead of direct batch API
            // This ensures consistent filtering behavior when batch is first loaded
            try {
                const filterPayload = {
                    batchId: batchId,
                    showDeleted: false, // Default to hiding deleted images
                    hasAnnotations: true, // Default to showing images with annotations
                    unlabelledOnly: false // Default to showing all images
                };

                // Directly use the known working endpoint
                const endpoint = '/api/filtered-images'; // MODIFIED: Added /api prefix
                console.log(`Attempting to fetch from ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(filterPayload)
                });

                if (!response.ok) {
                    throw new Error(`Error loading filtered images from ${endpoint}: ${response.statusText} (Status: ${response.status})`);
                }

                const filteredImages = await response.json();
                displayBatchImages(filteredImages, batchId);

            } catch (filterError) {
                console.error("Error using filter API, falling back to direct batch API:", filterError);
                
                // Fallback to direct batch API if filter API fails
                const response = await fetch(`/api/batch/${batchId}/images`);
                if (!response.ok) {
                    throw new Error(`Error loading images: ${response.statusText} (Status: ${response.status})`);
                }
                
                const data = await response.json();
                const images = data.images || [];
                
                // Process images with client-side filtering
                displayBatchImages(images, batchId);
            }
            
        } catch (error) {
            console.error("Error loading batch:", error);
            $('#image-list').html('<li class="error">Error loading images</li>');
            showMessage(`Error loading batch: ${error.message}`, "error");
        }
    }
    
    // Helper function to process images response data
    function processImagesResponse(data) {
        // Check if data is an array (direct images format) or object with images property
        const images = Array.isArray(data) ? data : (data && data.images ? data.images : []);
        
        // Process the images with batch filtering
        displayBatchImages(images, window.AppState.currentBatch);
    }

    // Helper function to display batch images after filtering
    function displayBatchImages(imagesData, batchId) { // Renamed 'images' to 'imagesData'
        if (!imagesData || imagesData.length === 0) {
            $('#image-list').html('<li class="empty">No images found in this batch</li>');
            return;
        }

        let standardizedImages = [];
        if (imagesData.every(img => typeof img === 'string')) {
            console.log("[DEBUG] displayBatchImages: Standardizing data from fallback GET API (array of strings)");
            standardizedImages = imagesData.map(imagePathString => {
                const filename = imagePathString.split('/').pop();
                const lastDotIndex = filename.lastIndexOf('.');
                const imageId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
                return {
                    id: imageId,
                    file_name: imagePathString,
                    status: 'Not Reviewed' // Default status
                };
            });
        } else if (imagesData.every(img => typeof img === 'object' && img !== null && img.hasOwnProperty('file_name'))) {
            console.log("[DEBUG] displayBatchImages: Standardizing data from primary POST API or already processed (array of objects)");
            standardizedImages = imagesData.map(img => {
                const filename = img.file_name.split('/').pop();
                const lastDotIndex = filename.lastIndexOf('.');
                const defaultId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
                return { 
                    id: img.id || defaultId,
                    file_name: img.file_name,
                    status: img.status || 'Not Reviewed'
                    // admin_metadata: img.admin_metadata // Preserve if needed for more complex client filtering
                };
            });
        } else {
            console.error("[DEBUG] displayBatchImages: Unknown image data structure:", imagesData);
            $('#image-list').html('<li class="error">Error processing image list</li>');
            return;
        }

        // Client-side filter (defense in depth, server should ideally handle this)
        const imagesToDisplay = standardizedImages.filter(image => {
            if (image.status) {
                const status = image.status.toLowerCase();
                if (status === 'deleted' || status.includes('deleted') ||
                    status === 'remove' || status.includes('remove') ||
                    status === 'discarded') {
                    console.log(`[DEBUG] Client-side filtering out deleted image: ${image.id || image.file_name} (status: ${image.status})`);
                    return false;
                }
            }
            // Example if admin_metadata was passed through and needed for client filter:
            // if (image.admin_metadata && image.admin_metadata.Deletion_Date) {
            //     console.log(`[DEBUG] Client-side filtering out image with Deletion_Date: ${image.id || image.file_name}`);
            //     return false;
            // }
            return true;
        });

        if (standardizedImages.length > 0 && imagesToDisplay.length === 0) {
            console.log("[DEBUG] All images filtered out client-side (e.g., all marked deleted).");
            $('#image-list').html('<li class="empty">No images to display (all items may be filtered).</li>');
            return;
        }
        if (imagesToDisplay.length === 0) { // Handles case where standardizedImages was initially empty too
            $('#image-list').html('<li class="empty">No images found for this batch after processing.</li>');
            return;
        }

        $('#image-list').empty();
        
        // Store the image list for preloading
        window.AppState.currentImageList = imagesToDisplay;
        
        imagesToDisplay.forEach(image => {
            const listItem = $('<li>').addClass('image-item');
            const imageId = image.id;
            const imagePath = image.file_name;

            if (!imageId || !imagePath) {
                console.warn("[DEBUG] Image object missing id or file_name after standardization. Image data:", image);
                return; 
            }

            listItem.attr('data-image-id', imageId);
            listItem.attr('data-image-path', imagePath);

            if (image.status) {
                listItem.attr('data-status', image.status);
                const status = image.status.toLowerCase();
                if (status === 'labeled' || status === 'reviewed' || status === 'validated' ||
                    (status !== 'not reviewed' && status !== 'new')) {
                    listItem.addClass('labeled');
                }
            }

            const filename = imagePath.split('/').pop();
            listItem.text(filename);
            listItem.attr('title', imagePath);
            $('#image-list').append(listItem);
        });

        $('#batch-selection-display').text(batchId).addClass('active');
        // Batch info update can be simplified or removed if not critical path
        // For now, let's ensure it doesn't break if imagesToDisplay[0] is undefined
        const firstImageForBatchInfo = imagesToDisplay.length > 0 ? imagesToDisplay[0] : null;
        const batchInfo = (firstImageForBatchInfo && firstImageForBatchInfo.batchInfo) ? firstImageForBatchInfo.batchInfo : null;
        if (batchInfo) {
            $('#batch-info').show();
            $('#batch-info-count').text(imagesToDisplay.length); // Count of displayed images
            $('#batch-info-date').text(new Date(batchInfo.created).toLocaleDateString());
        } else {
            // If no specific batchInfo, still show the count of displayed images
            $('#batch-info').show(); // Show the container
            $('#batch-info-count').text(imagesToDisplay.length); // Display current count
            $('#batch-info-date').text('-'); // Placeholder for date
            // console.log("[DEBUG] Batch info not available on first image, displaying count only.");
        }
        
        console.log(`[DEBUG] Loaded batch ${batchId} with ${imagesToDisplay.length} images to display.`);
    }
    
    // Handle image selection
    async function handleImageSelection(imageId, imagePath) {
        if (!imageId || !imagePath) return;
        
        // Generate a unique load ID for this image selection
        const loadId = ++window.AppState.currentLoadId;
        window.AppState.expectedLoadId = loadId;
        
        console.log(`[DEBUG] Starting image load ${loadId} for: ${imageId}`);
        
        // Enhanced race condition safeguard: Check if this is still the expected image
        if (window.AppState.expectedImageId && window.AppState.expectedImageId !== imageId) {
            console.log(`[DEBUG] Ignoring outdated image load: ${imageId} (expected: ${window.AppState.expectedImageId})`);
            return;
        }
        
        // Legacy check for debounced loading as backup
        if (window.AppState.debouncedLoading.expectedImageId && 
            window.AppState.debouncedLoading.expectedImageId !== imageId) {
            console.log(`[DEBUG] Ignoring outdated debounced image load: ${imageId} (expected: ${window.AppState.debouncedLoading.expectedImageId})`);
            return;
        }
        
        try {
            window.AppState.loading = true;
            window.AppState.currentImageId = imageId;
            window.AppState.currentImage = imagePath;
            window.AppState.currentImageFilename = imagePath; // Add this to ensure filename is set for validation
            
            console.log(`[DEBUG] Starting to load image: ${imagePath} (loadId: ${loadId}, first load: ${window.AppState.isFirstImageLoad})`);
            
            // Check if this load is still expected
            if (window.AppState.expectedLoadId !== loadId) {
                console.log(`[DEBUG] Load ${loadId} cancelled - expected ${window.AppState.expectedLoadId}`);
                return;
            }
            
            // Reset zoom to 100% when switching images
            resetZoom();
            
            // Clear previous annotations immediately to prevent them from showing with a new image
            if (window.AppState.annotations && window.AppState.annotations.length > 0) {
                console.log("[DEBUG] Clearing previous annotations before loading new image");
                window.AppState.annotations.forEach(obj => {
                    window.AppState.fabricCanvas.remove(obj);
                });
                window.AppState.annotations = [];
                $('#annotation-list').empty();
            }
            
            // Show loading message
            $('#canvas-container').addClass('loading');
            
            // Load image first and wait for it to fully complete
            const imageLoadComplete = await loadImage(imagePath, loadId);
            
            // Check if this load is still expected after image loading
            if (window.AppState.expectedLoadId !== loadId) {
                console.log(`[DEBUG] Load ${loadId} cancelled after image load - expected ${window.AppState.expectedLoadId}`);
                window.AppState.loading = false;
                $('#canvas-container').removeClass('loading');
                return;
            }
            
            // Only proceed with loading annotations if the image loaded successfully
            if (!imageLoadComplete) {
                console.error("[DEBUG] Image loading failed or was incomplete, not loading annotations");
                window.AppState.loading = false;
                $('#canvas-container').removeClass('loading');
                return;
            }
            
            console.log("[DEBUG] Image loaded successfully, preparing to load annotations");
            
            // After loading image, always reset the first load flag to false
            // (this fix ensures annotations load correctly for all images)
            const wasFirstLoad = window.AppState.isFirstImageLoad;
            window.AppState.isFirstImageLoad = false;
            
            // Add a delay after image is loaded to ensure it's fully rendered
            // before attempting to load annotations
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        console.log("[DEBUG] Canvas fully rendered after image load, now loading annotations");
                        window.AppState.fabricCanvas.renderAll();
                        resolve();
                    }, wasFirstLoad ? 800 : 400); // Longer delay for first load
                });
            });
            
            // Check that we have all necessary scale information
            if (!window.AppState.currentScale || !window.AppState.originalImageWidth) {
                console.warn("[DEBUG] Missing scale information, may affect annotations");
            }
            
            console.log(`[DEBUG] Current scale: ${window.AppState.currentScale}, Original dimensions: ${window.AppState.originalImageWidth}x${window.AppState.originalImageHeight}`);
            
            // Check if this load is still expected before loading annotations
            if (window.AppState.expectedLoadId !== loadId) {
                console.log(`[DEBUG] Load ${loadId} cancelled before annotations - expected ${window.AppState.expectedLoadId}`);
                window.AppState.loading = false;
                $('#canvas-container').removeClass('loading');
                return;
            }
            
            // Now load annotations when image is definitely visible
            await loadAnnotations(imagePath, window.AppState.currentBatch, imageId);
            
            // Ensure annotations are fully rendered
            window.AppState.fabricCanvas.renderAll();
            
            // Load sensor data
            await loadSensorData(window.AppState.currentBatch, imageId);
            
            // Trigger preloading of adjacent images for better UX
            if (window.AppState.imagePreloader && window.AppState.currentImageList) {
                try {
                    const currentIndex = window.AppState.currentImageList.findIndex(img => {
                        const imgPath = typeof img === 'string' ? img : (img.path || img.image_path);
                        return imgPath === imagePath;
                    });
                    
                    if (currentIndex !== -1) {
                        // Preload adjacent images in background
                        window.AppState.imagePreloader.preloadAdjacentImages(currentIndex, window.AppState.currentImageList);
                    }
                } catch (error) {
                    console.warn("Failed to trigger image preloading:", error);
                }
            }
            
            // Remove loading indicator if still present
            $('#canvas-container').removeClass('loading');
            window.AppState.loading = false;
            
        } catch (error) {
            // Remove loading indicator
            $('#canvas-container').removeClass('loading');
            console.error("Error handling image selection:", error);
            showMessage(`Error loading image: ${imageId}`, "error");
            window.AppState.loading = false;
        }
    }
    
    // Load image from server
    async function loadImage(imagePath, loadId = null) {
        try {
            console.log(`[DEBUG] Loading image: ${imagePath} (loadId: ${loadId})`);
            
            const imageUrl = `/api/image/${imagePath}`;
            
            // Update status bar
            $('#image-name-status').text(imagePath.split('/').pop());
            
            // Clear canvas before loading new image
            clearCanvas();
            
            // Add loading indicator
            $('#canvas-container').addClass('loading');
            
            // Wait for the next animation frame to ensure the canvas container is fully rendered
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Check if this load is still expected
            if (loadId && window.AppState.expectedLoadId !== loadId) {
                console.log(`[DEBUG] Load ${loadId} cancelled during setup - expected ${window.AppState.expectedLoadId}`);
                $('#canvas-container').removeClass('loading');
                return false;
            }
            
            // Create a pre-loaded image to check if it loads successfully
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Set cross-origin before src
            let imageLoaded = false;
            
            // Create a promise to handle image loading
            const imageLoadPromise = new Promise((resolve, reject) => {
                img.onload = function() {
                    imageLoaded = true;
                    resolve(img);
                };
                img.onerror = function() {
                    reject(new Error(`Failed to load image: ${imagePath}`));
                };
                // Remove cache buster since we now have proper server-side caching
                img.src = imageUrl;
            });
            
            // Add a timeout for the image loading (increased for larger images)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    if (!imageLoaded) {
                        reject(new Error("Image loading timed out (60 seconds)"));
                    }
                }, 60000); // Increased to 60 seconds timeout
            });
            
            // Wait for image to load or timeout
            const loadedImg = await Promise.race([imageLoadPromise, timeoutPromise]);
            
            // Use fabric.js to directly load the image instead of double loading
            return new Promise((resolve) => {
                // Check if image is already in preloader cache
                const cachedImg = window.AppState.imagePreloader?.getCachedImage(imagePath);
                const srcToUse = cachedImg ? cachedImg.src : img.src;
                
                fabric.Image.fromURL(srcToUse, function(fabricImg) {
                    // Check if this load is still expected before proceeding
                    if (loadId && window.AppState.expectedLoadId !== loadId) {
                        console.log(`[DEBUG] Load ${loadId} cancelled in fabric callback - expected ${window.AppState.expectedLoadId}`);
                        $('#canvas-container').removeClass('loading');
                        resolve(false);
                        return;
                    }
                    
                    // Remove loading indicator
                    $('#canvas-container').removeClass('loading');
                    
                    // Wait for the image to fully load before calculating dimensions
                    if (!fabricImg.width || !fabricImg.height) {
                        console.error("Image dimensions not available");
                        showMessage("Error loading image dimensions", "error");
                        resolve(false);
                        return;
                    }
                    
                    // Get the canvas container dimensions - use the parent of canvas-wrapper for accurate sizing
                    const canvasContainer = $('#canvas-container');
                    const containerWidth = canvasContainer.width();
                    const containerHeight = canvasContainer.height() - $('#status-bar').outerHeight();
                    
                    console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);
                    console.log(`Image dimensions: ${fabricImg.width}x${fabricImg.height}`);
                    
                    // Store original image dimensions
                    window.AppState.originalImageWidth = fabricImg.width;
                    window.AppState.originalImageHeight = fabricImg.height;
                    
                    // Calculate scaling to maximize the image in the available space
                    // while maintaining aspect ratio
                    const scaleX = containerWidth / fabricImg.width;
                    const scaleY = containerHeight / fabricImg.height;
                    const scale = Math.min(scaleX, scaleY);
                    
                    // Set the canvas size to match the scaled image dimensions
                    const displayWidth = Math.floor(fabricImg.width * scale);
                    const displayHeight = Math.floor(fabricImg.height * scale);
                    
                    console.log(`Display dimensions: ${displayWidth}x${displayHeight}, Scale: ${scale}`);
                    
                    // Set canvas dimensions
                    window.AppState.fabricCanvas.setWidth(displayWidth);
                    window.AppState.fabricCanvas.setHeight(displayHeight);
                    window.AppState.currentScale = scale;
                    
                    // Set image as background and ensure we wait for the callback to complete
                    window.AppState.fabricCanvas.setBackgroundImage(fabricImg, function() {
                        // After background is set, make sure canvas is correctly positioned
                        centerCanvas();
                        
                        // Load metadata asynchronously without blocking image display
                        loadMetadata(imagePath).catch(error => {
                            console.warn("Failed to load metadata:", error);
                        });
                        
                        console.log(`Image loaded with scale: ${scale}, dimensions: ${displayWidth}x${displayHeight}`);
                        // Note: "Image loaded" message is now shown by higher-level functions with proper race condition checks
                        
                        // Ensure multiple render calls to fully initialize canvas with new image
                        window.AppState.fabricCanvas.renderAll();
                        
                        // Wait for browser to fully render before resolving
                        setTimeout(() => {
                            window.AppState.fabricCanvas.renderAll();
                            resolve(true);
                        }, 50);
                    }, {
                        scaleX: scale,
                        scaleY: scale,
                        originX: 'left',
                        originY: 'top'
                    });
                }, { crossOrigin: 'anonymous' }); // Enable cross-origin image loading
            });
        } catch (error) {
            // Remove loading indicator
            $('#canvas-container').removeClass('loading');
            console.error("Error loading image:", error);
            showMessage("Error loading image. Please try again or select a different image.", "error");
            return false;
        }
    }

    // Replace or modify the existing loadImage function to delegate to label.js

    // function loadImage(imageId) {
    //     // Check if label.js loadImage is available
    //     if (window.labelJsFunctions && window.labelJsFunctions.loadImage) {
    //         console.log('[DEBUG] Delegating loadImage to label.js');
    //         return window.labelJsFunctions.loadImage(imageId);
    //     } else if (window.loadImageFromLabel) {
    //         console.log('[DEBUG] Using loadImageFromLabel from label.js');
    //         return window.loadImageFromLabel(imageId);
    //     } else {
    //         console.warn('[WARN] Label.js loadImage not available, using fallback');
    //         // Fallback implementation or error
    //         throw new Error('Label.js loadImage function not available');
    //     }
    // }

    // Update mainJsFunctions to point to label.js
    window.mainJsFunctions = window.mainJsFunctions || {};
    window.mainJsFunctions.loadImage = function(imageId) {
        return window.labelJsFunctions.loadImage(imageId);
    };
    
    // Load sensor data from CosmosDB
    async function loadSensorData(batchId, imageId) {
        if (!batchId || !imageId) return;
        
        try {
            const response = await fetch(`/api/sensor/${imageId}?batch_id=${batchId}&image_id=${imageId}`);
            if (!response.ok) {
                throw new Error(`Error loading sensor data: ${response.statusText}`);
            }
            
            const data = await response.json();
            const sensorData = data.sensor || {};
            
            // Update the metadata panel with sensor data
            displaySensorData(sensorData);
            
        } catch (error) {
            console.error("Error loading sensor data:", error);
        }
    }
    
    // Display sensor data in the metadata panel
    function displaySensorData(sensorData) {
        if (!sensorData || Object.keys(sensorData).length === 0) {
            $('#sensor-data-container').hide();
            return;
        }
        
        const sensorContainer = $('#sensor-data-container');
        const sensorTable = $('#sensor-data-table');
        sensorTable.empty();
        
        // Create table rows for each sensor data field
        Object.entries(sensorData).forEach(([key, value]) => {
            const row = $('<tr>');
            row.append($('<td>').text(key));
            
            // Format numeric values to 5 decimal places
            let displayValue = value;
            if (typeof value === 'number') {
                // Check if it's a floating point number that needs rounding
                if (value % 1 !== 0) {
                    displayValue = Number(value).toFixed(5);
                }
            } else if (typeof value === 'string') {
                // Try to parse string numbers and round them
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue % 1 !== 0) {
                    displayValue = numValue.toFixed(5);
                }
            }
            
            row.append($('<td>').text(displayValue));
            sensorTable.append(row);
        });
        
        // Show the sensor data section
        sensorContainer.show();
    }
    
    // Load metadata for image
    async function loadMetadata(imagePath) {
        try {
            const response = await fetch(`/api/metadata/${imagePath}`);
            if (!response.ok) {
                throw new Error(`Failed to load metadata: ${response.statusText}`);
            }
            
            const metadata = await response.json();
            
            // Update metadata display
            const metadataBox = $('#metadata-box');
            metadataBox.empty();
            
            const table = $('<table>').addClass('metadata-table');
            
            // Add rows for each metadata field
            Object.entries(metadata).forEach(([key, value]) => {
                const row = $('<tr>');
                row.append($('<td>').text(key));
                row.append($('<td>').text(value));
                table.append(row);
            });
            
            metadataBox.append(table);
            
        } catch (error) {
            console.error("Error loading metadata:", error);
            $('#metadata-box').html('<p class="error">Error loading metadata</p>');
        }
    }
    
    // Initialize fabric.js canvas
    function initCanvas() {
        if (window.AppState.fabricInitialized) return;
        
        // Create the HTML5 canvas element with willReadFrequently attribute
        const canvasEl = document.getElementById('annotation-canvas');
        if (canvasEl) {
            // Set willReadFrequently to true to optimize getImageData operations
            const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        }
        
        const canvas = new fabric.Canvas('annotation-canvas', {
            selection: true,
            preserveObjectStacking: true
        });
        
        window.AppState.fabricCanvas = canvas;
        window.AppState.fabricInitialized = true;
        
        // Setup canvas event handlers
        setupCanvasEvents(canvas);
        
        console.log("Canvas initialized with willReadFrequently optimization");
    }
    
    // Setup canvas event handlers
    function setupCanvasEvents(canvas) {
        // Object selection handler
        canvas.on('selection:created', handleSelectionEvent);
        canvas.on('selection:updated', handleSelectionEvent);
        
        // Object movement handler for editing polygon points
        canvas.on('object:moving', function(options) {
            window.AppState.isMovingHandle = true; // Set flag when a handle starts moving
            handleObjectMoving(options);
        });

        canvas.on('mouse:up', function(options) {
            if (window.AppState.isMovingHandle) {
                window.AppState.isMovingHandle = false; // Reset flag when movement stops
                // Potentially commit changes or update state here if needed after handle move
                console.log("[DEBUG] Handle movement finished.");
                // Ensure mode remains 'edit' if it was 'edit' before moving a handle
                if (window.AppState.activePolygon && !window.AppState.currentMode !== 'edit') {
                    // window.AppState.currentMode = 'edit'; // This might be too aggressive, let's test
                    // updateModeDisplay(); // Ensure UI reflects this
                }
            }
        });
        
        canvas.on('selection:cleared', function() {
            $('#selected-object-status').text('None');
            // If a handle is being moved, do not deselect the polygon,
            // as handles are removed and re-added during movement.
            if (window.AppState.isMovingHandle) {
                console.log("[DEBUG] selection:cleared detected during handle move - IGNORING deselectActivePolygon");
                return;
            }
            if (window.AppState.activePolygon) {
                import('./annotations.js').then(({ deselectActivePolygon }) => {
                    if (deselectActivePolygon) deselectActivePolygon();
                });
            }
        });
        
        // Mouse move handler for coordinates and drawing
        canvas.on('mouse:move', function(options) {
            const pointer = canvas.getPointer(options.e);
            $('#coords-status').text(`(${Math.round(pointer.x)}, ${Math.round(pointer.y)})`);
            
            // Update the temporary line if we're in drawing mode
            if (window.AppState.isDrawing && window.AppState.currentMode === 'create' && 
                window.AppState.currentPolygonPoints?.length > 0 && window.AppState.tempLine) {
                window.AppState.tempLine.set({ x2: pointer.x, y2: pointer.y });
                canvas.renderAll();
            }
        });
        
        // Mouse down handler for polygon drawing
        canvas.on('mouse:down', function(options) {
            console.log("[DEBUG] mouse:down event - target:", options.target ? options.target.type : "none");
            
            // Check validation mode using the validation module
            import('./validation.js').then(({ isInValidationMode }) => {
                if (isInValidationMode && isInValidationMode()) {
                    console.log("[DEBUG] Validation mode is active, cannot draw polygons");
                    showMessage("Cannot draw polygons in Validation mode. Switch to Label mode first.", "warning");
                    return;
                }
                
                handleMouseDown(options);
            }).catch(error => {
                console.error("[DEBUG] Error checking validation mode:", error);
                // Fallback to checking the toggle switch
                const validationToggle = document.getElementById('mode-toggle-switch');
                if (validationToggle && validationToggle.checked) {
                    console.log("[DEBUG] Validation mode is active, cannot draw polygons");
                    showMessage("Cannot draw polygons in Validation mode. Switch to Label mode first.", "warning");
                    return;
                }
                
                handleMouseDown(options);
            });
        });
        
        // Separate function to handle mouse down event
        function handleMouseDown(options) {
            // Reset state flags to ensure proper drawing
            window.AppState.isDrawingDisabled = false;
            
            // Set default class if none is selected
            if (!window.AppState.currentClass) {
                // Find and select a class button
                const shortGasketBtn = $('.class-button[data-class="Short-Gasket"]');
                if (shortGasketBtn.length) {
                    shortGasketBtn.addClass('active');
                    window.AppState.currentClass = 'Short-Gasket';
                    console.log("[DEBUG] Auto-selected default class: Short-Gasket");
                    showMessage("Auto-selected 'Short-Gasket' class", "info");
                } else {
                    // If Short-Gasket not found, select the first available class
                    const firstClassBtn = $('.class-button').first();
                    if (firstClassBtn.length) {
                        firstClassBtn.addClass('active');
                        window.AppState.currentClass = firstClassBtn.attr('data-class');
                        console.log(`[DEBUG] Auto-selected first available class: ${window.AppState.currentClass}`);
                        showMessage(`Auto-selected '${window.AppState.currentClass}' class`, "info");
                    } else {
                        console.log("[DEBUG] No class buttons found");
                        showMessage("Please select a class first before drawing", "warning");
                        return;
                    }
                }
            }
            
            // Ignore if right mouse button
            if (options.e.button === 2) {
                console.log("[DEBUG] Right mouse button - ignoring");
                return;
            }
            
            const pointer = window.AppState.fabricCanvas.getPointer(options.e);
            const target = options.target;
            
            // Debug current state
            console.log(`[DEBUG] handleMouseDown: mode=${window.AppState.currentMode}, isDrawing=${window.AppState.isDrawing}`);
            
            // Special case for when we're in Select mode and want to start drawing a new polygon
            if (window.AppState.currentMode === 'select' || window.AppState.currentMode === 'validate') {
                // If we just came back from validation mode, reset to select mode
                if (window.AppState.currentMode === 'validate') {
                    window.AppState.currentMode = 'select';
                    $('#mode-status').text('Select');
                    console.log("[DEBUG] Reset from validate to select mode");
                }
                
                // Check if we're clicking on blank canvas
                if (!target) {
                    // Start drawing a new polygon
                    console.log("[DEBUG] Starting new polygon drawing (no target)");
                    import('./drawing.js').then(({ startDrawing }) => {
                        if (startDrawing) startDrawing(pointer);
                    });
                    return;
                }
                
                // If we clicked on an edit handle
                if (target && target.customData?.isHandle) {
                    console.log("[DEBUG] Clicked on edit handle - selecting handle");
                    window.AppState.fabricCanvas.setActiveObject(target);
                    return;
                }
                
                // If we clicked on a polygon, check if it's an actual click on the polygon path or just within the bounding box
                if (target && window.AppState.annotations.includes(target) && target.type === 'polygon') {
                    console.log("[DEBUG] Clicked on or near polygon - checking exact hit location");
                    
                    // Check if the point is actually ON the polygon path using our helper function
                    const isClickOnPath = isPointOnPolygonPath(target, pointer);
                    
                    if (isClickOnPath) {
                        console.log("[DEBUG] Click is directly on polygon path - selecting polygon");
                        return; // Let the normal selection happen
                    } else {
                        console.log("[DEBUG] Click is inside bounding box but not on polygon path - starting new drawing");
                        
                        // IMPORTANT: Deselect the polygon that was automatically selected
                        window.AppState.fabricCanvas.discardActiveObject();
                        
                        // Prevent propagation of the mouse event to other handlers
                        options.e.stopImmediatePropagation();
                        options.e.preventDefault();
                        
                        // Start drawing a new polygon since we're not actually on the polygon
                        import('./drawing.js').then(({ startDrawing }) => {
                            if (startDrawing) startDrawing(pointer);
                        });
                        return;
                    }
                }
                
                // If Alt key is pressed, always start a new polygon
                if (options.e.altKey) {
                    console.log("[DEBUG] Alt key pressed - force starting new polygon");
                    import('./drawing.js').then(({ startDrawing }) => {
                        if (startDrawing) startDrawing(pointer);
                    });
                    return;
                }
                
                // Otherwise, if no target was found, start drawing 
                console.log("[DEBUG] No specific hit detected - starting new polygon");
                import('./drawing.js').then(({ startDrawing }) => {
                    if (startDrawing) startDrawing(pointer);
                });
                return;
            }
            
            // For Create mode, add another point to the polygon
            if (window.AppState.currentMode === 'create') {
                import('./drawing.js').then(({ addDrawingPoint }) => {
                    if (addDrawingPoint) addDrawingPoint(pointer);
                });
                return;
            }
        };
        
        // Double click to finish the polygon
        canvas.on('mouse:dblclick', function() {
            if (window.AppState.currentMode === 'create' && window.AppState.currentPolygonPoints?.length >= 3) {
                import('./drawing.js').then(module => {
                    module.completeDrawing();
                });
            }
        });
        
        // Canvas is now initialized
        window.AppState.canvasInitialized = true;
    }
    
    // Handle selection created event
    function handleSelectionEvent(options) {
        const selected = options.selected;
        
        // If a handle is selected, don't change selection state
        if (selected && selected.length === 1 && selected[0].customData?.isHandle) {
            return;
        }
        
        // Check if we have active edit handles
        if (window.AppState.editHandles?.length > 0) {
            // If selection changed to something not related to current editing, deselect
            if (!selected || selected.length === 0 || 
                !selected.find(obj => obj === window.AppState.activePolygon || obj.customData?.isHandle)) {
                import('./annotations.js').then(({ deselectActivePolygon }) => {
                    if (deselectActivePolygon) deselectActivePolygon();
                });
            } else {
                return; // Keep editing current polygon
            }
        }
        
        // Select a polygon if exactly one is selected and it's in our annotations array
        if (selected && selected.length === 1) {
            const sel = selected[0];
            if (window.AppState.annotations.includes(sel)) {
                import('./annotations.js').then(({ selectPolygon }) => {
                    if (selectPolygon) selectPolygon(sel);
                    
                    // Also highlight the corresponding item in the annotations list
                    highlightAnnotationInList(sel);
                });
            } else {
                import('./annotations.js').then(({ deselectActivePolygon }) => {
                    if (deselectActivePolygon) deselectActivePolygon();
                    // Remove any highlighted items in the annotation list
                    $('#annotation-list .annotation-item').removeClass('selected');
                });
            }
        } else if (!selected || selected.length === 0) {
            import('./annotations.js').then(({ deselectActivePolygon }) => {
                if (deselectActivePolygon) deselectActivePolygon();
                // Remove any highlighted items in the annotation list
                $('#annotation-list .annotation-item').removeClass('selected');
            });
        }
    }
    
    // Highlight the corresponding annotation in the list
    function highlightAnnotationInList(polygon) {
        // First remove any existing highlights
        $('#annotation-list .annotation-item').removeClass('selected');
        
        // Find the annotation item by ID if available or by class name
        if (polygon.customData?.objectId) {
            const item = $(`#annotation-list .annotation-item[data-id="${polygon.customData.objectId}"]`);
            if (item.length) {
                item.addClass('selected');
                
                // Scroll to the item if needed
                const listContainer = $('#annotation-list');
                const itemPosition = item.position().top;
                const listHeight = listContainer.height();
                
                if (itemPosition < 0 || itemPosition > listHeight) {
                    listContainer.scrollTop(listContainer.scrollTop() + itemPosition);
                }
            }
        } else {
            // Fallback to find by class name if objectId is not available
            const className = polygon.class || '';
            const items = $('#annotation-list .annotation-item');
            
            // Find the matching item containing this class name
            items.each(function() {
                if ($(this).text().includes(className)) {
                    $(this).addClass('selected');
                    return false; // Break the loop after finding the first match
                }
            });
        }
    }
    
    // Handle mouse move event for edit handles
    function handleObjectMoving(options) {
        import('./annotations.js').then(({ handleObjectMoving: handleMovingFunc }) => {
            if (handleMovingFunc) handleMovingFunc(options);
        });
    }
    
    // Setup event handlers
    function setupEventHandlers() {
        // Batch selection handler
        $('#batch-selector').on('change', function() {
            const selectedBatch = $(this).val();
            handleBatchSelection(selectedBatch);
        });
        
        // Image selection handler
        $('#image-list').on('click', '.image-item', function() {
            const imageId = $(this).attr('data-image-id');
            const imagePath = $(this).attr('data-image-path');
            
            // Generate a unique load ID for this direct click
            const clickLoadId = ++window.AppState.currentLoadId;
            
            // Cancel any pending debounced image loads since user clicked directly
            if (window.AppState.debouncedLoading.timeoutId) {
                clearTimeout(window.AppState.debouncedLoading.timeoutId);
                window.AppState.debouncedLoading.timeoutId = null;
                window.AppState.debouncedLoading.isSkipLoad = false; // Reset flag
                window.AppState.debouncedLoading.expectedImageId = null; // Reset expected image
                console.log("[DEBUG] Cancelled pending debounced load due to direct image click");
            }
            
            // Set expected image and load ID for direct clicks (prevents any stale loads from showing)
            window.AppState.expectedImageId = imageId;
            window.AppState.expectedLoadId = clickLoadId;
            window.AppState.debouncedLoading.expectedImageId = imageId;
            
            // Update active state
            $('#image-list .image-item').removeClass('active');
            $(this).addClass('active');
            
            // Show loading progress message
            showMessage("Loading...", "info");
            
            handleImageSelection(imageId, imagePath).then(() => {
                // Only show "Image loaded" if this is still the current image and load
                if (window.AppState.currentImageId === imageId && window.AppState.expectedLoadId === clickLoadId) {
                    showMessage("Image loaded", "success");
                } else {
                    console.log(`[DEBUG] Skipping 'Image loaded' message for direct click ${imageId} (loadId: ${clickLoadId}) - current image: ${window.AppState.currentImageId}, expected load: ${window.AppState.expectedLoadId}`);
                }
                // Clear global expected image after successful direct load
                if (window.AppState.expectedLoadId === clickLoadId) {
                    window.AppState.expectedImageId = null;
                }
            }).catch(error => {
                console.error("[DEBUG] Error in direct image selection:", error);
                showMessage("Error loading image", "error");
                // Clear expected image even on error to prevent getting stuck
                if (window.AppState.expectedLoadId === clickLoadId) {
                    window.AppState.expectedImageId = null;
                }
            });
        });
        
        // Class button click handler
        $('.class-button').on('click', function() {
            // Update active state
            $('.class-button').removeClass('active');
            $(this).addClass('active');
            
            // Set current class
            const className = $(this).attr('data-class');
            window.AppState.currentClass = className;
            
            // Update status
            $('#class-status').text(className);
            
            // If there's an active polygon, update its class
            if (window.AppState.activePolygon) {
                const oldClass = window.AppState.activePolygon.class || 'Unknown';
                
                // Update polygon class
                window.AppState.activePolygon.class = className;
                window.AppState.activePolygon.customData = window.AppState.activePolygon.customData || {};
                window.AppState.activePolygon.customData.class = className;
                
                // Update polygon color based on class
                const newColor = getCategoryColorByName(className);
                // Ensure transparency in polygon fill colors
                const newFillColor = getCategoryColorByName(className, true); // RGBA color with transparency
                window.AppState.activePolygon.set({
                    stroke: newColor,
                    fill: newFillColor // Apply transparency
                });
                
                // Update UI
                addLogEntry(`Changed class from "${oldClass}" to "${className}"`);
                $('#annotation-list').empty();
                window.AppState.annotations.forEach(annotation => {
                    addAnnotationToList(annotation);
                });
                
                window.AppState.fabricCanvas.renderAll();
            }
        });
        
        // Polygon mode toggle
        $('#polygon-mode-btn').on('click', function() {
            togglePolygonMode();
        });
        
        // Submit button handler
        $('#submit-btn').on('click', async function() {
            // Import the saveAnnotations function from annotations.js
            import('./annotations.js').then(({ saveAnnotations }) => {
                if (saveAnnotations) {
                    saveAnnotations().then(async success => {
                        if (success) {
                            // Navigate to the next image after successful submission
                            // await navigateToNextImage();
                            $('#skip-btn').trigger('click');
                        } else {
                            showMessage("Failed to save annotations to CosmosDB", "error");
                        }
                    });
                }
            });
        });
        
        // Skip button handler - simple one-by-one navigation
        $('#skip-btn').on('click', async function() {
            // Basic throttle to prevent abuse (silent)
            if (!canNavigate()) {
                return; // Silent throttle - no warning message
            }
            
            try {
                addLogEntry(`Skipped image: ${window.AppState.currentImageId}`);
                const success = await navigateToNextImage();
                
                if (success) {
                    showMessage("Skipped", "success");
                } else {
                    showMessage("No more images available", "info");
                }
            } catch (error) {
                console.error("[DEBUG] Error during skip navigation:", error);
                showMessage("Error skipping image", "error");
            }
        });
        
        // Delete button handler
        $('#delete-btn').on('click', function() {
            console.log("[DEBUG] Delete button clicked");
            // Call the deleteCurrentImage function from api.js
            import('./api.js').then(module => {
                if (module.deleteCurrentImage) {
                    console.log("[DEBUG] Calling deleteCurrentImage from api.js");
                    module.deleteCurrentImage();
                } else {
                    console.error("[DEBUG] deleteCurrentImage function not found in api.js");
                    deleteSelectedObject(); // Fallback to old function
                }
            }).catch(error => {
                console.error("[DEBUG] Error importing api.js:", error);
                // Fallback to old implementation if import fails
                deleteSelectedObject();
            });
        });
        
        // Accept button (validation mode) handler
        $('#accept-btn').on('click', function() {
            // Handle accepting the current image validation
            if (window.AppState.currentImage) {
                import('./validation.js').then(({ acceptValidation }) => {
                    if (acceptValidation) {
                        acceptValidation().then(async () => {
                            addLogEntry(`Accepted image: ${window.AppState.currentImageId}`);
                            showMessage("Image accepted", "success");
                            await navigateToNextImage();
                        });
                    } else {
                        (async () => {
                            addLogEntry(`Accepted image: ${window.AppState.currentImageId}`);
                            showMessage("Image accepted", "success");
                            await navigateToNextImage();
                        })();
                    }
                });
            }
        });
        
        // Reject button (validation mode) handler
        $('#reject-btn').on('click', function() {
            // Handle rejecting the current image validation
            if (window.AppState.currentImage) {
                import('./validation.js').then(({ rejectValidation }) => {
                    if (rejectValidation) {
                        rejectValidation().then(async () => {
                            addLogEntry(`Rejected image: ${window.AppState.currentImageId}`);
                            showMessage("Image rejected", "warning");
                            await navigateToNextImage();
                        });
                    } else {
                        (async () => {
                            addLogEntry(`Rejected image: ${window.AppState.currentImageId}`);
                            showMessage("Image rejected", "warning");
                            await navigateToNextImage();
                        })();
                    }
                });
            }
        });
        
        // Export button handler
        $('#export-btn').on('click', function() {
            exportAnnotations();
        });
        
        // Import button handler
        $('#import-btn').on('click', function() {
            $('#import-file').click();
        });
        
        $('#import-file').on('change', function() {
            importAnnotations(this.files[0]);
        });
        
        // Mode toggle is handled by label.js to avoid conflicts
        // $('#mode-toggle-switch').on('change', function() {
        //     const isValidationMode = $(this).prop('checked');
        //     toggleValidationMode(isValidationMode);
        // });
        
        // Handle window resize
        $(window).on('resize', function() {
            if (window.AppState.fabricCanvas) {
                centerCanvas();
            }
        });
        
        // Context menu prevention
        $('#canvas-wrapper').on('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Keyboard shortcuts
        $(document).on('keydown', function(e) {
            // H key for temporarily hiding annotations (press and hold)
            if (e.key === 'h' || e.key === 'H') {
                if (!window.AppState.annotationsHidden && window.AppState.annotations && window.AppState.annotations.length > 0) {
                    hideAnnotations();
                    e.preventDefault();
                }
            }
            
            // P key for polygon mode
            if (e.key === 'p' || e.key === 'P') {
                if (!window.AppState.currentImage) {
                    showMessage("Load an image first", "warning");
                    return;
                }
                
                if (!window.AppState.currentClass) {
                    showMessage("Select a class first", "warning");
                    return;
                }
                
                // Toggle polygon mode
                togglePolygonMode();
                e.preventDefault();
            }
            
            // Arrow keys for panning when zoomed in
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                // Only pan if we are zoomed in
                if (window.AppState.currentZoom && window.AppState.currentZoom > 1) {
                    const panAmount = 20; // pixels to pan per keystroke
                    
                    switch(e.key) {
                        case 'ArrowLeft':
                            panCanvas(panAmount, 0);
                            break;
                        case 'ArrowRight':
                            panCanvas(-panAmount, 0);
                            break;
                        case 'ArrowUp':
                            panCanvas(0, panAmount);
                            break;
                        case 'ArrowDown':
                            panCanvas(0, -panAmount);
                            break;
                    }
                    e.preventDefault();
                }
            }
            
            // Space key for skip functionality (simple navigation)
            if (e.key === ' ' || e.code === 'Space') {
                // Only if we're not typing in an input field
                if (!e.target.matches('input, textarea, [contenteditable]')) {
                    e.preventDefault();
                    // Trigger skip button click for consistent behavior
                    $('#skip-btn').trigger('click');
                }
            }
            
            // Enter key to complete polygon or commit edits
            if (e.key === 'Enter') {
                if (window.AppState.currentMode === 'create' && window.AppState.currentPolygonPoints?.length >= 3) {
                    console.log("[DEBUG] Enter key pressed - completing polygon");
                    
                    // Complete the polygon
                    import('./drawing.js').then(module => {
                        module.completeDrawing();
                    });
                    
                    e.preventDefault();
                }
                else if (window.AppState.currentMode === 'edit' && window.AppState.activePolygon) {
                    console.log("[DEBUG] Enter key pressed - committing polygon edits");
                    
                    try {
                        // Save the current polygon state first
                        window.AppState.activePolygon.dirty = true;
                        window.AppState.activePolygon.setCoords();
                        
                        // Calculate and save the correct image points
                        if (window.AppState.activePolygon.points && window.AppState.activePolygon.customData) {
                            const imagePoints = window.AppState.activePolygon.points.map(point => {
                                // Convert from canvas point to image point
                                const canvasPoint = {
                                    x: window.AppState.activePolygon.left + point.x,
                                    y: window.AppState.activePolygon.top + point.y
                                };
                                
                                return {
                                    x: canvasPoint.x / window.AppState.currentScale,
                                    y: canvasPoint.y / window.AppState.currentScale
                                };
                            });
                            
                            // Save the image points
                            window.AppState.activePolygon.customData.imagePoints = imagePoints;
                            
                            // Mark state as changed
                            window.AppState.isDirty = true;
                        }
                        
                        // Log the action
                        addLogEntry(`Polygon edit committed for ${window.AppState.activePolygon.class || 'polygon'}`);
                        //showMessage("Polygon edit committed", "success");
                        
                        // Exit edit mode
                        import('./annotations.js').then(({ deselectActivePolygon }) => {
                            if (deselectActivePolygon) deselectActivePolygon();
                        });
                    } catch (error) {
                        console.error("[DEBUG] Error committing polygon edits:", error);
                        showMessage("Error committing polygon edits", "error");
                    }
                    
                    e.preventDefault();
                }
            }
            
            // Escape key to cancel drawing or editing or reset zoom
            if (e.key === 'Escape') {
                // If we're zoomed in, reset zoom first
                if (window.AppState.currentZoom > 1) {
                    console.log("[DEBUG] Escape key pressed - resetting zoom level");
                    resetZoom();
                    centerCanvas();
                    e.preventDefault();
                    return;
                }
                
                if (window.AppState.currentMode === 'create') {
                    console.log("[DEBUG] Escape key pressed - canceling polygon drawing");
                    
                    // Cancel the drawing
                    import('./drawing.js').then(module => {
                        module.cancelDrawing();
                    });
                    
                    e.preventDefault();
                }
                else if (window.AppState.currentMode === 'edit' && window.AppState.activePolygon) {
                    console.log("[DEBUG] Escape key pressed - canceling polygon edits");
                    
                    try {
                        if (window.AppState.originalPolygonState) {
                            // First remove edit handles to avoid any interaction issues
                            import('./annotations.js').then(({ removeEditHandles, deselectActivePolygon }) => {
                                // Remove the existing edit handles
                                if (removeEditHandles) removeEditHandles();
                                
                                // Deep clone the original points to avoid reference issues
                                window.AppState.activePolygon.points = JSON.parse(JSON.stringify(window.AppState.originalPolygonState.points));
                                
                                // Restore all original position and transformation properties
                                window.AppState.activePolygon.set({
                                    left: window.AppState.originalPolygonState.left,
                                    top: window.AppState.originalPolygonState.top,
                                    width: window.AppState.originalPolygonState.width,
                                    height: window.AppState.originalPolygonState.height,
                                    angle: window.AppState.originalPolygonState.angle,
                                    scaleX: window.AppState.originalPolygonState.scaleX,
                                    scaleY: window.AppState.originalPolygonState.scaleY
                                });
                                
                                // Restore original image points if available
                                if (window.AppState.originalImagePoints && window.AppState.activePolygon.customData) {
                                    window.AppState.activePolygon.customData.imagePoints = 
                                        JSON.parse(JSON.stringify(window.AppState.originalImagePoints));
                                }
                                
                                // Mark polygon as needing render update
                                window.AppState.activePolygon.dirty = true;
                                window.AppState.activePolygon.setCoords();
                                
                                // Log the action
                                addLogEntry(`Polygon edit canceled for ${window.AppState.activePolygon.class || 'polygon'}`);
                                showMessage("Polygon edit canceled - changes reverted", "info");
                                
                                // Force a render
                                window.AppState.fabricCanvas.renderAll();
                                
                                // Then deselect the polygon
                                if (deselectActivePolygon) deselectActivePolygon();
                            });
                        } else {
                            // If no original state is available, just deselect
                            addLogEntry(`Edit canceled for ${window.AppState.activePolygon.class || 'polygon'}`);
                            
                            import('./annotations.js').then(({ deselectActivePolygon }) => {
                                if (deselectActivePolygon) deselectActivePolygon();
                            });
                        }
                    } catch (error) {
                        console.error("[DEBUG] Error canceling polygon edits:", error);
                        showMessage("Error canceling polygon edits", "error");
                        
                        // Fallback: just deselect
                        import('./annotations.js').then(({ deselectActivePolygon }) => {
                            if (deselectActivePolygon) deselectActivePolygon();
                        });
                    }
                    
                    e.preventDefault();
                }
            }
            
            // Delete key to remove selected object
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
            if (window.AppState.activePolygon) {
                console.log("[DEBUG] Delete key pressed - removing selected polygon");
                import('./annotations.js').then(({ deleteSelectedPolygon }) => {
                    if (deleteSelectedPolygon) deleteSelectedPolygon();
                });
                e.preventDefault();
            } else {
                const activeObject = window.AppState.fabricCanvas.getActiveObject();
                if (activeObject && !activeObject.customData?.isHandle) {
                    deleteSelectedObject();
                    e.preventDefault();
                } else if (window.AppState.annotations && window.AppState.annotations.length > 0) {
                    // No active object, but annotations exist: delete all annotations
                    import('./api.js').then(({ deleteCurrentImage }) => {
                        if (deleteCurrentImage) deleteCurrentImage();
                    });
                    e.preventDefault();
                } else {
                    showMessage("No active annotation or annotations to delete.", "info");
                    e.preventDefault();
                }
            }
        }
            
            // Z key for zoom in
            if (e.key === 'z' && !e.ctrlKey && !e.metaKey) {
                zoomCanvas(1.2);
                e.preventDefault();
            }
            
            // X key for zoom out 
            if (e.key === 'x' && !e.ctrlKey && !e.metaKey) {
                zoomCanvas(1/1.2);
                e.preventDefault();
            }
            
            // S key for save annotations
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                saveAnnotations();
                e.preventDefault();
            }
        });
        
        // Keyboard shortcuts for keyup events
        $(document).on('keyup', function(e) {
            // H key release - show annotations again
            if (e.key === 'h' || e.key === 'H') {
                if (window.AppState.annotationsHidden) {
                    showAnnotations();
                    e.preventDefault();
                }
            }
        });
        
        // Handle window blur to ensure annotations are shown if user switches away while holding H
        $(window).on('blur', function() {
            if (window.AppState.annotationsHidden) {
                showAnnotations();
            }
        });
    }
    
    // Toggle polygon mode
    function togglePolygonMode() {
        if (window.AppState.currentMode === 'create') {
            // Exit polygon mode
            import('./drawing.js').then(module => {
                module.cancelDrawing();
            });
            
            window.AppState.polygonMode = false;
            $('#polygon-mode-btn').removeClass('active');
            
            console.log("[DEBUG] Exited polygon mode");
            showMessage("Exited polygon mode", "info");
        } else {
            // Enter polygon mode
            window.AppState.polygonMode = true;
            window.AppState.currentMode = 'create';
            
            // Update UI
            $('#polygon-mode-btn').addClass('active');
            $('#mode-status').text('Create');
            
            console.log("[DEBUG] Entered polygon mode");
            showMessage("Entered polygon mode. Click to place points, double-click or press Enter to complete.", "info");
        }
    }
    
    // Delete selected object from canvas and annotations array
    // Delete selected object from canvas and annotations array
function deleteSelectedObject() {
    const canvas = window.AppState.fabricCanvas;
    if (!canvas) {
        console.log("[DEBUG] No canvas available for deletion");
        return;
    }

    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
        console.log("[DEBUG] No active object to delete");
        return;
    }

    // Check if it's a handle - don't delete these
    if (activeObject.customData?.isHandle) {
        console.log("[DEBUG] Cannot delete edit handles directly");
        return;
    }

    // If it's the active polygon, use the dedicated deletion method
    if (activeObject === window.AppState.activePolygon) {
        import('./annotations.js').then(({ deleteSelectedPolygon }) => {
            if (deleteSelectedPolygon) deleteSelectedPolygon();
        });
        return;
    }

    // For regular objects, use confirmation
    if (confirm("Delete selected object?")) {
        // Remove from annotations array if it exists there
        const index = window.AppState.annotations.indexOf(activeObject);
        if (index > -1) {
            window.AppState.annotations.splice(index, 1);
        }

        // Remove from canvas
        canvas.remove(activeObject);

        // Log deletion with object info if available
        const objInfo = activeObject.customData?.objectId || activeObject.id || '';
        addLogEntry(`Deleted object ${objInfo}`);

        // Update annotation list using renderAnnotationList if available
        import('./ui.js').then(({ renderAnnotationList, updateButtonStates }) => {
            if (renderAnnotationList) renderAnnotationList();
            if (updateButtonStates) updateButtonStates();
        });

        // Update status bar
        $('#selected-object-status').text('None');

        // Re-render canvas
        canvas.renderAll();

        console.log("[DEBUG] Object deleted");
    }
}
    
    // Add log entry
    function addLogEntry(message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const entry = `[${timestamp}] ${message}`;
        
        const logBox = $('#log-box');
        const logList = logBox.find('.log-list');
        
        if (logList.length === 0) {
            const newList = $('<ul>').addClass('log-list');
            const listItem = $('<li>').addClass('log-entry').text(entry);
            newList.append(listItem);
            logBox.empty().append(newList);
        } else {
            const listItem = $('<li>').addClass('log-entry').text(entry);
            logList.append(listItem);
        }
        
        // Scroll to bottom
        logBox.scrollTop(logBox[0].scrollHeight);
        
        return entry;
    }
    
    // Center the canvas in its container
    function centerCanvas() {
        if (!window.AppState.fabricCanvas) return;
        
        const canvasWrapper = $('#canvas-wrapper');
        const canvasEl = $('#annotation-canvas');
        
        if (canvasWrapper.length === 0 || canvasEl.length === 0) return;
        
        const wrapperWidth = canvasWrapper.width();
        const wrapperHeight = canvasWrapper.height();
        const canvasWidth = window.AppState.fabricCanvas.getWidth();
        const canvasHeight = window.AppState.fabricCanvas.getHeight();
        
        // Calculate centering offsets
        const leftOffset = Math.max(0, (wrapperWidth - canvasWidth) / 2);
        const topOffset = Math.max(0, (wrapperHeight - canvasHeight) / 2);
        
        // Apply centering
        canvasEl.css({
            'margin-left': `${leftOffset}px`,
            'margin-top': `${topOffset}px`
        });
        
        console.log(`Canvas centered: offset(${leftOffset}, ${topOffset})`);
    }
    
    // Clear canvas
    function clearCanvas() {
        if (!window.AppState.fabricCanvas) return;
        
        // Clear all objects including polygon handles
        window.AppState.fabricCanvas.getObjects().slice().forEach(obj => {
            window.AppState.fabricCanvas.remove(obj);
        });
        
        // Reset all drawing state
        window.AppState.annotations = [];
        window.AppState.currentPolygonPoints = [];
        window.AppState.tempPoints = [];
        window.AppState.tempLine = null;
        window.AppState.activePolygon = null;
        window.AppState.activeShape = null;
        window.AppState.isDrawing = false;
        window.AppState.editHandles = [];
        window.AppState.annotationsHidden = false; // Reset annotation visibility state
        
        // Reset current mode
        window.AppState.currentMode = 'select';
        
        // Update UI
        $('#mode-status').text('Select');
        $('#selected-object-status').text('None');
        $('#annotation-list').empty();
        
        window.AppState.fabricCanvas.renderAll();
    }
    
    // Get color for a category with transparency option
    function getCategoryColorByName(className, asTransparentFill = false) {
        if (!className || !AppState.classes) return asTransparentFill ? 'rgba(0, 0, 0, 0.2)' : 'rgb(0, 0, 0)';

        const classData = AppState.classes.find(cls => cls.name === className);
        const color = classData && classData.color ? classData.color : 'rgb(0, 0, 0)';
        console.log(`[DEBUG] Fetching color for class '${className}': ${color}`);
        // if (asTransparentFill && color.startsWith('rgb')) {
        //     // Convert rgb color to rgba with 0.3 opacity
        //     return color.replace('rgb', 'rgba').replace(')', ', 0.3)');
        // }

        return color;
    }
    
    // Zoom canvas with a specific factor
    function zoomCanvas(factor) {
        if (!window.AppState.fabricCanvas) return;
        
        // Get current zoom
        const currentZoom = window.AppState.fabricCanvas.getZoom();
        
        // Calculate new zoom (with limits)
        const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor));
        
        // Store the zoom level in the AppState
        window.AppState.currentZoom = newZoom;
        
        // Update zoom
        window.AppState.fabricCanvas.setZoom(newZoom);
        
        // Keep the canvas centered
        centerCanvas();
        
        // Update zoom status in UI (showing percentage)
        const zoomPercentage = Math.round(newZoom * 100);
        $('#zoom-status').text(`${zoomPercentage}%`);
        
        console.log(`Canvas zoomed: ${currentZoom.toFixed(2)} -> ${newZoom.toFixed(2)}`);
    }
    
    // Reset zoom to 100%
    function resetZoom() {
        if (!window.AppState.fabricCanvas) return;
        
        // Reset zoom level
        window.AppState.fabricCanvas.setZoom(1);
        window.AppState.currentZoom = 1;
        
        // Reset viewport transform to remove any panning
        window.AppState.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        
        // Update zoom status in UI
        $('#zoom-status').text('100%');
        
        // Force a render
        window.AppState.fabricCanvas.renderAll();
        
        console.log("[DEBUG] Zoom reset to 100%");
    }
    
    // Pan the canvas by the specified amount
    function panCanvas(deltaX, deltaY) {
        if (!window.AppState.fabricCanvas) return;
        
        // Only pan if we're zoomed in
        if (window.AppState.currentZoom <= 1) return;
        
        // Get current viewport transformation
        const vpt = window.AppState.fabricCanvas.viewportTransform;
        
        // Update the transformation with the delta amounts
        vpt[4] += deltaX;
        vpt[5] += deltaY;
        
        // Apply the new transformation and redraw
        window.AppState.fabricCanvas.setViewportTransform(vpt);
        
        console.log(`[DEBUG] Canvas panned by (${deltaX}, ${deltaY})`);
    }
    
    // Hide all annotations temporarily
    function hideAnnotations() {
        if (!window.AppState.fabricCanvas || !window.AppState.annotations || window.AppState.annotationsHidden) return;
        
        console.log("[DEBUG] Hiding annotations temporarily");
        
        // Hide all annotation polygons and their edit handles
        window.AppState.annotations.forEach(annotation => {
            annotation.set({ visible: false });
        });
        
        // Hide edit handles if they exist
        if (window.AppState.editHandles && window.AppState.editHandles.length > 0) {
            window.AppState.editHandles.forEach(handle => {
                handle.set({ visible: false });
            });
        }
        
        // Mark annotations as hidden
        window.AppState.annotationsHidden = true;
        
        // Force canvas refresh
        window.AppState.fabricCanvas.renderAll();
        
        // Update status bar to indicate annotations are hidden
        const statusBar = document.getElementById('status-bar');
        if (statusBar) {
            statusBar.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            statusBar.setAttribute('data-original-text', statusBar.innerHTML);
            statusBar.innerHTML = statusBar.innerHTML + ' | <span style="color: orange; font-weight: bold;">Annotations Hidden (release H to show)</span>';
        }
    }
    
    // Show all annotations again
    function showAnnotations() {
        if (!window.AppState.fabricCanvas || !window.AppState.annotations || !window.AppState.annotationsHidden) return;
        
        console.log("[DEBUG] Showing annotations again");
        
        // Show all annotation polygons
        window.AppState.annotations.forEach(annotation => {
            annotation.set({ visible: true });
        });
        
        // Show edit handles if they exist
        if (window.AppState.editHandles && window.AppState.editHandles.length > 0) {
            window.AppState.editHandles.forEach(handle => {
                handle.set({ visible: true });
            });
        }
        
        // Mark annotations as visible again
        window.AppState.annotationsHidden = false;
        
        // Force canvas refresh
        window.AppState.fabricCanvas.renderAll();
        
        // Restore status bar to normal
        const statusBar = document.getElementById('status-bar');
        if (statusBar && statusBar.getAttribute('data-original-text')) {
            statusBar.style.backgroundColor = '';
            statusBar.innerHTML = statusBar.getAttribute('data-original-text');
            statusBar.removeAttribute('data-original-text');
        }
    }
    
    // Add annotation to the annotation list
    function addAnnotationToList(obj) {
        const list = $('#annotation-list');
        const className = obj.class || `Category ${obj.category_id}`;
        
        // Get the annotation ID - use id property directly (from COCO) or index+1 as fallback
        const annotationId = obj.id || obj.customData?.objectId || '';
        
        const listItem = $('<li>').addClass('annotation-item');
        listItem.attr('data-id', obj.id || obj.customData?.objectId || '');
        
        // Display the annotation ID before the class name for better identification
        listItem.html(`<span class="annotation-color" style="background-color: ${obj.stroke};"></span> ${annotationId}: ${className}`);
        
        // Click handler to select the corresponding object on canvas
        listItem.on('click', function() {
            window.AppState.fabricCanvas.discardActiveObject();
            window.AppState.fabricCanvas.setActiveObject(obj);
            window.AppState.fabricCanvas.renderAll();
        });
        
        list.append(listItem);
    }
    
    // Show a message to the user
    function showMessage(message, type = 'info') {
        // Create message container if it doesn't exist
        let messageContainer = $('#message-container');
        if (messageContainer.length === 0) {
            messageContainer = $('<div>').attr('id', 'message-container');
            $('body').append(messageContainer);
        }
        
        // Create message element
        const messageElement = $('<div>')
            .addClass('message')
            .addClass(type)
            .text(message);
        
        // Add to container
        messageContainer.append(messageElement);
        
        // Auto-remove after delay
        setTimeout(() => {
            messageElement.fadeOut(300, function() {
                $(this).remove();
            });
        }, 1000);
        
        // Log to console as well
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    // Load annotations for the current image
    async function loadAnnotations(imagePath, batchId, imageId) {
        console.group("[DEBUG] loadAnnotations:", imagePath);
        
        if (!imagePath) {
            console.error("[DEBUG] loadAnnotations: No image path provided");
            console.groupEnd();
            return;
        }
        
        try {
            if (!batchId || !imageId) {
                console.warn("[DEBUG] loadAnnotations: Missing batch_id or image_id");
            }
            
            // Build the API URL with query parameters
            const apiUrl = `/api/annotations/${imagePath}?batch_id=${batchId || ""}&image_id=${imageId || ""}`;
            console.log(`[DEBUG] loadAnnotations: Requesting from ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`[DEBUG] No annotations found for ${imagePath}`);
                    console.groupEnd();
                    //showMessage(`No annotations found for this image. Sometimes no annotations will be available in the cosmos coco file`, "info");
                    return;
                }
                
                throw new Error(`Failed to load annotations: ${response.statusText}`);
            }
            
            const data = await response.json();
            const cocoData = data.coco;
            
            if (!cocoData || !cocoData.annotations || cocoData.annotations.length === 0) {
                console.log(`[DEBUG] No annotations in COCO data for ${imagePath}`);
                console.groupEnd();
                //showMessage(`No annotations found in COCO data for this image`, "info");
                return;
            }
            
            // Parse COCO data and create annotations
            parseCocoAnnotations(cocoData);
            
            // Render the annotation list
            window.AppState.annotations.forEach(annotation => {
                addAnnotationToList(annotation);
            });
            
            // showMessage(`Loaded ${window.AppState.annotations.length} annotations for ${imagePath}`, "success");
            window.AppState.fabricCanvas.renderAll();
            
        } catch (error) {
            console.error("[DEBUG] Error loading annotations:", error);
            showMessage(`Error loading annotations for ${imagePath}. ${error.message}`, "warning");
        }
        
        console.groupEnd();
    }
    
    // Parse COCO annotations and create Fabric.js objects
    function parseCocoAnnotations(cocoData) {
        console.group("[DEBUG] parseCocoAnnotations");
        
        // Build category map for looking up class names
        const categoryMap = {};
        if (cocoData.categories) {
            cocoData.categories.forEach(cat => {
                categoryMap[cat.id] = cat.name;
            });
        }
        
        console.log(`[DEBUG] Category map:`, categoryMap);
        console.log(`[DEBUG] Processing ${cocoData.annotations?.length || 0} annotations`);
        
        if (!cocoData.annotations || !Array.isArray(cocoData.annotations)) {
            console.warn("[DEBUG] No valid annotations array in COCO data");
            console.groupEnd();
            return;
        }
        
        // Process each annotation
        cocoData.annotations.forEach((ann, index) => {
            try {
                // Validate segmentation data
                if (!ann.segmentation || !Array.isArray(ann.segmentation) || !ann.segmentation[0]) {
                    console.warn(`[DEBUG] Skip ann ${index}: Invalid segmentation data`);
                    return;
                }
                
                const seg = ann.segmentation[0];
                
                // Check segmentation format
                if (!Array.isArray(seg) || seg.length < 6) {
                    console.warn(`[DEBUG] Skip ann ${index}: Bad segmentation format (need at least 3 points)`);
                    return;
                }
                
                // Build points array from segmentation data
                const points = [];
                for (let i = 0; i < seg.length; i += 2) {
                    if (typeof seg[i] !== 'number' || typeof seg[i+1] !== 'number') {
                        console.warn(`[DEBUG] Invalid coordinate at position ${i}`);
                        continue;
                    }
                    
                    // Convert image coordinates to canvas coordinates
                    const canvasX = seg[i] * window.AppState.currentScale;
                    const canvasY = seg[i+1] * window.AppState.currentScale;
                    
                    points.push({ x: canvasX, y: canvasY });
                }
                
                // Need at least 3 valid points to create a polygon
                if (points.length < 3) {
                    console.warn(`[DEBUG] Skip ann ${index}: Not enough valid points (${points.length})`);
                    return;
                }
                
                // Get class name from category
                const categoryId = ann.category_id;
                const className = categoryMap[categoryId] || `Category ${categoryId}`;
                
                // Get stroke and fill colors based on class
                const strokeColor = getCategoryColorByName(className);
                // Ensure transparency in polygon fill colors
                const fillColor = getCategoryColorByName(className, true); // RGBA color with transparency
                // window.AppState.activePolygon
                // Create the polygon with disabled controls to prevent bounding box flashing
                const polygon = new fabric.Polygon(points, {
                    stroke: strokeColor,
                    strokeWidth: 2,
                    fill: fillColor,
                    objectCaching: false,
                    transparentCorners: false,
                    cornerColor: 'transparent', // Make corners transparent
                    borderColor: 'transparent', // Make borders transparent
                    selectable: true,
                    hasControls: false, // Disable controls to prevent bounding box
                    hasBorders: false,  // Disable borders to prevent bounding box
                    perPixelTargetFind: true, // Enable precise hit testing
                    padding: 0, // Remove extra padding around the polygon
                    lockMovementX: false,
                    lockMovementY: false,
                    // Set the ID from the COCO annotation
                    id: ann.id
                });
                
                // Override the containsPoint method to use a more strict hit test
                polygon._containsOriginal = polygon.containsPoint;
                polygon.containsPoint = function(point, lines, absolute) {
                    // First check if the point is on the polygon border with a tolerance
                    if (isPointOnPolygonPath(this, point, 5)) {
                        return true;
                    }
                    
                    // For clicks inside the polygon, use the original containsPoint method 
                    // which correctly detects if a point is inside the polygon
                    const isInsidePolygon = this._containsOriginal(point, lines, absolute);
                    
                    // Check if the current action is "selecting a polygon" versus "drawing a new polygon"
                    // If the user is actively drawing a polygon or we're in "create" mode,
                    // we don't want to select existing polygons on clicks within the polygon
                    if (isInsidePolygon) {
                        if (window.AppState.isDrawing || window.AppState.currentMode === 'create') {
                            return false;
                        }
                        return true;
                    }
                    
                    // Not inside polygon
                    return false;
                };
                
                // Store class and category information
                polygon.class = className;
                polygon.category_id = categoryId;
                
                // Store original points for saving later
                polygon.customData = {
                    class: className,
                    objectId: ann.objectId || `obj-${Date.now()}-${index}`,
                    imagePoints: seg.reduce((arr, val, i) => {
                        if (i % 2 === 0) {
                            arr.push({ x: seg[i], y: seg[i+1] });
                        }
                        return arr;
                    }, [])
                };
                
                // Add to canvas and annotations array
                window.AppState.fabricCanvas.add(polygon);
                window.AppState.annotations.push(polygon);
                
                // Respect current annotation visibility state
                if (window.AppState.annotationsHidden) {
                    polygon.set({ visible: false });
                }
                
                console.log(`[DEBUG] Added polygon ${index} of class ${className}`);
                
            } catch (error) {
                console.error(`[DEBUG] Error processing annotation ${index}:`, error);
            }
        });
        
        console.log(`[DEBUG] Successfully added ${window.AppState.annotations.length} annotations`);
        console.groupEnd();
    }
    
    // Save annotations to the server
    async function saveAnnotations() {
        console.group("[DEBUG] saveAnnotations: Start");
        
        try {
            if (!window.AppState.currentImage || !window.AppState.currentBatch || !window.AppState.currentImageId) {
                showMessage("No image selected. Please select an image first.", "warning");
                console.warn("[DEBUG] saveAnnotations: No image selected");
                console.groupEnd();
                return false;
            }
            
            // Show loading indicator
            // showMessage("Saving annotations...", "info");
            const annotations = window.AppState.annotations || [];
            
            console.log(`[DEBUG] saveAnnotations: Found ${annotations.length} annotations to save`);
            
            // Convert annotations to COCO format
            const cocoPayload = convertFabricToCoco(annotations);
            
            if (!cocoPayload) {
                console.error("[DEBUG] saveAnnotations: Failed to convert to COCO format");
                showMessage("Error creating COCO payload", "error");
                console.groupEnd();
                return false;
            }
            
            // First retrieve any existing sensor data to ensure we don't overwrite it
            let existingSensorData = null;
            try {
                console.log("[DEBUG] saveAnnotations: Retrieving existing sensor data first");
                const sensorResponse = await fetch(`/api/sensor/${window.AppState.currentImageId}?batch_id=${window.AppState.currentBatch}&image_id=${window.AppState.currentImageId}`);
                if (sensorResponse.ok) {
                    const sensorData = await sensorResponse.json();
                    existingSensorData = sensorData.sensor || null;
                    console.log("[DEBUG] saveAnnotations: Retrieved existing sensor data:", existingSensorData);
                } else {
                    console.log("[DEBUG] saveAnnotations: No existing sensor data found or error retrieving it");
                }
            } catch (error) {
                console.warn("[DEBUG] saveAnnotations: Error retrieving sensor data:", error);
            }
            
            // Add metadata and sensor data (if it exists)
            cocoPayload.metadata = {
                batch_id: window.AppState.currentBatch,
                image_id: window.AppState.currentImageId,
                file_name: window.AppState.currentImage
            };
            
            // Include existing sensor data if available
            if (existingSensorData) {
                cocoPayload.sensor = existingSensorData;
                console.log("[DEBUG] saveAnnotations: Including existing sensor data in save payload");
            }
            
            // Prepare request body
            console.log("[DEBUG] saveAnnotations: Attempting to stringify payload...");
            const bodyString = JSON.stringify(cocoPayload);
            console.log("[DEBUG] saveAnnotations: Payload stringified successfully. Length:", bodyString?.length);
            
            // Send to server
            console.log("[DEBUG] saveAnnotations: Attempting fetch POST...");
            const response = await fetch(`/api/annotations/${window.AppState.currentImage}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: bodyString
            });
            
            console.log("[DEBUG] saveAnnotations: Fetch response received. Status:", response.status);
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log("[DEBUG] saveAnnotations: Server response:", result);
            
            
            // Mark state as saved

            window.AppState.isDirty = false;
            
            // Log the action
            addLogEntry(`Saved ${annotations.length} annotations to ${window.AppState.currentImage}`);
            showMessage(`${annotations.length} annotations saved successfully!`, "success");
            
            console.groupEnd();
            return true;
            
        } catch (error) {
            console.error("[DEBUG] saveAnnotations: Error:", error);
            showMessage(`Error saving annotations: ${error.message}`, "error");
            console.groupEnd();
            return false;
        }
    }
    
    // Convert Fabric.js objects to COCO format
    function convertFabricToCoco(annotations) {
        if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
            return null;
        }
        
        try {
            // Create base COCO structure

            const coco = {
                info: {
                    description: "Facade Studio Annotations",
                    date_created: new Date().toISOString()

                },
                images: [{
                    id: window.AppState.currentImageId,
                    file_name: window.AppState.currentImage,
                    width: window.AppState.originalImageWidth,
                    height: window.AppState.originalImageHeight
                }],
                annotations: [],
                categories: []
            };
            
            // Build categories dictionary
            const categoriesDict = {};
            let nextCategoryId = 1;
            
            // Process each annotation
            annotations.forEach((obj, index) => {
                // Skip non-polygon objects
                if (!obj.points || !Array.isArray(obj.points)) {
                    console.warn(`[DEBUG] convertFabricToCoco: Skipping non-polygon object at index ${index}`);
                    return;
                }
                
                // Get or create category
                const className = obj.class || `Unknown_${index}`;
                let categoryId;
                
                if (categoriesDict[className]) {
                    categoryId = categoriesDict[className];
                } else {
                    categoryId = nextCategoryId++;
                   
                    categoriesDict[className] = categoryId;
                    
                    // Add to categories array
                    coco.categories.push({
                        id: categoryId,
                        name: className,
                        supercategory: "Facade"
                    });
                }
                
                // Get image points from customData if available, otherwise convert from canvas points
                let imagePoints = [];
                
                if (obj.customData && obj.customData.imagePoints) {
                    imagePoints = obj.customData.imagePoints;
                } else {
                    // Convert canvas points to image points
                    imagePoints = obj.points.map(point => {
                        // Calculate absolute canvas position
                        const canvasX = obj.left + point.x;
                        const canvasY = obj.top + point.y;
                        
                        // Convert to image coordinates
                        return {
                            x: canvasX / window.AppState.currentScale,
                            y: canvasY / window.AppState.currentScale
                        };
                    });
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
                    id: index + 1,
                    image_id: window.AppState.currentImageId,
                    category_id: categoryId,
                    segmentation: segmentation,
                    area: area,
                    bbox: bbox,
                    iscrowd: 0,
                    objectId: obj.customData?.objectId || `obj-${Date.now()}-${index}`
                };
                
                // Add to annotations array
                coco.annotations.push(annotation);
            });
            
            return coco;
            
        } catch (error) {
            console.error("[DEBUG] convertFabricToCoco: Error converting to COCO format:", error);
            return null;
        }
    }
    
    // Toggle between regular annotation mode and validation mode
    function toggleValidationMode(isValidationMode) {
        console.group("[DEBUG] toggleValidationMode:", isValidationMode);
        
        try {
            if (isValidationMode) {
                // Switch to validation mode
                window.AppState.previousMode = window.AppState.currentMode;
                window.AppState.currentMode = 'validate';
                
                // Update UI
                $('#mode-label').text('Validate');
                $('#mode-status').text('Validate');
                
                // Disable drawing controls
                $('#polygon-mode-btn').addClass('disabled');
                $('.class-button').addClass('disabled');
                
                // Show validation controls if they exist
                $('#validation-controls').show();
                
                // Update canvas options
                if (window.AppState.fabricCanvas) {
                    window.AppState.fabricCanvas.selection = false;
                    window.AppState.fabricCanvas.getObjects().forEach(obj => {
                        if (window.AppState.annotations && window.AppState.annotations.includes(obj)) {
                            obj.set({
                                selectable: false,
                                hoverCursor: 'pointer'
                            });
                        }
                    });
                }
                
                // Load validation module if needed
                import('./validation.js').then(module => {
                    if (module.initValidation) {
                        module.initValidation();
                    }
                }).catch(error => {
                    console.error("[DEBUG] Error loading validation module:", error);
                    showMessage("Error loading validation module", "error");
                });
                
                showMessage("Entered validation mode", "info");
            } else {
                // Switch back to regular mode
                window.AppState.currentMode = window.AppState.previousMode || 'select';
                
                // Update UI
                $('#mode-label').text('Label');
                $('#mode-status').text(window.AppState.currentMode.charAt(0).toUpperCase() + window.AppState.currentMode.slice(1));
                
                // Enable drawing controls
                $('#polygon-mode-btn').removeClass('disabled');
                $('.class-button').removeClass('disabled');
                
                // Hide validation controls
                $('#validation-controls').hide();
                
                // Update canvas options
                if (window.AppState.fabricCanvas) {
                    window.AppState.fabricCanvas.selection = true;
                    window.AppState.fabricCanvas.getObjects().forEach(obj => {
                        if (window.AppState.annotations && window.AppState.annotations.includes(obj)) {
                            obj.set({
                                selectable: true,
                                hoverCursor: 'move'
                            });
                        }
                    });
                }
                
                showMessage("Exited validation mode", "info");
            }
            
            // Force a canvas render
            if (window.AppState.fabricCanvas) {
                window.AppState.fabricCanvas.renderAll();
            }
        } catch (error) {
            console.error("[DEBUG] Error toggling validation mode:", error);
            showMessage(`Error toggling validation mode: ${error.message}`, "error");
        }
        
        console.groupEnd();
    }
    
    // Expose toggleValidationMode globally so it can be called from label.js
    window.toggleValidationMode = function(isValidationMode) {
        console.group("[DEBUG] Global toggleValidationMode called:", isValidationMode);
        
        try {
            if (isValidationMode) {
                // Switch to validation mode
                window.AppState.previousMode = window.AppState.currentMode;
                window.AppState.currentMode = 'validate';
                
                // Update mode status
                const modeStatus = document.getElementById('mode-status');
                if (modeStatus) {
                    modeStatus.textContent = 'Validate';
                    modeStatus.className = 'text-orange-400';
                }
                
                // Disable drawing controls
                const polygonModeBtn = document.getElementById('polygon-mode-btn');
                if (polygonModeBtn) {
                    polygonModeBtn.classList.add('disabled');
                    polygonModeBtn.disabled = true;
                }
                
                // Disable class buttons
                const classButtons = document.querySelectorAll('.class-button');
                classButtons.forEach(button => {
                    button.classList.add('disabled', 'opacity-50', 'cursor-not-allowed');
                    button.disabled = true;
                });
                
                // Disable bottom panel (class selection)
                const bottomPanel = document.getElementById('bottom-panel');
                if (bottomPanel) {
                    bottomPanel.style.opacity = '0.5';
                    bottomPanel.style.pointerEvents = 'none';
                }
                
                // Update canvas options
                if (window.AppState.fabricCanvas) {
                    const canvas = window.AppState.fabricCanvas;
                    canvas.selection = false;
                    canvas.isDrawingMode = false;
                    
                    // Disable interaction with annotations
                    canvas.getObjects().forEach(obj => {
                        if (window.AppState.annotations && window.AppState.annotations.includes(obj)) {
                            obj.set({
                                selectable: false,
                                evented: false,
                                hoverCursor: 'default'
                            });
                        }
                    });
                    
                    canvas.renderAll();
                }
                
                // Transform buttons to Accept/Reject in validation mode
                if (typeof window.transformButtons === 'function') {
                    window.transformButtons(true);
                    console.log("[DEBUG] Transformed buttons to validation mode");
                }
                
                // Load validation module if needed
                import('./validation.js').then(module => {
                    if (module.initValidation) {
                        module.initValidation();
                    }
                }).catch(error => {
                    console.error("[DEBUG] Error loading validation module:", error);
                    if (window.showMessage) {
                        window.showMessage("Error loading validation module", "error");
                    }
                });
                
                console.log("[DEBUG] Entered validation mode");
                if (window.showMessage) {
                    window.showMessage("Entered validation mode", "info");
                }
                
            } else {
                // Switch back to regular mode
                window.AppState.currentMode = window.AppState.previousMode || 'select';
                
                // Update mode status
                const modeStatus = document.getElementById('mode-status');
                if (modeStatus) {
                    modeStatus.textContent = 'Label';
                    modeStatus.className = 'text-blue-400';
                }
                
                // Enable drawing controls
                const polygonModeBtn = document.getElementById('polygon-mode-btn');
                if (polygonModeBtn) {
                    polygonModeBtn.classList.remove('disabled');
                    polygonModeBtn.disabled = false;
                }
                
                // Enable class buttons
                const classButtons = document.querySelectorAll('.class-button');
                classButtons.forEach(button => {
                    button.classList.remove('disabled', 'opacity-50', 'cursor-not-allowed');
                    button.disabled = false;
                });
                
                // Enable bottom panel (class selection)
                const bottomPanel = document.getElementById('bottom-panel');
                if (bottomPanel) {
                    bottomPanel.style.opacity = '1';
                    bottomPanel.style.pointerEvents = 'auto';
                }
                
                // Update canvas options
                if (window.AppState.fabricCanvas) {
                    const canvas = window.AppState.fabricCanvas;
                    canvas.selection = true;
                    
                    // Enable interaction with annotations
                    canvas.getObjects().forEach(obj => {
                        if (window.AppState.annotations && window.AppState.annotations.includes(obj)) {
                            obj.set({
                                selectable: true,
                                evented: true,
                                hoverCursor: 'move'
                            });
                        }
                    });
                    
                    canvas.renderAll();
                }
                
                // Transform buttons back to Submit/Delete in label mode
                if (typeof window.transformButtons === 'function') {
                    window.transformButtons(false);
                    console.log("[DEBUG] Transformed buttons back to label mode");
                }
                
                console.log("[DEBUG] Exited validation mode");
                if (window.showMessage) {
                    window.showMessage("Exited validation mode", "info");
                }
            }
            
            // Force a canvas render
            if (window.AppState.fabricCanvas) {
                window.AppState.fabricCanvas.renderAll();
            }
            
        } catch (error) {
            console.error("[DEBUG] Error toggling validation mode:", error);
            if (window.showMessage) {
                window.showMessage(`Error toggling validation mode: ${error.message}`, "error");
            }
        }
        
        console.groupEnd();
    };
    
    // Check if a point is directly on a polygon's path, not just inside its bounding box
    function isPointOnPolygonPath(polygon, point, tolerance = 5) {
        if (!polygon || !polygon.points || !point) {
            return false;
        }
        
        // Convert the point from canvas coordinates to polygon's local coordinates
        // Account for polygon's transformations
        const polygonPoints = polygon.points;
        
        // Get the absolute points of the polygon (accounting for position)
        const absolutePoints = polygonPoints.map(p => ({
            x: p.x + polygon.left - (polygon.pathOffset?.x || 0),
            y: p.y + polygon.top - (polygon.pathOffset?.y || 0)
        }));
        
        // Use a more efficient approach to check if point is near any edge
        // Cache calculations where possible
        let minDistance = Number.MAX_VALUE;
        
        // Check if the point is near any edge of the polygon
        for (let i = 0; i < absolutePoints.length; i++) {
            const p1 = absolutePoints[i];
            const p2 = absolutePoints[(i + 1) % absolutePoints.length];
            
            // Calculate distance from point to line segment using more efficient algorithm
            const distance = distancePointToLineSegment(point, p1, p2);
            
            // Track minimum distance found
            if (distance < minDistance) {
                minDistance = distance;
            }
            
            // Optimization: early return if we find a close enough point
            if (distance <= tolerance) {
                return true;
            }
        }
        
        // If we didn't find any edge close enough, this is not a hit
        return false;
    }
    
    // Calculate the distance from a point to a line segment
    function distancePointToLineSegment(point, p1, p2) {
        const { x, y } = point;
        const { x: x1, y: y1 } = p1;
        const { x: x2, y: y2 } = p2;
        
        // Calculate squared length of line segment
        const lineSquaredLength = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        
        // If line segment is just a point, return distance to that point
        if (lineSquaredLength === 0) {
            return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        }
        
        // Calculate projection factor
        const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lineSquaredLength));
        
        // Calculate closest point on line segment
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        
        // Return distance to closest point
        return Math.sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
    }
    
    // Debounced image loading - only loads the final image after rapid skips
    function scheduleImageLoad(imageId, imagePath) {
        // Clear any pending image load
        if (window.AppState.debouncedLoading.timeoutId) {
            clearTimeout(window.AppState.debouncedLoading.timeoutId);
            console.log("[DEBUG] Cancelled previous pending image load due to new skip");
        }
        
        // Generate a unique load ID for this scheduled load
        const scheduledLoadId = ++window.AppState.currentLoadId;
        
        // Mark this as a skip-triggered load and set expected image
        window.AppState.debouncedLoading.isSkipLoad = true;
        window.AppState.debouncedLoading.expectedImageId = imageId;
        
        // Set global expected image to prevent any race conditions
        window.AppState.expectedImageId = imageId;
        window.AppState.expectedLoadId = scheduledLoadId;
        
        // Schedule the new image load
        window.AppState.debouncedLoading.timeoutId = setTimeout(async () => {
            // Triple-check that this is still the expected load
            if (window.AppState.debouncedLoading.expectedImageId !== imageId) {
                console.log(`[DEBUG] Skipping load for ${imageId} - expected ${window.AppState.debouncedLoading.expectedImageId}`);
                return;
            }
            
            if (window.AppState.expectedLoadId !== scheduledLoadId) {
                console.log(`[DEBUG] Skipping load ${scheduledLoadId} for ${imageId} - expected load ${window.AppState.expectedLoadId}`);
                return;
            }
            
            console.log(`[DEBUG] Loading final image after debounce: ${imageId} (loadId: ${scheduledLoadId})`);
            
            // Show loading progress message (only when actually starting to load)
            showMessage("Loading...", "info");
            
            try {
                await handleImageSelection(imageId, imagePath);
                console.log(`[DEBUG] Successfully loaded debounced image: ${imageId}`);
                
                // Only show "Image loaded" if this is still the current image and load
                if (window.AppState.currentImageId === imageId && window.AppState.expectedLoadId === scheduledLoadId) {
                    showMessage("Image loaded", "success");
                } else {
                    console.log(`[DEBUG] Skipping 'Image loaded' message for ${imageId} (loadId: ${scheduledLoadId}) - current image: ${window.AppState.currentImageId}, expected load: ${window.AppState.expectedLoadId}`);
                }
            } catch (error) {
                console.error("[DEBUG] Error loading debounced image:", error);
                showMessage("Error loading image", "error");
            }
            window.AppState.debouncedLoading.timeoutId = null;
            window.AppState.debouncedLoading.isSkipLoad = false; // Reset flag
            window.AppState.debouncedLoading.expectedImageId = null; // Reset expected image
            window.AppState.expectedImageId = null; // Reset global expected image
        }, window.AppState.debouncedLoading.delay);
        
        console.log(`[DEBUG] Scheduled image load for: ${imageId} (will load in ${window.AppState.debouncedLoading.delay}ms)`);
    }
    
    // Navigate to the next image in the list
    async function navigateToNextImage() {
        const currentImageItem = $('#image-list .image-item.active');
        if (currentImageItem.length === 0) {
            console.log("[DEBUG] No current image selected");
            return false;
        }
        
        const nextImageItem = currentImageItem.next('.image-item');
        
        if (nextImageItem.length > 0) {
            // We have a next image, select it
            const imageId = nextImageItem.attr('data-image-id');
            const imagePath = nextImageItem.attr('data-image-path');
            
            if (!imageId || !imagePath) {
                console.error("[DEBUG] Next image item missing data attributes");
                showMessage("Error: Invalid image data", "error");
                return false;
            }
            
            // Update app state immediately (no loading yet)
            window.AppState.currentImageId = imageId;
            window.AppState.currentImage = imagePath;
            window.AppState.currentImageFilename = imagePath;
            
            // Set global expected image to prevent any older loads from showing
            window.AppState.expectedImageId = imageId;
            
            // Update active state immediately to provide visual feedback
            $('#image-list .image-item').removeClass('active');
            nextImageItem.addClass('active');
            
            // Ensure the next item is visible (scroll if needed)
            const listContainer = $('#image-list');
            const itemPosition = nextImageItem.position().top;
            const listHeight = listContainer.height();
            
            if (itemPosition < 0 || itemPosition > listHeight) {
                listContainer.scrollTop(listContainer.scrollTop() + itemPosition);
            }
            
            // Schedule debounced image loading (cancels previous if rapid skipping)
            scheduleImageLoad(imageId, imagePath);
            
            console.log(`[DEBUG] Navigation UI updated to: ${imageId} (image loading scheduled)`);
            return true;
            
        } else {
            console.log("[DEBUG] No next image available");
            showMessage("No more images available in this batch", "info");
            return false;
        }
    }
});


window.mainJsFunctions = {
    loadBatches,
    handleBatchSelection,
    loadImage,
    handleImageSelection,
    loadSensorData,
    displaySensorData,
    loadAnnotations,
    parseCocoAnnotations,
    saveAnnotations,
    navigateToNextImage,
    canNavigate,
    showMessage,
    addLogEntry,
    clearCanvas,
    resetZoom,
    centerCanvas
};

// Also expose individual functions for backward compatibility
window.loadImage = loadImage;
window.handleImageSelection = handleImageSelection;
window.handleBatchSelection = handleBatchSelection;
window.loadSensorData = loadSensorData;
window.displaySensorData = displaySensorData;
window.loadAnnotations = loadAnnotations;
window.saveAnnotations = saveAnnotations;
window.navigateToNextImage = navigateToNextImage;
window.canNavigate = canNavigate;
window.showMessage = showMessage;
window.addLogEntry = addLogEntry;