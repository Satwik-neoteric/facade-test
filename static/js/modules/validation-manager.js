// validation-manager.js - Validation Operations
// Handles validation mode, annotation review, and approval/rejection workflows

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry } from './utilities.js';
import { updateUIForMode } from './ui-manager.js';

/**
 * Initialize validation functionality
 */
export function initValidation() {
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
        modeToggleSwitch.checked = false;
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
            acceptValidation();
        });
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', function() {
            showNotesDialog();
        });
    }
    
    // Setup notes dialog handlers
    if (notesCancelBtn) {
        notesCancelBtn.addEventListener('click', function() {
            hideNotesDialog();
        });
    }
    
    if (notesSubmitBtn) {
        notesSubmitBtn.addEventListener('click', function() {
            const notes = notesText ? notesText.value : '';
            rejectValidation(notes);
        });
    }
    
    console.log("[DEBUG] Validation initialization complete");
}

/**
 * Toggle between label and validation modes
 */
export function toggleValidationMode(isValidationMode) {
    const AppState = getAppState();
    
    console.log(`[DEBUG] Toggling validation mode: ${isValidationMode}`);
    
    try {
        if (isValidationMode) {
            // Switch to validation mode
            AppState.previousMode = AppState.currentMode;
            AppState.currentMode = 'validate';
            AppState.isValidationMode = true;
            
            // Update canvas settings for validation
            if (AppState.fabricCanvas) {
                AppState.fabricCanvas.selection = false;
                AppState.fabricCanvas.getObjects().forEach(obj => {
                    if (AppState.annotations && AppState.annotations.includes(obj)) {
                        obj.set({
                            selectable: false,
                            hoverCursor: 'pointer'
                        });
                    }
                });
                AppState.fabricCanvas.renderAll();
            }
            
            showMessage("Entered validation mode", "info");
            addLogEntry("Switched to validation mode");
            
        } else {
            // Switch back to label mode
            AppState.currentMode = AppState.previousMode || 'select';
            AppState.isValidationMode = false;
            
            // Update canvas settings for labeling
            if (AppState.fabricCanvas) {
                AppState.fabricCanvas.selection = true;
                AppState.fabricCanvas.getObjects().forEach(obj => {
                    if (AppState.annotations && AppState.annotations.includes(obj)) {
                        obj.set({
                            selectable: true,
                            hoverCursor: 'move'
                        });
                    }
                });
                AppState.fabricCanvas.renderAll();
            }
            
            showMessage("Entered label mode", "info");
            addLogEntry("Switched to label mode");
        }
        
        // Update UI
        updateUIForMode(isValidationMode);
        
        // Update mode badge
        const modeBadge = document.getElementById('mode-badge');
        if (modeBadge) {
            modeBadge.textContent = isValidationMode ? 'Validation Mode' : 'Label Mode';
            modeBadge.className = isValidationMode ? 'badge bg-warning' : 'badge bg-primary';
        }
        
        // Update help text
        const helpText = document.getElementById('mode-help-text');
        if (helpText) {
            helpText.textContent = isValidationMode 
                ? 'In validation mode, you can review and approve or reject annotations.'
                : 'In label mode, you can create and edit annotations.';
        }
        
        console.log(`[DEBUG] Successfully switched to ${isValidationMode ? 'validation' : 'label'} mode`);
        
    } catch (error) {
        console.error("[DEBUG] Error toggling validation mode:", error);
        showMessage("Error switching modes", "error");
    }
}

/**
 * Accept current annotations
 */
export async function acceptValidation() {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Accepting validation");
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to validate", "warning");
            return;
        }
        
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            action: "accept",
            validator_notes: "",
            validation_status: "approved",
            validated_by: AppState.user?.name || "Unknown",
            validated_at: new Date().toISOString()
        };
        
        console.log("[DEBUG] Submitting validation acceptance:", payload);
        
        const response = await fetch('/api/validation/accept', {
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
        console.log("[DEBUG] Validation acceptance successful:", result);
        
        addLogEntry(`Accepted annotations for image: ${AppState.currentImageId}`);
        showMessage("Annotations accepted", "success");
        
        // Auto-navigate to next image after successful validation
        setTimeout(() => {
            if (window.modules?.batchManager?.navigateToNextImage) {
                window.modules.batchManager.navigateToNextImage();
            }
        }, 1000);
        
        return result;
        
    } catch (error) {
        console.error("[DEBUG] Error accepting validation:", error);
        showMessage(`Error accepting validation: ${error.message}`, "error");
        throw error;
    }
}

/**
 * Reject current annotations with notes
 */
export async function rejectValidation(notes = "") {
    const AppState = getAppState();
    
    try {
        console.log("[DEBUG] Rejecting validation with notes:", notes);
        
        if (!AppState.currentBatch || !AppState.currentImageId) {
            showMessage("No image loaded to reject", "warning");
            return;
        }
        
        if (!notes.trim()) {
            showMessage("Please provide a reason for rejection", "warning");
            return;
        }
        
        const payload = {
            batch_id: AppState.currentBatch,
            image_id: AppState.currentImageId,
            action: "reject",
            validator_notes: notes,
            validation_status: "rejected",
            validated_by: AppState.user?.name || "Unknown",
            validated_at: new Date().toISOString()
        };
        
        console.log("[DEBUG] Submitting validation rejection:", payload);
        
        const response = await fetch('/api/validation/reject', {
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
        console.log("[DEBUG] Validation rejection successful:", result);
        
        // Hide notes dialog
        hideNotesDialog();
        
        addLogEntry(`Rejected annotations for image: ${AppState.currentImageId} - Reason: ${notes}`);
        showMessage("Annotations rejected", "success");
        
        // Auto-navigate to next image after successful validation
        setTimeout(() => {
            if (window.modules?.batchManager?.navigateToNextImage) {
                window.modules.batchManager.navigateToNextImage();
            }
        }, 1000);
        
        return result;
        
    } catch (error) {
        console.error("[DEBUG] Error rejecting validation:", error);
        showMessage(`Error rejecting validation: ${error.message}`, "error");
        throw error;
    }
}

/**
 * Show notes dialog for rejection
 */
function showNotesDialog() {
    const notesDialog = document.getElementById('notes-dialog');
    const notesText = document.getElementById('notes-text');
    
    if (notesDialog) {
        notesDialog.style.display = 'flex';
        
        // Clear previous notes
        if (notesText) {
            notesText.value = '';
            notesText.focus();
        }
    } else {
        // Fallback: use prompt
        const notes = prompt("Please provide a reason for rejecting these annotations:");
        if (notes !== null && notes.trim()) {
            rejectValidation(notes);
        }
    }
}

/**
 * Hide notes dialog
 */
function hideNotesDialog() {
    const notesDialog = document.getElementById('notes-dialog');
    if (notesDialog) {
        notesDialog.style.display = 'none';
    }
}

/**
 * Get validation statistics for current batch
 */
export async function getValidationStatistics(batchId) {
    try {
        console.log(`[DEBUG] Getting validation statistics for batch: ${batchId}`);
        
        const response = await fetch(`/api/validation/stats/${batchId}`);
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const stats = await response.json();
        console.log("[DEBUG] Validation statistics:", stats);
        
        return stats;
        
    } catch (error) {
        console.error("[DEBUG] Error getting validation statistics:", error);
        showMessage("Error loading validation statistics", "error");
        return null;
    }
}

/**
 * Get validation history for current image
 */
export async function getValidationHistory(batchId, imageId) {
    try {
        console.log(`[DEBUG] Getting validation history for image: ${imageId}`);
        
        const response = await fetch(`/api/validation/history/${batchId}/${imageId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                return []; // No history found
            }
            throw new Error(`Server error: ${response.status}`);
        }
        
        const history = await response.json();
        console.log("[DEBUG] Validation history:", history);
        
        return history;
        
    } catch (error) {
        console.error("[DEBUG] Error getting validation history:", error);
        return [];
    }
}

/**
 * Display validation history in UI
 */
export function displayValidationHistory(history) {
    const historyContainer = document.getElementById('validation-history');
    
    if (!historyContainer) return;
    
    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No validation history</p>';
        return;
    }
    
    let html = '<div class="validation-history-list space-y-2">';
    
    history.forEach(entry => {
        const date = new Date(entry.validated_at).toLocaleDateString();
        const time = new Date(entry.validated_at).toLocaleTimeString();
        const statusClass = entry.validation_status === 'approved' ? 'text-green-600' : 'text-red-600';
        
        html += `
            <div class="validation-entry p-3 border rounded-lg bg-gray-50 dark:bg-gray-700">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-medium ${statusClass}">${entry.validation_status.toUpperCase()}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${date} ${time}</div>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300">By: ${entry.validated_by}</div>
                ${entry.validator_notes ? `<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">${entry.validator_notes}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    historyContainer.innerHTML = html;
}

/**
 * Update validation progress display
 */
export function updateValidationProgress(stats) {
    const progressContainer = document.getElementById('validation-progress');
    
    if (!progressContainer || !stats) return;
    
    const total = stats.total_images || 0;
    const validated = stats.validated_images || 0;
    const approved = stats.approved_images || 0;
    const rejected = stats.rejected_images || 0;
    const pending = total - validated;
    
    const progressPercent = total > 0 ? Math.round((validated / total) * 100) : 0;
    
    progressContainer.innerHTML = `
        <div class="validation-progress">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium">Validation Progress</span>
                <span class="text-sm text-gray-600 dark:text-gray-400">${validated}/${total} (${progressPercent}%)</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div class="bg-blue-600 h-2 rounded-full" style="width: ${progressPercent}%"></div>
            </div>
            <div class="grid grid-cols-3 gap-4 text-center text-sm">
                <div class="validation-stat">
                    <div class="text-lg font-bold text-green-600">${approved}</div>
                    <div class="text-gray-600 dark:text-gray-400">Approved</div>
                </div>
                <div class="validation-stat">
                    <div class="text-lg font-bold text-red-600">${rejected}</div>
                    <div class="text-gray-600 dark:text-gray-400">Rejected</div>
                </div>
                <div class="validation-stat">
                    <div class="text-lg font-bold text-yellow-600">${pending}</div>
                    <div class="text-gray-600 dark:text-gray-400">Pending</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Load validation data for current image
 */
export async function loadValidationData() {
    const AppState = getAppState();
    
    if (!AppState.currentBatch || !AppState.currentImageId) {
        return;
    }
    
    try {
        // Load validation history
        const history = await getValidationHistory(AppState.currentBatch, AppState.currentImageId);
        displayValidationHistory(history);
        
        // Load batch statistics
        const stats = await getValidationStatistics(AppState.currentBatch);
        if (stats) {
            updateValidationProgress(stats);
        }
        
    } catch (error) {
        console.error("[DEBUG] Error loading validation data:", error);
    }
}

/**
 * Setup validation-specific keyboard shortcuts
 */
export function setupValidationKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        const AppState = getAppState();
        
        // Only handle shortcuts in validation mode
        if (!AppState.isValidationMode) return;
        
        // Ignore if user is typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case 'a':
                // A: Accept validation
                event.preventDefault();
                acceptValidation();
                break;
                
            case 'r':
                // R: Reject validation
                event.preventDefault();
                showNotesDialog();
                break;
                
            case 'v':
                // V: Toggle validation mode
                event.preventDefault();
                const modeToggle = document.getElementById('mode-toggle-switch');
                if (modeToggle) {
                    modeToggle.checked = !modeToggle.checked;
                    toggleValidationMode(modeToggle.checked);
                }
                break;
        }
    });
    
    console.log("[DEBUG] Validation keyboard shortcuts setup complete");
}

/**
 * Initialize validation for user role
 */
export function initValidationForRole() {
    const AppState = getAppState();
    
    if (AppState.user?.role === 'Reviewer') {
        // For reviewers, start in validation mode
        const modeToggle = document.getElementById('mode-toggle-switch');
        if (modeToggle) {
            modeToggle.checked = true;
            modeToggle.disabled = true; // Prevent changing mode
            toggleValidationMode(true);
        }
        
        console.log("[DEBUG] Initialized validation mode for Reviewer role");
    }
    
    // Setup validation keyboard shortcuts
    setupValidationKeyboardShortcuts();
}