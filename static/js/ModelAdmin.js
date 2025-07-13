// static/js/ModelAdmin.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("ModelAdmin.js loaded and DOM fully parsed!");

    const API_BASE_URL = '/api/models';

    // DOM Elements
    const openModalBtn = document.getElementById('openModelModalBtn');
    const modelListContainer = document.getElementById('modelListContainer');
    
    // Modal specific elements
    const modalElement = document.getElementById('modelModal');
    let modelBootstrapModal = null;
    if (modalElement) {
        modelBootstrapModal = new bootstrap.Modal(modalElement);
    } else {
        console.error("Modal element with ID 'modelModal' not found!");
    }

    const modalTitle = document.getElementById('modelModalTitle');
    const modelForm = document.getElementById('modelForm');
    const formIdInput = document.getElementById('modelFormIdInput');
    const formModelNameInput = document.getElementById('modelFormModelName');
    const formAzureModelNameInput = document.getElementById('modelFormAzureModelName');
    const formConfidenceInput = document.getElementById('modelFormConfidence');
    const formModelAccuracyInput = document.getElementById('modelFormModelAccuracy');
    const formCategoryNoInput = document.getElementById('modelFormCategoryNo');
    const modalErrorDiv = document.getElementById('modelModalError');
    const saveBtn = document.getElementById('modelFormSaveBtn');

    let currentEditId = null;

    // API Helper Functions
    async function fetchModels() {
        console.log("Fetching models...");
        const response = await fetch(`${API_BASE_URL}/inference`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error fetching models" }));
            console.error("Failed to fetch models:", errorData);
            throw new Error(errorData.detail || `Failed to fetch models: ${response.statusText}`);
        }
        const models = await response.json();
        console.log("Models fetched:", models);
        return models;
    }

    async function upsertModelAPI(modelData) {
        console.log("Upserting model with data:", modelData);
        const response = await fetch(`${API_BASE_URL}/inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modelData),
        });
        const responseData = await response.json();
        if (!response.ok) {
            console.error("API upsert error responseData:", responseData);
            const error = new Error(responseData.detail || `API Error: ${response.status}`);
            error.status = response.status;
            error.data = responseData;
            throw error;
        }
        console.log("Model upserted successfully via API:", responseData);
        return { data: responseData, status: response.status };
    }

    async function deleteModelAPI(modelId) {
        console.log("Deleting model with ID:", modelId);
        const response = await fetch(`${API_BASE_URL}/inference/${modelId}`, {
            method: 'DELETE'
        });
        const responseData = await response.json();
        if (!response.ok) {
            console.error("API delete error responseData:", responseData);
            const error = new Error(responseData.detail || `API Error: ${response.status}`);
            error.status = response.status;
            error.data = responseData;
            throw error;
        }
        console.log("Model deleted successfully via API:", responseData);
        return { data: responseData, status: response.status };
    }

    // UI Update Functions
    function renderModels(models) {
        console.log("Rendering models:", models);
        modelListContainer.innerHTML = '';
        if (!models || models.length === 0) {
            modelListContainer.innerHTML = '<p>No models registered yet.</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'table table-striped table-hover';
        table.innerHTML = `<thead><tr>
            <th>Model Name</th>
            <th>Azure Model Name</th>
            <th>Confidence (%)</th>
            <th>Accuracy (%)</th>
            <th>Category No</th>
            <th>Actions</th>
        </tr></thead>`;
        
        const tbody = document.createElement('tbody');
        models.forEach(m => {
            const tr = tbody.insertRow();
            tr.insertCell().textContent = m.ModelName;
            tr.insertCell().textContent = m.AzureModelName;
            tr.insertCell().textContent = m.Confidence;
            tr.insertCell().textContent = m.ModelAccuracy;
            tr.insertCell().textContent = m.categoryNo;

            const actionsCell = tr.insertCell();            // Edit button
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'btn btn-sm btn-info';
            editButton.onclick = () => {
                console.log("Edit button clicked for model:", m);
                showModal('edit', m);
            };
            actionsCell.appendChild(editButton);
            
            // Delete button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.onclick = async () => {
                if (confirm(`Are you sure you want to delete the model "${m.ModelName}"?`)) {
                    try {
                        await deleteModelAPI(m.id);
                        await loadAndDisplayModels();
                    } catch (error) {
                        console.error("Error deleting model:", error);
                        alert(`Error deleting model: ${error.message || 'Unknown error'}`);
                    }
                }
            };
            actionsCell.appendChild(deleteButton);
        });
        
        table.appendChild(tbody);
        modelListContainer.appendChild(table);
    }
    
    async function loadAndDisplayModels() {
        if (!modelListContainer) {
            console.error("modelListContainer not found in DOM. Cannot load models.");
            return;
        }
        modelListContainer.innerHTML = '<p>Loading models...</p>';
        try {
            const models = await fetchModels();
            renderModels(models);
        } catch (error) {
            console.error("Error in loadAndDisplayModels:", error);
            modelListContainer.innerHTML = `<p class="text-danger">Error loading models: ${error.message}</p>`;
        }
    }

    // Modal Functions
    function showModal(mode = 'register', model = null) {
        console.log("showModal called. Mode:", mode, "Model data:", model);
        if (!modelBootstrapModal || !modelForm || !modalTitle) {
            console.error("One or more modal DOM elements are missing or Bootstrap modal not initialized. Cannot show modal.");
            return;
        }
        currentEditId = null;
        modelForm.reset();
        modalErrorDiv.textContent = '';
        modalErrorDiv.style.display = 'none';
        formIdInput.value = '';

        if (mode === 'edit' && model) {
            if(modalTitle) modalTitle.textContent = 'Edit Model';
            currentEditId = model.id;
            if(formIdInput) formIdInput.value = model.id;
            if(formModelNameInput) formModelNameInput.value = model.ModelName || '';
            if(formAzureModelNameInput) formAzureModelNameInput.value = model.AzureModelName || '';
            if(formConfidenceInput) formConfidenceInput.value = model.Confidence || '';
            if(formModelAccuracyInput) formModelAccuracyInput.value = model.ModelAccuracy || '';
            if(formCategoryNoInput) formCategoryNoInput.value = model.categoryNo || '';
        } else {
            if(modalTitle) modalTitle.textContent = 'Register New Model';
        }
        modelBootstrapModal.show();
        console.log("Bootstrap modal should be shown now.");
    }

    function closeModal() {
        if (!modelBootstrapModal) {
            console.error("Bootstrap modal instance not found. Cannot close modal programmatically.");
            return;
        }
        modelBootstrapModal.hide();
        console.log("Bootstrap modal hidden programmatically.");
    }

    // Event Handlers
    async function handleFormSubmit(event) {
        event.preventDefault();
        console.log("Model form submitted.");
        if (!modalErrorDiv || !saveBtn) {
            console.error("Form submission elements missing.");
            return;
        }

        modalErrorDiv.textContent = '';
        modalErrorDiv.style.display = 'none';
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        const modelName = formModelNameInput.value.trim();
        const azureModelName = formAzureModelNameInput.value.trim();
        const confidence = parseInt(formConfidenceInput.value.trim(), 10);
        const modelAccuracy = parseInt(formModelAccuracyInput.value.trim(), 10);
        const categoryNo = parseInt(formCategoryNoInput.value.trim(), 10);

        // Validation
        if (!modelName || !azureModelName || isNaN(confidence) || isNaN(modelAccuracy) || isNaN(categoryNo)) {
            modalErrorDiv.textContent = 'All fields are required and numeric values must be valid.';
            modalErrorDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Model';
            console.log("Form validation failed: required fields missing or invalid.");
            return;
        }

        // Additional validation
        if (confidence < 0 || confidence > 100) {
            modalErrorDiv.textContent = 'Confidence must be between 0 and 100.';
            modalErrorDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Model';
            return;
        }

        if (modelAccuracy < 0 || modelAccuracy > 100) {
            modalErrorDiv.textContent = 'Model Accuracy must be between 0 and 100.';
            modalErrorDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Model';
            return;
        }

        const modelData = {
            ModelName: modelName,
            AzureModelName: azureModelName,
            Confidence: confidence,
            ModelAccuracy: modelAccuracy,
            categoryNo: categoryNo,
            Organisation: "Default" // Default organization for now
        };

        if (currentEditId) {
            modelData.id = currentEditId;
        }
        
        console.log("Submitting modelData:", modelData);

        try {
            const { data: savedModel, status } = await upsertModelAPI(modelData);
            console.log("Model save successful. API Status:", status, "Saved data:", savedModel);
            closeModal();
            await loadAndDisplayModels();
        } catch (error) {
            console.error("Error saving model:", error);
            modalErrorDiv.textContent = error.data?.detail || error.message || 'An unexpected error occurred during save.';
            modalErrorDiv.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Model';
        }
    }

    // Attach Event Listeners
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => showModal('register'));
    } else {
        console.warn("'openModelModalBtn' not found.");
    }

    if(modalElement) {
        modalElement.addEventListener('hidden.bs.modal', function (event) {
            console.log('Bootstrap modal has been hidden.');
            if(modalErrorDiv) {
                modalErrorDiv.textContent = '';
                modalErrorDiv.style.display = 'none';
            }
        });
    }

    if (modelForm) {
        modelForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.warn("'modelForm' not found. Form submission will not work.");
    }

    // Initial Load
    console.log("Attempting initial load of models...");
    loadAndDisplayModels();
});
