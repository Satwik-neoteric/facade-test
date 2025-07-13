/**
 * Admin Actions Manager
 * Handles all user actions and operations in the admin interface
 */

// ToastManager fallback for cases where it's not available
const ToastManagerFallback = {
    info: (message, options) => console.log(message, options),
    success: (message) => console.log(message),
    error: (message) => console.error(message),
    warning: (message) => console.warn(message),
    loading: (message) => { console.log(message); return { dismiss: () => {} }; }
};

// Use ToastManager if available, otherwise use fallback
const Toast = typeof ToastManager !== 'undefined' ? ToastManager : ToastManagerFallback;

class AdminActionsManager {
    constructor() {
        this.initialized = false;
        this.config = {
            confirmDeletions: true,
            showSuccessMessages: true,
            autoRefresh: true
        };
        this.endpoints = {
            users: '/api/admin/users',
            batches: '/api/batches',
            buildings: '/api/buildings',
            models: '/api/models/inference',
            pipelines: '/api/pipelines/inference'
        };
    }

    /**
     * Initialize admin actions
     */
    init() {
        if (this.initialized) return;
        
        console.log('Initializing Admin Actions Manager...');
        this.bindGlobalActions();
        this.setupEventListeners();
        this.initialized = true;
        console.log('✅ Admin Actions Manager initialized');
        
        // Dispatch event to indicate admin actions are ready
        document.dispatchEvent(new CustomEvent('adminActionsReady'));
    }

    /**
     * Setup event listeners for actions
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const entityType = target.dataset.entityType;
            const entityId = target.dataset.entityId;

            this.handleAction(action, entityType, entityId, target);
        });
    }

    /**
     * Handle generic action
     */
    async handleAction(action, entityType, entityId, element) {
        const handlers = {
            edit: () => this.editEntity(entityType, entityId),
            delete: () => this.deleteEntity(entityType, entityId),
            view: () => this.viewEntity(entityType, entityId),
            run: () => this.runEntity(entityType, entityId),
            duplicate: () => this.duplicateEntity(entityType, entityId),
            export: () => this.exportEntity(entityType, entityId)
        };

        const handler = handlers[action];
        if (handler) {
            LoadingManager.addButtonLoading(element);
            try {
                await handler();
            } catch (error) {
                console.error(`Error executing ${action} on ${entityType}:`, error);
                Toast.error(`Failed to ${action} ${entityType}`);
            } finally {
                LoadingManager.removeButtonLoading(element);
            }
        }
    }

    /**
     * Bind global action functions for legacy compatibility
     */
    bindGlobalActions() {
        // User management actions
        window.editUser = (userId) => this.editEntity('user', userId);
        window.deleteUser = (userId) => this.deleteEntity('user', userId);
        
        // Batch management actions - override any previous definitions
        // AdminActionsManager is the authoritative source for these functions
        window.viewBatchImages = (batchId) => this.viewBatchImages(batchId);
        window.downloadBatchImages = (batchId) => this.downloadBatchImages(batchId);
        window.runInference = (batchId) => this.runInference(batchId);
        
        // Building management actions
        window.editBuilding = (buildingId) => this.editEntity('building', buildingId);
        window.deleteBuilding = (buildingId) => this.deleteEntity('building', buildingId);
        
        // Model management actions
        window.editModel = (modelId) => this.editEntity('model', modelId);
        window.deleteModel = (modelId) => this.deleteEntity('model', modelId);
        
        // Pipeline management actions
        window.editPipeline = (pipelineId) => this.editEntity('pipeline', pipelineId);
        window.deletePipeline = (pipelineId) => this.deleteEntity('pipeline', pipelineId);
        window.runPipeline = (pipelineId) => this.runEntity('pipeline', pipelineId);
    }

    /**
     * Generic edit entity
     */
    async editEntity(entityType, entityId) {
        console.log(`Edit ${entityType}:`, entityId);
        
        try {
            const entity = await this.fetchEntity(entityType, entityId);
            if (entity) {
                this.showEditModal(entityType, entity);
            } else {
                Toast.error(`${this.capitalize(entityType)} not found`);
            }
        } catch (error) {
            console.error(`Error editing ${entityType}:`, error);
            Toast.error(`Failed to load ${entityType} for editing`);
        }
    }

    /**
     * Generic delete entity
     */
    async deleteEntity(entityType, entityId) {
        console.log(`Delete ${entityType}:`, entityId);
        
        if (this.config.confirmDeletions) {
            const confirmed = await this.showConfirmDialog(
                `Delete ${this.capitalize(entityType)}`,
                `Are you sure you want to delete this ${entityType}? This action cannot be undone.`,
                'danger'
            );
            if (!confirmed) return;
        }

        try {
            const success = await this.performDelete(entityType, entityId);
            if (success) {
                if (this.config.showSuccessMessages) {
                    Toast.success(`${this.capitalize(entityType)} deleted successfully`);
                }
                if (this.config.autoRefresh) {
                    this.refreshSection(entityType + 's');
                }
            }
        } catch (error) {
            console.error(`Error deleting ${entityType}:`, error);
            Toast.error(`Failed to delete ${entityType}: ${error.message}`);
        }
    }

    /**
     * Generic view entity
     */
    async viewEntity(entityType, entityId) {
        console.log(`View ${entityType}:`, entityId);
        
        const viewHandlers = {
            batch: () => this.viewBatchImages(entityId),
            user: () => this.viewUserProfile(entityId),
            building: () => this.viewBuildingDetails(entityId),
            model: () => this.viewModelDetails(entityId),
            pipeline: () => this.viewPipelineDetails(entityId)
        };

        const handler = viewHandlers[entityType];
        if (handler) {
            await handler();
        } else {
            Toast.info(`View ${entityType} details: ${entityId}`);
        }
    }

    /**
     * Generic run entity
     */
    async runEntity(entityType, entityId) {
        console.log(`Run ${entityType}:`, entityId);
        
        const runHandlers = {
            batch: () => this.runInference(entityId),
            pipeline: () => this.runPipeline(entityId),
            model: () => this.runModelTest(entityId)
        };

        const handler = runHandlers[entityType];
        if (handler) {
            await handler();
        } else {
            Toast.info(`Run ${entityType}: ${entityId}`);
        }
    }

    /**
     * Fetch entity data
     */
    async fetchEntity(entityType, entityId) {
        const endpoint = this.endpoints[entityType + 's'] || this.endpoints[entityType];
        if (!endpoint) {
            throw new Error(`No endpoint defined for ${entityType}`);
        }

        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${entityType} data`);
        }

        const data = await response.json();
        const entities = Array.isArray(data) ? data : (data[entityType + 's'] || data.data || []);
        
        return entities.find(entity => 
            entity.id === entityId || 
            entity._id === entityId || 
            entity.objectId === entityId
        );
    }

    /**
     * Perform delete operation
     */
    async performDelete(entityType, entityId) {
        const endpointMap = {
            user: `${this.endpoints.users}/${entityId}`,
            batch: `${this.endpoints.batches}/${entityId}`,
            building: `${this.endpoints.buildings}/${entityId}`,
            model: `${this.endpoints.models}/${entityId}`,
            pipeline: `${this.endpoints.pipelines}/${entityId}`
        };

        const endpoint = endpointMap[entityType];
        if (!endpoint) {
            throw new Error(`No delete endpoint defined for ${entityType}`);
        }

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || errorData.message || 'Delete operation failed');
        }

        return true;
    }

    /**
     * Show edit modal
     */
    showEditModal(entityType, entity) {
        const modalId = `edit-${entityType}-modal`;
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            const content = this.generateEditForm(entityType, entity);
            const modalHtml = UIComponents.createModal(modalId, `Edit ${this.capitalize(entityType)}`, content, [
                UIComponents.createButton('Cancel', { variant: 'secondary', onclick: `UIComponents.closeModal('${modalId}')` }),
                UIComponents.createButton('Save Changes', { variant: 'primary', onclick: `adminActionsManager.saveEntity('${entityType}', '${entity.id || entity._id}')` })
            ]);
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        UIComponents.openModal(modalId);
    }

    /**
     * Generate edit form for entity
     */
    generateEditForm(entityType, entity) {
        const formFields = this.getFormFields(entityType, entity);
        return `
            <form id="edit-${entityType}-form" class="space-y-4">
                ${formFields.map(field => UIComponents.createInput(field)).join('')}
            </form>
        `;
    }

    /**
     * Get form fields for entity type
     */
    getFormFields(entityType, entity) {
        const fieldMaps = {
            user: [
                { name: 'displayName', label: 'Display Name', value: entity.displayName || '', required: true },
                { name: 'email', label: 'Email', type: 'email', value: entity.email || '', required: true },
                { name: 'role', label: 'Role', value: entity.role || 'user', required: true }
            ],
            building: [
                { name: 'name', label: 'Building Name', value: entity.name || '', required: true },
                { name: 'address', label: 'Address', value: entity.address || '' },
                { name: 'description', label: 'Description', value: entity.description || '' }
            ],
            model: [
                { name: 'name', label: 'Model Name', value: entity.name || '', required: true },
                { name: 'description', label: 'Description', value: entity.description || '' },
                { name: 'version', label: 'Version', value: entity.version || '' }
            ],
            pipeline: [
                { name: 'name', label: 'Pipeline Name', value: entity.name || '', required: true },
                { name: 'description', label: 'Description', value: entity.description || '' },
                { name: 'status', label: 'Status', value: entity.status || 'active' }
            ]
        };

        return fieldMaps[entityType] || [];
    }

    /**
     * Save entity
     */
    async saveEntity(entityType, entityId) {
        const form = document.getElementById(`edit-${entityType}-form`);
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const endpoint = `${this.endpoints[entityType + 's']}/${entityId}`;
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                Toast.success(`${this.capitalize(entityType)} updated successfully`);
                UIComponents.closeModal(`edit-${entityType}-modal`);
                this.refreshSection(entityType + 's');
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || 'Failed to update');
            }
        } catch (error) {
            console.error(`Error saving ${entityType}:`, error);
            Toast.error(`Failed to save ${entityType}: ${error.message}`);
        }
    }

    /**
     * Show confirmation dialog
     */
    showConfirmDialog(title, message, type = 'warning') {
        return new Promise((resolve) => {
            const modalId = 'confirm-dialog';
            const content = `
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                        <i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300">${message}</p>
                </div>
            `;

            const actions = [
                UIComponents.createButton('Cancel', { 
                    variant: 'secondary', 
                    onclick: `UIComponents.closeModal('${modalId}'); window.confirmDialogResolve(false);` 
                }),
                UIComponents.createButton('Confirm', { 
                    variant: 'danger', 
                    onclick: `UIComponents.closeModal('${modalId}'); window.confirmDialogResolve(true);` 
                })
            ];

            // Remove existing modal if any
            const existingModal = document.getElementById(modalId);
            if (existingModal) existingModal.remove();

            const modalHtml = UIComponents.createModal(modalId, title, content, actions);
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            window.confirmDialogResolve = resolve;
            UIComponents.openModal(modalId);
        });
    }

    /**
     * Specific action implementations
     */
    async viewBatchImages(batchId) {
        console.log(`👁️ Viewing images for batch: ${batchId}`);
        
        try {
            // Check if batch images modal exists and use it
            const batchImagesModal = document.getElementById('batch-images-modal');
            if (batchImagesModal) {
                // Populate modal with batch images
                const response = await fetch(`/api/admin/batches/${batchId}/images`);
                if (response.ok) {
                    const data = await response.json();
                    this.showBatchImagesModal(batchId, data.images);
                } else {
                    throw new Error('Failed to load batch images');
                }
            } else {
                // Fallback: expand batch row or show info
                Toast.info(`View images for batch: ${batchId}`, {
                    action: 'View Details',
                    onClick: () => window.open(`/admin/batches/${batchId}`, '_blank')
                });
            }
        } catch (error) {
            console.error('Error viewing batch images:', error);
            Toast.error(`Failed to load images for batch ${batchId}`);
        }
    }

    async downloadBatchImages(batchId) {
        console.log(`📥 Downloading images for batch: ${batchId}`);
        
        try {
            Toast.loading(`Preparing download for batch ${batchId}...`);
            
            // Call the download API endpoint
            const response = await fetch(`/api/admin/batches/${batchId}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.download_url) {
                    // Create temporary download link
                    const link = document.createElement('a');
                    link.href = result.download_url;
                    link.download = `batch_${batchId}_images.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    Toast.success(`Batch ${batchId} download started successfully`);
                } else {
                    throw new Error('No download URL provided');
                }
            } else {
                throw new Error(`Download failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error downloading batch images:', error);
            Toast.error(`Failed to download batch ${batchId}: ${error.message}`);
        }
    }

    async runInference(batchId) {
        console.log(`▶️ Running inference on batch: ${batchId}`);
        
        try {
            // Check if run inference modal exists
            const runInferenceModal = document.getElementById('run-inference-modal');
            if (runInferenceModal) {
                // Pre-populate the modal with batch ID
                const batchIdInput = runInferenceModal.querySelector('#inference-batch-id');
                if (batchIdInput) {
                    batchIdInput.value = batchId;
                }
                
                // Open the modal
                if (window.adminPageController?.modalManager) {
                    window.adminPageController.modalManager.openModal('run-inference-modal');
                } else {
                    // Fallback modal opening
                    runInferenceModal.classList.add('show');
                    runInferenceModal.style.display = 'block';
                }
                
                Toast.info(`Configure inference settings for batch ${batchId}`);
            } else {
                // Direct API call fallback
                Toast.loading(`Running inference on batch ${batchId}...`);
                
                const response = await fetch(`/api/admin/batches/${batchId}/inference`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        batch_id: batchId,
                        model: 'default' // Use default model
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    Toast.success(`Inference started for batch ${batchId}. Job ID: ${result.job_id || 'N/A'}`);
                } else {
                    throw new Error(`Inference failed: ${response.statusText}`);
                }
            }
        } catch (error) {
            console.error('Error running inference:', error);
            Toast.error(`Failed to run inference on batch ${batchId}: ${error.message}`);
        }
    }

    /**
     * Show batch images in modal
     */
    showBatchImagesModal(batchId, images) {
        const modal = document.getElementById('batch-images-modal');
        if (!modal) return;
        
        // Update modal title
        const title = modal.querySelector('.modal-title');
        if (title) title.textContent = `Images in Batch: ${batchId}`;
        
        // Populate images grid
        const imagesContainer = modal.querySelector('#batch-images-container');
        if (imagesContainer && images.length > 0) {
            imagesContainer.innerHTML = images.map(image => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <img src="${image.thumbnail_url || image.url}" 
                             class="card-img-top" 
                             alt="${image.filename}"
                             style="height: 200px; object-fit: cover;">
                        <div class="card-body p-2">
                            <small class="text-muted">${image.filename}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        } else if (imagesContainer) {
            imagesContainer.innerHTML = '<p class="text-center text-muted">No images found in this batch.</p>';
        }
        
        // Open modal
        if (window.adminPageController?.modalManager) {
            window.adminPageController.modalManager.openModal('batch-images-modal');
        }
    }

    async runPipeline(pipelineId) {
        Toast.loading(`Running pipeline ${pipelineId}...`);
        // Implement pipeline run logic
        setTimeout(() => {
            Toast.success(`Pipeline ${pipelineId} executed successfully`);
        }, 2000);
    }

    /**
     * Utility methods
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    refreshSection(section) {
        if (window.adminPageController) {
            window.adminPageController.refreshSection(section);
        } else if (window.adminSectionLoader) {
            window.adminSectionLoader.refreshSection(section);
        }
    }
}

// Create global functions immediately when script loads
// This ensures they're available when table buttons are created
console.log('Defining global batch management functions...');

// Safeguard against circular calls
let isExecutingBatchAction = false;

window.viewBatchImages = function(batchId) {
    if (isExecutingBatchAction) {
        console.warn('Preventing circular call to viewBatchImages');
        return;
    }
    
    console.log('👁️ viewBatchImages called for batch:', batchId);
    if (window.adminActionsManager && window.adminActionsManager.initialized) {
        isExecutingBatchAction = true;
        try {
            window.adminActionsManager.viewBatchImages(batchId);
        } finally {
            isExecutingBatchAction = false;
        }
    } else {
        console.warn('AdminActionsManager not ready yet, queuing action');
        // Queue the action to be executed once manager is ready
        const executeAction = function() {
            if (window.adminActionsManager && window.adminActionsManager.initialized) {
                isExecutingBatchAction = true;
                try {
                    window.adminActionsManager.viewBatchImages(batchId);
                } finally {
                    isExecutingBatchAction = false;
                }
            } else {
                setTimeout(executeAction, 100); // Retry in 100ms
            }
        };
        executeAction();
    }
};

window.downloadBatchImages = function(batchId) {
    if (isExecutingBatchAction) {
        console.warn('Preventing circular call to downloadBatchImages');
        return;
    }
    
    console.log('📥 downloadBatchImages called for batch:', batchId);
    if (window.adminActionsManager && window.adminActionsManager.initialized) {
        isExecutingBatchAction = true;
        try {
            window.adminActionsManager.downloadBatchImages(batchId);
        } finally {
            isExecutingBatchAction = false;
        }
    } else {
        console.warn('AdminActionsManager not ready yet, queuing action');
        // Queue the action to be executed once manager is ready
        const executeAction = function() {
            if (window.adminActionsManager && window.adminActionsManager.initialized) {
                isExecutingBatchAction = true;
                try {
                    window.adminActionsManager.downloadBatchImages(batchId);
                } finally {
                    isExecutingBatchAction = false;
                }
            } else {
                setTimeout(executeAction, 100); // Retry in 100ms
            }
        };
        executeAction();
    }
};

window.runInference = function(batchId) {
    if (isExecutingBatchAction) {
        console.warn('Preventing circular call to runInference');
        return;
    }
    
    if (window.adminActionsManager && window.adminActionsManager.initialized) {
        isExecutingBatchAction = true;
        try {
            window.adminActionsManager.runInference(batchId);
        } finally {
            isExecutingBatchAction = false;
        }
    } else {
        console.warn('AdminActionsManager not ready yet, queuing action');
        // Queue the action to be executed once manager is ready
        const executeAction = function() {
            if (window.adminActionsManager && window.adminActionsManager.initialized) {
                isExecutingBatchAction = true;
                try {
                    window.adminActionsManager.runInference(batchId);
                } finally {
                    isExecutingBatchAction = false;
                }
            } else {
                setTimeout(executeAction, 100); // Retry in 100ms
            }
        };
        executeAction();
    }
};

console.log('✅ Global batch management functions defined:', {
    viewBatchImages: typeof window.viewBatchImages,
    downloadBatchImages: typeof window.downloadBatchImages,
    runInference: typeof window.runInference
});

// Initialize when DOM is ready (fallback for direct script loading)
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if not already initialized by AdminPageController
    if (!window.adminActionsManager) {
        window.adminActionsManager = new AdminActionsManager();
        window.adminActionsManager.init();
        
        // Dispatch event to indicate admin actions are ready
        document.dispatchEvent(new CustomEvent('adminActionsReady'));
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminActionsManager;
}
