/**
 * Model Management System - Updated UI Version
 * Handles all model-related functionality for the admin interface
 */
class ModelManagement {
    constructor() {
        this.API_BASE_URL = '/api/models';
        this.currentEditId = null;
        this.initialized = false;
        
        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the model management system
     */
    init() {
        if (this.initialized) return;
        
        console.log("🧠 Model Management System initializing...");
        
        // Get DOM elements
        this.initializeElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadAndDisplayModels();
        
        this.initialized = true;
        console.log("✅ Model Management System initialized successfully");
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Modal elements
        this.modalElement = document.getElementById('modelModal');
        this.modalTitle = document.getElementById('modelModalTitle');
        this.modelForm = document.getElementById('modelForm');
        this.modalErrorDiv = document.getElementById('modelModalError');
        this.saveBtn = document.getElementById('modelFormSaveBtn');
        
        // Form inputs
        this.formIdInput = document.getElementById('modelFormIdInput');
        this.formModelNameInput = document.getElementById('modelFormModelName');
        this.formAzureModelNameInput = document.getElementById('modelFormAzureModelName');
        this.formConfidenceInput = document.getElementById('modelFormConfidence');
        this.formModelAccuracyInput = document.getElementById('modelFormModelAccuracy');
        this.formCategoryNoInput = document.getElementById('modelFormCategoryNo');
        
        // Container for displaying models (multiple fallback options)
        this.modelListContainer = document.getElementById('models-table-view') || 
                                 document.getElementById('modelListContainer') ||
                                 document.getElementById('models-container') ||
                                 document.querySelector('[id*="models"]') ||
                                 document.querySelector('.models-container');
        
        // Bootstrap modal instance
        if (this.modalElement && typeof bootstrap !== 'undefined') {
            this.bootstrapModal = new bootstrap.Modal(this.modalElement);
        }
        
        // Validate required elements
        this.validateRequiredElements();
    }

    /**
     * Validate that required DOM elements exist
     */
    validateRequiredElements() {
        const requiredElements = [
            { element: this.modelForm, name: 'modelForm' },
            { element: this.modelListContainer, name: 'modelListContainer' },
            { element: this.formModelNameInput, name: 'formModelNameInput' },
            { element: this.formAzureModelNameInput, name: 'formAzureModelNameInput' },
            { element: this.formConfidenceInput, name: 'formConfidenceInput' },
            { element: this.formModelAccuracyInput, name: 'formModelAccuracyInput' },
            { element: this.formCategoryNoInput, name: 'formCategoryNoInput' }
        ];

        const missingElements = requiredElements.filter(({ element }) => !element);
        
        if (missingElements.length > 0) {
            console.error('❌ Missing required elements:', missingElements.map(e => e.name));
            return false;
        }
        
        return true;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add Model button
        const openModelModalBtn = document.getElementById('openModelModalBtn');
        if (openModelModalBtn) {
            openModelModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showModal('register');
            });
        }

        // Form submission
        if (this.modelForm) {
            this.modelForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Modal hidden event
        if (this.modalElement) {
            this.modalElement.addEventListener('hidden.bs.modal', () => {
                if (this.modalErrorDiv) {
                    this.modalErrorDiv.textContent = '';
                    this.modalErrorDiv.style.display = 'none';
                }
            });
        }

        // Global functions for edit/delete buttons
        window.editModel = (modelId) => this.editModel(modelId);
        window.deleteModel = (modelId) => this.deleteModel(modelId);
        
        console.log("📝 Event listeners setup completed");
    }

    /**
     * API Methods
     */
    async fetchModels() {
        console.log("📥 Fetching models...");
        try {
            const response = await fetch(`${this.API_BASE_URL}/inference`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown error fetching models" }));
                throw new Error(errorData.detail || `Failed to fetch models: ${response.statusText}`);
            }
            const models = await response.json();
            console.log("✅ Models fetched successfully:", models.length);
            return models;
        } catch (error) {
            console.error("❌ Error fetching models:", error);
            throw error;
        }
    }

    async upsertModel(modelData) {
        console.log("💾 Upserting model:", modelData);
        try {
            const response = await fetch(`${this.API_BASE_URL}/inference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelData),
            });
            
            const responseData = await response.json();
            
            if (!response.ok) {
                const error = new Error(responseData.detail || `API Error: ${response.status}`);
                error.status = response.status;
                error.data = responseData;
                throw error;
            }
            
            console.log("✅ Model upserted successfully:", responseData);
            return { data: responseData, status: response.status };
        } catch (error) {
            console.error("❌ Error upserting model:", error);
            throw error;
        }
    }

    async deleteModelAPI(modelId) {
        console.log("🗑️ Deleting model:", modelId);
        try {
            const response = await fetch(`${this.API_BASE_URL}/inference/${modelId}`, {
                method: 'DELETE'
            });
            
            const responseData = await response.json();
            
            if (!response.ok) {
                const error = new Error(responseData.detail || `API Error: ${response.status}`);
                error.status = response.status;
                error.data = responseData;
                throw error;
            }
            
            console.log("✅ Model deleted successfully:", responseData);
            return { data: responseData, status: response.status };
        } catch (error) {
            console.error("❌ Error deleting model:", error);
            throw error;
        }
    }

    /**
     * UI Methods
     */
    renderModels(models) {
        console.log("🎨 Rendering models:", models?.length || 0);
        
        if (!this.modelListContainer) {
            console.error("❌ Model list container not found");
            return;
        }

        this.modelListContainer.innerHTML = '';
        
        if (!models || models.length === 0) {
            this.modelListContainer.innerHTML = `
                <div class="p-8 text-center">
                    <div class="inline-block p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <i class="fas fa-brain text-4xl text-gray-400 dark:text-gray-500"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Models Found</h3>
                    <p class="text-gray-600 dark:text-gray-400">No AI models are currently registered.</p>
                </div>
            `;
            return;
        }

        // Create responsive table
        const table = document.createElement('table');
        table.className = 'w-full text-sm text-left text-gray-500 dark:text-gray-400';
        table.innerHTML = `
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                    <th scope="col" class="px-6 py-3">Model Name</th>
                    <th scope="col" class="px-6 py-3">Azure Model Name</th>
                    <th scope="col" class="px-6 py-3">Confidence (%)</th>
                    <th scope="col" class="px-6 py-3">Accuracy (%)</th>
                    <th scope="col" class="px-6 py-3">Category No</th>
                    <th scope="col" class="px-6 py-3">Actions</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        models.forEach(model => {
            const row = this.createModelRow(model);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        this.modelListContainer.appendChild(table);
        
        console.log("✅ Models rendered successfully");
    }

    createModelRow(model) {
        const tr = document.createElement('tr');
        tr.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
        
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                ${model.ModelName}
            </td>
            <td class="px-6 py-4">${model.AzureModelName}</td>
            <td class="px-6 py-4">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    ${model.Confidence}%
                </span>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    ${model.ModelAccuracy}%
                </span>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    ${model.categoryNo}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex space-x-2">
                    <button onclick="editModel('${model.id}')" 
                            class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150"
                            title="Edit Model">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteModel('${model.id}')" 
                            class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-150"
                            title="Delete Model">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return tr;
    }

    async loadAndDisplayModels() {
        console.log("🔄 Loading and displaying models...");
        console.log("📍 Model list container:", this.modelListContainer);
        
        if (!this.modelListContainer) {
            console.error("❌ Model list container not found. Cannot load models.");
            console.log("🔍 Available containers:", {
                'models-table-view': document.getElementById('models-table-view'),
                'modelListContainer': document.getElementById('modelListContainer'),
                'models-container': document.getElementById('models-container')
            });
            return;
        }

        this.modelListContainer.innerHTML = `
            <div class="p-8 text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                <p class="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading models...</p>
            </div>
        `;

        try {
            const models = await this.fetchModels();
            console.log("✅ Models fetched, calling renderModels...");
            this.renderModels(models);
        } catch (error) {
            console.error("❌ Error loading models:", error);
            this.modelListContainer.innerHTML = `
                <div class="p-8 text-center">
                    <div class="inline-block p-6 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Error Loading Models</h3>
                    <p class="text-red-600 dark:text-red-400 mb-4">${error.message}</p>
                    <button onclick="window.modelManagement.loadAndDisplayModels()" 
                            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Modal Methods
     */
    showModal(mode = 'register', model = null) {
        console.log("🔧 Showing modal:", mode, model);
        
        if (!this.bootstrapModal || !this.modelForm || !this.modalTitle) {
            console.error("❌ Modal elements not available");
            return;
        }

        this.currentEditId = null;
        this.modelForm.reset();
        this.hideError();
        
        if (this.formIdInput) {
            this.formIdInput.value = '';
        }

        if (mode === 'edit' && model) {
            this.modalTitle.textContent = 'Edit Model';
            this.currentEditId = model.id;
            
            if (this.formIdInput) this.formIdInput.value = model.id;
            if (this.formModelNameInput) this.formModelNameInput.value = model.ModelName || '';
            if (this.formAzureModelNameInput) this.formAzureModelNameInput.value = model.AzureModelName || '';
            if (this.formConfidenceInput) this.formConfidenceInput.value = model.Confidence || '';
            if (this.formModelAccuracyInput) this.formModelAccuracyInput.value = model.ModelAccuracy || '';
            if (this.formCategoryNoInput) this.formCategoryNoInput.value = model.categoryNo || '';
        } else {
            this.modalTitle.textContent = 'Register New Model';
        }

        this.bootstrapModal.show();
    }

    closeModal() {
        if (this.bootstrapModal) {
            this.bootstrapModal.hide();
        }
    }

    showError(message) {
        if (this.modalErrorDiv) {
            this.modalErrorDiv.textContent = message;
            this.modalErrorDiv.style.display = 'block';
        }
    }

    hideError() {
        if (this.modalErrorDiv) {
            this.modalErrorDiv.textContent = '';
            this.modalErrorDiv.style.display = 'none';
        }
    }

    /**
     * Form Handling
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        console.log("📝 Form submitted");

        if (!this.saveBtn) return;

        this.hideError();
        this.saveBtn.disabled = true;
        this.saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        try {
            // Get form data
            const modelData = this.getFormData();
            
            // Validate data
            if (!this.validateFormData(modelData)) {
                return;
            }

            // Save model
            const result = await this.upsertModel(modelData);
            console.log("✅ Model saved successfully:", result);

            // Close modal and refresh list
            this.closeModal();
            
            // Show success message
            if (typeof ToastManager !== 'undefined') {
                ToastManager.success(`Model ${this.currentEditId ? 'updated' : 'created'} successfully!`);
            }

        } catch (error) {
            console.error("❌ Error saving model:", error);
            this.showError(error.data?.detail || error.message || 'An unexpected error occurred during save.');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Model';
        }
    }

    getFormData() {
        const modelData = {
            ModelName: this.formModelNameInput.value.trim(),
            AzureModelName: this.formAzureModelNameInput.value.trim(),
            Confidence: parseInt(this.formConfidenceInput.value.trim(), 10),
            ModelAccuracy: parseFloat(this.formModelAccuracyInput.value.trim()),
            categoryNo: parseInt(this.formCategoryNoInput.value.trim(), 10),
            Organisation: "Default" // Default organization
        };

        if (this.currentEditId) {
            modelData.id = this.currentEditId;
        }

        return modelData;
    }

    validateFormData(modelData) {
        const { ModelName, AzureModelName, Confidence, ModelAccuracy, categoryNo } = modelData;

        // Check required fields
        if (!ModelName || !AzureModelName || isNaN(Confidence) || isNaN(ModelAccuracy) || isNaN(categoryNo)) {
            this.showError('All fields are required and numeric values must be valid.');
            return false;
        }

        // Validate confidence range
        if (Confidence < 0 || Confidence > 100) {
            this.showError('Confidence must be between 0 and 100.');
            return false;
        }

        // Validate accuracy range
        if (ModelAccuracy < 0 || ModelAccuracy > 100) {
            this.showError('Model Accuracy must be between 0 and 100.');
            return false;
        }

        // Validate category number
        if (categoryNo < 1) {
            this.showError('Category Number must be greater than 0.');
            return false;
        }

        return true;
    }

    /**
     * Model Actions
     */
    async editModel(modelId) {
        console.log("✏️ Editing model:", modelId);
        
        try {
            const models = await this.fetchModels();
            const model = models.find(m => m.id === modelId);
            
            if (model) {
                this.showModal('edit', model);
            } else {
                console.error("❌ Model not found:", modelId);
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.error('Model not found');
                }
            }
        } catch (error) {
            console.error("❌ Error fetching model for edit:", error);
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Error loading model data');
            }
        }
    }

    async deleteModel(modelId) {
        console.log("🗑️ Deleting model:", modelId);
        
        // Get model name for confirmation
        try {
            const models = await this.fetchModels();
            const model = models.find(m => m.id === modelId);
            const modelName = model ? model.ModelName : 'this model';
            
            if (!confirm(`Are you sure you want to delete "${modelName}"? This action cannot be undone.`)) {
                return;
            }

            await this.deleteModelAPI(modelId);
            await this.loadAndDisplayModels();
            
            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Model deleted successfully');
            }
            
        } catch (error) {
            console.error("❌ Error deleting model:", error);
            const errorMessage = error.data?.detail || error.message || 'Unknown error occurred';
            
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error(`Error deleting model: ${errorMessage}`);
            } else {
                alert(`Error deleting model: ${errorMessage}`);
            }
        }
    }

    /**
     * Public API
     */
    refresh() {
        this.loadAndDisplayModels();
    }

    getModels() {
        return this.fetchModels();
    }
}

// Initialize the model management system
document.addEventListener('DOMContentLoaded', () => {
    // Multiple initialization strategies to ensure it works
    console.log("🚀 Model Management: DOM Content Loaded");
    
    // Strategy 1: Wait for facade studio to be ready
    if (window.facadeStudioLoader) {
        document.addEventListener('facadeStudioReady', () => {
            console.log("🎉 Facade Studio Ready - Initializing Model Management...");
            if (!window.modelManagement) {
                window.modelManagement = new ModelManagement();
            }
        });
        
        // Fallback timeout in case facadeStudioReady doesn't fire
        setTimeout(() => {
            if (!window.modelManagement) {
                console.log("🔧 Fallback: Initializing Model Management after timeout...");
                window.modelManagement = new ModelManagement();
            }
        }, 2000);
    } else {
        // Strategy 2: Direct initialization if facade studio is not available
        console.log("🔧 Direct: Initializing Model Management (no facade studio)...");
        window.modelManagement = new ModelManagement();
    }
});

// Additional fallback: Initialize on window load if not already done
window.addEventListener('load', () => {
    if (!window.modelManagement) {
        console.log("🔧 Window Load: Initializing Model Management as final fallback...");
        window.modelManagement = new ModelManagement();
    }
});

// Export the class for use in other modules
window.ModelManagement = ModelManagement;

// Debug function to manually trigger model loading
window.debugModelManagement = function() {
    console.log("🔧 Debug: Manual model management initialization");
    console.log("Current modelManagement instance:", window.modelManagement);
    
    if (!window.modelManagement) {
        console.log("🚀 Creating new ModelManagement instance...");
        window.modelManagement = new ModelManagement();
    } else {
        console.log("🔄 Refreshing existing ModelManagement instance...");
        window.modelManagement.loadAndDisplayModels();
    }
};
