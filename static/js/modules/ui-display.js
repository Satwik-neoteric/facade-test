// ui-display.js - UI Display Functions
// Handles UI updates, information display, and visual feedback

import { getAppState } from './app-state.js';
import { getCategoryColorByName, formatFileSize, formatDate } from './utilities.js';

/**
 * Display sensor data in the sensor panel
 */
export function displaySensorData(sensorData) {
    const sensorTable = document.getElementById('sensor-data-table');
    if (!sensorTable) return;
    
    if (!sensorData || Object.keys(sensorData).length === 0) {
        sensorTable.innerHTML = '<tr><td colspan="2" class="p-3 text-center text-gray-500 dark:text-gray-400">No sensor data available</td></tr>';
        return;
    }
    
    let html = '';
    Object.keys(sensorData).forEach(key => {
        const value = sensorData[key];
        html += `
            <tr class="border-b border-gray-200 dark:border-gray-600">
                <td class="p-2 font-medium text-gray-700 dark:text-gray-300">${key}</td>
                <td class="p-2 text-gray-600 dark:text-gray-400">${formatSensorValue(value)}</td>
            </tr>
        `;
    });
    
    sensorTable.innerHTML = html;
    console.log("[DEBUG] Sensor data displayed");
}

/**
 * Format sensor value for display
 */
function formatSensorValue(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    } else if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Display image metadata
 */
export function displayImageMetadata(metadata) {
    const metadataBox = document.getElementById('metadata-box');
    if (!metadataBox) return;
    
    if (!metadata || Object.keys(metadata).length === 0) {
        metadataBox.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No metadata available</p>';
        return;
    }
    
    let html = '<div class="space-y-2 text-sm">';
    
    // Format common metadata fields
    if (metadata.filename) {
        html += `<div><strong>Filename:</strong> ${metadata.filename}</div>`;
    }
    if (metadata.size) {
        html += `<div><strong>Size:</strong> ${formatFileSize(metadata.size)}</div>`;
    }
    if (metadata.dimensions) {
        html += `<div><strong>Dimensions:</strong> ${metadata.dimensions.width} × ${metadata.dimensions.height}</div>`;
    }
    if (metadata.format) {
        html += `<div><strong>Format:</strong> ${metadata.format}</div>`;
    }
    if (metadata.created_date) {
        html += `<div><strong>Created:</strong> ${formatDate(metadata.created_date)}</div>`;
    }
    if (metadata.modified_date) {
        html += `<div><strong>Modified:</strong> ${formatDate(metadata.modified_date)}</div>`;
    }
    
    // Add any additional metadata
    Object.keys(metadata).forEach(key => {
        if (!['filename', 'size', 'dimensions', 'format', 'created_date', 'modified_date'].includes(key)) {
            html += `<div><strong>${key}:</strong> ${JSON.stringify(metadata[key])}</div>`;
        }
    });
    
    html += '</div>';
    metadataBox.innerHTML = html;
    console.log("[DEBUG] Image metadata displayed");
}

/**
 * Display batch information
 */
export function displayBatchInfo(batchData) {
    const batchInfo = document.getElementById('batch-info');
    if (!batchInfo || !batchData) return;
    
    const imageCount = batchData.image_count || 0;
    const batchId = batchData.batch_id || 'Unknown';
    const created = batchData.created_date ? formatDate(batchData.created_date) : 'Unknown';
    
    batchInfo.innerHTML = `
        <div class="batch-summary">
            <div class="batch-name font-medium">${batchId}</div>
            <div class="batch-stats text-sm text-gray-600 dark:text-gray-400">
                ${imageCount} images • Created ${created}
            </div>
        </div>
    `;
    
    batchInfo.classList.remove('hidden');
    console.log("[DEBUG] Batch info displayed");
}

/**
 * Update annotation counter display
 */
export function updateAnnotationCounter() {
    const AppState = getAppState();
    const counter = document.getElementById('annotation-counter');
    
    if (counter) {
        const count = AppState.annotations ? AppState.annotations.length : 0;
        counter.textContent = `${count} annotation${count !== 1 ? 's' : ''}`;
    }
}

/**
 * Display class selection panel
 */
export function displayClassSelection(classes) {
    const container = document.getElementById('class-selection-table');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-gray-500 dark:text-gray-400">No classes available</div>';
        return;
    }
    
    classes.forEach((cls, index) => {
        const button = document.createElement('button');
        button.className = 'class-button px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg';
        button.dataset.class = cls.name;
        button.style.backgroundColor = cls.color;
        button.style.color = '#ffffff';
        button.textContent = cls.name.replace(/-/g, ' ');
        
        // Add click handler for class selection
        button.addEventListener('click', function() {
            selectClass(cls.name);
        });
        
        container.appendChild(button);
    });
    
    console.log(`[DEBUG] Displayed ${classes.length} classes`);
}

/**
 * Select annotation class
 */
function selectClass(className) {
    const AppState = getAppState();
    
    // Update current class
    AppState.currentClass = className;
    
    // Update button states
    const classButtons = document.querySelectorAll('.class-button');
    classButtons.forEach(button => {
        if (button.dataset.class === className) {
            button.classList.add('selected', 'ring-2', 'ring-white');
        } else {
            button.classList.remove('selected', 'ring-2', 'ring-white');
        }
    });
    
    // Update current mode to drawing mode
    AppState.currentMode = 'polygon';
    
    // Update mode display
    const modeStatus = document.getElementById('mode-status');
    if (modeStatus) {
        modeStatus.textContent = `Draw ${className}`;
    }
    
    console.log(`[DEBUG] Selected class: ${className}`);
}

/**
 * Display loading indicator
 */
export function showLoadingIndicator(message = 'Loading...', container = null) {
    const targetContainer = container || document.body;
    
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loading-indicator';
    loadingEl.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    loadingEl.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <div class="flex items-center space-x-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div class="text-lg font-medium">${message}</div>
            </div>
        </div>
    `;
    
    targetContainer.appendChild(loadingEl);
}

/**
 * Hide loading indicator
 */
export function hideLoadingIndicator() {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.remove();
    }
}

/**
 * Display progress bar
 */
export function showProgressBar(progress, message = '') {
    let progressBar = document.getElementById('progress-bar-container');
    
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'progress-bar-container';
        progressBar.className = 'fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[300px] z-50';
        progressBar.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium" id="progress-message">${message}</span>
                <span class="text-sm text-gray-600 dark:text-gray-400" id="progress-percent">0%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" id="progress-fill" style="width: 0%"></div>
            </div>
        `;
        document.body.appendChild(progressBar);
    }
    
    // Update progress
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const progressMessage = document.getElementById('progress-message');
    
    if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
    if (progressMessage && message) progressMessage.textContent = message;
}

/**
 * Hide progress bar
 */
export function hideProgressBar() {
    const progressBar = document.getElementById('progress-bar-container');
    if (progressBar) {
        progressBar.remove();
    }
}

/**
 * Display error message with details
 */
export function displayError(error, context = '') {
    console.error(`[ERROR] ${context}:`, error);
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'fixed top-4 right-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg max-w-md z-50';
    errorContainer.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-red-500"></i>
            </div>
            <div class="ml-3">
                <h3 class="text-sm font-medium">Error ${context}</h3>
                <div class="mt-1 text-sm">${error.message || error}</div>
                ${error.stack ? `<details class="mt-2"><summary class="cursor-pointer text-xs">Details</summary><pre class="text-xs mt-1 overflow-auto">${error.stack}</pre></details>` : ''}
            </div>
            <div class="ml-auto pl-3">
                <button class="error-close-btn text-red-700 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    // Add close functionality
    const closeBtn = errorContainer.querySelector('.error-close-btn');
    closeBtn.addEventListener('click', () => errorContainer.remove());
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorContainer.parentNode) {
            errorContainer.remove();
        }
    }, 10000);
    
    document.body.appendChild(errorContainer);
}

/**
 * Display status information
 */
export function displayStatus(status) {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;
    
    const AppState = getAppState();
    
    // Update individual status elements
    const modeStatus = document.getElementById('mode-status');
    const zoomStatus = document.getElementById('zoom-status');
    const imageNameStatus = document.getElementById('image-name-status');
    const selectedObjectStatus = document.getElementById('selected-object-status');
    const coordsStatus = document.getElementById('coords-status');
    
    if (modeStatus) {
        modeStatus.textContent = status.mode || AppState.currentMode || 'Select';
    }
    
    if (zoomStatus) {
        const zoom = status.zoom || (AppState.fabricCanvas ? AppState.fabricCanvas.getZoom() : 1);
        zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
    }
    
    if (imageNameStatus) {
        const imageName = status.imageName || (AppState.currentImagePath ? AppState.currentImagePath.split('/').pop() : 'None');
        imageNameStatus.textContent = imageName;
    }
    
    if (selectedObjectStatus) {
        const selected = status.selected || (AppState.activePolygon?.customData?.objectId) || 'None';
        selectedObjectStatus.textContent = selected;
    }
    
    if (coordsStatus) {
        const coords = status.coords || '(0, 0)';
        coordsStatus.textContent = coords;
    }
}

/**
 * Display image grid/thumbnails
 */
export function displayImageGrid(images, containerId = 'image-grid') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!images || images.length === 0) {
        container.innerHTML = '<div class="text-center p-8 text-gray-500 dark:text-gray-400">No images available</div>';
        return;
    }
    
    let html = '<div class="grid grid-cols-4 gap-4">';
    
    images.forEach(image => {
        const imagePath = image.file_name || image.path;
        const imageId = image.id;
        const status = image.status || 'Unknown';
        const statusClass = getStatusClass(status);
        
        html += `
            <div class="image-card ${statusClass} cursor-pointer hover:shadow-lg transition-shadow" 
                 data-image-id="${imageId}" 
                 data-image-path="${imagePath}">
                <div class="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img src="${imagePath}" alt="${imageId}" class="w-full h-full object-cover" loading="lazy">
                </div>
                <div class="p-2 text-center">
                    <div class="text-xs font-medium truncate">${imageId}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${status}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.image-card').forEach(card => {
        card.addEventListener('click', function() {
            const imageId = this.dataset.imageId;
            const imagePath = this.dataset.imagePath;
            
            if (window.modules?.batchManager?.handleImageSelection) {
                window.modules.batchManager.handleImageSelection(imageId, imagePath);
            }
        });
    });
    
    console.log(`[DEBUG] Displayed ${images.length} images in grid`);
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'completed': 
        case 'approved': 
            return 'status-completed';
        case 'in progress': 
        case 'pending': 
            return 'status-in-progress';
        case 'reviewed': 
            return 'status-reviewed';
        case 'rejected': 
            return 'status-rejected';
        default: 
            return 'status-default';
    }
}

/**
 * Update UI theme
 */
export function updateTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    }
    
    // Update theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun text-yellow-400' : 'fas fa-moon text-blue-600';
        }
    }
    
    console.log(`[DEBUG] Theme updated to ${isDark ? 'dark' : 'light'} mode`);
}

/**
 * Initialize theme from saved preference
 */
export function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    updateTheme(savedTheme === 'dark');
}

/**
 * Display help/tutorial overlay
 */
export function showHelpOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
                    <button id="close-help" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div class="help-section">
                        <h3 class="font-medium text-gray-900 dark:text-white mb-2">Navigation</h3>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between"><span>Next Image</span><kbd>→ or Space</kbd></div>
                            <div class="flex justify-between"><span>Previous Image</span><kbd>←</kbd></div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3 class="font-medium text-gray-900 dark:text-white mb-2">Annotation</h3>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between"><span>Save</span><kbd>Ctrl+S</kbd></div>
                            <div class="flex justify-between"><span>Delete Selected</span><kbd>Delete</kbd></div>
                            <div class="flex justify-between"><span>Deselect</span><kbd>Esc</kbd></div>
                            <div class="flex justify-between"><span>Hide/Show Annotations</span><kbd>H</kbd></div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3 class="font-medium text-gray-900 dark:text-white mb-2">Canvas</h3>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between"><span>Reset Zoom</span><kbd>R</kbd></div>
                            <div class="flex justify-between"><span>Pan</span><kbd>Shift+Drag</kbd></div>
                            <div class="flex justify-between"><span>Zoom</span><kbd>Ctrl+Wheel</kbd></div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3 class="font-medium text-gray-900 dark:text-white mb-2">Validation Mode</h3>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between"><span>Accept</span><kbd>A</kbd></div>
                            <div class="flex justify-between"><span>Reject</span><kbd>R</kbd></div>
                            <div class="flex justify-between"><span>Toggle Mode</span><kbd>V</kbd></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add close functionality
    const closeBtn = overlay.querySelector('#close-help');
    closeBtn.addEventListener('click', () => overlay.remove());
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    document.body.appendChild(overlay);
}