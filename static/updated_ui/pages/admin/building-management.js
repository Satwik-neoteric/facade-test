/**
 * BuildingManagement
 * Handles building form submission from #buildingModal
 */
class BuildingManagement {
    constructor(controller) {
        this.controller = controller;
        this.formId = 'buildingForm';
        this.modalId = 'buildingModal';
        this.nameFieldId = 'buildingName';
        this.addressFieldId = 'buildingAddress';
        this.errorBoxId = 'buildingModalError';
        this.saveBtnId = 'buildingFormSaveBtn'; // NEW: Save button ID
    }

    /**
     * Initialize building form listener
     */
    init() {
        const form = document.getElementById(this.formId);
        if (!form) {
            console.warn(`⚠️ Building form (#${this.formId}) not found`);
            return;
        }

        form.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    /**
     * Handle form submit
     */
    async handleFormSubmit(e) {
        e.preventDefault();

        const saveBtn = document.getElementById(this.saveBtnId);
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }

        const name = document.getElementById(this.nameFieldId)?.value?.trim();
        const address = document.getElementById(this.addressFieldId)?.value?.trim();

        if (!name || !address) {
            this.showError('Both building name and address are required.');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Building';
            }
            return;
        }

        const payload = { name, address };

        try {
            const response = await fetch('/api/buildings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to register building.');
            }

            // On success
            this.hideError();
            this.resetForm();
            this.closeModal();
            this.controller.loadBuildings();

            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('🏢 Building registered successfully!');
            }

        } catch (err) {
            console.error('❌ Error submitting building form:', err);
            this.showError(err.message || 'Something went wrong.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Building';
            }
        }
    }

    /**
     * Display error message
     */
    showError(message) {
        const box = document.getElementById(this.errorBoxId);
        if (box) {
            box.style.display = 'block';
            box.querySelector('span').textContent = message;
        }
    }

    /**
     * Hide error box
     */
    hideError() {
        const box = document.getElementById(this.errorBoxId);
        if (box) {
            box.style.display = 'none';
            box.querySelector('span').textContent = '';
        }
    }

    /**
     * Reset the form fields
     */
    resetForm() {
        document.getElementById(this.formId)?.reset();
    }

    /**
     * Close modal (Bootstrap API)
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

// Expose globally
window.BuildingManagement = BuildingManagement;
