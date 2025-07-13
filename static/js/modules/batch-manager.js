// batch-manager.js - Batch and Image Selection Management
// Handles batch selection, image loading, and image list management

import { getAppState } from './app-state.js';
import { showMessage, addLogEntry } from './utilities.js';
import { fetchBatchImages } from './data-loader.js';

/**
 * Handle batch selection and load images for the selected batch
 */
export async function handleBatchSelection(batchId) {
    console.log(`[DEBUG] Batch selection initiated for: ${batchId}`);
    
    if (!batchId) {
        console.warn('[DEBUG] No batch ID provided');
        clearImageDisplay();
        return;
    }
    
    try {
        // Update UI to show loading state
        showLoadingState();
        
        // Store selected batch in app state
        const appState = getAppState();
        appState.selectedBatch = batchId;
        appState.currentImageIndex = 0;
        
        // Clear any existing images
        clearImageDisplay();
        
        // Fetch images for the selected batch
        console.log(`[DEBUG] Fetching images for batch: ${batchId}`);
        const images = await fetchBatchImages(batchId);
        
        if (!images || images.length === 0) {
            console.warn(`[DEBUG] No images found for batch: ${batchId}`);
            showMessage(`No images found in batch: ${batchId}`, 'warning');
            showNoImagesState();
            return;
        }
        
        console.log(`[DEBUG] Found ${images.length} images in batch: ${batchId}`);
        
        // Store images in app state
        appState.currentBatch = {
            id: batchId,
            images: images,
            currentIndex: 0
        };
        
        // Update image list in UI
        await updateImageList(images);
        
        // Load the first image
        if (images.length > 0) {
            await loadFirstImage(images[0], batchId);
        }
        
        // Update UI state
        hideLoadingState();
        
        addLogEntry(`Loaded batch: ${batchId} (${images.length} images)`);
        showMessage(`Loaded ${images.length} images from batch: ${batchId}`, 'success');
        
    } catch (error) {
        console.error(`[ERROR] Failed to load batch ${batchId}:`, error);
        showMessage(`Failed to load batch: ${error.message}`, 'error');
        hideLoadingState();
        showErrorState(error.message);
    }
}

/**
 * Process images response data
 */
export function processImagesResponse(data) {
    const AppState = getAppState();
    
    // Check if data is an array (direct images format) or object with images property
    const images = Array.isArray(data) ? data : (data && data.images ? data.images : []);
    
    // Process the images with batch filtering
    displayBatchImages(images, AppState.currentBatch);
}

/**
 * Display batch images after filtering
 */
export function displayBatchImages(imagesData, batchId) {
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    if (!imagesData || imagesData.length === 0) {
        imageList.innerHTML = '<li class="empty">No images found in this batch</li>';
        return;
    }

    let standardizedImages = [];
    
    if (imagesData.every(img => typeof img === 'string')) {
        console.log("[DEBUG] Standardizing data from fallback API (array of strings)");
        standardizedImages = imagesData.map(imagePathString => {
            const filename = imagePathString.split('/').pop();
            const lastDotIndex = filename.lastIndexOf('.');
            const imageId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
            return {
                id: imageId,
                file_name: imagePathString,
                status: 'Not Reviewed' // Default status
            };
        });
    } else if (imagesData.every(img => typeof img === 'object' && img !== null && img.hasOwnProperty('file_name'))) {
        console.log("[DEBUG] Standardizing data from primary API (array of objects)");
        standardizedImages = imagesData.map(img => {
            const filename = img.file_name.split('/').pop();
            const lastDotIndex = filename.lastIndexOf('.');
            const imageId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
            return {
                id: imageId,
                file_name: img.file_name,
                status: img.status || 'Not Reviewed',
                has_annotations: img.has_annotations || false,
                annotation_count: img.annotation_count || 0
            };
        });
    } else {
        console.error("[DEBUG] Unexpected image data format:", imagesData);
        showMessage("Unexpected image data format received", "error");
        return;
    }

    console.log(`[DEBUG] Displaying ${standardizedImages.length} images for batch ${batchId}`);

    // Build image list HTML
    const imageListHTML = standardizedImages.map(img => {
        const statusClass = getStatusClass(img.status);
        const annotationInfo = img.annotation_count > 0 ? 
            `<small class="text-blue-600">(${img.annotation_count} annotations)</small>` : '';
        
        return `
            <li class="image-item ${statusClass}" 
                data-image-id="${img.id}" 
                data-image-path="${img.file_name}"
                data-batch-id="${batchId}">
                <div class="image-info">
                    <div class="filename">${img.file_name.split('/').pop()}</div>
                    <div class="status">${img.status} ${annotationInfo}</div>
                </div>
            </li>
        `;
    }).join('');

    imageList.innerHTML = imageListHTML;

    // Add click event listeners to image items
    const imageItems = imageList.querySelectorAll('.image-item');
    imageItems.forEach(item => {
        item.addEventListener('click', function() {
            const imageId = this.dataset.imageId;
            const imagePath = this.dataset.imagePath;
            const batchId = this.dataset.batchId;
            
            handleImageSelection(imageId, imagePath, batchId);
        });
    });

    console.log(`[DEBUG] Image list updated with ${standardizedImages.length} images`);
    
    // Automatically select the first image if available
    if (imageItems.length > 0) {
        const firstImage = imageItems[0];
        const imageId = firstImage.dataset.imageId;
        const imagePath = firstImage.dataset.imagePath;
        const batchId = firstImage.dataset.batchId;
        
        console.log(`[DEBUG] Auto-selecting first image: ${imageId}`);
        handleImageSelection(imageId, imagePath, batchId);
    }
}

/**
 * Get CSS class for image status
 */
function getStatusClass(status) {
    switch (status) {
        case 'Completed': return 'status-completed';
        case 'In Progress': return 'status-in-progress';
        case 'Reviewed': return 'status-reviewed';
        case 'Approved': return 'status-approved';
        case 'Rejected': return 'status-rejected';
        default: return 'status-default';
    }
}

/**
 * Handle image selection
 */
export async function handleImageSelection(imageId, imagePath, batchId = null) {
    const AppState = getAppState();
    
    try {
        console.log(`[DEBUG] Image selected: ${imageId} (${imagePath})`);
        
        // Update active state in image list
        const imageList = document.getElementById('image-list');
        if (imageList) {
            const imageItems = imageList.querySelectorAll('.image-item');
            imageItems.forEach(item => {
                if (item.dataset.imageId === imageId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        // Update application state
        AppState.currentImageId = imageId;
        AppState.currentImagePath = imagePath;
        if (batchId) {
            AppState.currentBatch = batchId;
        }
        
        // Generate unique load ID for race condition prevention
        const loadId = ++AppState.currentLoadId;
        AppState.expectedLoadId = loadId;
        
        // Load the image
        if (window.modules?.dataLoader?.loadImage) {
            await window.modules.dataLoader.loadImage(imagePath, loadId);
        } else {
            // Fallback for during transition
            if (window.loadImage) {
                await window.loadImage(imagePath, loadId);
            } else {
                console.error("[DEBUG] No loadImage function available");
            }
        }
        
        // Load sensor data for this image
        if (batchId && imageId) {
            if (window.modules?.dataLoader?.loadSensorData) {
                await window.modules.dataLoader.loadSensorData(batchId, imageId);
            } else if (window.loadSensorData) {
                await window.loadSensorData(batchId, imageId);
            }
        }
        
        addLogEntry(`Selected image: ${imagePath.split('/').pop()}`);
        
    } catch (error) {
        console.error(`[DEBUG] Error handling image selection:`, error);
        showMessage(`Error loading image: ${error.message}`, "error");
    }
}

/**
 * Navigate to next image in sequence
 */
export function navigateToNextImage() {
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    const images = Array.from(imageList.children);
    const currentIndex = images.findIndex(img => img.classList.contains('active'));
    
    if (currentIndex >= 0 && currentIndex < images.length - 1) {
        const nextImage = images[currentIndex + 1];
        const imageId = nextImage.dataset.imageId;
        const imagePath = nextImage.dataset.imagePath;
        const batchId = nextImage.dataset.batchId;
        
        if (imageId && imagePath) {
            handleImageSelection(imageId, imagePath, batchId);
            console.log(`[DEBUG] Navigated to next image: ${imageId}`);
        }
    } else {
        console.log('[DEBUG] Already at last image');
        showMessage('You have reached the last image in this batch.', 'info');
    }
}

/**
 * Navigate to previous image in sequence
 */
export function navigateToPreviousImage() {
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    const images = Array.from(imageList.children);
    const currentIndex = images.findIndex(img => img.classList.contains('active'));
    
    if (currentIndex > 0) {
        const prevImage = images[currentIndex - 1];
        const imageId = prevImage.dataset.imageId;
        const imagePath = prevImage.dataset.imagePath;
        const batchId = prevImage.dataset.batchId;
        
        if (imageId && imagePath) {
            handleImageSelection(imageId, imagePath, batchId);
            console.log(`[DEBUG] Navigated to previous image: ${imageId}`);
        }
    } else {
        console.log('[DEBUG] Already at first image');
        showMessage('You are already at the first image in this batch.', 'info');
    }
}

/**
 * Update batch info display
 */
export function updateBatchInfo(batchData) {
    const batchInfo = document.getElementById('batch-info');
    if (!batchInfo || !batchData) return;
    
    const imageCount = batchData.image_count || 0;
    const batchId = batchData.batch_id || 'Unknown';
    
    batchInfo.innerHTML = `
        <div class="batch-summary">
            <div class="batch-name">${batchId}</div>
            <div class="batch-stats">${imageCount} images</div>
        </div>
    `;
    
    batchInfo.classList.remove('hidden');
}

/**
 * Show loading state in image list
 */
function showLoadingState() {
    const imageList = document.getElementById('image-list');
    if (imageList) {
        imageList.innerHTML = `
            <li class="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <span>Loading images...</span>
                </div>
            </li>
        `;
    }
}

/**
 * Hide loading state 
 */
function hideLoadingState() {
    // Loading state is hidden when images are displayed
    console.log('[DEBUG] Loading state hidden');
}

/**
 * Clear image display
 */
function clearImageDisplay() {
    const imageList = document.getElementById('image-list');
    if (imageList) {
        imageList.innerHTML = '';
    }
}

/**
 * Show no images state
 */
function showNoImagesState() {
    const imageList = document.getElementById('image-list');
    if (imageList) {
        imageList.innerHTML = `
            <li class="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                <div class="text-center">
                    <i class="fas fa-images text-4xl mb-2"></i>
                    <div>No images found in this batch</div>
                </div>
            </li>
        `;
    }
}

/**
 * Show error state
 */
function showErrorState(errorMessage) {
    const imageList = document.getElementById('image-list');
    if (imageList) {
        imageList.innerHTML = `
            <li class="flex items-center justify-center p-8 text-red-500 dark:text-red-400">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                    <div>Error loading images</div>
                    <small class="text-gray-500">${errorMessage}</small>
                </div>
            </li>
        `;
    }
}

/**
 * Update image list with new images
 */
async function updateImageList(images) {
    const AppState = getAppState();
    const batchId = AppState.selectedBatch;
    
    if (!images || images.length === 0) {
        showNoImagesState();
        return;
    }
    
    // Use existing displayBatchImages function
    displayBatchImages(images, batchId);
}

/**
 * Load first image
 */
async function loadFirstImage(image, batchId) {
    if (!image) return;
    
    // Extract image info
    let imageId, imagePath;
    
    if (typeof image === 'string') {
        imagePath = image;
        const filename = image.split('/').pop();
        const lastDotIndex = filename.lastIndexOf('.');
        imageId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
    } else if (image.file_name) {
        imagePath = image.file_name;
        const filename = image.file_name.split('/').pop();
        const lastDotIndex = filename.lastIndexOf('.');
        imageId = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;
    } else {
        console.warn('[DEBUG] Unknown image format:', image);
        return;
    }
    
    console.log(`[DEBUG] Loading first image: ${imageId} (${imagePath})`);
    
    // Use existing handleImageSelection function
    await handleImageSelection(imageId, imagePath, batchId);
}