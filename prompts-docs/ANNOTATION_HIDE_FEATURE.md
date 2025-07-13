# Annotation Hide Feature (H Key)

## Overview

This feature implements a press-and-hold keyboard shortcut that allows users to temporarily hide all annotations while labeling images in the Facade AI Studio. This is particularly useful for viewing the original image without annotation markings to better assess the underlying facade elements.

## Feature Details

### Functionality
- **Key Binding**: H key (case-insensitive)
- **Behavior**: Press and hold to hide annotations, release to show them again
- **Scope**: Affects all annotation types including polygons and edit handles
- **Visual Feedback**: Status bar changes color and displays informative text

### Supported Annotation Classes
This feature works with all annotation classes in the system:
- `Short-Gasket`
- `Defective-Mastic`
- `Glazing-Defects`
- `Stonework-Missing-Edge`
- `Stonework-Fractures`
- `Cleaning-Required`
- `Mechanical-Faults`
- `Steelwork-Corrosion`
- `Stone-Fractions`
- `WindowPane-Mask`
- `Human-Mask`
- `Privacy-Mask`

## Usage Instructions

### Basic Usage
1. Load an image with existing annotations in the labeling interface
2. Press and hold the **H** key to hide all annotations
3. Release the **H** key to show annotations again

### Visual Indicators
- **Status Bar**: When annotations are hidden, the status bar:
  - Background changes to yellow highlight (`rgba(255, 255, 0, 0.3)`)
  - Displays message: "Annotations Hidden (release H to show)"
- **Console Logging**: Debug messages are logged for troubleshooting

## Technical Implementation

### File Modified
- `app/static/js/main.js`

### Key Components Added

#### 1. State Management
```javascript
// Added to AppState object
annotationsHidden: false
```

#### 2. Event Handlers
```javascript
// Keydown handler for H key
$(document).on('keydown', function(e) {
    if (e.key === 'h' || e.key === 'H') {
        if (!window.AppState.annotationsHidden && window.AppState.annotations && window.AppState.annotations.length > 0) {
            hideAnnotations();
            e.preventDefault();
        }
    }
});

// Keyup handler for H key release
$(document).on('keyup', function(e) {
    if (e.key === 'h' || e.key === 'H') {
        if (window.AppState.annotationsHidden) {
            showAnnotations();
            e.preventDefault();
        }
    }
});

// Window blur handler for safety
$(window).on('blur', function() {
    if (window.AppState.annotationsHidden) {
        showAnnotations();
    }
});
```

#### 3. Core Functions

##### hideAnnotations()
- Sets all annotation polygons to `visible: false`
- Hides edit handles if present
- Updates state tracking
- Modifies status bar appearance
- Forces canvas re-render

##### showAnnotations()
- Sets all annotation polygons to `visible: true`
- Shows edit handles if present
- Resets state tracking
- Restores status bar appearance
- Forces canvas re-render

#### 4. Integration Points

##### parseCocoAnnotations()
- Respects current visibility state when loading new annotations
- Newly loaded annotations inherit the current hide/show state

##### clearCanvas()
- Resets `annotationsHidden` state to `false`
- Ensures clean state when clearing the canvas

## Safety Features

### Window Focus Loss Handling
If the user switches to another application while holding the H key, annotations are automatically restored when the window loses focus. This prevents annotations from being permanently hidden if the user forgets they were holding the key.

### State Persistence
The visibility state is properly managed across:
- New annotation loading
- Canvas clearing
- Mode switching
- Zoom operations

### Error Prevention
- Checks for canvas existence before operations
- Validates annotation array before processing
- Prevents duplicate hide/show operations

## Code Location

### Main Implementation
**File**: `app/static/js/main.js`

**Lines Added/Modified**:
- AppState object: Added `annotationsHidden: false`
- Event handlers: Lines ~1270-1290 (keydown), ~1500-1510 (keyup), ~1515-1520 (window blur)
- Functions: `hideAnnotations()` and `showAnnotations()` (~1750-1820)
- Integration: `parseCocoAnnotations()` and `clearCanvas()` updates

## Browser Compatibility

This feature uses standard JavaScript event handling and should work across all modern browsers:
- Chrome/Chromium-based browsers
- Firefox
- Safari
- Edge

## Performance Considerations

- **Minimal Impact**: Only affects visibility property of existing objects
- **Efficient**: No object creation/destruction during hide/show operations
- **Fast Response**: Immediate visual feedback on key press/release
- **Memory Safe**: No memory leaks from event handlers

## Future Enhancements

Potential improvements that could be added:
1. **Configuration**: Make the key binding configurable in settings
2. **Transparency Mode**: Option for semi-transparent annotations instead of complete hiding
3. **Selective Hiding**: Hide only specific annotation types
4. **Animation**: Smooth fade in/out transitions
5. **Tooltip**: Show tooltip with instructions on first use

## Testing

### Manual Testing Steps
1. Load the labeling interface (`/label`)
2. Select a batch with annotated images
3. Load an image with existing annotations
4. Press and hold H key - verify annotations disappear and status bar changes
5. Release H key - verify annotations reappear and status bar resets
6. Test with different annotation types and quantities
7. Test focus loss scenario (Alt+Tab while holding H)

### Edge Cases Tested
- Empty annotation arrays
- Images without annotations
- Multiple annotation types simultaneously
- Canvas operations while annotations are hidden
- Mode switching while annotations are hidden

## Dependencies

This feature relies on existing infrastructure:
- **Fabric.js**: For canvas object visibility manipulation
- **jQuery**: For event handling and DOM manipulation
- **AppState**: Global state management system
- **COCO Format**: Annotation data structure

## Backwards Compatibility

This feature is fully backwards compatible:
- No breaking changes to existing functionality
- No modifications to data structures
- No API changes
- Default behavior unchanged (annotations visible by default)

---

**Implementation Date**: July 2, 2025  
**Author**: AI Assistant  
**Status**: Complete and Tested  
**Impact**: Enhancement - No Breaking Changes
