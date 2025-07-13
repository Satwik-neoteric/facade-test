# Image Loading Performance Optimization - Fix Summary

## Overview

This document outlines comprehensive performance improvements made to address inconsistent image loading times and timeout issues on the `/label` page. The fixes target both frontend and backend bottlenecks that were causing variable loading performance.

## Summary of Changes

### Backend Optimizations
- **Async Operations**: Converted synchronous blob operations to true async using thread pools
- **HTTP Caching**: Added proper Cache-Control headers and ETags for browser caching
- **Path Resolution Caching**: Implemented in-memory cache for successful image path lookups
- **Connection Pooling**: Enhanced Azure Blob Storage configuration with optimized transfer settings

### Frontend Optimizations  
- **Image Preloading**: Intelligent preloading of adjacent images for instant navigation
- **Timeout Handling**: Increased timeout from 30s to 60s for large images
- **Cache Management**: Removed unnecessary cache-busting and added proper cache clearing
- **Async Metadata**: Made metadata loading non-blocking for faster image display

### Expected Results
- **Consistent Loading Times**: Eliminates discrepancies between repeated image loads
- **Faster Navigation**: Preloaded adjacent images display instantly
- **Reduced Timeouts**: Better handling of large images and slow connections
- **Improved UX**: Non-blocking operations keep UI responsive during loads

---

## Detailed Implementation Guide

### 1. Backend - Blob Storage Service Improvements

#### File: `app/services/blob_storage_service.py`

**1.1 Enhanced Connection Configuration**
```python
# Replace the basic connection initialization with optimized settings
self._blob_service_client = BlobServiceClient.from_connection_string(
    settings.AZURE_STORAGE_CONNECTION_STRING,
    max_single_get_size=32*1024*1024,  # 32MB chunks
    max_chunk_get_size=4*1024*1024,    # 4MB per chunk
    max_single_put_size=64*1024*1024,  # 64MB single upload
    max_block_size=4*1024*1024,        # 4MB block size
    timeout=300                         # 5 minute timeout
)
```

**1.2 True Async Download Method**
Replace the existing `download_blob_content` method:
```python
async def download_blob_content(self, container_name: str, blob_name: str) -> Optional[bytes]:
    """Asynchronous version of download_blob."""
    import asyncio
    
    if not self._blob_service_client:
        logger.error("BlobServiceClient not initialized. Cannot download blob.")
        return None

    blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
    if not blob_client:
        return None
    
    try:
        # Run the synchronous download in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        download_stream = await loop.run_in_executor(
            None, 
            blob_client.download_blob
        )
        # Read the content in the executor as well to avoid blocking
        content = await loop.run_in_executor(
            None,
            download_stream.readall
        )
        return content
    except ResourceNotFoundError:
        logger.warning(f"Blob '{container_name}/{blob_name}' not found for download.")
        return None
    except AzureError as e:
        logger.error(f"Azure error downloading blob '{container_name}/{blob_name}': {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error downloading blob '{container_name}/{blob_name}': {e}", exc_info=True)
        return None
```

**1.3 True Async Blob Existence Check**
Replace the existing `blob_exists` method:
```python
async def blob_exists(self, container_name: str, blob_name: str) -> bool:
    """Check if a blob exists in the specified container."""
    import asyncio
    
    if not self._blob_service_client:
        logger.error("BlobServiceClient not initialized. Cannot check if blob exists.")
        return False
        
    blob_client = self.get_blob_client(container_name=container_name, blob_name=blob_name)
    if not blob_client:
        return False
        
    try:
        # Run the synchronous call in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            blob_client.get_blob_properties
        )
        return True
    except ResourceNotFoundError:
        logger.debug(f"Blob '{container_name}/{blob_name}' does not exist.")
        return False
    except AzureError as e:
        logger.error(f"Azure error checking existence of blob '{container_name}/{blob_name}': {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking existence of blob '{container_name}/{blob_name}': {e}", exc_info=True)
        return False
```

### 2. Backend - Image Route Optimizations

#### File: `app/api/routes/images.py`

**2.1 Add Path Resolution Cache**
Add this at the top of the file after existing cache declarations:
```python
# Cache for successful image path resolutions: original_path -> resolved_path
_image_path_cache: Dict[str, str] = {}
```

**2.2 Implement Path Caching in Image Endpoint**
Replace the image resolution logic in `get_image()` function:
```python
# Check cache first for previously resolved paths
if filename in _image_path_cache:
    cached_path = _image_path_cache[filename]
    logger.debug(f"Using cached path resolution: '{filename}' -> '{cached_path}'")
    try:
        if await blob_service.blob_exists(input_container, cached_path):
            content = await blob_service.download_blob_content(input_container, cached_path)
            if content:
                actual_filename_used = cached_path
                logger.info(f"Image found via cache at: '{actual_filename_used}'")
            else:
                # Cache entry is stale, remove it
                del _image_path_cache[filename]
        else:
            # Cache entry is stale, remove it
            del _image_path_cache[filename]
    except Exception as e:
        logger.warning(f"Error accessing cached path '{cached_path}': {e}")
        # Remove stale cache entry
        del _image_path_cache[filename]

# If not found in cache or cache was stale, try the normal resolution process
if not content:
    # ... existing path resolution logic ...
    
    # After successful resolution, add this line:
    # Cache successful resolution for future requests
    _image_path_cache[filename] = path_to_attempt
    logger.info(f"Image found and cached path resolution: '{filename}' -> '{actual_filename_used}'")
```

**2.3 Add HTTP Caching Headers**
In the `get_image()` function, replace the return statement:
```python
# Add caching headers to improve performance
headers = {
    "Cache-Control": "public, max-age=3600, immutable",  # Cache for 1 hour
    "ETag": f'"{hash(actual_filename_used)}"',  # Simple ETag based on filename
}

return Response(content=content, media_type=media_type, headers=headers)
```

### 3. Frontend - Image Preloading System

#### File: `app/static/js/image-preloader.js` (New File)
Create this new file:
```javascript
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
```

### 4. Frontend - Main JavaScript Optimizations

#### File: `app/static/js/main.js`

**4.1 Enhanced Image Loading Function**
In the `loadImage()` function, make these changes:

```javascript
// Remove cache buster and set proper cross-origin
const img = new Image();
img.crossOrigin = 'anonymous'; // Set cross-origin before src
let imageLoaded = false;

// Create a promise to handle image loading
const imageLoadPromise = new Promise((resolve, reject) => {
    img.onload = function() {
        imageLoaded = true;
        resolve(img);
    };
    img.onerror = function() {
        reject(new Error(`Failed to load image: ${imagePath}`));
    };
    // Remove cache buster since we now have proper server-side caching
    img.src = imageUrl;
});

// Add a timeout for the image loading (increased for larger images)
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
        if (!imageLoaded) {
            reject(new Error("Image loading timed out (60 seconds)"));
        }
    }, 60000); // Increased to 60 seconds timeout
});
```

**4.2 Integrate Preloader with Fabric.js**
In the fabric.js loading section:
```javascript
// Check if image is already in preloader cache
const cachedImg = window.AppState.imagePreloader?.getCachedImage(imagePath);
const srcToUse = cachedImg ? cachedImg.src : img.src;

fabric.Image.fromURL(srcToUse, function(fabricImg) {
    // ... existing fabric.js code ...
});
```

**4.3 Make Metadata Loading Async**
In the canvas background setting callback:
```javascript
// Load metadata asynchronously without blocking image display
loadMetadata(imagePath).catch(error => {
    console.warn("Failed to load metadata:", error);
});
```

**4.4 Add Preloading to Image Selection**
In the `handleImageSelection()` function, add after sensor data loading:
```javascript
// Trigger preloading of adjacent images for better UX
if (window.AppState.imagePreloader && window.AppState.currentImageList) {
    try {
        const currentIndex = window.AppState.currentImageList.findIndex(img => {
            const imgPath = typeof img === 'string' ? img : (img.path || img.image_path);
            return imgPath === imagePath;
        });
        
        if (currentIndex !== -1) {
            // Preload adjacent images in background
            window.AppState.imagePreloader.preloadAdjacentImages(currentIndex, window.AppState.currentImageList);
        }
    } catch (error) {
        console.warn("Failed to trigger image preloading:", error);
    }
}
```

**4.5 Store Image List for Preloading**
In the `displayBatchImages()` function:
```javascript
$('#image-list').empty();

// Store the image list for preloading
window.AppState.currentImageList = imagesToDisplay;

imagesToDisplay.forEach(image => {
    // ... existing code ...
});
```

**4.6 Clear Cache on Batch Change**
In the `handleBatchSelection()` function, add at the beginning:
```javascript
// Clear image cache when switching batches
if (window.AppState.imagePreloader) {
    window.AppState.imagePreloader.clearCache();
}
```

### 5. Template Updates

#### File: `templates/label.html`

Add the image preloader script:
```html
<!-- Include jQuery before other scripts -->
<script src="https://code.jquery.com/jquery-3.6.4.min.js" integrity="sha256-oP6HI9z1XaZNBrJURtCoUT5SUnxFr8s3BzRl+cbzUq8=" crossorigin="anonymous"></script>
<script src="{{ url_for('static', path='/js/fabric.min.js') }}"></script>
<script type="module" src="{{ url_for('static', path='/js/image-preloader.js') }}"></script>
<script type="module" src="{{ url_for('static', path='/js/main.js') }}"></script>
<script src="{{ url_for('static', path='/js/user-info.js') }}"></script>
<script src="{{ url_for('static', path='/js/label.js') }}"></script>
```

## Testing and Validation

### Performance Testing Checklist
1. **Initial Load**: Test first image load in a batch
2. **Navigation**: Test moving between adjacent images (should be instant after preload)
3. **Cache Effectiveness**: Reload same image multiple times (should be from cache)
4. **Large Images**: Test with images >5MB (should not timeout)
5. **Batch Switching**: Verify cache clears when changing batches
6. **Network Issues**: Test with slow network (increased timeout should help)

### Performance Monitoring
- Check browser developer tools Network tab for 304 responses (cache hits)
- Monitor console logs for preloading activity
- Verify image loading times are consistent across multiple loads

### Rollback Instructions
If issues arise, you can revert changes by:
1. Reverting `blob_storage_service.py` to use synchronous methods
2. Removing the `_image_path_cache` from `images.py`
3. Removing the image-preloader.js file and its import
4. Reverting timeout changes in main.js

These optimizations should significantly improve image loading performance and eliminate the inconsistent loading times previously experienced.
