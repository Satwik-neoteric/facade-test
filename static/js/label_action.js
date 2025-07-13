// label_new.js
// This file contains only the relevant logic from label.js that is not already present in main.js or is needed for role-based UI, batch/image/category loading, and event setup.
// All canvas/annotation drawing logic is omitted, as we are standardizing on fabric.js (see main.js).
 
// Role and UI management helpers
function isAdministrator(userRoles) {
    return userRoles.includes('Administrator');
}
 
function isLabeller(userRoles) {
    return userRoles.includes('Labeller') || isAdministrator(userRoles);
}
 
function isReviewer(userRoles) {
    return userRoles.includes('Reviewer');
}
 
// Role-based UI setup (calls fabric.js-based canvas logic elsewhere)
async function setupBasedOnRole(userRoles, elements, currentModeRef, updateUIForMode) {
    // Hide all buttons initially
    if (elements.acceptBtn) elements.acceptBtn.style.display = 'none';
    if (elements.rejectBtn) elements.rejectBtn.style.display = 'none';
    if (elements.submitBtn) elements.submitBtn.style.display = 'none';
    if (elements.deleteBtn) elements.deleteBtn.style.display = 'none';
 
    if (isReviewer(userRoles) && !isLabeller(userRoles)) {
        // Reviewer only
        currentModeRef.current = 'validate';
        if (elements.modeToggleSwitch) {
            elements.modeToggleSwitch.checked = true;
            elements.modeToggleSwitch.disabled = true;
        }
        if (elements.acceptBtn) elements.acceptBtn.style.display = 'inline-flex';
        if (elements.rejectBtn) elements.rejectBtn.style.display = 'inline-flex';
        // Canvas pointer events should be handled by fabric.js logic
    } else if (isLabeller(userRoles) && !isReviewer(userRoles)) {
        // Labeller or Administrator only
        currentModeRef.current = 'label';
        if (elements.modeToggleSwitch) {
            elements.modeToggleSwitch.checked = false;
            elements.modeToggleSwitch.disabled = true;
        }
        if (elements.submitBtn) elements.submitBtn.style.display = 'inline-flex';
        if (elements.deleteBtn) elements.deleteBtn.style.display = 'inline-flex';
    } else if (isLabeller(userRoles) && isReviewer(userRoles)) {
        // User has BOTH roles
        currentModeRef.current = 'label';
        if (elements.modeToggleSwitch) {
            elements.modeToggleSwitch.checked = false;
            elements.modeToggleSwitch.disabled = false;
        }
        updateUIForMode(false);
    }
}
 
// UI mode toggling (fabric.js canvas pointer events should be handled in main.js)
function updateUIForMode(isValidateMode, userRoles, elements) {
    if (isValidateMode) {
        if (isReviewer(userRoles)) {
            if (elements.acceptBtn) elements.acceptBtn.style.display = 'inline-flex';
            if (elements.rejectBtn) elements.rejectBtn.style.display = 'inline-flex';
        }
        if (elements.submitBtn) elements.submitBtn.style.display = 'none';
        if (elements.deleteBtn) elements.deleteBtn.style.display = 'none';
        // Canvas pointer events handled by fabric.js
    } else {
        if (isLabeller(userRoles)) {
            if (elements.submitBtn) elements.submitBtn.style.display = 'inline-flex';
            if (elements.deleteBtn) elements.deleteBtn.style.display = 'inline-flex';
            // Canvas pointer events handled by fabric.js
        }
        if (elements.acceptBtn) elements.acceptBtn.style.display = 'none';
        if (elements.rejectBtn) elements.rejectBtn.style.display = 'none';
    }
}
 
// Event listener setup (delegates annotation/canvas logic to main.js)
function setupEventListeners(elements, handleBatchSelection, submitAnnotations, acceptAnnotations, rejectAnnotations, deleteAnnotations, skipImage, updateUIForMode, userRoles) {
    if (elements.batchSelect) {
        elements.batchSelect.addEventListener('change', handleBatchSelection);
    }
    if (elements.modeToggleSwitch) {
        elements.modeToggleSwitch.addEventListener('change', function() {
            updateUIForMode(this.checked, userRoles, elements);
        });
    }
    if (elements.submitBtn) {
        elements.submitBtn.addEventListener('click', submitAnnotations);
    }
    if (elements.acceptBtn) {
        elements.acceptBtn.addEventListener('click', acceptAnnotations);
    }
    if (elements.rejectBtn) {
        elements.rejectBtn.addEventListener('click', rejectAnnotations);
    }
    if (elements.deleteBtn) {
        elements.deleteBtn.addEventListener('click', deleteAnnotations);
    }
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', skipImage);
    }
    // Class button event listeners should be handled in main.js if needed
}
 
// Batch/category/image loading helpers (UI update logic should be handled in main.js)
async function loadBatches(batchSelect, populateBatchSelect) {
    if (!batchSelect) return;
    batchSelect.innerHTML = '<option value="">Loading batches...</option>';
    try {
        const response = await fetch('/api/batches');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const batches = Array.isArray(data) ? data : Array.isArray(data.batches) ? data.batches : [];
        const processedBatches = batches.map(batch => ({ id: batch, name: batch }));
        populateBatchSelect(processedBatches);
        batchSelect.style.display = 'block';
    } catch (error) {
        batchSelect.innerHTML = '<option value="">Error loading batches</option>';
    }
}
 
function populateBatchSelect(batches, batchSelect) {
    if (!batchSelect) return;
    batchSelect.innerHTML = '<option value="">Select a batch</option>';
    if (batches && batches.length > 0) {
        batches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch.id || batch;
            option.textContent = `Batch ${batch.name || batch}`;
            batchSelect.appendChild(option);
        });
        batchSelect.style.display = 'block';
        const batchCount = document.getElementById('batch-info');
        if (batchCount) {
            batchCount.textContent = `${batches.length} batches available`;
            batchCount.style.display = 'block';
        }
    } else {
        batchSelect.innerHTML = '<option value="">No batches found</option>';
    }
}
 
 
function drawAnnotations() {
        if (!annotationCanvas) return;
       
        clearCanvas();
        if (!annotations || !annotations.length) return;
       
        annotations.forEach(annotation => {
            drawAnnotation(annotation);
        });
    }
 
    function drawAnnotation(annotation) {
        if (!annotation || !annotation.points || annotation.points.length < 3) return;
       
        const category = categories.find(c => c.id === annotation.categoryId || c.name === annotation.categoryName);
        const color = category?.color || '#FF0000';
       
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = `${color}33`;
       
        ctx.beginPath();
        const firstPoint = normalizePoint(annotation.points[0]);
        ctx.moveTo(firstPoint.x, firstPoint.y);
       
        for (let i = 1; i < annotation.points.length; i++) {
            const point = normalizePoint(annotation.points[i]);
            ctx.lineTo(point.x, point.y);
        }
       
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }
 
    function normalizePoint(point) {
        const img = document.getElementById('main-image');
        if (!img) return { x: 0, y: 0 };
       
        return {
            x: (point.x / img.naturalWidth) * annotationCanvas.width,
            y: (point.y / img.naturalHeight) * annotationCanvas.height
        };
    }
 
    function clearCanvas() {
        if (!annotationCanvas) return;
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
    }
 
    // Update the annotation list
    function updateAnnotationList() {
        if (!annotationList) return;
       
        annotationList.innerHTML = '';
       
        if (!annotations || !annotations.length) {
            annotationList.innerHTML = '<div class="empty">No annotations yet</div>';
            return;
        }
       
        annotations.forEach((annotation, index) => {
            const category = categories.find(c => c.id === annotation.categoryId || c.name === annotation.categoryName);
            const categoryName = category?.name || 'Unknown';
            const color = category?.color || '#FF0000';
           
            const item = document.createElement('li');
            item.className = 'annotation-item';
            item.innerHTML = `
                <span class="category-badge" style="background-color: ${color}">${categoryName}</span>
                <div class="annotation-actions">
                    <button class="btn-edit" data-index="${index}">Edit</button>
                    <button class="btn-delete" data-index="${index}">Delete</button>
                </div>
            `;
           
            annotationList.appendChild(item);
        });
    }
 
async function loadCategories(setCategories) {
    try {
        const response = await fetch('/api/classes');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        setCategories(data || []);
    } catch (error) {
        setCategories([]);
    }
}
 
// Sensor data display helper (UI update logic should be handled in main.js)
function updateSensorDisplay(sensor, sensorDataTable) {
    if (!sensorDataTable) return;
    sensorDataTable.innerHTML = `
        <tr><th>Timestamp (UTC):</th><td>${sensor['Timestamp (UTC)'] || 'N/A'}</td></tr>
        <tr><th>Latitude:</th><td>${sensor['Latitude (deg)'] || 'N/A'}</td></tr>
        <tr><th>Longitude:</th><td>${sensor['Longitude (deg)'] || 'N/A'}</td></tr>
        <tr><th>Altitude:</th><td>${sensor['Altitude (meters)'] ? `${sensor['Altitude (meters)']} m` : 'N/A'}</td></tr>
        <tr><th>Fix Type:</th><td>${sensor['Fix Type'] || 'N/A'}</td></tr>
        <tr><th>Fix Status:</th><td>${sensor['Fix Status'] || 'N/A'}</td></tr>
        <tr><th>Satellites:</th><td>${sensor['Number of Satellites'] || 'N/A'}</td></tr>
        <tr><th>Accuracy:</th><td>${sensor['Horizontal Accuracy (m)'] ? `${sensor['Horizontal Accuracy (m)']} m` : 'N/A'}</td></tr>
    `;
}
 
// Export helpers for use in main.js
window.labelHelpers = {
    isAdministrator,
    isLabeller,
    isReviewer,
    setupBasedOnRole,
    updateUIForMode,
    setupEventListeners,
    loadBatches,
    populateBatchSelect,
    loadCategories,
    updateSensorDisplay
};