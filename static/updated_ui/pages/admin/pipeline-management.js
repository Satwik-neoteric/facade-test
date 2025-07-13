/**
 * PipelineManagement
 * Handles creation of new pipelines via the pipeline modal form
 */
class PipelineManagement {
    constructor(controller) {
        this.controller = controller;
        this.formId = 'pipelineForm';
        this.modalId = 'pipelineModal';
        this.nameInputId = 'pipelineFormName';
        this.versionInputId = 'pipelineFormVersion';
        this.amlIdInputId = 'pipelineFormAmlId';
        this.errorBoxId = 'pipelineModalError';
        this.saveBtnId = 'pipelineFormSaveBtn'; // ✅ Spinner button
    }

    /**
     * Initialize pipeline form submission listener
     */
    init() {
        const form = document.getElementById(this.formId);
        if (!form) {
            console.warn(`⚠️ Pipeline form (#${this.formId}) not found`);
            return;
        }

        form.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(event) {
        event.preventDefault();

        const saveBtn = document.getElementById(this.saveBtnId);
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }

        const name = document.getElementById(this.nameInputId)?.value?.trim();
        const version = document.getElementById(this.versionInputId)?.value?.trim();
        const amlId = document.getElementById(this.amlIdInputId)?.value?.trim();

        if (!name || !version || !amlId) {
            this.showError('All fields are required.');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Pipeline';
            }
            return;
        }

        const payload = { name, version, amlId, description: "No description provided" };

        try {
            const res = await fetch('/api/pipelines/inference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail || 'Failed to save pipeline.');
            }

            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('✅ Pipeline registered successfully');
            }

            this.hideError();
            this.resetForm();
            this.closeModal();
            this.controller.loadPipelines?.(); // Optional refresh

        } catch (err) {
            console.error('❌ Pipeline form submission error:', err);
            this.showError(err.message || 'Unexpected error occurred.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Pipeline';
            }
        }
    }

    /**
     * Show modal error
     */
    showError(message) {
        const box = document.getElementById(this.errorBoxId);
        if (box) {
            box.style.display = 'block';
            box.querySelector('span').textContent = message;
        }
    }

    /**
     * Hide modal error
     */
    hideError() {
        const box = document.getElementById(this.errorBoxId);
        if (box) {
            box.style.display = 'none';
            box.querySelector('span').textContent = '';
        }
    }

    /**
     * Reset form fields
     */
    resetForm() {
        document.getElementById(this.formId)?.reset();
    }

    /**
     * Close Bootstrap modal
     */
    closeModal() {
        const modalEl = document.getElementById(this.modalId);
        if (modalEl && typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    }
}

// Expose to global scope
window.PipelineManagement = PipelineManagement;
