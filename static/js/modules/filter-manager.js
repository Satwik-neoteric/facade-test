// filter-manager.js - Modular Filter Management
// Handles filtering images based on various criteria from CosmosDB COCO records

import { getAppState } from './app-state.js';
import { showMessage } from './utilities.js';

// Keep track of current filter state
const filterState = {
    nameWildcard: '',
    dateStart: '',
    dateEnd: '',
    status: [],
    classes: [],
    unlabelledOnly: false,
    hasAnnotations: true,
    isFilterActive: false,
    showDeleted: false
};

/**
 * Initialize filter manager
 */
export function initFilterManager() {
    console.log("[DEBUG] Initializing filter manager module");
    
    // Set up event handlers first
    setupFilterEventHandlers();
    
    // Populate class options (with retry mechanism)
    populateClassFilterOptions();
    
    // Update UI
    updateFilterUI();
}

/**
 * Populate class filter options from available classes
 */
function populateClassFilterOptions() {
    console.log("[DEBUG] Populating class filter options");
    
    const classFilterGroup = document.getElementById('class-filter-group');
    if (!classFilterGroup) {
        console.warn("[DEBUG] Class filter group element not found");
        return;
    }
    
    // Try to get classes from multiple sources
    let classes = [];
    
    // First, try to get from class buttons
    const classButtons = document.querySelectorAll('.class-button');
    if (classButtons.length > 0) {
        classes = Array.from(classButtons).map(button => button.getAttribute('data-class')).filter(Boolean);
        console.log("[DEBUG] Found classes from class buttons:", classes);
    }
    
    // If no class buttons found, try to get from AppState
    if (classes.length === 0) {
        const appState = getAppState();
        if (appState && appState.classes && Array.isArray(appState.classes)) {
            classes = appState.classes.map(cls => cls.name || cls).filter(Boolean);
            console.log("[DEBUG] Found classes from AppState:", classes);
        }
    }
    
    // If still no classes, use a default set
    if (classes.length === 0) {
        classes = [
            'Brickwork-Fracture',
            'Stonework-Fracture', 
            'Cladding-Disengaged',
            'Mechanical-Faults',
            'Gaskets-Disengaged',
            'WindowPane-Mask',
            'Human-Mask',
            'Privacy-Mask'
        ];
        console.log("[DEBUG] Using default classes:", classes);
    }
    
    classFilterGroup.innerHTML = '';
    console.log("[DEBUG] Adding class options:", classes);
    
    classes.forEach(className => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'filter-checkbox-item flex items-center space-x-2';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `class-${className}`;
        checkbox.name = 'class-filter';
        checkbox.value = className;
        checkbox.className = 'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500';
        
        const label = document.createElement('label');
        label.setAttribute('for', `class-${className}`);
        label.textContent = className.replace(/-/g, ' ');
        label.className = 'text-sm text-gray-700 dark:text-gray-300';
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        classFilterGroup.appendChild(checkboxItem);
    });
    
    console.log("[DEBUG] Class filter options populated");
}

/**
 * Refresh class filter options (call this after classes are loaded)
 */
export function refreshClassFilterOptions() {
    console.log("[DEBUG] Refreshing class filter options");
    populateClassFilterOptions();
}

/**
 * Open the filter dialog
 */
export function openFilterDialog() {
    console.log("[DEBUG] Opening filter dialog");
    
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        console.error("[DEBUG] Filter modal element not found");
        return;
    }
    
    // Initialize AppState if needed
    const appState = getAppState();
    if (!appState) {
        console.error("[DEBUG] AppState not available");
        return;
    }
    
    // Refresh class options in case they weren't available during init
    populateClassFilterOptions();
    
    // Populate with current filter state if filters are active
    if (filterState.isFilterActive) {
        populateFilterForm();
    } else {
        // Set default values for first-time open
        resetFilterForm(false);
    }
    
    // Show the dialog with animation
    filterModal.style.display = 'flex';
    // Force a reflow
    filterModal.offsetHeight;
    // Then add the active class for the animation
    filterModal.classList.add('active');
    console.log("[DEBUG] Filter dialog opened");
}

/**
 * Close the filter dialog
 */
export function closeFilterDialog() {
    console.log("[DEBUG] Closing filter dialog");
    
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
        filterModal.classList.remove('active');
        // Wait for the transition to complete before hiding
        setTimeout(() => {
            filterModal.style.display = 'none';
        }, 300);
        console.log("[DEBUG] Filter dialog closed");
    } else {
        console.error("[DEBUG] Filter modal element not found");
    }
}


/**
 * Apply filters based on user selections
 */
export async function applyFilters() {
    console.log("[DEBUG] applyFilters function called");
    
    try {
        const appState = getAppState();
        console.log("[DEBUG] Current app state:", appState);
        
        // First, check if a batch is selected
        if (!appState || !appState.currentBatch) {
            console.error("[DEBUG] No batch selected");
            showMessage("Please select a batch first before applying filters", "warning");
            return;
        }
        
        console.log(`[DEBUG] Applying filters for batch: ${appState.currentBatch}`);
        
        // Disable apply button to prevent multiple clicks
        const applyBtn = document.getElementById('apply-filters-btn');
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            console.log("[DEBUG] Apply button disabled and showing spinner");
        }
        
        // Show loading indicator
        const imageList = document.getElementById('image-list');
        if (imageList) {
            imageList.innerHTML = '<li class="loading">Filtering images...</li>';
            console.log("[DEBUG] Loading indicator shown");
        }
        
        // Collect filter criteria
        const filterCriteria = collectFilterCriteria();
        console.log("[DEBUG] Applying filters with criteria:", filterCriteria);
        
        // Call API with filter criteria
        console.log("[DEBUG] Making API call to /api/filtered-images");
        const response = await fetch('/api/filtered-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filterCriteria)
        });
        
        console.log(`[DEBUG] API response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DEBUG] API error response: ${errorText}`);
            throw new Error(`Error filtering images: ${response.statusText} (Status: ${response.status})`);
        }
        
        const filteredImages = await response.json();
        console.log("[DEBUG] Received filtered images:", filteredImages);
        
        // Update filter state
        updateFilterState(filterCriteria);
        
        // Update the image list with filtered results
        updateImageList(filteredImages);
        
        // Close the dialog
        closeFilterDialog();
        
        // Update UI to show filter state
        updateFilterUI();
        
        // Show result message
        const message = filterState.isFilterActive
            ? `Filter applied: Showing ${filteredImages.length} results`
            : `All filters cleared: Showing ${filteredImages.length} images`;
        
        showMessage(message, "info");
        console.log(`[DEBUG] Filter operation completed successfully: ${message}`);
        
    } catch (error) {
        console.error("[DEBUG] Error in applyFilters:", error);
        console.error("[DEBUG] Error stack:", error.stack);
        showMessage(`Error applying filters: ${error.message}`, "error");
        
        // Only try to refresh the image list if we have a batch selected
        const appState = getAppState();
        if (appState && appState.currentBatch) {
            console.log("[DEBUG] Attempting to refresh image list as fallback");
            refreshImageList();
        } else {
            const imageList = document.getElementById('image-list');
            if (imageList) {
                imageList.innerHTML = '<li class="empty">Please select a batch first</li>';
            }
        }
    } finally {
        // Re-enable apply button
        const applyBtn = document.getElementById('apply-filters-btn');
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.innerHTML = 'Apply Filters';
            console.log("[DEBUG] Apply button re-enabled");
        }
    }
}

/**
 * Reset filters to default state
 */
export function resetFilters(applyReset = true) {
    console.log("[DEBUG] Resetting filters");
    
    resetFilterForm(false);
    
    // Clear filter state
    Object.assign(filterState, {
        nameWildcard: '',
        dateStart: '',
        dateEnd: '',
        status: [],
        classes: [],
        unlabelledOnly: false,
        hasAnnotations: true,
        showDeleted: false,
        isFilterActive: false
    });
    
    updateFilterUI();
    
    // Apply the reset if requested
    if (applyReset) {
        refreshImageList();
    }
}

/**
 * Collect filter criteria from form
 */
function collectFilterCriteria() {
    const nameWildcard = document.getElementById('name-filter')?.value.trim() || '';
    const dateStart = document.getElementById('date-start')?.value || '';
    const dateEnd = document.getElementById('date-end')?.value || '';
    const unlabelledOnly = document.getElementById('filter-unlabelled')?.checked || false;
    const hasAnnotations = document.getElementById('has-annotations')?.checked || false;
    const showDeleted = document.getElementById('show-deleted')?.checked || false;
    
    // Get selected class values (only if has annotations is checked)
    const classFilters = [];
    if (hasAnnotations) {
        document.querySelectorAll('input[name="class-filter"]:checked').forEach(checkbox => {
            classFilters.push(checkbox.value);
        });
    }
    
    console.log("[DEBUG] Collected filter criteria:", {
        nameWildcard,
        dateStart,
        dateEnd,
        unlabelledOnly,
        hasAnnotations,
        showDeleted,
        classFilters
    });
    
    const appState = getAppState();
    return {
        batchId: appState.currentBatch,
        nameWildcard: nameWildcard,
        dateStart: dateStart,
        dateEnd: dateEnd,
        unlabelledOnly: unlabelledOnly,
        hasAnnotations: hasAnnotations,
        showDeleted: showDeleted,
        classes: classFilters,
        status: []
    };
}

/**
 * Update filter state with new criteria
 */
function updateFilterState(criteria) {
    filterState.nameWildcard = criteria.nameWildcard;
    filterState.dateStart = criteria.dateStart;
    filterState.dateEnd = criteria.dateEnd;
    filterState.unlabelledOnly = criteria.unlabelledOnly;
    filterState.hasAnnotations = criteria.hasAnnotations;
    filterState.showDeleted = criteria.showDeleted;
    filterState.classes = criteria.classes;
    filterState.isFilterActive = !!(
        criteria.nameWildcard || criteria.dateStart || criteria.dateEnd ||
        criteria.unlabelledOnly || !criteria.hasAnnotations ||
        criteria.showDeleted || criteria.classes.length > 0
    );
    
    console.log("[DEBUG] Updated filter state:", filterState);
}

/**
 * Populate filter form with current state
 */
function populateFilterForm() {
    // Set name filter
    const nameFilterInput = document.getElementById('name-filter');
    if (nameFilterInput) {
        nameFilterInput.value = filterState.nameWildcard || '';
    }
    
    // Set date range
    const dateStartInput = document.getElementById('date-start');
    const dateEndInput = document.getElementById('date-end');
    if (dateStartInput) dateStartInput.value = filterState.dateStart || '';
    if (dateEndInput) dateEndInput.value = filterState.dateEnd || '';
    
    // Set unlabelled only
    const unlabelledRadio = document.getElementById('filter-unlabelled');
    const allRadio = document.getElementById('filter-all');
    if (unlabelledRadio) unlabelledRadio.checked = filterState.unlabelledOnly;
    if (allRadio) allRadio.checked = !filterState.unlabelledOnly;
    
    // Set has annotations
    const hasAnnotationsCheck = document.getElementById('has-annotations');
    if (hasAnnotationsCheck) {
        hasAnnotationsCheck.checked = filterState.hasAnnotations;
        hasAnnotationsCheck.disabled = filterState.unlabelledOnly;
    }
    
    // Set show deleted
    const showDeletedCheck = document.getElementById('show-deleted');
    if (showDeletedCheck) {
        showDeletedCheck.checked = filterState.showDeleted;
    }
    
    // Set class checkboxes
    document.querySelectorAll('[name="class-filter"]').forEach(checkbox => {
        checkbox.checked = filterState.classes.includes(checkbox.value);
    });
    
    // Show/hide class filter based on hasAnnotations and unlabelledOnly
    const classFilterContainer = document.getElementById('class-filter-container');
    if (classFilterContainer) {
        if (filterState.unlabelledOnly) {
            classFilterContainer.style.display = 'none';
        } else if (filterState.hasAnnotations) {
            classFilterContainer.style.display = 'block';
        } else {
            classFilterContainer.style.display = 'none';
        }
    }
}

/**
 * Reset filter form to default values
 */
function resetFilterForm(clearState = true) {
    // Clear all filter inputs
    const nameFilter = document.getElementById('name-filter');
    const dateStart = document.getElementById('date-start');
    const dateEnd = document.getElementById('date-end');
    
    if (nameFilter) nameFilter.value = '';
    if (dateStart) dateStart.value = '';
    if (dateEnd) dateEnd.value = '';
    
    // Reset radio buttons
    const filterAll = document.getElementById('filter-all');
    const filterUnlabelled = document.getElementById('filter-unlabelled');
    if (filterAll) filterAll.checked = true;
    if (filterUnlabelled) filterUnlabelled.checked = false;
    
    // Reset checkboxes
    const hasAnnotations = document.getElementById('has-annotations');
    const showDeleted = document.getElementById('show-deleted');
    if (hasAnnotations) {
        hasAnnotations.checked = true;
        hasAnnotations.disabled = false;
    }
    if (showDeleted) showDeleted.checked = false;
    
    // Reset all class filter checkboxes
    document.querySelectorAll('input[name="class-filter"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Show class filter container
    const classFilterContainer = document.getElementById('class-filter-container');
    if (classFilterContainer) {
        classFilterContainer.style.display = 'block';
    }
}

/**
 * Update the image list with filtered results
 */
function updateImageList(filteredImages) {
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    imageList.innerHTML = '';
    
    if (!filteredImages || filteredImages.length === 0) {
        imageList.innerHTML = '<li class="empty">No images match the filter criteria</li>';
        return;
    }
    
    const appState = getAppState();
    const batchId = appState.currentBatch;
    
    // Filter out images with 'Deleted' status before displaying them
    const nonDeletedImages = filteredImages.filter(image => {
        if (typeof image === 'object' && image.status) {
            const status = image.status.toLowerCase();
            if (status === 'deleted' || status.includes('deleted')) {
                console.log(`[DEBUG] Filtering out deleted image from results: ${image.id || image.file_name}`);
                return false;
            }
        }
        return true;
    });
    
    console.log(`[DEBUG] Filtered out ${filteredImages.length - nonDeletedImages.length} deleted images from filter results`);
    
    // Create list items for images
    if (nonDeletedImages.length > 0) {
        nonDeletedImages.forEach(image => {
            if (typeof image === 'string') {
                // Handle plain string image paths
                const imagePath = image;
                const fileName = imagePath.split('/').pop();
                const imageId = fileName.split('.')[0];
                
                const listItem = document.createElement('li');
                listItem.className = 'image-item cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded';
                listItem.setAttribute('data-image-id', imageId);
                listItem.setAttribute('data-image-path', imagePath);
                listItem.setAttribute('data-batch-id', batchId);
                listItem.textContent = imageId;
                
                // Add click event listener
                listItem.addEventListener('click', function() {
                    const imageId = this.dataset.imageId;
                    const imagePath = this.dataset.imagePath;
                    const batchId = this.dataset.batchId;
                    
                    if (window.modules?.batchManager?.handleImageSelection) {
                        window.modules.batchManager.handleImageSelection(imageId, imagePath, batchId);
                    } else if (window.handleImageSelection) {
                        window.handleImageSelection(imageId, imagePath, batchId);
                    }
                });
                
                imageList.appendChild(listItem);
            } else if (typeof image === 'object' && image.id && image.file_name) {
                // Handle object format with id and file_name properties
                const listItem = document.createElement('li');
                listItem.className = 'image-item cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded';
                listItem.setAttribute('data-image-id', image.id);
                
                // Ensure the image path is properly formatted for loading
                let imagePath = image.file_name;
                
                // Check if file_name already has the batch ID as a prefix
                if (batchId && !imagePath.startsWith(batchId + '/')) {
                    // Ensure file_name doesn't have a leading slash
                    if (imagePath.startsWith('/')) {
                        imagePath = imagePath.substring(1);
                    }
                    
                    // If file_name doesn't include the batch ID, add it
                    if (!imagePath.includes('/')) {
                        imagePath = `${batchId}/${imagePath}`;
                    }
                }
                
                listItem.setAttribute('data-image-path', imagePath);
                listItem.setAttribute('data-batch-id', batchId);
                listItem.textContent = image.id;
                
                // Add click event listener
                listItem.addEventListener('click', function() {
                    const imageId = this.dataset.imageId;
                    const imagePath = this.dataset.imagePath;
                    const batchId = this.dataset.batchId;
                    
                    if (window.modules?.batchManager?.handleImageSelection) {
                        window.modules.batchManager.handleImageSelection(imageId, imagePath, batchId);
                    } else if (window.handleImageSelection) {
                        window.handleImageSelection(imageId, imagePath, batchId);
                    }
                });
                
                imageList.appendChild(listItem);
            }
        });
    }
    
    console.log(`[DEBUG] Updated image list with ${nonDeletedImages.length} filtered results`);
}

/**
 * Refresh the image list (used when clearing filters)
 */
async function refreshImageList() {
    try {
        const appState = getAppState();
        const batchId = appState.currentBatch;
        
        if (!batchId) {
            console.warn("[DEBUG] Cannot refresh image list: No batch selected");
            return;
        }
        
        // Show loading indicator
        const imageList = document.getElementById('image-list');
        if (imageList) {
            imageList.innerHTML = '<li class="loading">Loading images...</li>';
        }
        
        const response = await fetch(`/api/batch/${batchId}/images`);
        if (!response.ok) {
            throw new Error(`Error loading images for batch: ${response.statusText}`);
        }
        
        const data = await response.json();
        const images = data.images || [];
        
        // Filter out deleted images before updating the image list
        const filteredImages = images.filter(image => {
            if (image.status) {
                const status = image.status.toLowerCase();
                if (status === 'deleted' || status.includes('deleted')) {
                    console.log(`[DEBUG] Filtering out deleted image during refresh: ${image.id}`);
                    return false;
                }
            }
            return true;
        });
        
        console.log(`[DEBUG] Filtered out ${images.length - filteredImages.length} deleted images during refresh`);
        
        // Update the image list with filtered results
        updateImageList(filteredImages);
        
        console.log(`[DEBUG] Refreshed image list with ${filteredImages.length} images`);
        
    } catch (error) {
        console.error("Error refreshing image list:", error);
        const imageList = document.getElementById('image-list');
        if (imageList) {
            imageList.innerHTML = '<li class="error">Error loading images</li>';
        }
    }
}

/**
 * Update the UI when the filter state changes
 */
function updateFilterUI() {
    const filterButton = document.getElementById('open-filter-dialog');
    const activeClass = 'active';
    
    if (filterButton) {
        if (filterState.isFilterActive) {
            filterButton.classList.add(activeClass);
            const icon = filterButton.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-filter-circle-xmark'; // Show active filter icon
            }
        } else {
            filterButton.classList.remove(activeClass);
            const icon = filterButton.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-filter'; // Show default filter icon
            }
        }
    }
}

/**
 * Helper function to check if filter state contains any active filters
 */
export function hasActiveFilters() {
    return filterState.isFilterActive;
}

/**
 * Helper function to get current filter state
 */
export function getFilterState() {
    return { ...filterState }; // Return a copy to prevent direct modification
}

/**
 * Setup filter event handlers for form interactions
 */
export function setupFilterEventHandlers() {
    console.log("[DEBUG] Setting up filter form event handlers");
    
    // Add a small delay to ensure DOM elements are available
    setTimeout(() => {
        // Handle radio button changes
        const radioButtons = document.querySelectorAll('[name="annotation-status"]');
        console.log(`[DEBUG] Found ${radioButtons.length} annotation-status radio buttons`);
        
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                console.log(`[DEBUG] Radio button changed: ${e.target.value}`);
                const isUnlabelled = e.target.value === 'unlabelled';
                const hasAnnotationsCheck = document.getElementById('has-annotations');
                const classFilterContainer = document.getElementById('class-filter-container');
                
                if (hasAnnotationsCheck && classFilterContainer) {
                    if (isUnlabelled) {
                        classFilterContainer.style.display = 'none';
                        hasAnnotationsCheck.checked = false;
                        hasAnnotationsCheck.disabled = true;
                    } else {
                        hasAnnotationsCheck.disabled = false;
                        if (hasAnnotationsCheck.checked) {
                            classFilterContainer.style.display = 'block';
                        }
                    }
                }
            });
        });
        
        // Toggle class filter visibility based on "Has Annotations" checkbox
        const hasAnnotationsCheck = document.getElementById('has-annotations');
        if (hasAnnotationsCheck) {
            console.log("[DEBUG] Found has-annotations checkbox");
            hasAnnotationsCheck.addEventListener('change', (e) => {
                console.log(`[DEBUG] Has annotations changed: ${e.target.checked}`);
                const showClassFilters = e.target.checked;
                const classFilterContainer = document.getElementById('class-filter-container');
                
                if (classFilterContainer) {
                    classFilterContainer.style.display = showClassFilters ? 'block' : 'none';
                    if (!showClassFilters) {
                        // Uncheck all class filters when hiding
                        document.querySelectorAll('[name="class-filter"]')
                            .forEach(cb => cb.checked = false);
                    }
                }
            });
        } else {
            console.warn("[DEBUG] has-annotations checkbox not found");
        }
        
        // Apply filters button
        const applyFiltersBtn = document.getElementById('apply-filters-btn');
        if (applyFiltersBtn) {
            console.log("[DEBUG] Found apply-filters-btn, setting up click handler");
            
            // Remove any existing listeners first
            applyFiltersBtn.replaceWith(applyFiltersBtn.cloneNode(true));
            const newApplyBtn = document.getElementById('apply-filters-btn');
            
            newApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("[DEBUG] Apply filters button clicked - handler triggered");
                applyFilters();
            });
        } else {
            console.error("[DEBUG] apply-filters-btn not found in DOM");
        }
        
        // Reset filters button
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        if (resetFiltersBtn) {
            console.log("[DEBUG] Found reset-filters-btn");
            resetFiltersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("[DEBUG] Reset filters button clicked");
                resetFilters(true);
            });
        } else {
            console.warn("[DEBUG] reset-filters-btn not found");
        }
        
        // Close filter dialog button
        const closeFilterBtn = document.getElementById('close-filter-dialog');
        if (closeFilterBtn) {
            console.log("[DEBUG] Found close-filter-dialog");
            closeFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("[DEBUG] Close filter dialog button clicked");
                closeFilterDialog();
            });
        } else {
            console.warn("[DEBUG] close-filter-dialog not found");
        }
        
        // Open filter dialog button
        const openFilterBtn = document.getElementById('open-filter-dialog');
        if (openFilterBtn) {
            console.log("[DEBUG] Found open-filter-dialog");
            openFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("[DEBUG] Open filter dialog button clicked");
                openFilterDialog();
            });
        } else {
            console.warn("[DEBUG] open-filter-dialog not found");
        }
        
        // Close modal when clicking outside
        const filterModal = document.getElementById('filter-modal');
        if (filterModal) {
            console.log("[DEBUG] Found filter-modal");
            filterModal.addEventListener('click', function(event) {
                if (event.target === filterModal) {
                    console.log("[DEBUG] Clicked outside filter modal, closing");
                    closeFilterDialog();
                }
            });
        } else {
            console.warn("[DEBUG] filter-modal not found");
        }
        
        console.log("[DEBUG] Filter form event handlers setup completed");
        
    }, 500); // Wait 500ms for DOM to be ready
}