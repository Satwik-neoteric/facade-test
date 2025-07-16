// ui-manager.js - UI State Management
// Handles UI updates, button states, and interface management

import { getAppState } from './app-state.js';

/**
 * Update UI for validation mode
 */
export function updateUIForMode(isValidationMode) {
    console.log(`[DEBUG] Updating UI for ${isValidationMode ? 'validation' : 'labeling'} mode`);
    
    // Get button elements
    const submitBtn = document.getElementById('submit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const skipBtn = document.getElementById('skip-btn');
    
    // Get mode labels
    const modeStatus = document.getElementById('mode-status');
    const modeLabelLeft = document.getElementById('mode-label-left');
    const modeLabelRight = document.getElementById('mode-label-right');
    
    if (isValidationMode) {
        // Validation mode UI
        if (submitBtn) submitBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (acceptBtn) acceptBtn.style.display = 'inline-flex';
        if (rejectBtn) rejectBtn.style.display = 'inline-flex';
        
        // Update mode status
        if (modeStatus) modeStatus.textContent = 'Validate';
        
        // Update mode labels
        if (modeLabelLeft) {
            modeLabelLeft.classList.remove('text-blue-600');
            modeLabelLeft.classList.add('text-gray-600');
        }
        if (modeLabelRight) {
            modeLabelRight.classList.remove('text-gray-600');
            modeLabelRight.classList.add('text-blue-600');
        }
        
        // Disable drawing tools
        disableDrawingTools();
        
        // Update body class for CSS styling
        document.body.classList.add('validation-mode');
        document.body.classList.remove('labeling-mode');
        
    } else {
        // Labeling mode UI
        if (submitBtn) submitBtn.style.display = 'inline-flex';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
        
        // Update mode status
        if (modeStatus) modeStatus.textContent = 'Label';
        
        // Update mode labels
        if (modeLabelLeft) {
            modeLabelLeft.classList.remove('text-gray-600');
            modeLabelLeft.classList.add('text-blue-600');
        }
        if (modeLabelRight) {
            modeLabelRight.classList.remove('text-blue-600');
            modeLabelRight.classList.add('text-gray-600');
        }
        
        // Enable drawing tools
        enableDrawingTools();
        
        // Update body class for CSS styling
        document.body.classList.add('labeling-mode');
        document.body.classList.remove('validation-mode');
    }
    
    // Ensure skip button is always visible
    if (skipBtn) {
        skipBtn.style.display = 'inline-flex';
        skipBtn.style.visibility = 'visible';
        skipBtn.style.opacity = '1';
    }
}

/**
 * Update button states based on current context
 */
export function updateButtonStates() {
    const AppState = getAppState();
    
    // Get button elements
    const submitBtn = document.getElementById('submit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const acceptBtn = document.getElementById('accept-btn');
    const rejectBtn = document.getElementById('reject-btn');
    
    // Check if we have an image loaded
    const hasImage = AppState.currentImage !== null;
    
    // Check if we have annotations
    const hasAnnotations = AppState.annotations && AppState.annotations.length > 0;
    
    // Check if something is selected
    const hasSelection = AppState.activePolygon !== null;
    
    // Update submit button - allow submission even with no annotations
    if (submitBtn) {
        submitBtn.disabled = !hasImage; // Only require an image to be loaded
        if (submitBtn.disabled) {
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    
    // Update delete button text based on selection
    if (deleteBtn) {
        if (hasSelection) {
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> <span>Delete Selected</span>';
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> <span>Delete</span>';
            deleteBtn.disabled = !hasImage;
            if (deleteBtn.disabled) {
                deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }
    
    // Update validation buttons
    if (acceptBtn) {
        acceptBtn.disabled = !hasImage;
        if (acceptBtn.disabled) {
            acceptBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            acceptBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    
    if (rejectBtn) {
        rejectBtn.disabled = !hasImage;
        if (rejectBtn.disabled) {
            rejectBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            rejectBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

/**
 * Disable drawing tools
 */
function disableDrawingTools() {
    // Disable class selection buttons
    const classButtons = document.querySelectorAll('.class-button');
    classButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
    });
    
    // Disable bottom panel
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) {
        bottomPanel.classList.add('pointer-events-none', 'opacity-50');
    }
}

/**
 * Enable drawing tools
 */
function enableDrawingTools() {
    // Enable class selection buttons
    const classButtons = document.querySelectorAll('.class-button');
    classButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
    });
    
    // Enable bottom panel
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) {
        bottomPanel.classList.remove('pointer-events-none', 'opacity-50');
    }
}

/**
 * Update zoom display
 */
export function updateZoomDisplay(zoomLevel) {
    const zoomStatus = document.getElementById('zoom-status');
    if (zoomStatus) {
        zoomStatus.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
}

/**
 * Update selected object display
 */
export function updateSelectedObjectDisplay(obj) {
    const selectedStatus = document.getElementById('selected-object-status');
    if (selectedStatus) {
        if (obj && obj.customData) {
            const objectId = obj.customData.objectId || 'Unknown';
            selectedStatus.textContent = objectId;
        } else {
            selectedStatus.textContent = 'None';
        }
    }
}

/**
 * Update image name display
 */
export function updateImageNameDisplay(imagePath) {
    const imageNameStatus = document.getElementById('image-name-status');
    if (imageNameStatus) {
        if (imagePath) {
            const fileName = imagePath.split('/').pop();
            imageNameStatus.textContent = fileName;
        } else {
            imageNameStatus.textContent = 'None';
        }
    }
}

/**
 * Update mode display
 */
export function updateModeDisplay() {
    const AppState = getAppState();
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = AppState.currentMode || 'Select';
    }
}

/**
 * Show loading overlay
 */
export function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <div class="text-lg font-medium">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('div div:last-child').textContent = message;
        overlay.style.display = 'flex';
    }
}

/**
 * Hide loading overlay
 */
export function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Update coordinates display
 */
export function updateCoordinatesDisplay(x, y) {
    const coordsStatus = document.getElementById('coords-status');
    if (coordsStatus) {
        coordsStatus.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
    }
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar(sidebarId, collapsed = null) {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) return;
    
    const isCollapsed = collapsed !== null ? collapsed : !sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }
    
    // Update button icons
    const collapseBtn = sidebar.querySelector('[id*="collapse"]');
    const expandBtn = sidebar.querySelector('[id*="expand"]');
    
    if (collapseBtn && expandBtn) {
        if (isCollapsed) {
            collapseBtn.style.display = 'none';
            expandBtn.style.display = 'flex';
        } else {
            collapseBtn.style.display = '';
            expandBtn.style.display = 'none';
        }
    }
}

/**
 * Setup responsive UI handlers
 */
export function setupResponsiveUI() {
    // Handle window resize
    window.addEventListener('resize', function() {
        updateButtonStates();
        
        // Adjust canvas if needed
        if (window.modules?.canvasManager?.centerCanvas) {
            window.modules.canvasManager.centerCanvas();
        }
    });
    
    // Handle orientation change on mobile
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            updateButtonStates();
            if (window.modules?.canvasManager?.centerCanvas) {
                window.modules.canvasManager.centerCanvas();
            }
        }, 100);
    });
}

/**
 * Initialize UI state
 */
export function initializeUI() {
    console.log("[DEBUG] Initializing UI state");
    
    // Setup responsive handlers
    setupResponsiveUI();
    
    // Initial button state update
    updateButtonStates();
    
    // Initial mode display
    updateModeDisplay();
    
    // Initialize sidebar states
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    
    if (leftSidebar && !leftSidebar.classList.contains('collapsed')) {
        // Ensure left sidebar is expanded by default
    }
    
    if (rightSidebar && !rightSidebar.classList.contains('collapsed')) {
        // Ensure right sidebar is expanded by default
    }
    
    console.log("[DEBUG] UI state initialization complete");
}