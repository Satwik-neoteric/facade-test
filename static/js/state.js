// state.js - Application state management for Facade Studio
// Handles state manipulation, initialization and reset

// Access state and elements from window instead of importing
const state = window.state;
const elements = window.elements;

import { renderAnnotationList, renderLog, updateModeStatus } from './ui.js';
import { deselectActivePolygon } from './annotations.js';

// Clear the canvas and reset the application state
export function clearCanvasAndState() {
  removeEditHandles();
  
  if (state.fabricCanvas) {
    state.fabricCanvas.clear();
    state.fabricCanvas.setBackgroundImage(null, state.fabricCanvas.renderAll.bind(state.fabricCanvas));
  }
  
  state.annotations = [];
  state.logEntries = [];
  state.activePolygon = null;
  state.currentImageFilename = null;
  state.isDirty = false;
  state.isDrawing = false;
  state.currentPolygonPoints = [];
  state.tempLine = null;
  state.tempPoints = [];
  
  renderAnnotationList();
  renderLog();
  resetView();
  
  elements.imageNameStatus.textContent = 'None';
  elements.coordsStatus.textContent = '(0, 0)';
  
  import('./ui.js').then(module => {
    module.updateButtonStates();
  });
}

// Reset state before loading a new image
export function resetStateBeforeLoad() {
  removeEditHandles();
  
  if (state.fabricCanvas) {
    const objectsToRemove = state.fabricCanvas.getObjects().filter(obj =>
      state.annotations.includes(obj) || obj.temporary || obj.customData?.isHandle
    );
    state.fabricCanvas.remove(...objectsToRemove);
  }
  
  state.annotations = [];
  state.activePolygon = null;
  state.isDirty = false;
  state.isDrawing = false;
  state.currentPolygonPoints = [];
  
  import('./utils.js').then(module => {
    module.cleanupDrawingAids();
  });
  
  renderAnnotationList();
  resetView();
}

// Reset view to default settings
export function resetView() {
  state.currentMode = 'Select';
  
  import('./canvas.js').then(module => {
    module.resetZoom();
  });
  
  deselectActivePolygon();
  updateModeStatus();
}

// Remove edit handles from the canvas
export function removeEditHandles() {
  if (state.editHandles.length > 0) {
    while (state.editHandles.length > 0) {
      const handle = state.editHandles.pop();
      if (handle && state.fabricCanvas) {
        state.fabricCanvas.remove(handle);
      }
    }
  }
}