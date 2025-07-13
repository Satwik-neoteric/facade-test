// navigation.js - Navigation and Throttling
// Handles navigation controls and throttling mechanisms

import { getAppState } from './app-state.js';

/**
 * Utility function to throttle navigation actions
 */
export function canNavigate() {
    const AppState = getAppState();
    const now = Date.now();
    const timeSinceLastAction = now - AppState.navigationThrottle.lastAction;
    
    if (timeSinceLastAction < AppState.navigationThrottle.minInterval) {
        console.log(`[DEBUG] Navigation throttled. ${AppState.navigationThrottle.minInterval - timeSinceLastAction}ms remaining`);
        return false;
    }
    
    AppState.navigationThrottle.lastAction = now;
    return true;
}

/**
 * Schedule debounced image loading
 */
export function scheduleImageLoad(imageId, imagePath, isSkipLoad = false) {
    const AppState = getAppState();
    
    // Clear any existing timeout
    if (AppState.debouncedLoading.timeoutId) {
        clearTimeout(AppState.debouncedLoading.timeoutId);
    }
    
    // Set expected image for race condition prevention
    AppState.debouncedLoading.expectedImageId = imageId;
    AppState.debouncedLoading.isSkipLoad = isSkipLoad;
    
    // Schedule the load
    AppState.debouncedLoading.timeoutId = setTimeout(() => {
        // Only proceed if this is still the expected image
        if (AppState.debouncedLoading.expectedImageId === imageId) {
            const loadId = ++AppState.currentLoadId;
            AppState.expectedLoadId = loadId;
            
            if (window.loadImage) {
                window.loadImage(imagePath, loadId);
            }
            
            // Clear the timeout reference
            AppState.debouncedLoading.timeoutId = null;
        }
    }, isSkipLoad ? AppState.debouncedLoading.delay : 0);
    
    console.log(`[DEBUG] Scheduled image load for ${imageId} with ${isSkipLoad ? 'skip delay' : 'immediate'} loading`);
}

/**
 * Navigate to next image in sequence
 */
export function navigateToNextImage() {
    if (!canNavigate()) {
        return;
    }
    
    const AppState = getAppState();
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    const images = Array.from(imageList.children);
    const currentIndex = images.findIndex(img => img.classList.contains('active'));
    
    if (currentIndex >= 0 && currentIndex < images.length - 1) {
        const nextImage = images[currentIndex + 1];
        const imageId = nextImage.dataset.imageId;
        const imagePath = nextImage.dataset.imagePath;
        
        if (imageId && imagePath) {
            // Remove active class from current image
            images[currentIndex].classList.remove('active');
            // Add active class to next image
            nextImage.classList.add('active');
            
            // Schedule image load
            scheduleImageLoad(imageId, imagePath, true);
            
            console.log(`[DEBUG] Navigated to next image: ${imageId}`);
        }
    } else {
        console.log('[DEBUG] Already at last image');
        if (window.showMessage) {
            window.showMessage('You have reached the last image in this batch.', 'info');
        }
    }
}

/**
 * Navigate to previous image in sequence
 */
export function navigateToPreviousImage() {
    if (!canNavigate()) {
        return;
    }
    
    const AppState = getAppState();
    const imageList = document.getElementById('image-list');
    if (!imageList) return;
    
    const images = Array.from(imageList.children);
    const currentIndex = images.findIndex(img => img.classList.contains('active'));
    
    if (currentIndex > 0) {
        const prevImage = images[currentIndex - 1];
        const imageId = prevImage.dataset.imageId;
        const imagePath = prevImage.dataset.imagePath;
        
        if (imageId && imagePath) {
            // Remove active class from current image
            images[currentIndex].classList.remove('active');
            // Add active class to previous image
            prevImage.classList.add('active');
            
            // Schedule image load
            scheduleImageLoad(imageId, imagePath, true);
            
            console.log(`[DEBUG] Navigated to previous image: ${imageId}`);
        }
    } else {
        console.log('[DEBUG] Already at first image');
        if (window.showMessage) {
            window.showMessage('You are already at the first image in this batch.', 'info');
        }
    }
}

/**
 * Clear debounced loading timeout
 */
export function clearDebouncedLoading() {
    const AppState = getAppState();
    if (AppState.debouncedLoading.timeoutId) {
        clearTimeout(AppState.debouncedLoading.timeoutId);
        AppState.debouncedLoading.timeoutId = null;
    }
}

/**
 * Set navigation throttle interval
 */
export function setNavigationThrottle(interval) {
    const AppState = getAppState();
    AppState.navigationThrottle.minInterval = interval;
}