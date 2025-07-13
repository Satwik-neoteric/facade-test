// Filter module for Facade Studio
// Handles filtering images based on various criteria, particularly from CosmosDB COCO records
 
// Export filter functions
export { initFilters, openFilterDialog, closeFilterDialog, applyFilters, resetFilters };
 
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
 
// Initialize filter module
function initFilters() {
    console.log("[DEBUG] Initializing filter module");
    setupFilterEventHandlers();
    populateClassFilterOptions();
}
 
// Setup event handlers for the filter dialog
function setupFilterEventHandlers() {
    console.log("[DEBUG] Setting up filter event handlers");
   
    // Show filter dialog
    const openFilterBtn = document.getElementById('open-filter-dialog');
    if (openFilterBtn) {
        openFilterBtn.addEventListener('click', () => {
            console.log("[DEBUG] Filter button clicked");
            openFilterDialog();
        });
    } else {
        console.warn("[DEBUG] Filter button not found");
    }
   
    // Close filter dialog
    const closeFilterBtn = document.getElementById('close-filter-dialog');
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener('click', () => {
            console.log("[DEBUG] Close filter button clicked");
            closeFilterDialog();
        });
    }
   
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            console.log("[DEBUG] Apply filters button clicked");
            applyFilters();
        });
    }
   
    // Reset filters button
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            console.log("[DEBUG] Reset filters button clicked");
            resetFilters(true);
        });
    }
   
    // Handle clicks outside the modal to close it
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                closeFilterDialog();
            }
        });
    }
   
    // Handle radio button changes
    document.querySelectorAll('[name="annotation-status"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
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
        hasAnnotationsCheck.addEventListener('change', (e) => {
            const showClassFilters = e.target.checked;
            filterState.hasAnnotations = showClassFilters;
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
    }
   
    console.log("[DEBUG] Filter event handlers set up");
}
 
// Populate class filter options from available classes
function populateClassFilterOptions() {
    console.log("[DEBUG] Populating class filter options");
   
    // Get the predefined classes from the class buttons
    const classButtons = document.querySelectorAll('.class-button');
    const classes = Array.from(classButtons).map(button => button.getAttribute('data-class')).filter(Boolean);
   
    if (!classes.length) {
        console.warn("[DEBUG] No classes available for filter");
        return;
    }
   
    const classFilterGroup = $('#class-filter-group');
    if (!classFilterGroup.length) {
        console.warn("[DEBUG] Class filter group element not found");
        return;
    }
   
    classFilterGroup.empty();
    console.log("[DEBUG] Adding class options:", classes);
   
    classes.forEach(className => {
        const checkboxItem = $('<div>').addClass('filter-checkbox-item');
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .attr('id', `class-${className}`)
            .attr('name', 'class-filter')
            .attr('value', className);
           
        const label = $('<label>')
            .attr('for', `class-${className}`)
            .text(className);
           
        checkboxItem.append(checkbox).append(label);
        classFilterGroup.append(checkboxItem);
    });
   
    console.log("[DEBUG] Class filter options populated");
}
 
// Open the filter dialog
function openFilterDialog() {
    console.log("[DEBUG] Opening filter dialog");
   
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        console.error("[DEBUG] Filter modal element not found");
        return;
    }
   
    // Initialize AppState if needed
    if (!window.AppState) {
        window.AppState = {
            currentBatch: null,
            classes: []
        };
    }
   
    // Populate with current filter state if filters are active
    if (filterState.isFilterActive) {
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
    } else {
        // Set default values for first-time open
        resetFilters(false); // Reset without applying
    }
      // Show the dialog with animation
    filterModal.style.display = 'flex';  // First set display to flex
    // Force a reflow
    filterModal.offsetHeight;
    // Then add the active class for the animation
    filterModal.classList.add('active');
    console.log("[DEBUG] Filter dialog opened");
}
 
// Close the filter dialog
function closeFilterDialog() {
    console.log("[DEBUG] Closing filter dialog");
   
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
        filterModal.classList.remove('active');
        // Wait for the transition to complete before hiding
        setTimeout(() => {
            filterModal.style.display = 'none';
        }, 300); // Match the transition duration from CSS
        console.log("[DEBUG] Filter dialog closed");
    } else {
        console.error("[DEBUG] Filter modal element not found");
    }
}
 
// Apply filters based on user selections
async function applyFilters() {
    try {
        // First, check if a batch is selected
        if (!window.AppState.currentBatch) {
            alert("Please select a batch first before applying filters");
            return;
        }
       
        // Show loading indicator
        $('#image-list').html('<li class="loading">Filtering images...</li>');
       
        // Collect filter criteria
        const nameWildcard = $('#name-filter').val().trim();
        const dateStart = $('#date-start').val();
        const dateEnd = $('#date-end').val();
       
        // Check if "Unlabelled Only" is selected
        const unlabelledOnly = $('#filter-unlabelled').prop('checked');
       
        // Get selected class values (only if has annotations is checked)
        const classFilters = [];
        if ($('#has-annotations').prop('checked')) {            $('input[name="class-filter"]:checked').each(function() {
                const className = $(this).val();
                console.log(`[DEBUG] Adding class filter: ${className}`);
                classFilters.push(className);
            });
            console.log(`[DEBUG] Final class filters: ${JSON.stringify(classFilters)}`);
        }
       
        // Check if "Has Annotations" is selected
        const hasAnnotations = $('#has-annotations').prop('checked');
       
        // Check if "Show Deleted" is selected
        const showDeleted = $('#show-deleted').prop('checked');
          // Build filter payload
        const filterPayload = {
            batchId: window.AppState.currentBatch, // Changed from batch_id to batchId to match backend model
            nameWildcard: nameWildcard,
            dateStart: dateStart,
            dateEnd: dateEnd,
            unlabelledOnly: unlabelledOnly,
            hasAnnotations: hasAnnotations,
            showDeleted: showDeleted,
            classes: classFilters,
            status: [] // We'll let the backend determine status based on unlabelledOnly
        };
       
        console.log("[DEBUG] Applying filters:", filterPayload);
       
        // Call API with filter criteria
        const response = await fetch('/api/filtered-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filterPayload)
        });
       
        if (!response.ok) {
            throw new Error(`Error filtering images: ${response.statusText}`);
        }
       
        const filteredImages = await response.json();
       
        // Update filter state
        filterState.nameWildcard = nameWildcard;
        filterState.dateStart = dateStart;
        filterState.dateEnd = dateEnd;
        filterState.unlabelledOnly = unlabelledOnly;
        filterState.hasAnnotations = hasAnnotations;
        filterState.showDeleted = showDeleted;
        filterState.classes = classFilters;
        filterState.isFilterActive = !!(
            nameWildcard || dateStart || dateEnd ||
            unlabelledOnly || !hasAnnotations ||
            showDeleted || classFilters.length > 0
        );
          // Update the image list with filtered results
        updateImageList(filteredImages);
       
        // Close the dialog
        closeFilterDialog();
       
        // Update UI to show filter state
        $('#open-filter-dialog').toggleClass('active', filterState.isFilterActive);
       
        // Show specific message if class filters were applied but no results found
        if (filterState.classes && filterState.classes.length > 0 && filteredImages.length === 0) {
            const message = `No images found matching the selected class filters: ${filterState.classes.join(', ')}`;
            if (window.showMessage) {
                window.showMessage(message, "warning");
            } else {
                console.warn(message);
            }
        }
       
        // Show a message with the results
        const message = filterState.isFilterActive
            ? `Filter applied: Showing ${filteredImages.length} results`
            : `All filters cleared: Showing ${filteredImages.length} images`;
           
        if (window.showMessage) {
            window.showMessage(message, "info");
        } else {
            console.log(message);
        }
       
    } catch (error) {
        console.error("Error applying filters:", error);
        const errorMessage = `Error applying filters: ${error.message}`;
        if (window.showMessage) {
            window.showMessage(errorMessage, "error");
        } else {
            alert(errorMessage);
        }
       
        // Only try to refresh the image list if we have a batch selected
        if (window.AppState.currentBatch) {
            refreshImageList();
        } else {
            // Clear the image list with a message
            $('#image-list').html('<li class="empty">Please select a batch first</li>');
        }
    }
}
 
// Reset filters to default state
function resetFilters(applyReset = true) {
    // Clear all filter inputs
    $('#name-filter').val('');
    $('#date-start').val('');
    $('#date-end').val('');
   
    // Reset radio buttons
    $('#filter-all').prop('checked', true);
    $('#filter-unlabelled').prop('checked', false);
      // Reset checkboxes
    $('#has-annotations').prop('checked', true).prop('disabled', false);
    $('#show-deleted').prop('checked', false);
   
    // Reset all class filter checkboxes
    const classCheckboxes = $('input[name="class-filter"]');
    console.log(`[DEBUG] Resetting ${classCheckboxes.length} class filter checkboxes`);
    classCheckboxes.prop('checked', false);
   
    // Show class filter container
    $('#class-filter-container').show();
   
    // Clear filter state
    filterState.nameWildcard = '';
    filterState.dateStart = '';
    filterState.dateEnd = '';
    filterState.status = [];
    filterState.classes = [];
    filterState.unlabelledOnly = false;
    filterState.hasAnnotations = true;
    filterState.showDeleted = false;
    filterState.isFilterActive = false;
   
    console.log("[DEBUG] Filters reset");
   
    // Apply the reset if requested
    if (applyReset) {
        refreshImageList();
    }
}
 
// Update the image list with filtered results
function updateImageList(filteredImages) {
    const imageList = $('#image-list');
    imageList.empty();
   
    if (!filteredImages || filteredImages.length === 0) {
        imageList.html('<li class="empty">No images match the filter criteria</li>');
        return;
    }
   
    // Get batch ID from the global state
    const batchId = window.AppState.currentBatch;
   
    // Filter out images with 'Deleted' status before displaying them
    const nonDeletedImages = filteredImages.filter(image => {
        if (typeof image === 'object' && image.status) {
            const status = image.status.toLowerCase(); // Fixed: properly declare with const
            if (status === 'deleted' || status.includes('deleted')) {
                console.log(`[DEBUG] Filtering out deleted image from results: ${image.id || image.file_name}`);
                return false;
            }
        }
        return true;
    });
   
    console.log(`[DEBUG] Filtered out ${filteredImages.length - nonDeletedImages.length} deleted images from filter results`);
   
    // Extract the current batch's image IDs
    if (nonDeletedImages.length > 0) {
        nonDeletedImages.forEach(image => {
            if (typeof image === 'string') {
                // Handle plain string image paths
                const imagePath = image;
                const fileName = imagePath.split('/').pop();
                const imageId = fileName.split('.')[0]; // Extract ID from filename
               
                const listItem = $('<li>').addClass('image-item');
                listItem.attr('data-image-id', imageId);
                listItem.attr('data-image-path', imagePath);
                listItem.text(imageId);
                imageList.append(listItem);
            } else if (typeof image === 'object' && image.id && image.file_name) {
                // Handle object format with id and file_name properties
                const listItem = $('<li>').addClass('image-item');
                listItem.attr('data-image-id', image.id);
               
                // Ensure the image path is properly formatted for loading
                // If file_name contains a full path with batch/folder, use it directly
                // Otherwise, format it as "{batchId}/{fileName}" if batch ID is available
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
               
                listItem.attr('data-image-path', imagePath);
                listItem.text(image.id);
                imageList.append(listItem);
            }
        });
    }
   
    console.log(`[DEBUG] Updated image list with ${nonDeletedImages.length} filtered results`);
}
 
// Refresh the image list (used when clearing filters)
async function refreshImageList() {
    try {
        const batchId = window.AppState.currentBatch;
       
        if (!batchId) {
            console.warn("[DEBUG] Cannot refresh image list: No batch selected");
            return;
        }
       
        // Show loading indicator
        $('#image-list').html('<li class="loading">Loading images...</li>');
       
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
        $('#image-list').html('<li class="error">Error loading images</li>');
    }
}
 
// Helper function to check if filter state contains any active filters
export function hasActiveFilters() {
    return filterState.isFilterActive;
}
 
// Helper function to get current filter state
export function getFilterState() {
    return { ...filterState }; // Return a copy to prevent direct modification
}
 
// Show a message to the user (wrapper for global function)
function showMessage(message, type = 'info') {
    if (window.showMessage) {
        window.showMessage(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}
 
// Update the UI when the filter state changes
function updateFilterUI() {
    const filterButton = $('#open-filter-dialog');
    const activeClass = 'active';
   
    if (filterState.isFilterActive) {
        filterButton.addClass(activeClass);
        filterButton.find('.filter-button-icon').text('🔍✓'); // Show active icon
    } else {
        filterButton.removeClass(activeClass);
        filterButton.find('.filter-button-icon').text('🔍'); // Show default icon
    }
}