/**
 * Batch Management System for Admin
 * Enhanced with loading spinners for all major operations
 */
class BatchManagementSystem {
    constructor() {
        this.apiEndpoints = {
            registerBatch: '/api/admin/batches',
            uploadImages: '/api/admin/batches/{batch_id}/images',
            runInference: '/api/admin/batches/{batch_id}/inference',
            getBatchStatus: '/api/admin/batches/{batch_id}/status',
            downloadBatch: '/api/admin/batches/{batch_id}/download',
            getBatchImages: '/api/admin/batches/{batch_id}/images'
        };

        this.state = {
            batches: [],
            categories: [],
            models: [],
            currentBatch: null
        };

        this.init();
    }

    init() {
        console.log('🚀 Initializing Batch Management System');
        this.setupEventHandlers();
        this.loadCategories();
        this.loadModels();
    }

    setupEventHandlers() {
        const registerForm = document.getElementById('register-batch-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registerBatch();
            });
        }

        const uploadForm = document.getElementById('upload-images-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.uploadImages();
            });
        }

        const inferenceForm = document.getElementById('run-inference-form');
        if (inferenceForm) {
            inferenceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.runInference();
            });
        }
    }

    async registerBatch() {
        const batchId = document.getElementById('batch-id').value;
        const description = document.getElementById('batch-description').value;
        const categories = Array.from(document.getElementById('batch-categories').selectedOptions).map(o => o.value);

        const saveBtn = document.getElementById('registerBatchBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }

        try {
            const response = await fetch(this.apiEndpoints.registerBatch, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_id: batchId, description, categories })
            });

            if (!response.ok) throw new Error(await response.text());
            ToastManager.success(`Batch "${batchId}" registered successfully`);
            bootstrap.Modal.getInstance(document.getElementById('register-batch-modal')).hide();
            document.getElementById('register-batch-form').reset();
            window.refreshAdminData();
        } catch (error) {
            ToastManager.error(`Failed to register batch: ${error}`);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Register Batch';
            }
        }
    }

    async uploadImages() {
        const batchId = document.getElementById('upload-batch-id').value;
        const files = document.getElementById('image-files').files;
        const override = document.getElementById('override-existing').checked;

        const saveBtn = document.getElementById('uploadImagesBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
        }

        try {
            const formData = new FormData();
            for (const file of files) formData.append('files', file);
            formData.append('override', override);

            const url = this.apiEndpoints.uploadImages.replace('{batch_id}', batchId);
            const response = await fetch(url, { method: 'POST', body: formData });

            if (!response.ok) throw new Error(await response.text());
            ToastManager.success(`${files.length} images uploaded to batch "${batchId}" successfully`);
            bootstrap.Modal.getInstance(document.getElementById('upload-images-modal')).hide();
            document.getElementById('upload-images-form').reset();
            window.refreshAdminData();
        } catch (error) {
            ToastManager.error(`Upload failed: ${error}`);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>Upload Images';
            }
        }
    }

    async runInference() {
        const batchId = document.getElementById('inference-batch-id').value;
        const modelId = document.getElementById('inference-model1').value;

        const saveBtn = document.getElementById('runInferenceBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...';
        }

        try {
            const url = this.apiEndpoints.runInference.replace('{batch_id}', batchId);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelId, parameters: {} })
            });

            if (!response.ok) throw new Error(await response.text());
            ToastManager.success(`Inference started for batch "${batchId}"`);
            bootstrap.Modal.getInstance(document.getElementById('run-inference-modal')).hide();
            document.getElementById('run-inference-form').reset();
            window.refreshAdminData();
        } catch (error) {
            ToastManager.error(`Failed to run inference: ${error}`);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>Run Inference';
            }
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.batchManagement = new BatchManagementSystem();
});
