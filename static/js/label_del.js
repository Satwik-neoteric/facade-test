document.addEventListener('DOMContentLoaded', function() {
    console.log("[DEBUG] DOM Content Loaded - Starting label.js initialization");
    
    // Check if critical elements exist
    const criticalElements = {
        'mode-toggle-switch': document.getElementById('mode-toggle-switch'),
        'submit-btn': document.getElementById('submit-btn'),
        'delete-btn': document.getElementById('delete-btn'),
        'skip-btn': document.getElementById('skip-btn'),
        'accept-btn': document.getElementById('accept-btn'),
        'reject-btn': document.getElementById('reject-btn'),
        'mode-label-left': document.getElementById('mode-label-left'),
        'mode-label-right': document.getElementById('mode-label-right')
    };
    
    console.log("[DEBUG] Critical elements check:", criticalElements);
    
    Object.keys(criticalElements).forEach(key => {
        if (!criticalElements[key]) {
            console.error(`[DEBUG] Missing critical element: ${key}`);
        } else {
            console.log(`[DEBUG] ✓ Found element: ${key}`, criticalElements[key]);
        }
    });
    // State variables
    let userRoles = [];
    let currentMode = 'label'; // default mode
    let currentBatchId = null;
    let currentImageId = null;
    let annotations = [];
    let categories = [];
    let isDrawing = false;
    let currentAnnotationPoints = [];
    let map = null;
    let marker = null;
    
    // Pan functionality state
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let currentPanX = 0;
    let currentPanY = 0;
    let currentScale = 1;
 
 
    // Get DOM elements - updated to match your HTML
    const modeToggleSwitch = document.getElementById('mode-toggle-switch');
    const submitBtn = document.getElementById('submit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const skipBtn = document.getElementById('skip-btn');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
      // Batch and image elements
    const batchSelect = document.getElementById('batch-selector');  // Matches HTML
    const imageList = document.getElementById('image-list');     // Matches HTML
   
    // Canvas and annotation elements
    const annotationCanvas = document.getElementById('annotation-canvas');
    const ctx = annotationCanvas.getContext('2d');
    const annotationList = document.getElementById('annotation-list');
   
    // Metadata elements
    const metadataBox = document.getElementById('metadata-box');
    const sensorDataTable = document.getElementById('sensor-data-table');
   
    // Class buttons
    const classButtons = document.querySelectorAll('.class-button');
   
    // Additional DOM elements
    const imageContainer = document.getElementById('canvas-container');      // Matches HTML
    const canvasWrapper = document.getElementById('canvas-wrapper');        // Add this
    const mainImage = document.getElementById('main-image');               // Will be created dynamically
    
    // Sidebar elements
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    const collapseLeftBtn = document.getElementById('collapse-left-sidebar');
    const collapseRightBtn = document.getElementById('collapse-right-sidebar');
    const expandLeftBtn = document.getElementById('expand-left-sidebar');
    const expandRightBtn = document.getElementById('expand-right-sidebar');
    
    // Bottom panel elements
    const bottomPanel = document.getElementById('bottom-panel');
    const collapseBottomBtn = document.getElementById('collapse-bottom-panel');
    const batchSelectionContainer = document.getElementById('batch-selection-container');
 
    // Initialize the application
    (async function() {
        try {
            console.log('Starting initialization...');
            await initializeUserRoles();
           
            if (isLabeller() || isReviewer()) {
                await loadBatches();
                await loadCategories();
                setupEventListeners();
                updateDOMReferences(); // Update DOM references after cloning buttons
                setupSidebarCollapse();
                setupModeToggle();
                setupImagePanZoom();
                
                // Show batch selection container
                if (batchSelectionContainer) {
                    batchSelectionContainer.classList.remove('hidden');
                }
                
                console.log('Application initialized');
            } else {
                console.error('No valid roles found');
            }
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    })();
 
    // Role management
    async function initializeUserRoles() {
        try {
            console.log('🔍 Fetching user info...');
            const response = await fetch('/api/users/me');
            if (!response.ok) throw new Error('Failed to fetch user info');
            const userData = await response.json();
            userRoles = userData.roles || [];
            console.log('👤 User roles:', userRoles);
            await setupBasedOnRole();
        } catch (error) {
            console.error('❌ Error initializing user:', error);
        }
    }
 
    function isAdministrator() {
        // Check both role systems
        const hasAdminRole = userRoles.includes('Administrator');
        const hasMainJsAdminRole = window.AppState?.user?.role === 'Default Admin';
        return hasAdminRole || hasMainJsAdminRole;
    }
 
    function isLabeller() {
        // Check both role systems
        const hasLabellerRole = userRoles.includes('Labeller');
        const hasMainJsAdminRole = window.AppState?.user?.role === 'Default Admin';
        return hasLabellerRole || isAdministrator() || hasMainJsAdminRole;
    }
 
    function isReviewer() {
        // Check both role systems
        const hasReviewerRole = userRoles.includes('Reviewer');
        const hasMainJsReviewerRole = window.AppState?.user?.role === 'Reviewer';
        const hasMainJsAdminRole = window.AppState?.user?.role === 'Default Admin';
        return hasReviewerRole || isAdministrator() || hasMainJsReviewerRole || hasMainJsAdminRole;
    }
 
    async function setupBasedOnRole() {
        console.group('[DEBUG] Setting up UI based on roles');
        console.log('Label.js roles (array):', userRoles);
        console.log('Main.js role (string):', window.AppState?.user?.role);
        console.log('isAdministrator:', isAdministrator());
        console.log('isReviewer:', isReviewer());
        console.log('isLabeller:', isLabeller());
        console.log('Has both roles (can toggle):', isLabeller() && isReviewer());
       
        // Hide all action buttons initially except Skip
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Ensure Skip button is always visible - global button not tied to any role
        if (skipBtn) {
            skipBtn.style.display = 'inline-flex';
            skipBtn.disabled = false; // Ensure it's always enabled
            console.log('[DEBUG] Initial setup - Skip button made visible and enabled');
        }
 
        if (isReviewer() && !isLabeller()) {
            // Pure Reviewer (not Admin, not Labeller) - locked to validate mode
            console.log('[DEBUG] User is pure Reviewer only');
            currentMode = 'validate';
            if (modeToggleSwitch) {
                modeToggleSwitch.checked = true;
                modeToggleSwitch.disabled = true;
            }
            if (acceptBtn) acceptBtn.style.display = 'inline-flex';
            if (rejectBtn) rejectBtn.style.display = 'inline-flex';
           
            // Disable annotation controls for reviewers
            if (annotationCanvas) {
                annotationCanvas.style.pointerEvents = 'none';
                annotationCanvas.style.opacity = '0.5';
            }
            
            // Call the global toggle function
            if (typeof window.toggleValidationMode === 'function') {
                window.toggleValidationMode(true);
            }
        } else if (isLabeller() && !isReviewer()) {
            // Pure Labeller (not Admin, not Reviewer) - locked to label mode
            console.log('[DEBUG] User is pure Labeller only');
            currentMode = 'label';
            if (modeToggleSwitch) {
                modeToggleSwitch.checked = false;
                modeToggleSwitch.disabled = true;
            }
            if (submitBtn) submitBtn.style.display = 'inline-flex';
            if (deleteBtn) deleteBtn.style.display = 'inline-flex';
            
            // Call the global toggle function
            if (typeof window.toggleValidationMode === 'function') {
                window.toggleValidationMode(false);
            }
        } else if (isLabeller() && isReviewer()) {
            // User has BOTH roles (includes Administrators) - enable toggle switch
            console.log('[DEBUG] User has both roles (Admin or dual-role user), enabling toggle');
            currentMode = 'label'; // Default to label mode
            
            // Set up the mode toggle event listener for users with both roles
            setupModeToggle();
            
            // Update UI to label mode initially
            updateUIForMode(false);
        } else {
            // No valid roles
            console.error('[DEBUG] User has no valid roles');
        }
        
        // Always set up initial label styling
        updateLabelStyling(currentMode === 'validate');
        
        console.groupEnd();
    }
 
    function updateUIForMode(isValidateMode) {
        currentMode = isValidateMode ? 'validate' : 'label';
        
        console.log(`[DEBUG] updateUIForMode called with isValidateMode: ${isValidateMode}`);
        
        if (isValidateMode) {
            // Validate mode - Show Accept/Reject, hide Submit/Delete, keep Skip
            console.log('[DEBUG] Switching to validate mode');
            
            // Hide labeling buttons
            if (submitBtn) {
                submitBtn.style.display = 'none';
                console.log('[DEBUG] Hiding submit button');
            }
            if (deleteBtn) {
                deleteBtn.style.display = 'none';
                console.log('[DEBUG] Hiding delete button');
            }
            
            // Show validation buttons (for any user in validate mode)
            if (acceptBtn) {
                acceptBtn.style.display = 'inline-flex';
                console.log('[DEBUG] Showing accept button');
            }
            if (rejectBtn) {
                rejectBtn.style.display = 'inline-flex';
                console.log('[DEBUG] Showing reject button');
            }
            
            // Keep Skip button visible (always shown in both modes)
            if (skipBtn) {
                skipBtn.style.display = 'inline-flex !important'; // Use !important to override any other styles
                skipBtn.disabled = false; // Ensure it's always enabled
                skipBtn.classList.add('global-button'); // Mark as globally available
                
                // Force visibility with inline style
                skipBtn.setAttribute('style', 'display: inline-flex !important; visibility: visible !important;');
                
                // Add a data attribute to track that we've explicitly set this
                skipBtn.setAttribute('data-always-visible', 'true');
                
                console.log('[DEBUG] Keeping skip button visible and enabled with forced styles');
            }
            
            // Disable canvas interaction for validation
            if (annotationCanvas) {
                annotationCanvas.style.pointerEvents = 'none';
                console.log('[DEBUG] Disabled canvas interaction');
            }
            
            // Disable class selection
            const classButtons = document.querySelectorAll('.class-button');
            classButtons.forEach(button => {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
            });
            
        } else {
            // Label mode - Show Submit/Delete, hide Accept/Reject, keep Skip
            console.log('[DEBUG] Switching to label mode');
            
            // Hide validation buttons
            if (acceptBtn) {
                acceptBtn.style.display = 'none';
                console.log('[DEBUG] Hiding accept button');
            }
            if (rejectBtn) {
                rejectBtn.style.display = 'none';
                console.log('[DEBUG] Hiding reject button');
            }
            
            // Show labeling buttons (for labellers)
            if (isLabeller()) {
                if (submitBtn) {
                    submitBtn.style.display = 'inline-flex';
                    console.log('[DEBUG] Showing submit button');
                }
                if (deleteBtn) {
                    deleteBtn.style.display = 'inline-flex';
                    console.log('[DEBUG] Showing delete button');
                }
                
                // Enable canvas interaction for labeling
                if (annotationCanvas) {
                    annotationCanvas.style.pointerEvents = 'auto';
                    console.log('[DEBUG] Enabled canvas interaction');
                }
            }
            
            // Keep Skip button visible (always shown in both modes)
            if (skipBtn) {
                skipBtn.style.display = 'inline-flex !important'; // Use !important to override any other styles
                skipBtn.disabled = false; // Ensure it's always enabled
                skipBtn.classList.add('global-button'); // Mark as globally available
                
                // Force visibility with inline style
                skipBtn.setAttribute('style', 'display: inline-flex !important; visibility: visible !important;');
                
                // Add a data attribute to track that we've explicitly set this
                skipBtn.setAttribute('data-always-visible', 'true');
                
                console.log('[DEBUG] Keeping skip button visible and enabled with forced styles');
            }
            
            // Enable class selection
            const classButtons = document.querySelectorAll('.class-button');
            classButtons.forEach(button => {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            });
        }
        
        // Update mode status
        const modeStatus = document.getElementById('mode-status');
        if (modeStatus) {
            modeStatus.textContent = isValidateMode ? 'Validate' : 'Label';
            modeStatus.className = isValidateMode ? 'text-orange-400' : 'text-blue-400';
        }
        
        // Add/remove validation mode class to body for CSS styling
        if (isValidateMode) {
            document.body.classList.add('validation-mode');
        } else {
            document.body.classList.remove('validation-mode');
        }
        
        console.log(`Mode switched to: ${currentMode}`);
    }    function setupEventListeners() {
        if (batchSelect) {
            batchSelect.addEventListener('change', handleBatchSelection);
        }
       
        if (submitBtn) {
            // Clean up any existing event listeners to prevent duplicates
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            
            // Add event listener to the fresh element
            newSubmitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent multiple clicks while processing
                if (this.dataset.processing === 'true') {
                    console.log('[DEBUG] Submit already processing, ignoring click');
                    return;
                }
                
                this.dataset.processing = 'true';
                this.disabled = true;
                
                console.log('[DEBUG] Submit button clicked');
                
                try {
                    submitAnnotations();
                } finally {
                    // Re-enable after a delay
                    setTimeout(() => {
                        this.dataset.processing = 'false';
                        this.disabled = false;
                    }, 1000);
                }
            });
            
            // Update global reference
            window.submitBtn = newSubmitBtn;
        }
       
        if (acceptBtn) {
            acceptBtn.addEventListener('click', acceptAnnotations);
        }
       
        if (rejectBtn) {
            rejectBtn.addEventListener('click', rejectAnnotations);
        }
       
        if (deleteBtn) {
            // Clean up any existing event listeners to prevent duplicates
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            
            // Add event listener to the fresh element
            newDeleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent multiple clicks while processing
                if (this.dataset.processing === 'true') {
                    console.log('[DEBUG] Delete already processing, ignoring click');
                    return;
                }
                
                this.dataset.processing = 'true';
                this.disabled = true;
                
                console.log('[DEBUG] Delete button clicked');
                
                try {
                    deleteAnnotations();
                } finally {
                    // Re-enable after a delay
                    setTimeout(() => {
                        this.dataset.processing = 'false';
                        this.disabled = false;
                    }, 1000);
                }
            });
            
            // Update global reference
            window.deleteBtn = newDeleteBtn;
        }
       
        if (skipBtn) {
            // Clean up any existing event listeners to prevent duplicates
            const newSkipBtn = skipBtn.cloneNode(true);
            skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
            
            // Add event listener to the fresh element
            newSkipBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[DEBUG] Skip button clicked');
                
                // Add small delay to ensure UI updates properly
                setTimeout(() => {
                    skipImage();
                }, 50);
            });
            
            // Update reference
            window.skipBtn = newSkipBtn;
        }
       
        // Add class button event listeners - this will be updated when classes are loaded
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('class-button')) {
                const classButtons = document.querySelectorAll('.class-button');
                classButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // F key to fit image to container
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                fitImageToContainer();
            }
            // R key to reset pan/zoom
            else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                resetPanZoom();
            }
            // Space key to fit image (alternative)
            else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                fitImageToContainer();
            }
        });
        
        console.log('Event listeners set up successfully');
        console.log('Pan controls: Shift + Left Click to pan, Ctrl + Mouse Wheel to zoom');
        console.log('Keyboard shortcuts: F or Space to fit image, R to reset zoom');
    }
 
    // Load batches from API - updated implementation
    function loadBatches() {
        if (!batchSelect) return;
       
        batchSelect.innerHTML = '<option value="">Loading batches...</option>';
       
        fetch('/api/batches')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                console.log('Raw batches:', data);
                // Handle raw batch names from API
                const batches = Array.isArray(data) ? data :
                              Array.isArray(data.batches) ? data.batches : [];
               
                // Convert batch names to objects
                const processedBatches = batches.map(batch => ({
                    id: batch,
                    name: batch
                }));
               
                console.log('Processed batches:', processedBatches);
                populateBatchSelect(processedBatches);
                if (batchSelect) batchSelect.style.display = 'block';
            })
            .catch(error => {
                console.error('Error loading batches:', error);
                batchSelect.innerHTML = '<option value="">Error loading batches</option>';
            });
    }
 
    // Populate batch select dropdown - updated implementation
    function populateBatchSelect(batches) {
        if (!batchSelect) return;
       
        batchSelect.innerHTML = '<option value="">Select a batch</option>';
       
        if (batches && batches.length > 0) {
            batches.forEach(batch => {
                const option = document.createElement('option');
                option.value = batch.id || batch; // Handle both object and string
                option.textContent = `Batch ${batch.name || batch}`; // Handle both object and string
                batchSelect.appendChild(option);
            });
           
            // Make sure the select is visible
            batchSelect.style.display = 'block';
           
            // Show batch count
            const batchCount = document.getElementById('batch-info');
            if (batchCount) {
                batchCount.textContent = `${batches.length} batches available`;
                batchCount.style.display = 'block';
            }
        } else {
            batchSelect.innerHTML = '<option value="">No batches found</option>';
        }
    }
 
    // Handle batch selection
    function handleBatchSelection() {
        const batchId = batchSelect.value;
        currentBatchId = batchId;
        console.log('Selected batchId:', batchId); // Debug log
 
        if (!batchId) {
            imageList.innerHTML = '<li class="loading">Select a batch first</li>';
            return;
        }
 
        loadImagesForBatch(batchId);
    }
 
    // Load images for a batch - updated implementation
    function loadImagesForBatch(batchId) {
        if (!batchId || !imageList) return;
       
        imageList.innerHTML = '<li class="loading">Loading images...</li>';
       
        fetch(`/api/batch/${batchId}/images`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                console.log('Images data:', data);
                // Extract images array from response object
                const images = data.images || [];
                if (!Array.isArray(images)) {
                    throw new Error('Invalid images array format');
                }
                populateImageList(images);
                updateBatchInfo({
                    length: data.total_items,
                    currentPage: data.current_page,
                    totalPages: data.total_pages
                });
            })
            .catch(error => {
                console.error('Error loading images:', error);
                imageList.innerHTML = `<li class="error">Failed to load images: ${error.message}</li>`;
            });
    }
 
    function populateImageList(images) {
        if (!imageList) return;
       
        imageList.innerHTML = '';
       
        if (!images || images.length === 0) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'No images found in this batch';
            imageList.appendChild(li);
            return;
        }
 
        images.forEach((image, index) => {
            const li = document.createElement('li');
            li.textContent = image.fileName || image.name || `Image ${index + 1}`;
            li.dataset.imageId = image.id;
            li.className = 'image-item';
            
            // Add click event listener with debug logging
            li.addEventListener('click', () => {
                console.log(`Clicking image: ${image.id}`);
                handleImageSelection(image.id);
            });
           
            // Add selected state if this is the current image
            if (image.id === currentImageId) {
                li.classList.add('active');
            }
           
            imageList.appendChild(li);
        });

        console.log(`Populated ${images.length} images in list`);
    }
 
    // Update batch info
    function updateBatchInfo(data) {
        const batchInfo = document.getElementById('batch-info');
       
        if (data && data.length && batchInfo) {
            batchInfo.innerHTML = `
                ${data.length} images total
                ${data.totalPages > 1 ? `(Page ${data.currentPage}/${data.totalPages})` : ''}
            `;
            batchInfo.style.display = 'block';
            batchInfo.classList.remove('hidden');
        } else if (batchInfo) {
            batchInfo.style.display = 'none';
            batchInfo.classList.add('hidden');
        }
    }
 
    // Load image - updated implementation using same API pattern as main.js
    async function loadImage(imageId) {
        if (!imageId || !currentBatchId) {
            console.error('[ERROR] Invalid image or batch ID');
            return Promise.reject(new Error('Invalid image or batch ID'));
        }
        
        // Generate a unique load ID for this image selection (same as main.js)
        const loadId = Date.now() + Math.random();
        console.log(`[DEBUG] Loading image: ${imageId} from batch: ${currentBatchId} (loadId: ${loadId})`);
        
        try {
            // Update current image state
            currentImageId = imageId;
            
            // Clear previous state before loading new image
            clearCanvas();
            annotations = [];
            if (typeof updateAnnotationList === 'function') {
                updateAnnotationList();
            }
            
            // Show loading status
            updateStatus('image-status', 'Loading image...');
            
            // Main API call - same endpoint as main.js
            console.log(`[DEBUG] Fetching image data from: /api/batch/${currentBatchId}/image/${imageId}`);
            const imageResponse = await fetch(`/api/batch/${currentBatchId}/image/${imageId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!imageResponse.ok) {
                throw new Error(`HTTP error! Status: ${imageResponse.status} - ${imageResponse.statusText}`);
            }
            
            const imageData = await imageResponse.json();
            console.log('[DEBUG] Image data received:', imageData);
            
            if (!imageData || !imageData.url) {
                throw new Error('No image URL in response');
            }
            
            // Update UI with image information
            updateStatus('image-name-status', imageData.fileName || `Image ${imageId}`);
            
            // Load the actual image into the display (similar to main.js preloading)
            await loadImageIntoDisplay(imageData.url, imageData);
            
            // Load related data in parallel (same pattern as main.js)
            const dataLoadPromises = [
                loadAnnotationsForImage(currentBatchId, imageId).catch(error => {
                    console.warn('[WARN] Failed to load annotations:', error);
                    return null;
                }),
                loadSensorDataForImage(currentBatchId, imageId).catch(error => {
                    console.warn('[WARN] Failed to load sensor data:', error);
                    return null;
                })
            ];
            
            // Wait for all data to load (using Promise.allSettled like main.js)
            const [annotationsResult, sensorResult] = await Promise.allSettled(dataLoadPromises);
            
            // Handle annotations result
            if (annotationsResult.status === 'fulfilled' && annotationsResult.value) {
                annotations = annotationsResult.value;
                drawAnnotations();
                if (typeof updateAnnotationList === 'function') {
                    updateAnnotationList();
                }
                console.log(`[DEBUG] Loaded ${annotations.length} annotations`);
            } else {
                console.warn('[WARN] No annotations loaded or failed to load');
                annotations = [];
            }
            
            // Handle sensor data result
            if (sensorResult.status === 'fulfilled' && sensorResult.value) {
                updateSensorDisplay(sensorResult.value);
                console.log('[DEBUG] Sensor data loaded successfully');
            } else {
                console.warn('[WARN] No sensor data loaded or failed to load');
            }
            
            // Update final status
            updateStatus('image-status', 'Image loaded successfully');
            console.log(`[DEBUG] Image ${imageId} loaded successfully with loadId: ${loadId}`);
            
            return imageData;
            
        } catch (error) {
            console.error('[ERROR] Failed to load image:', error);
            updateStatus('image-status', `Error: ${error.message}`);
            
            // Show error in image container
            if (imageContainer) {
                imageContainer.innerHTML = `<div class="error-message">
                    <p>Failed to load image: ${error.message}</p>
                    <button onclick="loadImage('${imageId}')" class="retry-btn">Retry</button>
                </div>`;
                imageContainer.style.display = 'block';
            }
            
            // Clear state on error
            annotations = [];
            if (typeof updateAnnotationList === 'function') {
                updateAnnotationList();
            }
            clearCanvas();
            
            throw error;
        }
    }

    // Load annotations for image
    function loadAnnotationsForImage(batchId, imageId) {
        fetch(`/api/annotations/${batchId}/${imageId}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                console.log('Loaded annotation data:', data);
                
                // Handle COCO format response
                if (data.coco && data.coco.annotations) {
                    annotations = data.coco.annotations;
                    console.log('Loaded', annotations.length, 'annotations in COCO format');
                } else if (data.annotations) {
                    // Handle direct annotations array (fallback)
                    annotations = data.annotations;
                    console.log('Loaded', annotations.length, 'annotations in direct format');
                } else if (Array.isArray(data)) {
                    // Handle array response (legacy)
                    annotations = data;
                    console.log('Loaded', annotations.length, 'annotations in array format');
                } else {
                    // No annotations found
                    annotations = [];
                    console.log('No annotations found for this image');
                }
                
                updateAnnotationList();
                drawAnnotations();
            })
            .catch(error => {
                console.error('Error loading annotations:', error);
                annotations = [];
                updateAnnotationList();
            });
    }
 
    // Load categories
    function loadCategories() {
        fetch('/api/classes')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                categories = data || [];
            })
            .catch(error => {
                console.error('Error loading categories:', error);
                categories = [];
            });
    }
 
    // Load sensor data for image
    function loadSensorDataForImage(batchId, imageId) {
        fetch(`/api/images/${batchId}/${imageId}/sensor`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data && data.sensor) {
                    updateSensorDisplay(data.sensor);
                }
            })
            .catch(error => {
                console.error('Error loading sensor data:', error);
            });
    }
 
    // Update sensor data display
    function updateSensorDisplay(sensor) {
        if (!sensorDataTable) return;
       
        sensorDataTable.innerHTML = `
            <tr><th>Timestamp (UTC):</th><td>${sensor['Timestamp (UTC)'] || 'N/A'}</td></tr>
            <tr><th>Latitude:</th><td>${sensor['Latitude (deg)'] || 'N/A'}</td></tr>
            <tr><th>Longitude:</th><td>${sensor['Longitude (deg)'] || 'N/A'}</td></tr>
            <tr><th>Altitude:</th><td>${sensor['Altitude (meters)'] ? `${sensor['Altitude (meters)']} m` : 'N/A'}</td></tr>
            <tr><th>Fix Type:</th><td>${sensor['Fix Type'] || 'N/A'}</td></tr>
            <tr><th>Fix Status:</th><td>${sensor['Fix Status'] || 'N/A'}</td></tr>
            <tr><th>Satellites:</th><td>${sensor['Number of Satellites'] || 'N/A'}</td></tr>
            <tr><th>Accuracy:</th><td>${sensor['Horizontal Accuracy (m)'] ? `${sensor['Horizontal Accuracy (m)']} m` : 'N/A'}</td></tr>
        `;
    }
 
    // Update status bar
    function updateStatus(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
 
    // Drawing Annotations
    function drawAnnotations() {
        if (!annotationCanvas) return;
       
        clearCanvas();
        if (!annotations || !annotations.length) return;
       
        annotations.forEach(annotation => {
            drawAnnotation(annotation);
        });
    }
 
    function drawAnnotation(annotation) {
        // Handle both COCO format and legacy format
        let points = [];
        
        if (annotation.segmentation && annotation.segmentation.length > 0) {
            // COCO format - segmentation is array of arrays of [x1,y1,x2,y2,...]
            const segmentation = annotation.segmentation[0]; // Take first segmentation
            for (let i = 0; i < segmentation.length; i += 2) {
                points.push({ x: segmentation[i], y: segmentation[i + 1] });
            }
        } else if (annotation.points && Array.isArray(annotation.points)) {
            // Legacy format - points is array of {x, y} objects
            points = annotation.points;
        } else {
            console.warn('Annotation has no valid points data:', annotation);
            return;
        }
        
        if (points.length < 3) {
            console.warn('Annotation has insufficient points:', points.length);
            return;
        }
       
        // Find category for coloring
        const categoryId = annotation.category_id || annotation.categoryId;
        const category = categories.find(c => c.id === categoryId || c.name === annotation.categoryName);
        const color = category?.color || '#FF0000';
       
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = `${color}33`;
       
        ctx.beginPath();
        const firstPoint = normalizePoint(points[0]);
        ctx.moveTo(firstPoint.x, firstPoint.y);
       
        for (let i = 1; i < points.length; i++) {
            const point = normalizePoint(points[i]);
            ctx.lineTo(point.x, point.y);
        }
       
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }
 
    function normalizePoint(point) {
        const img = document.getElementById('main-image');
        if (!img) return { x: 0, y: 0 };
       
        return {
            x: (point.x / img.naturalWidth) * annotationCanvas.width,
            y: (point.y / img.naturalHeight) * annotationCanvas.height
        };
    }
 
    function clearCanvas() {
        if (!annotationCanvas) return;
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
    }
 
    // Update the annotation list
    function updateAnnotationList() {
        if (!annotationList) return;
       
        annotationList.innerHTML = '';
        
        // Use AppState.annotations if available, otherwise fall back to local annotations
        const currentAnnotations = window.AppState?.annotations || annotations || [];
       
        if (!currentAnnotations || !currentAnnotations.length) {
            annotationList.innerHTML = '<div class="empty">No annotations yet</div>';
            return;
        }
       
        currentAnnotations.forEach((annotation, index) => {
            // Handle both COCO format and legacy format
            const categoryId = annotation.category_id || annotation.categoryId;
            const category = categories.find(c => c.id === categoryId || c.name === annotation.categoryName);
            const categoryName = category?.name || `Category ${categoryId}` || 'Unknown';
            const color = category?.color || '#FF0000';
           
            const item = document.createElement('li');
            item.className = 'annotation-item';
            item.innerHTML = `
                <span class="category-badge" style="background-color: ${color}">${categoryName}</span>
                <div class="annotation-actions">
                    <button class="btn-edit" data-index="${index}">Edit</button>
                    <button class="btn-delete" data-index="${index}">Delete</button>
                </div>
            `;
           
            annotationList.appendChild(item);
        });
    }
 
    // Button action functions
    function submitAnnotations() {
        if (!isLabeller()) {
            console.warn('Submit action is only available for labellers');
            return;
        }
        syncBatchAndImageFromAppState();
        console.log('Submitting annotations for image:', currentImageId);
        // Check both local annotations and AppState.annotations
        const currentAnnotations = window.AppState?.annotations || annotations || [];
        console.log('Current annotations count:', currentAnnotations.length);
        // Validate that we have annotations to submit
        if (!currentAnnotations || currentAnnotations.length === 0) {
            showMessage('No annotations to submit', 'warning');
            return;
        }
        saveAnnotationsToServer().then(() => {
            showMessage('Annotations submitted successfully', 'success');
            // loadNextImage();
                setTimeout(() => {
                const skipBtn = document.getElementById('skip-btn');
                if (skipBtn) {
                    skipBtn.click();
                } else {
                    // Fallback: call skip function directly
                    skipImage();
                }
            }, 500); // Small delay to ensure user sees the success message
            
        }).catch(error => {
            console.error('Error submitting annotations:', error);
            showMessage('Error submitting annotations: ' + error.message, 'error');
        });
    }
 
    function acceptAnnotations() {
        if (!isReviewer()) {
            console.warn('Accept action is only available for reviewers');
            return;
        }
        
        console.log('Accepting annotations for image:', currentImageId);
        
        // Save the validation status as 'accepted'
        saveValidationStatus('accepted').then(() => {
            showMessage('Annotations accepted', 'success');
            // Move to next image
            loadNextImage();
        }).catch(error => {
            console.error('Error accepting annotations:', error);
            showMessage('Error accepting annotations: ' + error.message, 'error');
        });
    }
 
    function rejectAnnotations() {
        if (!isReviewer()) {
            console.warn('Reject action is only available for reviewers');
            return;
        }
        
        console.log('Rejecting annotations for image:', currentImageId);
        
        // Save the validation status as 'rejected'
        saveValidationStatus('rejected').then(() => {
            showMessage('Annotations rejected', 'warning');
            // Move to next image
            loadNextImage();
        }).catch(error => {
            console.error('Error rejecting annotations:', error);
            showMessage('Error rejecting annotations: ' + error.message, 'error');
        });
    }
 
    function deleteAnnotations() {
        if (!isLabeller()) {
            console.warn('Delete action is only available for labellers');
            return;
        }
        
        console.log('Deleting annotations for image:', currentImageId);
        
        // Confirm deletion
        if (!confirm('Are you sure you want to delete all annotations for this image?')) {
            return;
        }
        
        // Show loading state
        showMessage('Deleting annotations...', 'info');
        
        // Clear annotations array and update UI immediately
        annotations = [];
        if (window.AppState) {
            window.AppState.annotations = [];
        }
        clearCanvas();
        updateAnnotationList();
        
        // Send the cleared state to server to effectively delete the annotations
        saveAnnotationsToServer().then(() => {
            showMessage('Annotations deleted successfully', 'success');
            
            // AUTO-SKIP: Automatically move to next image after successful deletion
            console.log('[DEBUG] Auto-skipping to next image after deletion');
            setTimeout(() => {
                const skipBtn = document.getElementById('skip-btn');
                if (skipBtn) {
                    skipBtn.click();
                } else {
                    // Fallback: call skip function directly
                    skipImage();
                }
            }, 500); // Small delay to ensure user sees the success message
            
        }).catch(error => {
            console.error('Error deleting annotations:', error);
            showMessage('Error deleting annotations: ' + error.message, 'error');
            
            // Try alternative delete approach if the save method fails
            return deleteAnnotationsAlternative();
        }).then(() => {
            // This runs after either successful save or alternative delete
            if (annotations.length === 0) {
                // AUTO-SKIP: Also skip after alternative deletion method
                console.log('[DEBUG] Auto-skipping to next image after alternative deletion');
                setTimeout(() => {
                    const skipBtn = document.getElementById('skip-btn');
                    if (skipBtn) {
                        skipBtn.click();
                    } else {
                        // Fallback: call skip function directly
                        skipImage();
                    }
                }, 500);
            }
        }).catch(fallbackError => {
            console.error('Fallback delete method also failed:', fallbackError);
            showMessage('Failed to delete annotations from server', 'error');
        });
    }
    
    // Alternative delete method for when saving empty annotations doesn't work
    async function deleteAnnotationsAlternative() {
        const batchId = window.AppState?.currentBatch || currentBatchId;
        const imageId = window.AppState?.currentImageId || currentImageId;
        
        if (!batchId || !imageId) {
            throw new Error('No batch or image selected');
        }
        
        try {
            // Try to use the clear endpoint if it exists
            const response = await fetch('/api/annotations/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    batch_id: batchId,
                    image_id: imageId
                })
            });
            
            if (!response.ok) {
                throw new Error(`Clear endpoint failed: ${response.statusText}`);
            }
            
            console.log('Successfully cleared annotations via clear endpoint');
        } catch (clearError) {
            console.warn('Clear endpoint not available, trying DELETE method:', clearError);
            
            // Fallback: try a DELETE request to the annotations endpoint
            const deleteResponse = await fetch(`/api/annotations/${batchId}/${imageId}?batch_id=${batchId}&image_id=${imageId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!deleteResponse.ok) {
                throw new Error(`DELETE request failed: ${deleteResponse.statusText}`);
            }
            
            console.log('Successfully deleted annotations via DELETE method');
        }
    }
 
    function skipImage() {
        console.log('[DEBUG] Skipping image:', currentImageId);
        
        // Add throttling to prevent accidental double clicks
        if (window.AppState && typeof window.AppState.navigationThrottle === 'object') {
            const now = Date.now();
            const timeSinceLastAction = now - (window.AppState.navigationThrottle.lastAction || 0);
            const minInterval = window.AppState.navigationThrottle.minInterval || 300;
            
            if (timeSinceLastAction < minInterval) {
                console.log(`[DEBUG] Skip throttled (${timeSinceLastAction}ms < ${minInterval}ms)`);
                return; // Silently throttle to prevent double skips
            }
            
            // Update last action time
            window.AppState.navigationThrottle.lastAction = now;
        }
        
        // Clear any existing state before moving to next image
        if (window.AppState) {
            // Reset annotations state to prevent conflicts
            window.AppState.annotations = [];
        }
        
        // Clear local annotations state
        annotations = [];
        clearCanvas();
        updateAnnotationList();
        
        // Move to next image without saving
        loadNextImage();
        
        showMessage('Image skipped', 'info');
    }
 
    function handleImageSelection(imageId) {
        if (!imageId) return;
        
        console.log('[DEBUG] handleImageSelection called with imageId:', imageId);

        // Update current image ID immediately
        currentImageId = imageId;
        
        // Clear any existing state to prevent conflicts
        annotations = [];
        if (window.AppState) {
            window.AppState.currentImageId = imageId;
            window.AppState.annotations = [];
        }
        
        // Clear canvas immediately
        clearCanvas();
        updateAnnotationList();
       
        // Update UI state - mark the selected image as active
        const listItems = imageList.querySelectorAll('li');
        listItems.forEach(item => {
            item.classList.toggle('active', item.dataset.imageId === imageId);
        });
       
        // Show loading state
        if (imageContainer) {
            imageContainer.style.display = 'none';
        }
 
        // Load image and related data with proper error handling
        Promise.all([
            loadImage(imageId),
            loadAnnotationsForImage(currentBatchId, imageId),
            loadSensorDataForImage(currentBatchId, imageId)
        ]).then(() => {
            console.log('[DEBUG] Successfully loaded all image data for:', imageId);
        }).catch(error => {
            console.error('Error loading image data:', error);
            if (imageContainer) {
                imageContainer.innerHTML = `<p class="error">Error loading image: ${error.message}</p>`;
                imageContainer.style.display = 'block';
            }
            showMessage('Error loading image data', 'error');
        });
 
        // Update status bar
        updateStatus('image-name-status', `Image ${imageId}`);
    }
    
    // Helper to sync local batch/image IDs with AppState
    function syncBatchAndImageFromAppState() {
        if (window.AppState) {
            currentBatchId = window.AppState.currentBatch || currentBatchId;
            currentImageId = window.AppState.currentImageId || currentImageId;
        }
    }
    
    // Setup sidebar collapse functionality
    function setupSidebarCollapse() {
        // Left sidebar collapse/expand functionality
        if (collapseLeftBtn && leftSidebar) {
            collapseLeftBtn.addEventListener('click', function() {
                leftSidebar.classList.add('collapsed');
                const icon = collapseLeftBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-chevron-right';
                
                // Trigger a resize event to help canvas adjust
                window.dispatchEvent(new Event('resize'));
            });
        }
        
        if (expandLeftBtn && leftSidebar) {
            expandLeftBtn.addEventListener('click', function() {
                leftSidebar.classList.remove('collapsed');
                const icon = collapseLeftBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-chevron-left';
                
                // Trigger a resize event to help canvas adjust
                window.dispatchEvent(new Event('resize'));
            });
        }
        
        // Right sidebar collapse/expand functionality
        if (collapseRightBtn && rightSidebar) {
            collapseRightBtn.addEventListener('click', function() {
                rightSidebar.classList.add('collapsed');
                const icon = collapseRightBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-chevron-left';
                
                // Trigger a resize event to help canvas adjust
                window.dispatchEvent(new Event('resize'));
            });
        }
        
        if (expandRightBtn && rightSidebar) {
            expandRightBtn.addEventListener('click', function() {
                rightSidebar.classList.remove('collapsed');
                const icon = collapseRightBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-chevron-right';
                
                // Trigger a resize event to help canvas adjust
                window.dispatchEvent(new Event('resize'));
            });
        }
        
        // Bottom panel collapse functionality
        if (collapseBottomBtn && bottomPanel) {
            collapseBottomBtn.addEventListener('click', function() {
                bottomPanel.classList.toggle('collapsed');
                const icon = collapseBottomBtn.querySelector('i');
                
                if (bottomPanel.classList.contains('collapsed')) {
                    if (icon) icon.className = 'fas fa-chevron-up';
                } else {
                    if (icon) icon.className = 'fas fa-chevron-down';
                }
                
                // Trigger a resize event to help canvas adjust
                window.dispatchEvent(new Event('resize'));
            });
        }
    }
    
    // Setup mode toggle functionality
    function setupModeToggle() {
        console.log("[DEBUG] Starting setupModeToggle");
        
        // Re-get the toggle element to ensure it exists
        const toggle = document.getElementById('mode-toggle-switch');
        
        if (!toggle) {
            console.error("[DEBUG] Mode toggle switch element not found in DOM!");
            return;
        }
        
        console.log("[DEBUG] Setting up mode toggle in label.js");
        console.log("[DEBUG] Toggle element found:", toggle);
        console.log("[DEBUG] Toggle current checked state:", toggle.checked);
        console.log("[DEBUG] Toggle current disabled state:", toggle.disabled);
        
        // Wait a moment to ensure main.js has finished its initialization
        setTimeout(() => {
            console.log("[DEBUG] Setting toggle state after delay");
            
            // Set initial state and enable the toggle (only if user has both roles)
            if (isLabeller() && isReviewer()) {
                toggle.checked = currentMode === 'validate';
                toggle.disabled = false; // Ensure it's enabled
                console.log("[DEBUG] Toggle state set for dual-role user - checked:", toggle.checked, "disabled:", toggle.disabled);
            } else {
                console.log("[DEBUG] Single role user - toggle controlled by main.js");
            }
            
            // Clear any existing event listeners first
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
            
            // Set up event listeners on the fresh element
            setupToggleEventListeners(newToggle);
            
        }, 100); // Small delay to avoid conflicts with main.js
    }
    
    // Separate function to set up event listeners
    function setupToggleEventListeners(toggle) {
        console.log("[DEBUG] Setting up event listeners for toggle");
        
        // Add change event listener
        toggle.addEventListener('change', function(e) {
            console.log("[DEBUG] Toggle changed via change event:", this.checked);
            handleModeToggle.call(this, e);
        });
        
        // Add click event listener for debugging
        toggle.addEventListener('click', function(e) {
            console.log("[DEBUG] Toggle clicked:", this.checked);
            handleToggleClick.call(this, e);
        });
        
        // Also add click handler to the label wrapper
        const toggleContainer = document.querySelector('.mode-toggle-container');
        if (toggleContainer) {
            toggleContainer.addEventListener('click', function(e) {
                // Only trigger if clicking the toggle area, not the text labels
                if (e.target === toggleLabel || e.target === toggleDiv || e.target === toggle) {
                    console.log("[DEBUG] Toggle container clicked:", e.target);
                }
            });
        }
        
        // Also add click handler to the label
        const toggleLabel = toggle.closest('label');
        if (toggleLabel) {
            toggleLabel.addEventListener('click', function(e) {
                console.log("[DEBUG] Label CLICKED:", e);
                console.log("[DEBUG] Target:", e.target);
                
                // Prevent default label behavior and handle manually
                if (e.target !== toggle) {
                    e.preventDefault();
                    console.log("[DEBUG] Triggering toggle from label click");
                    
                    // Only allow toggle if user has both roles
                    if (isLabeller() && isReviewer() && !toggle.disabled) {
                        toggle.checked = !toggle.checked;
                        console.log("[DEBUG] Manually toggled checkbox to:", toggle.checked);
                        
                        // Create a synthetic change event
                        const changeEvent = new Event('change', { bubbles: true });
                        toggle.dispatchEvent(changeEvent);
                    }
                }
            });
            
            console.log("[DEBUG] Label element:", toggleLabel);
        }
        
        // Add direct click handler to the visual toggle div
        const toggleDiv = document.querySelector('#mode-toggle-switch + div');
        if (toggleDiv) {
            toggleDiv.addEventListener('click', function(e) {
                console.log("[DEBUG] Visual toggle div CLICKED:", e);
                e.preventDefault();
                e.stopPropagation();
                
                // Only allow toggle if user has both roles
                if (isLabeller() && isReviewer() && !toggle.disabled) {
                    toggle.checked = !toggle.checked;
                    console.log("[DEBUG] Manually toggled checkbox to:", toggle.checked);
                    
                    // Create a synthetic change event
                    const changeEvent = new Event('change', { bubbles: true });
                    toggle.dispatchEvent(changeEvent);
                }
            });
            console.log("[DEBUG] Added click handler to visual toggle div:", toggleDiv);
        }
        
        // Make the mode labels clickable
        const labelLeft = document.getElementById('mode-label-left');
        const labelRight = document.getElementById('mode-label-right');
        
        if (labelLeft) {
            labelLeft.addEventListener('click', function(e) {
                console.log("[DEBUG] Left label clicked - switching to Label mode");
                
                // Only allow toggle if user has both roles
                if (isLabeller() && isReviewer() && !toggle.disabled) {
                    toggle.checked = false;
                    const changeEvent = new Event('change', { bubbles: true });
                    toggle.dispatchEvent(changeEvent);
                }
            });
        }
        
        if (labelRight) {
            labelRight.addEventListener('click', function(e) {
                console.log("[DEBUG] Right label clicked - switching to Validate mode");
                
                // Only allow toggle if user has both roles
                if (isLabeller() && isReviewer() && !toggle.disabled) {
                    toggle.checked = true;
                    const changeEvent = new Event('change', { bubbles: true });
                    toggle.dispatchEvent(changeEvent);
                }
            });
        }
        
        console.log("[DEBUG] Mode toggle setup complete, initial state:", toggle.checked);
        
        // Mark that we've set up the listeners
        toggle._hasToggleListeners = true;
    }
    
    // Handler for toggle click events
    function handleToggleClick(e) {
        console.log("[DEBUG] Toggle CLICKED:", e);
        console.log("[DEBUG] Toggle checked after click:", this.checked);
    }
    
    // Handler for mode toggle changes
    function handleModeToggle(e) {
        // Only allow toggle if user has both roles
        if (!(isLabeller() && isReviewer())) {
            console.log("[DEBUG] User doesn't have both roles, ignoring toggle");
            return;
        }
        
        // Prevent the toggle if it's disabled
        if (this.disabled) {
            console.log("[DEBUG] Toggle is disabled, ignoring change");
            return;
        }
        
        const isValidateMode = this.checked;
        console.log(`[DEBUG] Toggle switched to: ${isValidateMode ? 'Validate' : 'Label'} mode in label.js`);
        
        // Update local state
        currentMode = isValidateMode ? 'validate' : 'label';
        
        // Update label text styling
        updateLabelStyling(isValidateMode);
        
        // Update UI in label.js
        updateUIForMode(isValidateMode);
        
        // Call main.js toggleValidationMode if available
        if (typeof window.toggleValidationMode === 'function') {
            console.log("[DEBUG] Calling global toggleValidationMode");
            try {
                window.toggleValidationMode(isValidateMode);
            } catch (error) {
                console.error("[DEBUG] Error calling global toggleValidationMode:", error);
            }
        } else {
            console.warn("[DEBUG] Global toggleValidationMode function not found - will retry");
            
            // Retry after a short delay in case main.js hasn't finished loading
            setTimeout(() => {
                if (typeof window.toggleValidationMode === 'function') {
                    console.log("[DEBUG] Retrying global toggleValidationMode call");
                    window.toggleValidationMode(isValidateMode);
                } else {
                    console.error("[DEBUG] Global toggleValidationMode still not available");
                }
            }, 100);
        }
    }
    
    // Function to update label styling
    function updateLabelStyling(isValidateMode) {
        const labelLeft = document.getElementById('mode-label-left');
        const labelRight = document.getElementById('mode-label-right');
        
        if (labelLeft && labelRight) {
            if (isValidateMode) {
                // Validate mode - highlight right label
                labelLeft.style.fontWeight = 'normal';
                labelLeft.classList.remove('text-blue-600');
                labelRight.style.fontWeight = 'bold';
                labelRight.classList.add('text-blue-600');
                console.log('[DEBUG] Updated labels for validate mode');
            } else {
                // Label mode - highlight left label
                labelLeft.style.fontWeight = 'bold';
                labelLeft.classList.add('text-blue-600');
                labelRight.style.fontWeight = 'normal';
                labelRight.classList.remove('text-blue-600');
                console.log('[DEBUG] Updated labels for label mode');
            }
        }
    }

    // Setup image pan and zoom functionality
    function setupImagePanZoom() {
        if (!imageContainer) return;
        
        // Prevent default drag behavior
        imageContainer.addEventListener('dragstart', (e) => e.preventDefault());
        
        // Mouse down event for starting pan
        imageContainer.addEventListener('mousedown', handlePanStart);
        
        // Mouse move event for panning
        document.addEventListener('mousemove', handlePanMove);
        
        // Mouse up event for ending pan
        document.addEventListener('mouseup', handlePanEnd);
        
        // Wheel event for zooming
        imageContainer.addEventListener('wheel', handleZoom);
        
        // Reset pan/zoom when new image loads
        imageContainer.addEventListener('imageLoaded', resetPanZoom);
        
        console.log('Image pan/zoom functionality initialized');
    }
    
    // Handle pan start (shift + left click)
    function handlePanStart(e) {
        if (e.shiftKey && e.button === 0) { // Left click with shift
            e.preventDefault();
            isPanning = true;
            panStartX = e.clientX - currentPanX;
            panStartY = e.clientY - currentPanY;
            imageContainer.classList.add('panning');
            console.log('Pan started');
        }
    }
    
    // Handle pan move
    function handlePanMove(e) {
        if (!isPanning) {
            // Show appropriate cursor when shift is held
            if (e.shiftKey && imageContainer) {
                imageContainer.style.cursor = 'grab';
            } else if (imageContainer) {
                imageContainer.style.cursor = '';
            }
            return;
        }
        
        e.preventDefault();
        currentPanX = e.clientX - panStartX;
        currentPanY = e.clientY - panStartY;
        
        updateImageTransform();
    }
    
    // Handle pan end
    function handlePanEnd(e) {
        if (isPanning) {
            isPanning = false;
            imageContainer.classList.remove('panning');
            imageContainer.style.cursor = '';
            console.log('Pan ended');
        }
    }
    
    // Handle zoom with mouse wheel
    function handleZoom(e) {
        if (e.ctrlKey) { // Ctrl + wheel for zoom
            e.preventDefault();
            
            const zoomIntensity = 0.1;
            const wheel = e.deltaY < 0 ? 1 : -1;
            const zoom = Math.exp(wheel * zoomIntensity);
            
            // Calculate zoom center point
            const rect = imageContainer.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;
            
            // Update scale with limits
            const newScale = Math.min(Math.max(0.1, currentScale * zoom), 5);
            
            if (newScale !== currentScale) {
                // Adjust pan to zoom around mouse position
                currentPanX = centerX - (centerX - currentPanX) * (newScale / currentScale);
                currentPanY = centerY - (centerY - currentPanY) * (newScale / currentScale);
                currentScale = newScale;
                
                updateImageTransform();
                updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
            }
        }
    }
    
    // Update image transform
    function updateImageTransform() {
        const canvasWrapper = document.getElementById('canvas-wrapper');
        if (canvasWrapper) {
            canvasWrapper.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
            canvasWrapper.style.transformOrigin = '0 0';
            canvasWrapper.style.transition = isPanning ? 'none' : 'transform 0.1s ease-out';
        }
    }
    
    // Reset pan and zoom
    function resetPanZoom() {
        currentPanX = 0;
        currentPanY = 0;
        currentScale = 1;
        updateImageTransform();
        updateStatus('zoom-status', 'Full');
        console.log('Pan/zoom reset');
    }
    
    // Fit image to container
    function fitImageToContainer() {
        const img = document.getElementById('main-image');
        if (!img || !imageContainer) return;
        
        const containerRect = imageContainer.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        
        const scaleX = containerRect.width / img.naturalWidth;
        const scaleY = containerRect.height / img.naturalHeight;
        currentScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        // Center the image
        currentPanX = (containerRect.width - img.naturalWidth * currentScale) / 2;
        currentPanY = (containerRect.height - img.naturalHeight * currentScale) / 2;
        
        updateImageTransform();
        updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
        console.log('Image fitted to container');
    }
    
    // Helper function to save validation status
    async function saveValidationStatus(status) {
        syncBatchAndImageFromAppState();
        const batchId = window.AppState?.currentBatch || currentBatchId;
        const imageId = window.AppState?.currentImageId || currentImageId;
        
        if (!batchId || !imageId) {
            throw new Error('No batch or image selected');
        }
        
        const payload = {
            batch_id: batchId,
            image_id: imageId,
            validation_status: status,
            reviewer_id: userRoles.join(','), // Simple user identification
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch('/api/admin/validation-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }
    
    // Helper function to load next image - independent of user roles
    function loadNextImage() {
        if (!imageList) {
            console.log('[DEBUG] No image list found');
            return;
        }
        
        const currentItem = imageList.querySelector('li.active');
        if (!currentItem) {
            console.log('[DEBUG] No active image found');
            return;
        }
        
        const nextItem = currentItem.nextElementSibling;
        if (nextItem && nextItem.dataset.imageId) {
            console.log('[DEBUG] Found next image:', nextItem.dataset.imageId);
            
            // Clear current state before loading next image
            if (annotationCanvas) {
                clearCanvas();
            }
            
            // Hide image container temporarily to show loading state
            if (imageContainer) {
                imageContainer.style.display = 'none';
            }
            
            // Update visual state immediately to provide feedback
            const allItems = imageList.querySelectorAll('li');
            allItems.forEach(item => item.classList.remove('active'));
            nextItem.classList.add('active');
            
            // Ensure the next item is visible (scroll if needed)
            const listRect = imageList.getBoundingClientRect();
            const itemRect = nextItem.getBoundingClientRect();
            
            if (itemRect.bottom > listRect.bottom || itemRect.top < listRect.top) {
                nextItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            // Update currentImageId before loading
            currentImageId = nextItem.dataset.imageId;
            
            // Sync with AppState if available
            if (window.AppState) {
                window.AppState.currentImageId = currentImageId;
                window.AppState.annotations = [];
            }
            
            // Load next image with proper error handling
            console.log('[DEBUG] Loading next image:', nextItem.dataset.imageId);
            try {
                handleImageSelection(nextItem.dataset.imageId);
            } catch (error) {
                console.error('[ERROR] Failed to load next image:', error);
                showMessage('Failed to load next image', 'error');
                
                // Show image container again even if loading failed
                if (imageContainer) {
                    imageContainer.style.display = 'block';
                }
            }
        } else {
            // No more images
            console.log('[DEBUG] No more images to review');
            showMessage('No more images to review', 'info');
        }
    }
    
    // Helper function to show messages (use existing UI system if available)
    function showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Try to use the global showMessage if available
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            // Fallback: create a simple notification
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : type === 'success' ? '#059669' : '#3b82f6'};
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }
    
    // Helper function to save annotations to server
    async function saveAnnotationsToServer() {
        syncBatchAndImageFromAppState();
        const batchId = window.AppState?.currentBatch || currentBatchId;
        const imageId = window.AppState?.currentImageId || currentImageId;
        
        if (!batchId || !imageId) {
            throw new Error('No batch or image selected');
        }
        
        const currentAnnotations = window.AppState?.annotations || annotations || [];
        console.log('Saving annotations to server:', currentAnnotations.length, 'annotations');
        console.log('Using endpoint:', `/api/annotations/${batchId}/${imageId}`);
        
        // Convert annotations to COCO format
        const cocoAnnotations = currentAnnotations.map((annotation, index) => {
            console.log(`Processing annotation ${index}:`, annotation);
            
            if (annotation.points) {
                // Fabric.js polygon format - convert to COCO
                let categoryId = annotation.category_id || annotation.categoryId;
                
                // If no category_id, try to find it based on the class name
                if (!categoryId && annotation.class) {
                    const classNames = window.AppState?.classes || categories || [];
                    const classIndex = classNames.indexOf(annotation.class);
                    categoryId = classIndex >= 0 ? classIndex + 1 : 1;
                }
                
                // Final fallback
                if (!categoryId) {
                    categoryId = 1;
                }
                
                console.log(`Annotation ${index} - class: "${annotation.class}", categoryId: ${categoryId}`);
                
                // Ensure segmentation coordinates are numbers - handle nested arrays and objects
                let flatPoints = [];
                if (Array.isArray(annotation.points)) {
                    annotation.points.forEach(point => {
                        if (typeof point === 'object' && point.x !== undefined && point.y !== undefined) {
                            // Point object {x, y}
                            flatPoints.push(Number(point.x), Number(point.y));
                        } else if (Array.isArray(point)) {
                            // Nested array
                            point.forEach(coord => flatPoints.push(Number(coord)));
                        } else {
                            // Direct coordinate
                            flatPoints.push(Number(point));
                        }
                    });
                }
                return {
                    id: index + 1,
                    image_id: imageId,
                    category_id: Math.floor(Number(categoryId)), // Ensure it's an integer
                    segmentation: [flatPoints], // COCO expects array of arrays
                    area: annotation.area || 0,
                    bbox: annotation.bbox || [0, 0, 0, 0],
                    iscrowd: 0
                };
            } else if (annotation.segmentation) {
                // Already in COCO format
                let categoryId = annotation.category_id || annotation.categoryId;
                
                // If no category_id, try to find it based on the class name
                if (!categoryId && annotation.class) {
                    const classNames = window.AppState?.classes || categories || [];
                    const classIndex = classNames.indexOf(annotation.class);
                    categoryId = classIndex >= 0 ? classIndex + 1 : 1;
                }
                
                // Final fallback
                if (!categoryId) {
                    categoryId = 1;
                }
                
                console.log(`Annotation ${index} - class: "${annotation.class}", categoryId: ${categoryId}`);
                
                // Ensure segmentation coordinates are numbers
                const segmentation = annotation.segmentation.map(segment => 
                    Array.isArray(segment) ? segment.map(coord => Number(coord)) : []
                );
                return {
                    ...annotation,
                    id: annotation.id || index + 1,
                    image_id: imageId,
                    category_id: Math.floor(Number(categoryId)), // Ensure it's an integer
                    segmentation: segmentation
                };
            } else {
                // Default format
                let categoryId = annotation.category_id || annotation.categoryId;
                
                // If no category_id, try to find it based on the class name
                if (!categoryId && annotation.class) {
                    const classNames = window.AppState?.classes || categories || [];
                    const classIndex = classNames.indexOf(annotation.class);
                    categoryId = classIndex >= 0 ? classIndex + 1 : 1;
                }
                
                // Final fallback
                if (!categoryId) {
                    categoryId = 1;
                }
                
                console.log(`Annotation ${index} - class: "${annotation.class}", categoryId: ${categoryId}`);
                
                return {
                    id: index + 1,
                    image_id: imageId,
                    category_id: Math.floor(Number(categoryId)), // Ensure it's an integer
                    segmentation: annotation.segmentation || [[]],
                    area: annotation.area || 0,
                    bbox: annotation.bbox || [0, 0, 0, 0],
                    iscrowd: 0
                };
            }
        });

        // Convert categories from string array to COCO format
        // Only include categories that are actually used in annotations
        const classNames = window.AppState?.classes || categories || [];
        console.log('Raw classNames:', classNames);
        console.log('Current annotations before conversion:', currentAnnotations);
        
        // Get unique category IDs from the actual annotations
        const usedCategoryIds = [...new Set(cocoAnnotations.map(ann => ann.category_id))];
        console.log('Used category IDs in annotations:', usedCategoryIds);
        
        // Only include categories that are used in annotations
        const cocoCategories = usedCategoryIds.map(categoryId => {
            // Find the corresponding class name from the available classes
            let categoryInfo = null;
            
            if (Array.isArray(classNames)) {
                // Handle array of strings or objects
                classNames.forEach((className, index) => {
                    if (typeof className === 'string') {
                        // String array - match by index + 1 (since category IDs are 1-based)
                        if ((index + 1) === categoryId) {
                            categoryInfo = {
                                id: categoryId,
                                name: className
                            };
                        }
                    } else if (className && typeof className === 'object') {
                        // Object array - match by ID
                        const classId = Math.floor(Number(className.id)) || (index + 1);
                        if (classId === categoryId) {
                            categoryInfo = {
                                id: categoryId,
                                name: className.name || className.className || 'Unknown Category'
                            };
                        }
                    }
                });
            }
            
            // Fallback if category not found in available classes
            if (!categoryInfo) {
                categoryInfo = {
                    id: categoryId,
                    name: `Category ${categoryId}`
                };
            }
            
            return categoryInfo;
        });
        
        console.log('Converted cocoCategories:', cocoCategories);

        // Get actual image dimensions
        const img = document.getElementById('main-image');
        const imageWidth = img ? img.naturalWidth : 1920;
        const imageHeight = img ? img.naturalHeight : 1080;
        
        // Create COCO format payload
        const cocoData = {
            info: {
                description: "Facade AI Studio Annotations",
                date_created: new Date().toISOString()
            },
            images: [{
                id: imageId,
                file_name: imageId,
                width: imageWidth,
                height: imageHeight
            }],
            annotations: cocoAnnotations,
            categories: cocoCategories,
            BatchID: batchId,
            ImageID: imageId,
            id: imageId
        };
        
        console.log('Created cocoData:', cocoData);

        const payload = {
            coco: cocoData,
            log: [`Saved ${currentAnnotations.length} annotations at ${new Date().toISOString()}`]
        };
        
        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`/api/annotations/${batchId}/${imageId}?batch_id=${batchId}&image_id=${imageId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        // Get the response data regardless of status for more details
        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = { message: "Failed to parse response" };
        }
        
        console.log('Response status:', response.status);
        console.log('Response data:', responseData);
        
        // Check if the operation was successful based on the response content
        // Even if status is 422, check if CosmosDB save was successful
        if (responseData && responseData.cosmosDBSaved) {
            console.log('Annotations successfully saved to CosmosDB despite validation error');
            return responseData;
        }
        
        // Also check if the response indicates success in other ways
        if (responseData && responseData.message && responseData.message.includes('completed')) {
            console.log('Annotation save process completed, assuming success');
            return responseData;
        }
        
        if (!response.ok) {
            // If we have detailed error information, use it
            if (responseData && responseData.detail) {
                // FastAPI validation errors have a 'detail' field with an array of errors
                let errorMessage = `Validation error (status: ${response.status})`;
                if (Array.isArray(responseData.detail)) {
                    const errorDetails = responseData.detail.map(err => 
                        `${err.loc ? err.loc.join('.') : 'unknown'}: ${err.msg || err.message || 'validation failed'}`
                    ).join('; ');
                    errorMessage += `: ${errorDetails}`;
                } else if (typeof responseData.detail === 'string') {
                    errorMessage += `: ${responseData.detail}`;
                } else {
                    errorMessage += `: ${JSON.stringify(responseData.detail)}`;
                }
                throw new Error(errorMessage);
            } else if (responseData && responseData.message) {
                throw new Error(`${responseData.message} (status: ${response.status})`);
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        return responseData;
    }
    
    // Fallback function to ensure toggle is set up
    function ensureToggleSetup() {
        const toggle = document.getElement('mode-toggle-switch');
        if (toggle && (isLabeller() && isReviewer())) {
            console.log("[DEBUG] Ensuring toggle is properly set up (fallback check)");
            
            // Check if event listeners are already attached
            const hasEventListeners = toggle._hasToggleListeners;
            
            if (!hasEventListeners) {
                console.log("[DEBUG] Setting up toggle event listeners (fallback)");
                setupModeToggle();
            } else {
                console.log("[DEBUG] Toggle already has event listeners, skipping setup");
            }
        } else if (toggle) {
            console.log("[DEBUG] Toggle found but user doesn't have both roles - skipping setup");
        } else {
            console.log("[DEBUG] Toggle element not found in fallback check");
        }
    }
    
    // Call the fallback after a longer delay to ensure all scripts have loaded
    setTimeout(ensureToggleSetup, 1000);
    
    // Additional fallback to ensure main.js AppState is available
    setTimeout(() => {
        if (window.AppState?.user) {
            console.log("[DEBUG] Main.js AppState detected, re-checking roles");
            // Re-run setup if AppState is now available and user has both roles
            if (isLabeller() && isReviewer()) {
                console.log("[DEBUG] User now has both roles, ensuring toggle is set up");
                ensureToggleSetup();
            }
        }
    }, 1500);
    
    // Debug function to test toggle manually (accessible from browser console)
    window.debugToggle = function() {
        const toggle = document.getElementById('mode-toggle-switch');
        if (toggle) {
            console.log("=== TOGGLE DEBUG INFO ===");
            console.log("Toggle element:", toggle);
            console.log("Checked:", toggle.checked);
            console.log("Disabled:", toggle.disabled);
            console.log("Event listeners attached:", toggle._hasToggleListeners);
            console.log("\n--- Role Information ---");
            console.log("Label.js roles (array):", userRoles);
            console.log("Main.js role (string):", window.AppState?.user?.role);
            console.log("Is Administrator:", isAdministrator());
            console.log("Is Labeller:", isLabeller());
            console.log("Is Reviewer:", isReviewer());
            console.log("Can toggle (has both roles):", isLabeller() && isReviewer());
            console.log("Current mode:", currentMode);
            
            // Test manual toggle
            console.log("\n--- Testing manual toggle ---");
            const oldState = toggle.checked;
            toggle.checked = !oldState;
            console.log("Toggled from", oldState, "to", toggle.checked);
            
            // Trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            toggle.dispatchEvent(changeEvent);
            
            console.log("========================");
        } else {
            console.error("Toggle element not found!");
        }
    };
    
    console.log("[DEBUG] Toggle debug function available as window.debugToggle()");
    
    // Add visual feedback for toggle interaction
    function addToggleVisualFeedback() {
        const toggle = document.getElementById('mode-toggle-switch');
        const toggleDiv = document.querySelector('#mode-toggle-switch + div');
        
        if (toggle && toggleDiv) {
            // Add hover effect
            toggleDiv.addEventListener('mouseenter', function() {
                if (!toggle.disabled) {
                    this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
                }
            });
            
            toggleDiv.addEventListener('mouseleave', function() {
                this.style.boxShadow = '';
            });
            
            // Add active effect
            toggleDiv.addEventListener('mousedown', function() {
                if (!toggle.disabled) {
                    this.style.transform = 'scale(0.95)';
                }
            });
            
            toggleDiv.addEventListener('mouseup', function() {
                this.style.transform = '';
            });
            
            console.log("[DEBUG] Visual feedback added to toggle");
        }
    }
    
    // Call visual feedback setup after a delay
    setTimeout(addToggleVisualFeedback, 200);
    
    // Add a global debug function to check button states
    window.debugButtonStates = function() {
        console.group('[DEBUG] Current Button States');
        console.log('Current mode:', currentMode);
        console.log('User roles:', userRoles);
        console.log('isLabeller():', isLabeller());
        console.log('isReviewer():', isReviewer());
        console.log('isAdministrator():', isAdministrator());
        
        const buttons = {
            'submit-btn': submitBtn,
            'delete-btn': deleteBtn,
            'skip-btn': skipBtn,
            'accept-btn': acceptBtn,
            'reject-btn': rejectBtn
        };
        
        Object.entries(buttons).forEach(([name, btn]) => {
            if (btn) {
                console.log(`${name}:`, {
                    exists: true,
                    visible: btn.style.display !== 'none',
                    display: btn.style.display,
                    classes: btn.className
                });
            } else {
                console.log(`${name}: NOT FOUND`);
            }
        });
        
        const toggle = document.getElementById('mode-toggle-switch');
        if (toggle) {
            console.log('Toggle:', {
                checked: toggle.checked,
                disabled: toggle.disabled,
                classes: toggle.className
            });
        }
        
        console.groupEnd();
    };

    // Helper function to update DOM element references after cloning
    function updateDOMReferences() {
        // Update references to the newly created elements
        const updatedSubmitBtn = document.getElementById('submit-btn');
        const updatedDeleteBtn = document.getElementById('delete-btn');
        const updatedSkipBtn = document.getElementById('skip-btn');
        
        if (updatedSubmitBtn) window.submitBtn = updatedSubmitBtn;
        if (updatedDeleteBtn) window.deleteBtn = updatedDeleteBtn;
        if (updatedSkipBtn) window.skipBtn = updatedSkipBtn;
    }
    
}); // End of DOMContentLoaded event listener
