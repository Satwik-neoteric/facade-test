// validation.js - Facade Studio validation functionality
// Handles switching between label and validation modes, and validation actions

// Access state and elements from window instead of importing
const state = window.state;
const elements = window.elements;

// Flag for validation mode - explicitly set to false by default
let isValidationMode = false;

// Initialize validation functionality
function initValidation() {
    console.log("[DEBUG] Initializing validation functionality");
    
    // Cache the validation elements
    const modeToggleSwitch = document.getElementById('mode-toggle-switch');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    
    // Cache notes dialog elements
    const notesDialog = document.getElementById('notes-dialog');
    const notesText = document.getElementById('notes-text');
    const notesCancelBtn = document.getElementById('notes-cancel-btn');
    const notesSubmitBtn = document.getElementById('notes-submit-btn');
    
    // Ensure toggle switch starts in "Label" position (unchecked)
    if (modeToggleSwitch) {
        // Only set the checked state, don't force validation mode
        modeToggleSwitch.checked = isValidationMode;
    }
    
    // Add event listeners for toggle switch
    if (modeToggleSwitch) {
        modeToggleSwitch.addEventListener('change', function() {
            toggleValidationMode(this.checked);
        });
    }
    
    // Add event listeners for validation buttons
    if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            validateAnnotation('accepted');
        });
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', function() {
            showNotesDialog();
        });
    }
    
    // Add event listeners for notes dialog
    if (notesCancelBtn) {
        notesCancelBtn.addEventListener('click', function() {
            hideNotesDialog();
        });
    }
    
    if (notesSubmitBtn) {
        notesSubmitBtn.addEventListener('click', function() {
            const notes = notesText.value.trim();
            validateAnnotation('rejected', notes);
            hideNotesDialog();
        });
    }
    
    // Ensure UI reflects current validation mode state
    updateButtonStates();
}

// Toggle between Label and Validation modes
function toggleValidationMode(enableValidation) {
    console.log(`[DEBUG] toggleValidationMode: ${enableValidation ? 'ON' : 'OFF'}`);
    isValidationMode = enableValidation;
    
    // Update UI elements
    const classButtons = document.querySelectorAll('.class-button');
    const modeButtons = document.querySelectorAll('.mode-button');
    
    // Access buttons directly
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const submitBtn = document.getElementById('submit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const skipBtn = document.getElementById('skip-btn');
    
    // Show/hide appropriate action buttons
    if (submitBtn) {
        submitBtn.style.display = enableValidation ? 'none' : 'inline-block';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = enableValidation ? 'none' : 'inline-block';
    }
    
    // Skip button is always visible, regardless of mode
    if (skipBtn) {
        skipBtn.style.display = 'inline-flex !important'; // Always visible with highest priority
        skipBtn.disabled = false; // Always enabled
        skipBtn.classList.add('global-button'); // Mark as global
        
        // Force visibility with inline style
        skipBtn.setAttribute('style', 'display: inline-flex !important; visibility: visible !important;');
        
        // Add a data attribute to track that we've explicitly set this
        skipBtn.setAttribute('data-always-visible', 'true');
    }
    
    if (acceptBtn) {
        acceptBtn.style.display = enableValidation ? 'inline-block' : 'none';
    }
    
    if (rejectBtn) {
        rejectBtn.style.display = enableValidation ? 'inline-block' : 'none';
    }
    
    // Enable/disable class buttons and mode buttons
    classButtons.forEach(button => {
        button.disabled = enableValidation;
    });
    
    modeButtons.forEach(button => {
        button.disabled = enableValidation;
    });
    
    // Update canvas and UI state
    if (window.updateCanvasForValidationMode) {
        window.updateCanvasForValidationMode(enableValidation);
    }
    
    // Update the mode badge in the UI
    const modeBadge = document.getElementById('mode-badge');
    if (modeBadge) {
        modeBadge.textContent = enableValidation ? 'Validation Mode' : 'Label Mode';
        modeBadge.className = enableValidation ? 'badge bg-warning' : 'badge bg-primary';
    }
    
    // Update help text
    const helpText = document.getElementById('mode-help-text');
    if (helpText) {
        helpText.textContent = enableValidation 
            ? 'In validation mode, you can review and approve or reject annotations.'
            : 'In label mode, you can create and edit annotations.';
    }
    
    // Log mode change
    console.log(`[INFO] Switched to ${enableValidation ? 'Validation' : 'Label'} mode`);
    
    // Optional: add visual feedback for mode switch
    if (window.showToast) {
        window.showToast(`Switched to ${enableValidation ? 'Validation' : 'Label'} mode`);
    }
}

// Show the notes dialog for rejection
function showNotesDialog() {
    const notesDialog = document.getElementById('notes-dialog');
    const notesText = document.getElementById('notes-text');
    
    if (notesDialog) {
        notesDialog.style.display = 'block';
        
        // Clear previous notes
        if (notesText) {
            notesText.value = '';
            notesText.focus();
        }
    }
}

// Hide the notes dialog
function hideNotesDialog() {
    const notesDialog = document.getElementById('notes-dialog');
    if (notesDialog) {
        notesDialog.style.display = 'none';
    }
}

// Validate an annotation (accept or reject)
function validateAnnotation(action, notes = '') {
    if (!window.state || !window.state.currentBatchId || !window.state.currentImageId) {
        console.error("[ERROR] Cannot validate: No current batch or image selected");
        return;
    }
    
    const batchId = window.state.currentBatchId;
    const imageId = window.state.currentImageId;
    
    console.log(`[INFO] Validating annotation: ${action} for batch ${batchId}, image ${imageId}`);
    
    // Prepare validation data
    const validationData = {
        action: action,
        notes: notes,
        validator: window.state.currentUser || 'Unknown',
        timestamp: new Date().toISOString()
    };
    
    // Send validation to server
    fetch(`/api/annotations/${batchId}/${imageId}/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`[SUCCESS] Validation (${action}) saved successfully:`, data);
        
        // Update UI to reflect validation status
        updateValidationStatus(action);
        
        // Optionally move to next image
        if (window.goToNextImage) {
            window.goToNextImage();
        }
        
        // Show success message
        if (window.showToast) {
            window.showToast(`Annotation ${action} successfully!`);
        }
    })
    .catch(error => {
        console.error('[ERROR] Failed to save validation:', error);
        if (window.showToast) {
            window.showToast(`Error: Failed to save validation. ${error.message}`, 'error');
        }
    });
}

// Update UI to reflect validation status
function updateValidationStatus(status) {
    const statusBadge = document.getElementById('validation-status');
    
    if (statusBadge) {
        statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        // Update badge color based on status
        statusBadge.className = 'badge';
        if (status === 'accepted') {
            statusBadge.classList.add('bg-success');
        } else if (status === 'rejected') {
            statusBadge.classList.add('bg-danger');
        } else {
            statusBadge.classList.add('bg-secondary');
        }
        
        // Make sure badge is visible
        statusBadge.style.display = 'inline-block';
    }
    
    // Update any related UI elements
    if (window.updateUIForValidationStatus) {
        window.updateUIForValidationStatus(status);
    }
}

// Update button states based on current mode and selection
function updateButtonStates() {
    // Update based on validation mode
    const classButtons = document.querySelectorAll('.class-button');
    const modeButtons = document.querySelectorAll('.mode-button');
    
    // Access buttons directly
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const submitBtn = document.getElementById('submit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    
    // Set button states based on validation mode
    if (isValidationMode) {
        // Validation mode is active
        if (submitBtn) submitBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (acceptBtn) acceptBtn.style.display = 'inline-block';
        if (rejectBtn) rejectBtn.style.display = 'inline-block';
        
        // Disable class and mode buttons in validation mode
        classButtons.forEach(button => { button.disabled = true; });
        modeButtons.forEach(button => { button.disabled = true; });
    } else {
        // Label mode is active
        if (submitBtn) submitBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
        
        // Enable class and mode buttons in label mode
        classButtons.forEach(button => { button.disabled = false; });
        modeButtons.forEach(button => { button.disabled = false; });
    }
}

// Expose functions to global scope
window.initValidation = initValidation;
window.toggleValidationMode = toggleValidationMode;
window.validateAnnotation = validateAnnotation;
window.updateButtonStates = updateButtonStates;
