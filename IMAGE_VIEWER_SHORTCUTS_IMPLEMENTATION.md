# Image Viewer Keyboard Shortcuts & Pan/Zoom Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing keyboard shortcuts and pan/zoom functionality in an image viewer interface. The implementation includes Shift+Drag for panning, Ctrl+Scroll for zooming, and keyboard shortcuts for reset and fit operations.

## Features Implemented
- **Shift + Left Click + Drag**: Pan the image around the viewport
- **Ctrl + Mouse Wheel**: Zoom in/out centered on mouse position
- **R Key**: Reset pan/zoom to original state
- **F Key / Space Bar**: Fit image to container
- **Visual feedback**: Instructions overlay and cursor changes
- **Status bar**: Shows current zoom level and mode

## Architecture Overview

### State Variables
The implementation requires several state variables to track pan/zoom state:

```javascript
// Pan functionality state
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let currentPanX = 0;
let currentPanY = 0;
let currentScale = 1;
```

### DOM Structure Required
```html
<!-- Image container with canvas wrapper -->
<div id="canvas-container" class="w-full h-full flex items-center justify-center">
    <div id="canvas-wrapper" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <canvas id="annotation-canvas" class="border border-gray-200 dark:border-gray-600 rounded"></canvas>
        <img id="main-image" src="" alt="Main image" style="display: none;">
    </div>
    
    <!-- Pan/Zoom Instructions Overlay -->
    <div class="pan-instructions">
        Shift + Drag: Pan | Ctrl + Wheel: Zoom | F: Fit | R: Reset
    </div>
</div>

<!-- Status Bar -->
<div id="status-bar" class="absolute bottom-0 left-0 right-0 bg-gray-800 text-white px-4 py-2 text-sm font-mono">
    <span>Zoom: <span id="zoom-status" class="text-green-400">Full</span></span>
</div>
```

## Implementation Steps

### Step 1: Initialize Pan/Zoom Functionality

Add this function to set up all event listeners:

```javascript
function setupImagePanZoom() {
    const imageContainer = document.getElementById('canvas-container');
    if (!imageContainer) return;
    
    // Prevent default drag behavior
    imageContainer.addEventListener('dragstart', (e) => e.preventDefault());
    
    // Mouse down event for starting pan
    imageContainer.addEventListener('mousedown', handlePanStart);
    
    // Mouse move event for panning
    document.addEventListener('mousemove', handlePanMove);
    
    // Mouse up event for ending pan
    document.addEventListener('mouseup', handlePanEnd);
    
    // Wheel event for zooming
    imageContainer.addEventListener('wheel', handleZoom);
    
    // Reset pan/zoom when new image loads
    imageContainer.addEventListener('imageLoaded', resetPanZoom);
    
    console.log('Image pan/zoom functionality initialized');
}
```

### Step 2: Implement Pan Functionality

#### Pan Start Handler
```javascript
function handlePanStart(e) {
    if (e.shiftKey && e.button === 0) { // Left click with shift
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX - currentPanX;
        panStartY = e.clientY - currentPanY;
        imageContainer.classList.add('panning');
        console.log('Pan started');
    }
}
```

#### Pan Move Handler
```javascript
function handlePanMove(e) {
    const imageContainer = document.getElementById('canvas-container');
    
    if (!isPanning) {
        // Show appropriate cursor when shift is held
        if (e.shiftKey && imageContainer) {
            imageContainer.style.cursor = 'grab';
        } else if (imageContainer) {
            imageContainer.style.cursor = '';
        }
        return;
    }
    
    e.preventDefault();
    currentPanX = e.clientX - panStartX;
    currentPanY = e.clientY - panStartY;
    
    updateImageTransform();
}
```

#### Pan End Handler
```javascript
function handlePanEnd(e) {
    const imageContainer = document.getElementById('canvas-container');
    
    if (isPanning) {
        isPanning = false;
        imageContainer.classList.remove('panning');
        imageContainer.style.cursor = '';
        console.log('Pan ended');
    }
}
```

### Step 3: Implement Zoom Functionality

```javascript
function handleZoom(e) {
    const imageContainer = document.getElementById('canvas-container');
    
    if (e.ctrlKey) { // Ctrl + wheel for zoom
        e.preventDefault();
        
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        // Calculate zoom center point
        const rect = imageContainer.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        
        // Update scale with limits
        const newScale = Math.min(Math.max(0.1, currentScale * zoom), 5);
        
        if (newScale !== currentScale) {
            // Adjust pan to zoom around mouse position
            currentPanX = centerX - (centerX - currentPanX) * (newScale / currentScale);
            currentPanY = centerY - (centerY - currentPanY) * (newScale / currentScale);
            currentScale = newScale;
            
            updateImageTransform();
            updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
        }
    }
}
```

### Step 4: Transform Update Function

```javascript
function updateImageTransform() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        canvasWrapper.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
        canvasWrapper.style.transformOrigin = '0 0';
        canvasWrapper.style.transition = isPanning ? 'none' : 'transform 0.1s ease-out';
    }
}
```

### Step 5: Keyboard Shortcuts Implementation

```javascript
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // F key to fit image to container
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            fitImageToContainer();
        }
        // R key to reset pan/zoom
        else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            resetPanZoom();
        }
        // Space key to fit image (alternative)
        else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            fitImageToContainer();
        }
    });
    
    console.log('Keyboard shortcuts: F or Space to fit image, R to reset zoom');
    console.log('Pan controls: Shift + Left Click to pan, Ctrl + Mouse Wheel to zoom');
}
```

### Step 6: Reset and Fit Functions

#### Reset Pan/Zoom
```javascript
function resetPanZoom() {
    currentPanX = 0;
    currentPanY = 0;
    currentScale = 1;
    updateImageTransform();
    updateStatus('zoom-status', 'Full');
    console.log('Pan/zoom reset');
}
```

#### Fit Image to Container
```javascript
function fitImageToContainer() {
    const img = document.getElementById('main-image');
    const imageContainer = document.getElementById('canvas-container');
    
    if (!img || !imageContainer) return;
    
    const containerRect = imageContainer.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    const scaleX = containerRect.width / img.naturalWidth;
    const scaleY = containerRect.height / img.naturalHeight;
    currentScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
    
    // Center the image
    currentPanX = (containerRect.width - img.naturalWidth * currentScale) / 2;
    currentPanY = (containerRect.height - img.naturalHeight * currentScale) / 2;
    
    updateImageTransform();
    updateStatus('zoom-status', `${Math.round(currentScale * 100)}%`);
    console.log('Image fitted to container');
}
```

### Step 7: Utility Functions

#### Status Update Function
```javascript
function updateStatus(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}
```

## CSS Styling

Add these CSS classes for visual feedback:

```css
/* Pan/zoom instructions overlay */
.pan-instructions {
    position: absolute;
    bottom: 40px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    transition: opacity 0.3s ease;
}

#canvas-container:hover .pan-instructions {
    opacity: 1;
}

/* Panning cursor */
.panning {
    cursor: grabbing !important;
}

/* Canvas container styling */
#canvas-container {
    position: relative;
    overflow: hidden;
    user-select: none;
}

#canvas-wrapper {
    transform-origin: 0 0;
    transition: transform 0.1s ease-out;
}

/* Status bar styling */
#status-bar {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
}
```

## Integration Steps

### 1. Initialize in Main Script
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // ... other initialization code ...
    
    setupImagePanZoom();
    setupKeyboardShortcuts();
    
    // ... rest of initialization ...
});
```

### 2. Call on Image Load
When a new image is loaded, reset the pan/zoom state:
```javascript
function loadImage(imageUrl) {
    const img = document.getElementById('main-image');
    img.onload = function() {
        resetPanZoom();
        // Dispatch custom event for pan/zoom reset
        const event = new CustomEvent('imageLoaded');
        document.getElementById('canvas-container').dispatchEvent(event);
    };
    img.src = imageUrl;
}
```

## Advanced Features

### Zoom Limits
You can customize zoom limits by modifying the scale constraints:
```javascript
// In handleZoom function
const minZoom = 0.1;  // 10% minimum
const maxZoom = 5.0;  // 500% maximum
const newScale = Math.min(Math.max(minZoom, currentScale * zoom), maxZoom);
```

### Smooth Transitions
For smoother zooming, you can add easing:
```javascript
function updateImageTransform() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        canvasWrapper.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
        canvasWrapper.style.transformOrigin = '0 0';
        canvasWrapper.style.transition = isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
    }
}
```

### Pan Boundaries
To prevent panning outside image bounds:
```javascript
function constrainPan() {
    const img = document.getElementById('main-image');
    const container = document.getElementById('canvas-container');
    
    if (!img || !container) return;
    
    const containerRect = container.getBoundingClientRect();
    const scaledWidth = img.naturalWidth * currentScale;
    const scaledHeight = img.naturalHeight * currentScale;
    
    // Constrain horizontal pan
    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const minPanX = -maxPanX;
    currentPanX = Math.min(Math.max(currentPanX, minPanX), maxPanX);
    
    // Constrain vertical pan
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
    const minPanY = -maxPanY;
    currentPanY = Math.min(Math.max(currentPanY, minPanY), maxPanY);
}
```

## Testing Checklist

### Functionality Tests
- [ ] Shift + Left Click + Drag pans the image
- [ ] Ctrl + Mouse Wheel zooms in/out at mouse position
- [ ] R key resets pan and zoom
- [ ] F key fits image to container
- [ ] Space bar fits image to container (when not in input fields)
- [ ] Zoom limits are respected (0.1x to 5x)
- [ ] Status bar updates show correct zoom percentage

### Visual Tests
- [ ] Instructions overlay appears on hover
- [ ] Cursor changes to grab when Shift is held
- [ ] Cursor changes to grabbing while panning
- [ ] Smooth transitions work correctly
- [ ] Transform origin is set correctly

### Edge Cases
- [ ] Works with different image sizes
- [ ] Handles missing DOM elements gracefully
- [ ] Keyboard shortcuts don't interfere with input fields
- [ ] Pan/zoom state resets when new image loads
- [ ] Works in different container sizes

## Common Issues and Solutions

### Issue: Transform not applying
**Solution**: Ensure the target element exists and has the correct CSS positioning.

### Issue: Pan/zoom feels sluggish
**Solution**: Reduce transition duration or disable transitions during active pan/zoom.

### Issue: Keyboard shortcuts interfere with forms
**Solution**: Check if target element is an input/textarea before preventing default.

### Issue: Zoom center point is off
**Solution**: Verify that getBoundingClientRect() coordinates are calculated correctly relative to the container.

## Browser Compatibility

This implementation uses:
- CSS transforms (IE9+)
- addEventListener (IE9+)
- getBoundingClientRect (IE9+)
- CustomEvent (IE11+, polyfill available for older browsers)

For IE9-10 support, replace CustomEvent with:
```javascript
// IE9-10 compatible custom event
function createCustomEvent(eventName, detail) {
    const event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventName, true, true, detail);
    return event;
}
```

## Performance Considerations

1. **Throttle mouse move events** for smoother panning on slower devices
2. **Use requestAnimationFrame** for transform updates
3. **Debounce zoom events** to prevent excessive calculations
4. **Cache DOM references** to avoid repeated queries

This implementation provides a robust, user-friendly image viewer with intuitive pan/zoom controls that work across modern browsers.
