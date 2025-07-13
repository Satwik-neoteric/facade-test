// Batch Management JS for admin page

document.addEventListener('DOMContentLoaded', function() {
    // --- Modal triggers ---
    document.getElementById('register-batch-btn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('register-batch-modal'));
        document.getElementById('register-batch-form').reset();
        document.getElementById('register-batch-error').style.display = 'none';
        modal.show();
    });
    document.getElementById('upload-images-btn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('upload-images-modal'));
        document.getElementById('upload-images-form').reset();
        document.getElementById('upload-images-error').style.display = 'none';
        loadBatchDropdown('upload-batch-id');
        modal.show();
    });    document.getElementById('run-inference-btn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('run-inference-modal'));
        document.getElementById('run-inference-form').reset();
        document.getElementById('run-inference-error').style.display = 'none';
        
        // Reset additional models container
        document.getElementById('additional-models-container').innerHTML = '';
        
        // Load dropdowns
        loadBatchDropdown('inference-batch-id');
        loadModelDropdown('inference-model1');
        modal.show();
    });
    
    // Add model button click handler
    document.getElementById('add-model-btn').addEventListener('click', () => {
        addModelField();
    });

    // --- Form submissions ---
    document.getElementById('register-batch-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await registerBatch();
    });
    document.getElementById('upload-images-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await uploadImages();
    });
    document.getElementById('run-inference-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await runInference();
    });

    // Initial load
    loadBatches();
});

async function loadBatches() {
    const loading = document.getElementById('loading-batches');
    const error = document.getElementById('batches-error');
    const tableBody = document.getElementById('batches-table-body');
    loading.style.display = 'block';
    error.style.display = 'none';
    tableBody.innerHTML = '';
    try {
        const resp = await fetch('/api/admin/batches');
        if (!resp.ok) throw new Error('Failed to load batches');
        const batches = await resp.json();
        batches.forEach(batch => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${batch.batch_id}</td>
                <td>${batch.status || ''}</td>
                <td>${batch.image_count || 0}</td>
                <td>${batch.last_modified ? new Date(batch.last_modified).toLocaleString() : ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="expandBatch('${batch.batch_id}')">Expand</button>
                    <button class="btn btn-sm btn-outline-success" onclick="downloadBatchImages('${batch.batch_id}')">Download</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        error.textContent = err.message;
        error.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function registerBatch() {
    const batchId = document.getElementById('batch-id').value;
    const description = document.getElementById('batch-description').value;
    const categories = Array.from(document.getElementById('batch-categories').selectedOptions).map(opt => opt.value);
    const error = document.getElementById('register-batch-error');
    const submitButton = document.querySelector('button[type="submit"][form="register-batch-form"]');
    
    // Input validation
    if (!batchId) {
        error.textContent = "Batch ID is required";
        error.style.display = 'block';
        return;
    }
    
    // Clear previous error
    error.style.display = 'none';
    
    // Disable button and show loading state if button exists
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
    }
    
    try {
        console.log(`Registering batch with ID: ${batchId}`);
        
        const resp = await fetch('/api/admin/batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: batchId, description, categories })
        });
        
        // Check if the response was successful
        if (!resp.ok) {
            // Try to parse the error response as JSON
            let errorDetail;
            try {
                const errorJson = await resp.json();
                errorDetail = errorJson.detail || JSON.stringify(errorJson);
            } catch (e) {
                // If it's not valid JSON, get it as text
                errorDetail = await resp.text();
            }
            
            throw new Error(`Failed to register batch (${resp.status}): ${errorDetail}`);
        }
        
        // Try to parse response as JSON
        const data = await resp.json();
        console.log("Batch registration successful:", data);
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('register-batch-modal')).hide();
        
        // Show success message
        showToast(`Batch "${batchId}" registered successfully`);
        
        // Refresh the batch list
        loadBatches();
    } catch (err) {
        console.error("Error registering batch:", err);
        error.textContent = err.message;
        error.style.display = 'block';    } finally {
        // Reset button state if button exists
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Register Batch';
        }
    }
}

async function uploadImages() {
    const batchId = document.getElementById('upload-batch-id').value;
    const files = document.getElementById('image-files').files;
    const uploadError = document.getElementById('upload-images-error');
    const progress = document.getElementById('upload-progress');
    const submitButton = document.querySelector('button[type="submit"][form="upload-images-form"]');
    
    uploadError.style.display = 'none';
    
    // Input validation
    if (!batchId) {
        uploadError.textContent = 'Please select a batch.';
        uploadError.style.display = 'block';
        return;
    }
    
    if (files.length === 0) {
        uploadError.textContent = 'Please select at least one image.';
        uploadError.style.display = 'block';
        return;
    }
      // Show progress and disable button if it exists
    progress.style.display = 'block';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
    }    // Prepare form data
    const formData = new FormData();
    
    // Add batch_id explicitly as a form field
    formData.append('batch_id', batchId);
    
    let totalSize = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Use indexed file names (file0, file1, etc.) to match the Azure Function's expected format
        formData.append(`file${i}`, file);
        totalSize += file.size;
    }
    
    // Log form data for debugging
    console.log(`Form data contains ${files.length} files`);
    
    // Log upload details
    console.log(`Uploading ${files.length} files (${Math.round(totalSize/1024)} KB) to batch ${batchId}`);
    try {
        // Log the form data structure to debug
        console.log(`Sending upload request to /api/admin/batches/${batchId}/images with ${files.length} files`);
        console.log('FormData content:');
        
        // Debug: Log form data contents (this won't show file content, just names)
        for (let pair of formData.entries()) {
            console.log(`- ${pair[0]}: ${pair[1] instanceof File ? pair[1].name + ' (' + pair[1].size + ' bytes)' : pair[1]}`);
        }
        
        // Upload images to batch
        const resp = await fetch(`/api/admin/batches/${batchId}/images`, {
            method: 'POST',
            body: formData
        });
          if (!resp.ok) {
            // Get the response text first
            const errorText = await resp.text();
            console.log(`Error response text: ${errorText}`);
            
            // Try to parse as JSON
            let errorDetail;
            try {
                const errorJson = JSON.parse(errorText);
                errorDetail = errorJson.detail || JSON.stringify(errorJson);
            } catch (e) {
                // If not valid JSON, use the raw text
                errorDetail = errorText || `HTTP ${resp.status}`;
            }
            
            // Add some context for common errors
            if (resp.status === 422) {
                errorDetail = `Validation error: ${errorDetail}. Make sure file uploads are properly formatted.`;
            } else if (resp.status === 413) {
                errorDetail = `The files are too large. Try uploading fewer or smaller files.`;
            } else if (resp.status === 400) {
                errorDetail = `${errorDetail} (No files were uploaded or files weren't properly named (should be file0, file1, etc.))`;
            }
            
            throw new Error(`Failed to upload images (${resp.status}): ${errorDetail}`);
        }
        
        // Get response data - read response text once
        const responseText = await resp.text();
        console.log(`Response text: ${responseText}`);
        
        // Default message
        let message = `${files.length} images uploaded successfully to batch ${batchId}`;
        
        // Try to parse as JSON
        try {
            const responseData = JSON.parse(responseText);
            console.log("Upload response:", responseData);
            
            // If the response has a specific message, use it
            if (responseData && responseData.message) {
                message = responseData.message;
                
                // If this is a fallback response, add a note
                if (responseData.is_fallback) {
                    message += ' (Note: Azure Function was unavailable, files saved locally)';
                }
            }
        } catch (e) {
            console.log("Upload successful, but response wasn't valid JSON:", e);
            // Use response text as the message if it's not empty
            if (responseText && responseText.trim()) {
                message = responseText;
            }
        }
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('upload-images-modal')).hide();
        
        // Show success message
        showToast(message);
        
        // Refresh batch list
        loadBatches();
    } catch (err) {
        console.error("Error uploading images:", err);
        uploadError.textContent = err.message;
        uploadError.style.display = 'block';    } finally {
        // Reset UI
        progress.style.display = 'none';
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Upload Images';
        }
    }
}

async function runInference() {
    // Get batch info
    const batchId = document.getElementById('inference-batch-id').value;
    
    // Get all model selections
    const modelsToRun = {};
    
    // Get primary model (required)
    // In the runInference function, update the model path construction:

// Get primary model (required)
    const primaryModelName = document.getElementById('inference-model1').value;
    if (!primaryModelName) {
        showError('Please select a primary model.');
        return;
    }

    // Extract just the model name without version
    const modelNameOnly = primaryModelName.split(':')[0];

    modelsToRun.model1 = {
        // Use the correct Azure ML model URI format
        path: `azureml://locations/westeurope/workspaces/bb4231a9-6d31-4939-9169-62673507fde4/models/${modelNameOnly}/versions/${primaryModelName.split(':')[1] || '1'}`,
        name: modelNameOnly
    };

    // Look for additional models (up to 8 total)
    for (let i = 2; i <= 8; i++) {
        const modelSelect = document.getElementById(`inference-model${i}`);
        if (modelSelect && modelSelect.value) {
            const additionalModelName = modelSelect.value;
            const additionalModelNameOnly = additionalModelName.split(':')[0];
            
            modelsToRun[`model${i}`] = {
                path: `azureml://locations/westeurope/workspaces/bb4231a9-6d31-4939-9169-62673507fde4/models/${additionalModelNameOnly}/versions/${additionalModelName.split(':')[1] || '1'}`,
                name: additionalModelNameOnly
            };
        }
    }
    
    // Get inference config
    const mode = document.getElementById('inference-mode').value || 'force';
    const windowSize = parseInt(document.getElementById('inference-window-size').value || 512);
    const overlap = parseInt(document.getElementById('inference-overlap').value || 64);
    const confidence = parseInt(document.getElementById('inference-confidence').value || 50);
    const trace = document.getElementById('inference-trace').checked;
    
    // Get compute config
    const computeTarget = document.getElementById('compute-target').value || 'cpu-cluster2';
    const instanceCount = parseInt(document.getElementById('instance-count').value || 1);
    const miniBatchSize = document.getElementById('mini-batch-size').value || '5';
    const maxConcurrency = parseInt(document.getElementById('max-concurrency').value || 2);
    const errorThreshold = parseInt(document.getElementById('error-threshold').value || -1);
    const loggingLevel = document.getElementById('logging-level').value || 'DEBUG';

    const inferenceError = document.getElementById('run-inference-error');
    const submitButton = document.querySelector('button[type="submit"][form="run-inference-form"]');
    
    // Helper function to show error
    function showError(message) {
        inferenceError.textContent = message;
        inferenceError.style.display = 'block';
    }
    
    inferenceError.style.display = 'none';
    
    // Input validation
    if (!batchId) {
        showError('Please select a batch.');
        return;
    }
    
    // Count the number of models being used
    const modelCount = Object.keys(modelsToRun).length;
    console.log(`Running inference with ${modelCount} models on batch ${batchId}`);
    
    // Update button state if button exists
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';
    }
    
    // Create JSON payload based on the required structure
    const requestData = {
        batch_id: batchId,
        models_to_run: modelsToRun,
        key_vault_url: "https://facadeaml8464799836.vault.azure.net/",
        compute_config: {
            compute_target: computeTarget,
            instance_count: instanceCount,
            mini_batch_size: miniBatchSize,
            max_concurrency_per_instance: maxConcurrency,
            error_threshold: errorThreshold,
            logging_level: loggingLevel
        },
        inference_config: {
            mode: mode,
            window_size: windowSize,
            overlap: overlap,
            confidence: confidence,
            trace: trace
        }
    };
    
    // Log inference parameters
    const modelNames = Object.values(modelsToRun).map(m => m.name).join(', ');
    console.log(`Running inference on batch ${batchId} with models: ${modelNames}`);
    console.log("Request payload:", requestData);
      try {
        const resp = await fetch(`/api/admin/batches/${batchId}/run-inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!resp.ok) {
            // Try to parse error response
            let errorDetail;
            try {
                const errorJson = await resp.json();
                errorDetail = errorJson.detail || JSON.stringify(errorJson);
            } catch (e) {
                errorDetail = await resp.text();
            }
            
            throw new Error(`Failed to start inference job (${resp.status}): ${errorDetail}`);
        }
        
        // Parse response
        const result = await resp.json();
        console.log("Inference job started:", result);
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('run-inference-modal')).hide();
          // Show success message with job details
        let message;
        
        if (result.job_name) {
            message = `Inference job started for batch ${batchId}. Job name: ${result.job_name}`;
            
            // Add a link to Azure ML Studio if available
            if (result.studio_url) {
                message += `\nView job in <a href="${result.studio_url}" target="_blank">Azure ML Studio</a>`;
            }
        } else {
            const jobId = result.job_id || result.jobId || 'Unknown';
            message = `Inference job started for batch ${batchId}. Job ID: ${jobId}`;
        }
        
        showToast(message);
        
        // Refresh batch list
        loadBatches();
    } catch (err) {
        console.error("Error starting inference job:", err);
        inferenceError.textContent = err.message;
        inferenceError.style.display = 'block';    } finally {
        // Reset button state if button exists
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Run Inference';
        }
    }
}

// Helper to load batch dropdowns
async function loadBatchDropdown(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    try {
        const resp = await fetch('/api/admin/batches');
        if (!resp.ok) throw new Error('Failed to load batches');
        const batches = await resp.json();
        batches.forEach(batch => {
            const opt = document.createElement('option');
            opt.value = batch.batch_id;
            opt.textContent = batch.batch_id;
            select.appendChild(opt);
        });
    } catch (err) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Error loading batches';
        select.appendChild(opt);
    }
}

// Helper to load model dropdown
// Helper to load model dropdown
async function loadModelDropdown(selectId) {
    const select = document.getElementById(selectId);
    
    // Check if the element exists before trying to modify it
    if (!select) {
        console.warn(`Element with ID '${selectId}' not found. Cannot load model dropdown.`);
        return;
    }
    
    select.innerHTML = '';
    
    // Add loading option
    const loadingOpt = document.createElement('option');
    loadingOpt.textContent = 'Loading models...';
    select.appendChild(loadingOpt);
    
    try {
        // Debug info
        console.log(`Attempting to load models from /api/models/inference/dropdown for ${selectId}`);
        
        // Fetch models from backend API
        const response = await fetch('/api/models/inference/dropdown');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Failed to load models: ${response.status} ${response.statusText}`);
        }
        
        const models = await response.json();
        console.log('Models API response:', models);
        
        // Clear loading option
        select.innerHTML = '';
        
        // Add default empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- Select a model --';
        select.appendChild(emptyOpt);
        
        // Check if we have a valid models array
        if (!Array.isArray(models)) {
            console.error('Invalid models response, not an array:', models);
            throw new Error('Invalid models response format');
        }
        
        // Add each model from the API - store just the model name as the value
        models.forEach(model => {
            const modelName = model.id || model.name;
            // Store just the model name for simplicity
            const opt = document.createElement('option');
            opt.value = modelName; // Just store the name, no version formatting
            opt.textContent = model.display_name || modelName;
            select.appendChild(opt);
        });
        
        console.log(`Loaded ${models.length} models for dropdown ${selectId}`);
    } catch (err) {
        console.error(`Error loading models for dropdown ${selectId}:`, err);
        
        // Show error in dropdown
        select.innerHTML = '';
        const errorOpt = document.createElement('option');
        errorOpt.value = '';
        errorOpt.textContent = 'Error loading models';
        select.appendChild(errorOpt);
        
        // Fallback to hardcoded models without version formatting
        const fallbackModels = [
            { value: 'Mechanical-Faults', label: 'Mechanical-Faults' },
            { value: 'Stonework-Fractures', label: 'Stonework-Fractures' },
            { value: 'Glazing-Defects', label: 'Glazing-Defects' },
            { value: 'short_gasket', label: 'Short Gasket' },
            { value: 'windows_detection', label: 'Windows Detection' }
        ];
        
        fallbackModels.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model.value;
            opt.textContent = model.label;
            select.appendChild(opt);
        });
        
        console.log(`Loaded ${fallbackModels.length} fallback models for ${selectId}`);
    }
}

// Function to add a new model field dynamically
function addModelField() {
    const container = document.getElementById('additional-models-container');
    
    // Find the next model number
    const nextModelNum = getNextModelNumber();
    
    // Check if we've reached the maximum number of models (8)
    if (nextModelNum > 8) {
        alert('Maximum of 8 models allowed');
        return;
    }
    
    // Create model field group
    const modelGroup = document.createElement('div');
    modelGroup.className = 'form-group model-field-group';
    modelGroup.dataset.modelNumber = nextModelNum;
    
    // Create model field with label and select
    modelGroup.innerHTML = `
        <div class="d-flex align-items-center mt-3">
            <div class="flex-grow-1">
                <label for="inference-model${nextModelNum}" class="form-label">Additional Model ${nextModelNum - 1}</label>
                <select class="form-control model-select" id="inference-model${nextModelNum}"></select>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm ms-2 remove-model-btn" 
                    style="margin-top: 32px;" data-model-number="${nextModelNum}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
      container.appendChild(modelGroup);
    
    // Load the model dropdown
    loadModelDropdown(`inference-model${nextModelNum}`);
    
    // Add event listener for remove button
    const removeButton = modelGroup.querySelector('.remove-model-btn');
    removeButton.addEventListener('click', (e) => {
        // If e.target is the icon or any child element, get the button
        const removeBtn = e.target.closest('.remove-model-btn');
        if (removeBtn) {
            const modelNum = parseInt(removeBtn.dataset.modelNumber);
            removeModelField(modelNum);
        }
    });
}

// Function to remove a model field
function removeModelField(modelNum) {
    const container = document.getElementById('additional-models-container');
    const modelGroup = container.querySelector(`.model-field-group[data-model-number="${modelNum}"]`);
    
    if (modelGroup) {
        modelGroup.remove();
        renumberModelFields(); // Renumber remaining fields
    }
}

// Function to find the next available model number
function getNextModelNumber() {
    const container = document.getElementById('additional-models-container');
    const modelGroups = container.querySelectorAll('.model-field-group');
    
    // Start with model2 (since model1 is the primary model)
    let highestNum = 1;
    
    modelGroups.forEach(group => {
        const modelNum = parseInt(group.dataset.modelNumber);
        if (modelNum > highestNum) {
            highestNum = modelNum;
        }
    });
    
    // Return the next number
    return highestNum + 1;
}

// Function to renumber model fields after deletion
function renumberModelFields() {
    const container = document.getElementById('additional-models-container');
    const modelGroups = container.querySelectorAll('.model-field-group');
    
    // Sort by model number
    const sortedGroups = Array.from(modelGroups).sort((a, b) => {
        return parseInt(a.dataset.modelNumber) - parseInt(b.dataset.modelNumber);
    });
    
    // Update labels (but not IDs/numbers to avoid breaking references)
    sortedGroups.forEach((group, index) => {
        const modelNum = parseInt(group.dataset.modelNumber);
        const label = group.querySelector('label');
        
        if (label) {
            label.textContent = `Additional Model ${index + 1}`;
        }
    });
}

// Expand batch to show all images
async function expandBatch(batchId) {
    const modal = new bootstrap.Modal(document.getElementById('batch-images-modal'));
    const loadingElement = document.getElementById('loading-batch-images');
    const errorElement = document.getElementById('batch-images-error');
    const imagesContainer = document.getElementById('batch-images-container');
    const downloadAllBtn = document.getElementById('download-all-batch-images');
    const modalTitle = document.querySelector('#batch-images-modal .modal-title');
    
    // Reset modal state
    if (modalTitle) {
        modalTitle.textContent = `Batch: ${batchId}`;
    }
    
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    if (imagesContainer) {
        imagesContainer.innerHTML = '';
    }
    
    if (downloadAllBtn) {
        downloadAllBtn.href = `/api/admin/batches/${batchId}/download`;
    }
    
    modal.show();
    
    try {
        console.log(`Fetching images for batch: ${batchId}`);
        const response = await fetch(`/api/admin/batches/${batchId}/images`);
        
        if (!response.ok) {
            throw new Error(`Failed to load images: ${response.statusText} (${response.status})`);
        }
        
        const images = await response.json();
        console.log(`Received ${images ? images.length : 0} images for batch ${batchId}`);
        console.log("Raw API response:", images);
        
        if (!images || images.length === 0) {
            if (imagesContainer) {
                imagesContainer.innerHTML = '<div class="alert alert-info">No images found in this batch.</div>';
            }
            
            if (downloadAllBtn) {
                downloadAllBtn.style.display = 'none';
            }
        } else {
            // Create a table to list images
            const table = document.createElement('table');
            table.className = 'table table-striped table-hover';
            
            // Add table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Image Name</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // Add table body
            const tbody = document.createElement('tbody');
            
            // Process each image
            images.forEach((image, index) => {
                // Debug: Log each image object
                console.log(`Image ${index + 1}:`, image);
                
                // Get image name with fallbacks
                let imageName = "unknown";
                
                // Try multiple possible properties where the name might be stored
                if (typeof image === 'object') {
                    if (image.name) imageName = image.name;
                    else if (image.filename) imageName = image.filename;
                    else if (image.ImageID) imageName = image.ImageID;
                    else if (image.id) imageName = image.id;
                    else if (image.path) {
                        const parts = image.path.split('/');
                        if (parts.length > 0) {
                            imageName = parts[parts.length - 1];
                        }
                    }
                } else if (typeof image === 'string') {
                    imageName = image;
                }
                
                const row = document.createElement('tr');                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${imageName}</td>
                `;tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            
            // Add table to container if it exists
            if (imagesContainer) {
                imagesContainer.appendChild(table);
            }
            
            // Update image count in modal title
            if (modalTitle) {
                modalTitle.textContent = `Batch: ${batchId} (${images.length} Images)`;
            }
            
            // Update download all button if it exists
            if (downloadAllBtn) {
                downloadAllBtn.style.display = 'inline-block';
            }
        }
        
    } catch (error) {
        console.error("Error loading batch images:", error);
        
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    } finally {
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Download batch images
function downloadBatchImages(batchId) {
    // This function is called when the user clicks on the download button in the batch table
    // We redirect the browser to the download endpoint which will handle the download process
    window.location = `/api/admin/batches/${batchId}/download`;
    
    // Show a toast notification to inform the user
    showToast(`Downloading batch ${batchId}... If the download doesn't start automatically, check your browser settings.`);
}

// Download a single image from a batch
async function downloadSingleImage(batchId, imageName) {
    try {
        showToast(`Downloading image ${imageName} from batch ${batchId}...`);
        
        // Construct payload for the Azure Function
        const payload = {
            batch_id: batchId,
            filenames: [imageName] // Specify just one filename to download
        };
        
        // Use fetch with POST request similar to the PowerShell script
        const response = await fetch(
            '/api/admin/batches/download-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }
        
        // Convert response to blob and create a download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = imageName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast(`Image ${imageName} downloaded successfully!`);
    } catch (error) {
        console.error('Error downloading image:', error);
        showToast(`Error downloading image: ${error.message}`, 'error');
    }
}

// Show toast notification
function showToast(message) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Check if message contains multiple lines
    const messageLines = message.split('\n');
    const primaryMessage = messageLines[0];
    const secondaryMessage = messageLines.length > 1 ? messageLines.slice(1).join('\n') : '';
    
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">Notification</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            <div>${primaryMessage}</div>
            ${secondaryMessage ? `<div class="mt-2">${secondaryMessage}</div>` : ''}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 5000);
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
}
