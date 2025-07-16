// event-handlers.js - Button Event Handlers
// Handles all button click events and user interactions

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry } from './utilities.js';
import { navigateToNextImage } from './batch-manager.js';
import { convertFabricToCoco } from './data-converter.js';
import { deleteSelectedPolygon, deselectActivePolygon } from './annotation-manager.js';

/**
 * Setup all event handlers for the application
 */
export function setupEventHandlers() {
    console.log("[DEBUG] Setting up event handlers");
    
    // Submit button handler
    setupSubmitButtonHandler();
    
    // Skip button handler
    setupSkipButtonHandler();
    
    // Delete button handler
    setupDeleteButtonHandler();
    
    // Accept button handler (validation mode)
    setupAcceptButtonHandler();
    
    // Reject button handler (validation mode)
    setupRejectButtonHandler();
    
    // Batch selector handler
    setupBatchSelectorHandler();
    
    // Mode toggle handler
    setupModeToggleHandler();
    
    // Class selection handlers
    setupClassSelectionHandlers();
    
    // Keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Canvas interaction handlers
    setupCanvasHandlers();
    
    console.log("[DEBUG] All event handlers setup complete");
}

/**
 * Setup submit button event handler
 */
function setupSubmitButtonHandler() {
    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;
    
    submitBtn.addEventListener('click', async function() {
        await handleSubmitAnnotations();
    });
}

/**
 * Handle annotation submission
 */
async function handleSubmitAnnotations() {
    const AppState = getAppState();

    try {
        console.group("[DEBUG] Annotation Submission Process");
        console.log("[DEBUG] Submit button clicked");
        console.log("[DEBUG] Current AppState:", {
            currentBatch: AppState.currentBatch,
            currentImageId: AppState.currentImageId,
            annotationsCount: AppState.annotations?.length || 0,
            currentImagePath: AppState.currentImagePath
        });

        if (!AppState.currentBatch || !AppState.currentImageId) {
            console.error("[DEBUG] Missing required identifiers");
            showMessage("No image loaded to submit annotations for", "warning");
            return;
        }

        // Disable submit button to prevent multiple clicks
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Submitting...</span>';
        }

        // Always submit, even if no annotations
        let cocoPayload;
        if (!AppState.annotations || AppState.annotations.length === 0) {
            console.warn("[DEBUG] No annotations to submit, submitting blank [] to overwrite existing");
            
            // Build blank COCO payload with all required fields for proper CosmosDB update
            cocoPayload = {
                info: {
                    description: "Facade AI Studio Annotations",
                    date_created: new Date().toISOString()
                },
                images: [{
                    id: AppState.currentImageId,
                    file_name: `${AppState.currentBatch}/cam/${AppState.currentImageId}.jpg`,
                    width: AppState.originalImageWidth || 800,
                    height: AppState.originalImageHeight || 600
                }],
                annotations: [], // This should overwrite existing annotations
                categories: AppState.classes?.map((cls, idx) => ({
                    id: idx + 1,
                    name: cls.name || cls,
                    supercategory: "object"
                })) || [],
                // Add required CosmosDB fields
                BatchID: AppState.currentBatch,
                ImageID: AppState.currentImageId,
                id: AppState.currentImageId,
                Status: "Labelled" // Mark as labelled even with empty annotations
            };
        } else {
            // Log each annotation before conversion
            console.log("[DEBUG] Raw annotations before conversion:");
            AppState.annotations.forEach((annotation, index) => {
                console.log(`[DEBUG] Annotation ${index}:`, {
                    type: annotation.type,
                    points: annotation.points?.length || 0,
                    customData: annotation.customData,
                    stroke: annotation.stroke,
                    fill: annotation.fill
                });
            });

            // Convert annotations to COCO format
            console.log("[DEBUG] Converting to COCO format...");
            cocoPayload = convertFabricToCoco(AppState.annotations);
            console.log("[DEBUG] COCO conversion result:", cocoPayload);

            if (!cocoPayload) {
                throw new Error("Failed to convert annotations to COCO format");
            }

            // Ensure required CosmosDB fields are present
            cocoPayload.BatchID = AppState.currentBatch;
            cocoPayload.ImageID = AppState.currentImageId;
            cocoPayload.id = AppState.currentImageId;
            cocoPayload.Status = "Labelled";
        }

        // Validate COCO structure
        console.log("[DEBUG] COCO validation:", {
            hasAnnotations: Array.isArray(cocoPayload.annotations),
            annotationCount: cocoPayload.annotations?.length || 0,
            hasCategories: Array.isArray(cocoPayload.categories),
            categoryCount: cocoPayload.categories?.length || 0,
            hasImages: Array.isArray(cocoPayload.images),
            imageCount: cocoPayload.images?.length || 0,
            hasBatchID: !!cocoPayload.BatchID,
            hasImageID: !!cocoPayload.ImageID,
            hasStatus: !!cocoPayload.Status
        });

        // Prepare the payload for submission
        const payload = {
            coco: cocoPayload,
            log: [`Submitted ${AppState.annotations?.length || 0} annotations at ${new Date().toISOString()}`]
        };

        console.log("[DEBUG] Final payload structure:", {
            hasCoco: 'coco' in payload,
            hasLog: 'log' in payload,
            cocoType: typeof payload.coco,
            logType: typeof payload.log,
            payloadSize: JSON.stringify(payload).length,
            isEmptySubmission: (AppState.annotations?.length || 0) === 0
        });

        // Use the simpler API URL format that matches the backend routing
        const apiUrl = `/api/annotations/${AppState.currentBatch}/${AppState.currentImageId}?batch_id=${AppState.currentBatch}&image_id=${AppState.currentImageId}`;
        console.log("[DEBUG] Submitting to URL:", apiUrl);

        // Submit to server
        console.log("[DEBUG] Making POST request...");
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log("[DEBUG] Response received:", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[DEBUG] Error response body:", errorText);

            try {
                const errorData = JSON.parse(errorText);
                console.error("[DEBUG] Parsed error data:", errorData);
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            } catch (parseError) {
                console.error("[DEBUG] Could not parse error response as JSON");
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
        }

        const result = await response.json();
        console.log("[DEBUG] Submission successful:", result);

        // Check if CosmosDB was updated successfully
        if (result.cosmosDBSaved === false && result.cosmosDBError) {
            console.warn("[DEBUG] CosmosDB save failed:", result.cosmosDBError);
            showMessage(`Warning: ${result.cosmosDBError}`, "warning");
        }

        const annotationCount = AppState.annotations?.length || 0;
        const message = annotationCount === 0 
            ? "Successfully submitted empty annotations (cleared existing)"
            : `Successfully submitted ${annotationCount} annotations`;

        addLogEntry(`Submitted ${annotationCount} annotations for ${AppState.currentImageId}`);
        showMessage(message, "success");

        // Auto-navigate to next image after successful submission
        setTimeout(() => {
            navigateToNextImage();
        }, 500);

    } catch (error) {
        console.error("[DEBUG] Error submitting annotations:", error);
        console.error("[DEBUG] Error stack:", error.stack);
        showMessage(`Error submitting annotations: ${error.message}`, "error");
    } finally {
        console.groupEnd();
        // Reset button state
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> <span>Submit</span>';
        }
    }
}

/**
 * Setup skip button event handler
 */
function setupSkipButtonHandler() {
    const skipBtn = document.getElementById('skip-btn');
    if (!skipBtn) return;
    
    skipBtn.addEventListener('click', function() {
        handleSkipImage();
    });
}

/**
 * Handle image skip
 */
function handleSkipImage() {
    console.log("[DEBUG] Skip button clicked");
    
    const AppState = getAppState();
    
    // Log the skip action
    addLogEntry(`Skipped image: ${AppState.currentImageId || 'unknown'}`);
    
    // Navigate to next image
    navigateToNextImage();
    
    showMessage("Image skipped", "info");
}

/**
 * Setup delete button event handler
 */
function setupDeleteButtonHandler() {
    const deleteBtn = document.getElementById('delete-btn');
    if (!deleteBtn) return;
    
    deleteBtn.addEventListener('click', function() {
        handleDeleteAction();
    });
}

/**
 * Handle delete action (either selected annotation or all annotations)
 */
function handleDeleteAction() {
    const AppState = getAppState();
    
    console.log("[DEBUG] Delete button clicked");
    
    if (AppState.activePolygon) {
        // Delete selected annotation
        if (confirm("Are you sure you want to delete the selected annotation?")) {
            if (window.modules?.annotationManager?.deleteSelectedPolygon) {
                window.modules.annotationManager.deleteSelectedPolygon();
            }
        }
    } else if (AppState.annotations && AppState.annotations.length > 0) {
        // Delete all annotations from current image
        if (confirm("Are you sure you want to delete ALL annotations from this image?")) {
            handleDeleteAllAnnotations();
        }
    } else {
        showMessage("No annotations to delete", "info");
    }
}

/**
 * Delete all annotations from current image
 */
async function handleDeleteAllAnnotations() {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Deleting all annotations from current image");
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded", "warning");
            return;
        }
        
        // Show loading message
        showMessage("Deleting all annotations...", "info");
        
        // Clear annotations from UI immediately
        if (window.modules?.annotationManager?.clearAllAnnotations) {
            window.modules.annotationManager.clearAllAnnotations();
        }
        
        // Save empty annotations to server to persist the deletion
        const success = await saveEmptyAnnotations();
        
        if (success) {
            showMessage("All annotations deleted successfully", "success");
            addLogEntry(`Deleted all annotations from ${AppState.currentImageId}`);
        } else {
            throw new Error("Failed to save empty annotations to server");
        }
        
    } catch (error) {
        console.error("[DEBUG] Error deleting all annotations:", error);
        showMessage(`Error deleting annotations: ${error.message}`, "error");
        
        // Try alternative deletion method
        try {
            await deleteAnnotationsAlternative();
            showMessage("All annotations deleted successfully (alternative method)", "success");
        } catch (altError) {
            console.error("[DEBUG] Alternative deletion also failed:", altError);
            showMessage("Failed to delete annotations", "error");
        }
    }
}

/**
 * Save empty annotations to effectively delete all annotations
 */
async function saveEmptyAnnotations() {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Saving empty annotations by reusing submit logic");
        
        // Store original annotations
        const originalAnnotations = [...(AppState.annotations || [])];
        
        // Temporarily clear annotations to trigger empty submission logic
        AppState.annotations = [];
        
        // Call the existing submit logic which already handles empty annotations correctly
        const result = await handleSubmitAnnotationsInternal();
        
        // Restore annotations array (UI is already cleared)
        AppState.annotations = originalAnnotations;
        
        return result;
        
    } catch (error) {
        console.error("[DEBUG] Error in saveEmptyAnnotations:", error);
        return false;
    }
}

/**
 * Internal submit function that can be reused
 */
async function handleSubmitAnnotationsInternal() {
    // Extract the core submission logic from handleSubmitAnnotations
    // This is the same logic but without the UI button management
    const AppState = getAppState();

    if (!AppState.currentBatch || !AppState.currentImageId) {
        throw new Error("No image loaded to submit annotations for");
    }

    // Build COCO payload (handles empty annotations automatically)
    let cocoPayload;
    if (!AppState.annotations || AppState.annotations.length === 0) {
        cocoPayload = {
            info: {
                description: "Facade AI Studio Annotations",
                date_created: new Date().toISOString()
            },
            images: [{
                id: AppState.currentImageId,
                file_name: `${AppState.currentBatch}/cam/${AppState.currentImageId}.jpg`,
                width: AppState.originalImageWidth || 800,
                height: AppState.originalImageHeight || 600
            }],
            annotations: [],
            categories: AppState.classes?.map((cls, idx) => ({
                id: idx + 1,
                name: cls.name || cls,
                supercategory: "object"
            })) || [],
            BatchID: AppState.currentBatch,
            ImageID: AppState.currentImageId,
            id: AppState.currentImageId,
            Status: "Labelled"
        };
    } else {
        cocoPayload = convertFabricToCoco(AppState.annotations);
        if (!cocoPayload) {
            throw new Error("Failed to convert annotations to COCO format");
        }
        cocoPayload.BatchID = AppState.currentBatch;
        cocoPayload.ImageID = AppState.currentImageId;
        cocoPayload.id = AppState.currentImageId;
        cocoPayload.Status = "Labelled";
    }

    const payload = {
        coco: cocoPayload,
        log: [`Submitted ${AppState.annotations?.length || 0} annotations at ${new Date().toISOString()}`]
    };

    const apiUrl = `/api/annotations/${AppState.currentBatch}/${AppState.currentImageId}?batch_id=${AppState.currentBatch}&image_id=${AppState.currentImageId}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        } catch (parseError) {
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
    }

    return await response.json();
}

/**
 * Setup accept button event handler (validation mode)
 */
function setupAcceptButtonHandler() {
    const acceptBtn = document.getElementById('accept-btn');
    if (!acceptBtn) return;
    
    acceptBtn.addEventListener('click', function() {
        handleAcceptValidation();
    });
}

/**
 * Handle validation acceptance
 */
async function handleAcceptValidation() {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Accept button clicked");
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to validate", "warning");
            return;
        }
        
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            action: "accept",
            notes: ""
        };
        
        const response = await fetch('/api/validation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        addLogEntry(`Accepted validation for: ${AppState.currentImageId}`);
        showMessage("Annotations accepted", "success");
        
        // Navigate to next image
        setTimeout(() => {
            navigateToNextImage();
        }, 1000);
        
    } catch (error) {
        console.error("[DEBUG] Error accepting validation:", error);
        showMessage(`Error accepting validation: ${error.message}`, "error");
    }
}

/**
 * Setup reject button event handler (validation mode)
 */
function setupRejectButtonHandler() {
    const rejectBtn = document.getElementById('reject-btn');
    if (!rejectBtn) return;
    
    rejectBtn.addEventListener('click', function() {
        handleRejectValidation();
    });
}

/**
 * Handle validation rejection
 */
function handleRejectValidation() {
    console.log("[DEBUG] Reject button clicked");
    
    // Show notes dialog for rejection reason
    const notesDialog = document.getElementById('notes-dialog');
    if (notesDialog) {
        notesDialog.style.display = 'flex';
        
        // Clear and focus notes textarea
        const notesText = document.getElementById('notes-text');
        if (notesText) {
            notesText.value = '';
            notesText.focus();
        }
    } else {
        // Fallback: ask for rejection reason with prompt
        const notes = prompt("Please provide a reason for rejecting these annotations:");
        if (notes !== null) {
            submitValidationRejection(notes);
        }
    }
}

/**
 * Submit validation rejection with notes
 */
async function submitValidationRejection(notes) {
    const AppState = getAppState();
    
    try {
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to reject", "warning");
            return;
        }
        
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            action: "reject",
            notes: notes || ""
        };
        
        const response = await fetch('/api/validation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        addLogEntry(`Rejected validation for: ${AppState.currentImageId} - ${notes}`);
        showMessage("Annotations rejected", "success");
        
        // Hide notes dialog
        const notesDialog = document.getElementById('notes-dialog');
        if (notesDialog) {
            notesDialog.style.display = 'none';
        }
        
        // Navigate to next image
        setTimeout(() => {
            navigateToNextImage();
        }, 1000);
        
    } catch (error) {
        console.error("[DEBUG] Error rejecting validation:", error);
        showMessage(`Error rejecting validation: ${error.message}`, "error");
    }
}

/**
 * Setup batch selector event handler
 */
function setupBatchSelectorHandler() {
    const batchSelector = document.getElementById('batch-selector');
    if (!batchSelector) return;
    
    batchSelector.addEventListener('change', function() {
        const batchId = this.value;
        if (batchId && window.modules?.batchManager?.handleBatchSelection) {
            window.modules.batchManager.handleBatchSelection(batchId);
        } else if (window.handleBatchSelection) {
            window.handleBatchSelection(batchId);
        }
    });
}

/**
 * Setup mode toggle event handler
 */
function setupModeToggleHandler() {
    const modeToggle = document.getElementById('mode-toggle-switch');
    if (!modeToggle) return;
    
    modeToggle.addEventListener('change', function() {
        const isValidationMode = this.checked;
        if (window.toggleValidationMode) {
            window.toggleValidationMode(isValidationMode);
        }
    });
}

/**
 * Setup class selection button handlers
 */
function setupClassSelectionHandlers() {
    // Set up delegated event handler for dynamically created class buttons
    const classTable = document.getElementById('class-selection-table');
    if (!classTable) return;
    
    classTable.addEventListener('click', function(event) {
        const button = event.target.closest('.class-button');
        if (!button) return;
        
        handleClassButtonClick(button);
    });
    
    console.log("[DEBUG] Class selection handlers setup complete");
}

/**
 * Handle class button click
 */
function handleClassButtonClick(button) {
    const AppState = getAppState();
    
    // Update active state
    document.querySelectorAll('.class-button').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Set current class
    const className = button.dataset.class;
    AppState.currentClass = className;
    AppState.currentMode = 'polygon'; // Switch to drawing mode
    
    // Update status displays
    const classStatus = document.getElementById('class-status');
    if (classStatus) {
        classStatus.textContent = className;
    }
    
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = 'Draw';
    }
    
    console.log(`[DEBUG] Selected class: ${className}, switched to drawing mode`);
    addLogEntry(`Selected class: ${className}`);
    // showMessage(`Selected class: ${className}. Click on canvas to start drawing.`, "info");
}

/**
 * Populate class selection buttons
 */
export function populateClassButtons(classes) {
    const container = document.getElementById('class-selection-table');
    if (!container || !classes || !Array.isArray(classes)) return;
    
    container.innerHTML = '';
    
    classes.forEach((cls, index) => {
        const button = document.createElement('button');
        button.className = 'class-button px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-md';
        button.dataset.class = cls.name;
        button.style.backgroundColor = cls.color;
        button.style.color = '#ffffff';
        button.textContent = cls.name.replace(/-/g, ' ');
        container.appendChild(button);
    });
    
    // Auto-select first class
    const firstButton = container.querySelector('.class-button');
    if (firstButton) {
        handleClassButtonClick(firstButton);
    }
    
    console.log(`[DEBUG] Populated ${classes.length} class buttons`);
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ignore if user is typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const AppState = getAppState();
        const MIN_ZOOM = 0.1;
        const MAX_ZOOM = 5;

        
        switch (event.key.toLowerCase()) {
            case 's':
                if (event.ctrlKey || event.metaKey) {
                    // Ctrl+S: Submit annotations
                    event.preventDefault();
                    handleSubmitAnnotations();
                }
                break;
                
            case 'arrowleft':
                // Left arrow: Previous image
                event.preventDefault();
                if (window.modules?.batchManager?.navigateToPreviousImage) {
                    window.modules.batchManager.navigateToPreviousImage();
                }
                break;
                
            case 'arrowright':
            case ' ': // Spacebar
                // Right arrow or spacebar: Next image
                event.preventDefault();
                navigateToNextImage();
                break;
                
            case 'delete':
            case 'backspace':
                // Delete: Delete selected annotation
                event.preventDefault();
                if (AppState.activePolygon) {
                    deleteSelectedPolygon();
                }
                break;
                
            case 'enter':
                // Enter: Complete polygon or commit edits
                event.preventDefault();
                if (AppState.currentMode === 'polygon' && AppState.isDrawing && AppState.polyPoints && AppState.polyPoints.length >= 3) {
                    console.log("[DEBUG] Enter key - completing polygon");
                    if (window.completePolygon) {
                        window.completePolygon();
                    } else if (window.modules?.canvasManager?.completePolygon) {
                        window.modules.canvasManager.completePolygon();
                    }
                }
                break;
                
            case 'escape':
                // Escape: Deselect
                event.preventDefault();
                deselectActivePolygon();
                break;
                
            case 'h':
                // H: Hide/show annotations
                event.preventDefault();
                toggleAnnotationVisibility();
                break;
                
            
        }
    });
}

/**
 * Toggle annotation visibility
 */
function toggleAnnotationVisibility() {
    const AppState = getAppState();
    
    if (AppState.annotationsHidden) {
        if (window.modules?.annotationManager?.showAnnotations) {
            window.modules.annotationManager.showAnnotations();
        }
    } else {
        if (window.modules?.annotationManager?.hideAnnotations) {
            window.modules.annotationManager.hideAnnotations();
        }
    }
}

/**
 * Setup canvas interaction handlers
 */
function setupCanvasHandlers() {
    // Canvas handlers are managed by canvas-manager.js
    // This function can be extended for additional canvas interactions
    console.log("[DEBUG] Canvas handlers will be setup by canvas-manager.js");
}

/**
 * Setup notes dialog handlers
 */
export function setupNotesDialogHandlers() {
    const notesDialog = document.getElementById('notes-dialog');
    const notesCancelBtn = document.getElementById('notes-cancel-btn');
    const notesSubmitBtn = document.getElementById('notes-submit-btn');
    const notesText = document.getElementById('notes-text');
    
    if (notesCancelBtn) {
        notesCancelBtn.addEventListener('click', function() {
            if (notesDialog) {
                notesDialog.style.display = 'none';
            }
        });
    }
    
    if (notesSubmitBtn) {
        notesSubmitBtn.addEventListener('click', function() {
            const notes = notesText ? notesText.value : '';
            submitValidationRejection(notes);
        });
    }
    
    // Allow Enter to submit and Escape to cancel
    if (notesText) {
        notesText.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                // Ctrl+Enter: Submit
                event.preventDefault();
                const notes = this.value;
                submitValidationRejection(notes);
            } else if (event.key === 'Escape') {
                // Escape: Cancel
                event.preventDefault();
                if (notesDialog) {
                    notesDialog.style.display = 'none';
                }
            }
        });
    }
}

/**
 * Setup filter dialog handlers
 */
export function setupFilterDialogHandlers() {
    console.log("[DEBUG] Setting up filter dialog handlers");
    
    // Wait a bit for DOM to be ready and filter manager to be loaded
    setTimeout(() => {
        const openFilterBtn = document.getElementById('open-filter-dialog');
        const closeFilterBtn = document.getElementById('close-filter-dialog');
        const filterModal = document.getElementById('filter-modal');
        
        if (openFilterBtn) {
            console.log("[DEBUG] Setting up open filter button handler");
            openFilterBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("[DEBUG] Open filter button clicked");
                if (window.modules?.filterManager?.openFilterDialog) {
                    window.modules.filterManager.openFilterDialog();
                } else {
                    console.error("[DEBUG] Filter manager not available");
                }
            });
        } else {
            console.error("[DEBUG] Open filter button not found");
        }
        
        if (closeFilterBtn) {
            console.log("[DEBUG] Setting up close filter button handler");
            closeFilterBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("[DEBUG] Close filter button clicked");
                if (window.modules?.filterManager?.closeFilterDialog) {
                    window.modules.filterManager.closeFilterDialog();
                } else {
                    console.error("[DEBUG] Filter manager not available");
                }
            });
        }
        
        // Close modal when clicking outside
        if (filterModal) {
            console.log("[DEBUG] Setting up modal outside click handler");
            filterModal.addEventListener('click', function(event) {
                if (event.target === filterModal) {
                    console.log("[DEBUG] Clicked outside filter modal");
                    if (window.modules?.filterManager?.closeFilterDialog) {
                        window.modules.filterManager.closeFilterDialog();
                    }
                }
            });
        }
        
        console.log("[DEBUG] Filter dialog handlers setup complete");
    }, 1000); // Wait 1 second for everything to be loaded
}

// Zoom function with clamping and transform update
function zoomImage(factor) {
    const prevScale = currentScale;
    let newScale = Math.min(Math.max(currentScale * factor, MIN_SCALE), MAX_SCALE);

    // Center zoom on image container
    const imageContainer = document.getElementById('canvas-container');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!imageContainer || !canvasWrapper) return;

    const rect = imageContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Adjust pan so zoom is centered
    currentPanX = centerX - (centerX - currentPanX) * (newScale / prevScale);
    currentPanY = centerY - (centerY - currentPanY) * (newScale / prevScale);
    currentScale = newScale;

    updateImageTransform();
    updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
}


// Reset pan/zoom to default
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
    const imageContainer = document.getElementById('canvas-container');
    if (!img || !imageContainer) return;

    const containerRect = imageContainer.getBoundingClientRect();
    const scaleX = containerRect.width / img.naturalWidth;
    const scaleY = containerRect.height / img.naturalHeight;
    currentScale = Math.min(scaleX, scaleY, 1);

    currentPanX = (containerRect.width - img.naturalWidth * currentScale) / 2;
    currentPanY = (containerRect.height - img.naturalHeight * currentScale) / 2;

    updateImageTransform();
    updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
    console.log('Image fitted to container');
}

// Update transform for image viewer
function updateImageTransform() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        canvasWrapper.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
        canvasWrapper.style.transformOrigin = '0 0';
        canvasWrapper.style.transition = isPanning ? 'none' : 'transform 0.1s ease-out';
    }
}

// Utility to update status bar
function updateStatus(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}