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
        console.log("[DEBUG] Submit button clicked");
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to submit annotations for", "warning");
            return;
        }
        
        if (!AppState.annotations || AppState.annotations.length === 0) {
            showMessage("No annotations to submit", "warning");
            return;
        }
        
        // Show loading state
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Submitting...</span>';
        }
        
        // Convert annotations to COCO format
        const cocoPayload = convertFabricToCoco(AppState.annotations);
        
        if (!cocoPayload) {
            throw new Error("Failed to convert annotations to COCO format");
        }
        
        // Prepare the payload for submission
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            annotations: cocoPayload.annotations,
            categories: cocoPayload.categories
        };
        
        console.log("[DEBUG] Submitting annotations:", payload);
        
        // Submit to server
        const response = await fetch('/api/annotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("[DEBUG] Submission successful:", result);
        
        addLogEntry(`Submitted ${AppState.annotations.length} annotations for ${AppState.currentImageId}`);
        showMessage(`Successfully submitted ${AppState.annotations.length} annotations`, "success");
        
        // Auto-navigate to next image after successful submission
        setTimeout(() => {
            navigateToNextImage();
        }, 1000);
        
    } catch (error) {
        console.error("[DEBUG] Error submitting annotations:", error);
        showMessage(`Error submitting annotations: ${error.message}`, "error");
    } finally {
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
 * Handle delete action (either selected annotation or entire image)
 */
function handleDeleteAction() {
    const AppState = getAppState();
    
    console.log("[DEBUG] Delete button clicked");
    
    if (AppState.activePolygon) {
        // Delete selected annotation
        if (confirm("Are you sure you want to delete the selected annotation?")) {
            deleteSelectedPolygon();
        }
    } else {
        // Delete entire image (mark as deleted)
        if (confirm("Are you sure you want to mark this image as deleted?")) {
            handleDeleteImage();
        }
    }
}

/**
 * Handle image deletion (marking as deleted)
 */
async function handleDeleteImage() {
    const AppState = getAppState();
    
    try {
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to delete", "warning");
            return;
        }
        
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            action: "mark_deleted"
        };
        
        const response = await fetch('/api/images/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        addLogEntry(`Marked image as deleted: ${AppState.currentImageId}`);
        showMessage("Image marked as deleted", "success");
        
        // Navigate to next image
        setTimeout(() => {
            navigateToNextImage();
        }, 1000);
        
    } catch (error) {
        console.error("[DEBUG] Error deleting image:", error);
        showMessage(`Error deleting image: ${error.message}`, "error");
    }
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
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Ignore if user is typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const AppState = getAppState();
        
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
                
            case 'r':
                // R: Reset zoom
                event.preventDefault();
                if (window.modules?.canvasManager?.resetZoom) {
                    window.modules.canvasManager.resetZoom();
                }
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
    const openFilterBtn = document.getElementById('open-filter-dialog');
    const closeFilterBtn = document.getElementById('close-filter-dialog');
    const filterModal = document.getElementById('filter-modal');
    
    if (openFilterBtn) {
        openFilterBtn.addEventListener('click', function() {
            if (window.filterModule?.openFilterDialog) {
                window.filterModule.openFilterDialog();
            }
        });
    }
    
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener('click', function() {
            if (window.filterModule?.closeFilterDialog) {
                window.filterModule.closeFilterDialog();
            }
        });
    }
    
    // Close modal when clicking outside
    if (filterModal) {
        filterModal.addEventListener('click', function(event) {
            if (event.target === filterModal) {
                if (window.filterModule?.closeFilterDialog) {
                    window.filterModule.closeFilterDialog();
                }
            }
        });
    }
}