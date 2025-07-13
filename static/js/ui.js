// ui.js - UI-related functionality for Facade Studio
// Handles rendering and updating UI elements

// Access state and elements from window instead of importing
const state = window.state;
const elements = window.elements;

import { getClassColor } from './utils.js';
import { transformCanvasPointToImagePoint } from './transformations.js';

// Utility function to show messages with filtering and smarter display
window.messageCache = {};
window.messageTimers = {};

export function showNotification(message, type = 'info') {
    // Don't show "loading" messages unless they're errors
    if (message.toLowerCase().includes('loading') && type === 'info') {
        console.log(`[FILTERED INFO] ${message}`);
        return;
    }
    
    // Generate a message key based on type and first few words (to group similar messages)
    const messageKey = `${type}_${message.split(' ').slice(0, 3).join('_')}`;
    
    // Check if we've shown a similar message recently (within 5 seconds)
    if (window.messageCache[messageKey] && (Date.now() - window.messageCache[messageKey] < 5000)) {
        console.log(`[FILTERED DUPLICATE] ${message}`);
        
        // If we already have a timer for this message type, clear it
        if (window.messageTimers[messageKey]) {
            clearTimeout(window.messageTimers[messageKey]);
        }
        
        // Update the cache timestamp
        window.messageCache[messageKey] = Date.now();
        
        // Set a new timer
        window.messageTimers[messageKey] = setTimeout(() => {
            delete window.messageCache[messageKey];
            delete window.messageTimers[messageKey];
        }, 5000);
        
        return;
    }
    
    // Create message container if it doesn't exist
    let messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'message-container';
        document.body.appendChild(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Add to container
    messageContainer.appendChild(messageElement);
    
    // Auto-remove after delay (2.5 seconds for info, 5 seconds for others)
    const timeout = type === 'info' ? 2500 : 5000;
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => {
            messageElement.remove();
        }, 500);
    }, timeout);
    
    // Add to cache to prevent duplicate messages
    window.messageCache[messageKey] = Date.now();
    
    // Set a timer to clear the cache entry
    window.messageTimers[messageKey] = setTimeout(() => {
        delete window.messageCache[messageKey];
        delete window.messageTimers[messageKey];
    }, 5000);
    
    // Log to console as well
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Backward compatibility with existing code that uses showMessage
export function showMessage(message, type = 'info') {
    showNotification(message, type);
}

export function updateModeDisplay() {
    const AppState = window.AppState;
    const elements = window.elements; // Assuming elements is globally available or passed/imported

    if (elements && elements.modeStatus && AppState && AppState.currentMode) {
        elements.modeStatus.textContent = `Mode: ${AppState.currentMode.charAt(0).toUpperCase() + AppState.currentMode.slice(1)}`;
    }

    // Update active state of mode buttons
    // Ensure modeButtons are queried correctly, or use elements.modeButtons if populated in main.js
    const modeButtons = document.querySelectorAll('.mode-button'); 
    if (AppState && AppState.currentMode) {
        modeButtons.forEach(button => {
            if (button.dataset.mode === AppState.currentMode) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    // console.log(`[UI] Mode updated to: ${AppState ? AppState.currentMode : 'Unknown'}`);
}

export function addLogEntry(message, objectId = null) {
    const AppState = window.AppState;
    if (!AppState) {
        console.error("addLogEntry: AppState is not available.");
        return;
    }

    if (!AppState.logEntries) {
        AppState.logEntries = [];
    }
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        message,
        objectId,
        mode: AppState.currentMode,
        image: AppState.currentImageFilename // Assuming this property exists on AppState
    };
    AppState.logEntries.push(entry);
    console.log(`[LOG] ${message}`, entry);

    // Optional: Update a log display in the UI
    const logDisplay = document.getElementById('log-entries'); // Check actual ID in HTML (e.g., in base.html or label.html)
    if (logDisplay) {
        const logItem = document.createElement('div');
        logItem.className = 'log-entry-item'; // Add a class for potential styling
        logItem.textContent = `[${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${message}${objectId ? ' (Obj: ' + objectId + ')' : ''}`;
        
        if (logDisplay.firstChild) {
            logDisplay.insertBefore(logItem, logDisplay.firstChild);
        } else {
            logDisplay.appendChild(logItem);
        }
        
        // Limit number of log entries displayed
        while (logDisplay.children.length > 100) { 
            logDisplay.removeChild(logDisplay.lastChild);
        }
    }
}

// Initialize class selector
export function initClassSelector() {
    console.log("[DEBUG] Initializing class selector");
  
    // The bottom panel already contains class buttons, no need to search for a specific container
    // Just use the elements.classButtons that we already initialized in main.js
    if (!elements.classButtons || elements.classButtons.length === 0) {
        console.error("[DEBUG] Class buttons not found");
        return;
    }
  
    // Set up event listeners for class buttons
    elements.classButtons.forEach(button => {
        button.addEventListener('click', () => {
            state.activeObjectClass = button.dataset.class;
            updateClassSelectionUI();
        });
    });
  
    // Set default class if available
    if (elements.classButtons.length > 0) {
        state.activeObjectClass = elements.classButtons[0].dataset.class;
    }
  
    updateClassSelectionUI();
}

// Initialize mode buttons
export function initModeButtons() {
    console.log("[DEBUG] Initializing mode buttons");
  
    const modeButtons = document.querySelectorAll('.mode-button');
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            if (mode) {
                state.currentMode = mode;
        
                // Update UI
                modeButtons.forEach(btn => {
                    btn.classList.toggle('active', btn === button);
                });
        
                updateModeStatus();
            }
        });
    });
}

// Initialize toolbar
export function initToolbar() {
    console.log("[DEBUG] Initializing toolbar");
  
    // Set up submit button
    if (elements.submitBtn) {
        elements.submitBtn.addEventListener('click', () => {
            import('./api.js').then(module => {
                module.saveAnnotations();
            });
        });
    }
  
    // Set up skip button
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', () => {
            import('./api.js').then(module => {
                module.loadNextImage();
            });
        });
    }
  
    // Set up delete button
    if (elements.deleteBtn) {
        elements.deleteBtn.addEventListener('click', () => {
            import('./api.js').then(module => {
                module.deleteCurrentImage();
            });
        });
    }
  
    // Update initial button states
    updateButtonStates();
}

// Render the list of images with pagination support and folder navigation
export function renderImageList(clearList = true, selectedFilename = null) {
    // Clear the list if requested (default) or add to existing list
    if (clearList) {
        elements.imageListElement.innerHTML = '';
    
        // If we have prefixes (folders), show navigation
        if (state.imagePrefixes && state.imagePrefixes.length > 0) {
            addFolderNavigation();
        }
    } else {
        // Remove any loading indicators and load more button
        const loadingItems = elements.imageListElement.querySelectorAll('.loading, .loading-more');
        loadingItems.forEach(item => item.remove());
    
        const loadMoreButton = elements.imageListElement.querySelector('.load-more-container');
        if (loadMoreButton) {
            loadMoreButton.remove();
        }
    }
  
    if (!state.imageList || state.imageList.length === 0) {
        if (elements.imageListElement.children.length === 0 || 
            (elements.imageListElement.children.length === 1 && 
            elements.imageListElement.children[0].classList.contains('folder-nav'))) {
            // Only add empty message if we don't have folders displayed
            const emptyLi = document.createElement('li');
            emptyLi.className = 'empty';
            emptyLi.textContent = state.currentPrefix ? 
                `No images in folder '${state.currentPrefix}'` : 
                'No images found';
            elements.imageListElement.appendChild(emptyLi);
        }
        return;
    }
  
    // Create fragment for better performance
    const fragment = document.createDocumentFragment();
  
    // Get the current list of filenames that are already in the DOM
    const existingItems = new Set();
    if (!clearList) {
        elements.imageListElement.querySelectorAll('li:not(.loading-progress):not(.load-more-container):not(.folder-nav)').forEach(li => {
            if (li.dataset.filename) {
                existingItems.add(li.dataset.filename);
            }
        });
    }
  
    // Determine which images to actually render (virtual scrolling)
    // We'll only render a subset of the total images for performance
    const maxVisibleItems = 100; // Maximum number to render at once
    const imagesToRender = state.imageList.slice(0, Math.min(state.imageList.length, maxVisibleItems));
  
    // If there are more than what we're rendering, create a message about it
    if (state.imageList.length > maxVisibleItems && clearList) {
        const virtualLi = document.createElement('li');
        virtualLi.className = 'virtual-notice';
        virtualLi.textContent = `Showing ${maxVisibleItems} of ${state.imageList.length} images. Scroll to load more.`;
        fragment.appendChild(virtualLi);
    }
  
    // Add each image to the list, but only if it's not already there
    imagesToRender.forEach(filename => {
        // Skip if this file is already in the list (when adding more pages)
        if (!clearList && existingItems.has(filename)) {
            return;
        }
    
        const li = document.createElement('li');
    
        // Show just the filename without the folder prefix for cleaner display
        const displayName = state.currentPrefix && filename.startsWith(state.currentPrefix) ? 
            filename.substring(state.currentPrefix.length) : 
            filename;
      
        li.textContent = displayName;
        li.dataset.filename = filename;
        li.title = filename; // Full path on hover
    
        // Mark as selected if it matches the current image or specified filename
        if (filename === state.currentImageFilename || filename === selectedFilename) {
            li.classList.add('selected');
        }
    
        li.addEventListener('click', () => {
            import('./api.js').then(module => {
                module.selectImage(filename);
            });
        });
    
        fragment.appendChild(li);
    });
  
    // Append all new items to the list
    elements.imageListElement.appendChild(fragment);
  
    // Add the "Load More" button at the bottom if pagination is available
    if (state.imagePagination) {
        const loadMoreContainer = document.createElement('li');
        loadMoreContainer.className = 'load-more-container';
    
        // Create the button with appropriate state
        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'load-more-button';
    
        if (state.imagePagination.currentPage >= state.imagePagination.totalPages) {
            // No more pages to load
            loadMoreButton.textContent = 'End of List';
            loadMoreButton.disabled = true;
            loadMoreButton.classList.add('end-of-list');
        } else {
            // More pages available
            loadMoreButton.textContent = `Load More (${state.imageList.length}/${state.imagePagination.totalImages})`;
            loadMoreButton.addEventListener('click', () => {
                import('./api.js').then(module => {
                    module.loadMoreImages();
                });
            });
        }
    
        loadMoreContainer.appendChild(loadMoreButton);
        elements.imageListElement.appendChild(loadMoreContainer);
    }
  
    // Set up scroll event listener for virtual scrolling if we have a lot of images
    if (state.imageList.length > maxVisibleItems) {
        setupVirtualScrolling(maxVisibleItems);
    }
}

// Add folder navigation UI
function addFolderNavigation() {
    // Create folder navigation container
    const navContainer = document.createElement('li');
    navContainer.className = 'folder-nav';
  
    // If we're in a subfolder, add "Back to root" button
    if (state.currentPrefix) {
        const backButton = document.createElement('button');
        backButton.className = 'folder-back-button';
        backButton.innerHTML = '&#8593; Back to root';
        backButton.addEventListener('click', () => {
            import('./api.js').then(module => {
                module.navigateUp();
            });
        });
        navContainer.appendChild(backButton);
    } else {
        // Add folder (prefix) buttons
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.textContent = 'Folders:';
        navContainer.appendChild(folderHeader);
    
        // Add each folder as a button
        state.imagePrefixes.forEach(prefix => {
            const folderBtn = document.createElement('button');
            folderBtn.className = 'folder-button';
            // Remove trailing slash for display
            folderBtn.textContent = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
            folderBtn.addEventListener('click', () => {
                import('./api.js').then(module => {
                    module.setCurrentPrefix(prefix);
                });
            });
            navContainer.appendChild(folderBtn);
        });
    }
  
    // Add a separator after folders
    const separator = document.createElement('hr');
    separator.className = 'folder-separator';
    navContainer.appendChild(separator);
  
    // Add to the image list before any other elements
    if (elements.imageListElement.firstChild) {
        elements.imageListElement.insertBefore(navContainer, elements.imageListElement.firstChild);
    } else {
        elements.imageListElement.appendChild(navContainer);
    }
}

// Setup virtual scrolling for the image list
function setupVirtualScrolling(initialCount) {
    const imageList = elements.imageListElement;
  
    // Add scroll listener if not already set
    if (!imageList._virtualScrollHandler) {
        imageList._virtualScrollHandler = function() {
            // If we're within 100px of the bottom and there are more images to show
            const scrollBottom = this.scrollTop + this.clientHeight;
            if (scrollBottom >= (this.scrollHeight - 100)) {
                const allItems = state.imageList || [];
                const currentItemCount = imageList.querySelectorAll('li[data-filename]').length;
        
                // If we have more images to display from what's already loaded
                if (currentItemCount < allItems.length) {
                    const nextBatch = allItems.slice(
                        currentItemCount, 
                        Math.min(currentItemCount + 50, allItems.length)
                    );
          
                    // Create fragment for better performance
                    const fragment = document.createDocumentFragment();
          
                    // Add each image in the next batch
                    nextBatch.forEach(filename => {
                        const li = document.createElement('li');
            
                        // Show just the filename without the folder prefix
                        const displayName = state.currentPrefix && filename.startsWith(state.currentPrefix) ? 
                            filename.substring(state.currentPrefix.length) : 
                            filename;
              
                        li.textContent = displayName;
                        li.dataset.filename = filename;
                        li.title = filename; // Full path on hover
            
                        // Mark as selected if it matches the current image
                        if (filename === state.currentImageFilename) {
                            li.classList.add('selected');
                        }
            
                        li.addEventListener('click', () => {
                            import('./api.js').then(module => {
                                module.selectImage(filename);
                            });
                        });
            
                        fragment.appendChild(li);
                    });
          
                    // Find the load more button or progress indicator
                    const insertBefore = imageList.querySelector('.load-more-container') || 
                                        imageList.querySelector('.loading-progress');
          
                    // Insert the new items before the load more button
                    if (insertBefore) {
                        imageList.insertBefore(fragment, insertBefore);
                    } else {
                        imageList.appendChild(fragment);
                    }
          
                    // Update virtual notice if we still have more to show
                    let virtualNotice = imageList.querySelector('.virtual-notice');
                    if (virtualNotice) {
                        if (currentItemCount + nextBatch.length >= allItems.length) {
                            // All images are now visible, remove the notice
                            virtualNotice.remove();
                        } else {
                            // Update the count
                            virtualNotice.textContent = `Showing ${currentItemCount + nextBatch.length} of ${allItems.length} images. Scroll to load more.`;
                        }
                    }
                }
            }
        };
    
        // Add the scroll event listener
        imageList.addEventListener('scroll', imageList._virtualScrollHandler);
    }
}

// Render the list of annotations in the right panel
export function renderAnnotationList() {
    // Check if elements object has been initialized
    if (!elements) {
        console.warn("[DEBUG] renderAnnotationList: elements object not initialized");
        return;
    }

    // Check if annotation list element exists before accessing it
    if (!elements.annotationListElement) {
        // Try to find the element directly if it wasn't properly initialized
        const annotationList = document.getElementById('annotation-list');
        if (annotationList) {
            // Store the element reference for future use
            elements.annotationListElement = annotationList;
            console.log("[DEBUG] renderAnnotationList: Found and initialized annotation list element");
        } else {
            console.warn("[DEBUG] renderAnnotationList: Annotation list element not found");
            return;
        }
    }
  
    // Clear the current list
    elements.annotationListElement.innerHTML = '';
  
    if (!state.annotations || state.annotations.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'No annotations';
        emptyItem.className = 'empty-list';
        elements.annotationListElement.appendChild(emptyItem);
        return;
    }
  
    // Create a list item for each annotation
    state.annotations.forEach((polygon, index) => {
        const li = document.createElement('li');
        const className = polygon.customData?.class || 'Unknown';
        const objectId = polygon.customData?.objectId || `${index + 1}`;
    
        // Show ID followed by class name - changed order here
        li.textContent = `${objectId}: ${className}`;
        li.dataset.index = index;
    
        // Highlight if this is the active polygon
        if (polygon === state.activePolygon) {
            li.classList.add('selected');
        }
    
        // Add color indicator matching the polygon color
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'color-indicator';
        colorIndicator.style.backgroundColor = polygon.fill;
        li.insertBefore(colorIndicator, li.firstChild);
    
        // Add click handler to select this polygon
        li.addEventListener('click', () => {
            import('./annotations.js').then(module => {
                module.selectPolygon(polygon);
            });
        });
    
        elements.annotationListElement.appendChild(li);
    });
  
    // Add a CSS rule for the color indicator if it doesn't exist yet
    if (!document.querySelector('style#annotation-list-style')) {
        const style = document.createElement('style');
        style.id = 'annotation-list-style';
        style.textContent = `
            .color-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
                border: 1px solid #fff;
            }
            #annotation-list li.empty-list {
                color: #999;
                font-style: italic;
                text-align: center;
                padding: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Update the mode status display in the UI
export function updateModeStatus() {
    if (elements.modeStatus) {
        elements.modeStatus.textContent = state.currentMode || 'Select';
    
        // Update mode buttons to match current mode
        const modeButtons = document.querySelectorAll('.mode-button');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === state.currentMode);
        });
    }
}

// Update the UI to reflect the current class selection
export function updateClassSelectionUI() {
    // Reset all buttons to non-active state
    elements.classButtons.forEach(button => {
        button.classList.remove('active');
    });
  
    // Find and activate the button for the current class
    const activeButton = Array.from(elements.classButtons).find(
        button => button.dataset.class === state.activeObjectClass
    );
  
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Update button states based on the application state
export function updateButtonStates() {
    // Import validation mode status
    import('./validation.js').then(module => {
        const isValidationMode = module.isInValidationMode();
        console.log("[DEBUG] updateButtonStates: isValidationMode=", isValidationMode);
    
        // Mode buttons should be disabled in validation mode, enabled in label mode
        const modeButtons = document.querySelectorAll('.mode-button');
        modeButtons.forEach(btn => {
            btn.disabled = isValidationMode;
            btn.style.opacity = isValidationMode ? '0.5' : '1';
            
            // In validation mode, remove active state from all mode buttons
            if (isValidationMode) {
                btn.classList.remove('active');
            }
        });
    
        // SHOW/HIDE BUTTONS INSTEAD OF DISABLING
        // Submit button is only shown in label mode
        if (elements.submitBtn) {
            elements.submitBtn.style.display = isValidationMode ? 'none' : 'inline-block';
            // Don't disable, let it be handled by visibility
            elements.submitBtn.disabled = false;
        }
    
        // Skip button is shown in both modes but labeled differently
        if (elements.skipBtn) {
            elements.skipBtn.textContent = isValidationMode ? 'Skip' : 'Next Image';
            // Always enable the skip button
            elements.skipBtn.disabled = false;
        }
    
        // Delete button is only shown in label mode
        if (elements.deleteBtn) {
            elements.deleteBtn.style.display = isValidationMode ? 'none' : 'inline-block';
            // Don't disable, let it be handled by visibility
            elements.deleteBtn.disabled = false;
        }
    
        // Validation buttons are only shown in validation mode
        if (elements.acceptBtn) {
            elements.acceptBtn.style.display = isValidationMode ? 'inline-block' : 'none';
            // Always enable if it's visible
            elements.acceptBtn.disabled = false;
            
            // Add custom attribute for our CSS override
            if (isValidationMode) {
                elements.acceptBtn.setAttribute('data-validation-enabled', 'true');
                console.log("[DEBUG] Accept button force enabled in updateButtonStates");
            } else {
                elements.acceptBtn.removeAttribute('data-validation-enabled');
            }
        }
    
        if (elements.rejectBtn) {
            elements.rejectBtn.style.display = isValidationMode ? 'inline-block' : 'none';
            // Always enable if it's visible
            elements.rejectBtn.disabled = false;
            
            // Add custom attribute for our CSS override
            if (isValidationMode) {
                elements.rejectBtn.setAttribute('data-validation-enabled', 'true');
                console.log("[DEBUG] Reject button force enabled in updateButtonStates");
            } else {
                elements.rejectBtn.removeAttribute('data-validation-enabled');
            }
        }
    
        // Class buttons should be disabled in validation mode, enabled in label mode
        if (elements.classButtons && elements.classButtons.length > 0) {
            elements.classButtons.forEach(btn => {
                btn.disabled = isValidationMode;
                btn.style.opacity = isValidationMode ? '0.5' : '1';
            });
        }
        
        // ENSURE NO BUTTONS ARE ACCIDENTALLY DISABLED
        document.querySelectorAll('.action-buttons button').forEach(btn => {
            if (btn.style.display !== 'none') {
                btn.disabled = false;
                btn.removeAttribute('disabled');
            }
        });
    });
}

// Update the status display for a selected object
export function updateSelectedObjectStatus(polygon) {
    if (!elements.selectedObjectStatus || !polygon) return;
  
    const className = polygon.customData?.class || 'Unknown';
    const objectId = polygon.customData?.objectId || '';
  
    elements.selectedObjectStatus.textContent = `${className} (${objectId})`;
}

// Update the annotation list in the UI
export function updateAnnotationList() {
    // Check if elements object has been initialized
    if (!elements) {
        console.warn("[DEBUG] renderAnnotationList: elements object not initialized");
        return;
    }

    // Check if annotation list element exists before accessing it
    if (!elements.annotationListElement) {
        // Try to find the element directly if it wasn't properly initialized
        const annotationList = document.getElementById('annotation-list');
        if (annotationList) {
            // Store the element reference for future use
            elements.annotationListElement = annotationList;
            console.log("[DEBUG] renderAnnotationList: Found and initialized annotation list element");
        } else {
            console.warn("[DEBUG] renderAnnotationList: Annotation list element not found");
            return;
        }
    }
  
    // Clear the current list
    elements.annotationListElement.innerHTML = '';
  
    if (!state.annotations || state.annotations.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'No annotations';
        emptyItem.className = 'empty-list';
        elements.annotationListElement.appendChild(emptyItem);
        return;
    }
  
    // Create a list item for each annotation
    state.annotations.forEach((polygon, index) => {
        const li = document.createElement('li');
        const className = polygon.customData?.class || 'Unknown';
        const objectId = polygon.customData?.objectId || `${index + 1}`;
    
        // Show ID followed by class name - changed order here
        li.textContent = `${objectId}: ${className}`;
        li.dataset.index = index;
    
        // Highlight if this is the active polygon
        if (polygon === state.activePolygon) {
            li.classList.add('selected');
        }
    
        // Add color indicator matching the polygon color
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'color-indicator';
        colorIndicator.style.backgroundColor = polygon.fill;
        li.insertBefore(colorIndicator, li.firstChild);
    
        // Add click handler to select this polygon
        li.addEventListener('click', () => {
            import('./annotations.js').then(module => {
                module.selectPolygon(polygon);
            });
        });
    
        elements.annotationListElement.appendChild(li);
    });
  
    // Add a CSS rule for the color indicator if it doesn't exist yet
    if (!document.querySelector('style#annotation-list-style')) {
        const style = document.createElement('style');
        style.id = 'annotation-list-style';
        style.textContent = `
            .color-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
                border: 1px solid #fff;
            }
            #annotation-list li.empty-list {
                color: #999;
                font-style: italic;
                text-align: center;
                padding: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Update zoom status in the UI
export function updateZoomStatus() {
    if (!elements.zoomStatus) return;
  
    // Format the zoom level as a percentage with 0 decimal places
    const zoomPercent = Math.round(state.zoomLevel * 100);
    elements.zoomStatus.textContent = `${zoomPercent}%`;
}

// Define a simple implementation of renderMetadata if it doesn't exist
export function renderMetadata(metadata) {
  console.log("[DEBUG] renderMetadata: Displaying metadata in UI", metadata);
  
  // Find the container for metadata display
  const metadataContainer = document.getElementById('metadata-box') || document.querySelector('#metadata-box');
  
  if (!metadataContainer) {
    console.warn("[DEBUG] renderMetadata: No metadata container found in UI");
    return;
  }
  
  // Clear existing content
  metadataContainer.innerHTML = '';
  
  if (!metadata || Object.keys(metadata).length === 0) {
    metadataContainer.innerHTML = '<p class="empty-metadata">No metadata available</p>';
    return;
  }
  
  // Create a table to display metadata
  const table = document.createElement('table');
  table.className = 'metadata-table';
  
  // Add each metadata field to the table
  Object.entries(metadata).forEach(([key, value]) => {
    const row = document.createElement('tr');
    
    const keyCell = document.createElement('td');
    keyCell.className = 'metadata-key';
    keyCell.textContent = key;
    
    const valueCell = document.createElement('td');
    valueCell.className = 'metadata-value';
    valueCell.textContent = value;
    
    row.appendChild(keyCell);
    row.appendChild(valueCell);
    table.appendChild(row);
  });
  
  // Add the table to the container
  metadataContainer.appendChild(table);
}