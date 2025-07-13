// Image preloading and caching utilities
class ImagePreloader {
    constructor() {
        this.cache = new Map();
        this.preloadQueue = [];
        this.isPreloading = false;
        this.maxCacheSize = 10; // Limit cache to 10 images
    }

    // Preload an image and store it in cache
    async preloadImage(imagePath) {
        if (this.cache.has(imagePath)) {
            return this.cache.get(imagePath);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Manage cache size
                if (this.cache.size >= this.maxCacheSize) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }
                
                this.cache.set(imagePath, img);
                console.log(`[DEBUG] Preloaded image: ${imagePath}`);
                resolve(img);
            };
            
            img.onerror = () => {
                console.warn(`[DEBUG] Failed to preload image: ${imagePath}`);
                reject(new Error(`Failed to preload: ${imagePath}`));
            };
            
            img.src = `/api/image/${imagePath}`;
        });
    }

    // Preload images around the current selection
    async preloadAdjacentImages(currentIndex, imageList) {
        if (!imageList || imageList.length === 0) return;

        // Preload next 2 and previous 2 images
        const indicesToPreload = [];
        for (let offset = -2; offset <= 2; offset++) {
            const index = currentIndex + offset;
            if (index >= 0 && index < imageList.length && index !== currentIndex) {
                indicesToPreload.push(index);
            }
        }

        // Add to preload queue
        indicesToPreload.forEach(index => {
            const imageData = imageList[index];
            const imagePath = typeof imageData === 'string' ? imageData : imageData.path || imageData.image_path;
            if (imagePath && !this.cache.has(imagePath)) {
                this.preloadQueue.push(imagePath);
            }
        });

        // Start preloading if not already running
        if (!this.isPreloading) {
            this.processPreloadQueue();
        }
    }

    // Process the preload queue in background
    async processPreloadQueue() {
        if (this.preloadQueue.length === 0) {
            this.isPreloading = false;
            return;
        }

        this.isPreloading = true;
        const imagePath = this.preloadQueue.shift();
        
        try {
            await this.preloadImage(imagePath);
        } catch (error) {
            console.warn(`Preload failed for ${imagePath}:`, error);
        }

        // Continue processing with a small delay to not overwhelm the server
        setTimeout(() => this.processPreloadQueue(), 100);
    }

    // Get cached image if available
    getCachedImage(imagePath) {
        return this.cache.get(imagePath);
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        this.preloadQueue.length = 0;
        this.isPreloading = false;
    }
}

// Create global instance
window.AppState = window.AppState || {};
window.AppState.imagePreloader = new ImagePreloader();

export { ImagePreloader };