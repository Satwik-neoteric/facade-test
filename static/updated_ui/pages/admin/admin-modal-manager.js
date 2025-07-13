/**
 * Admin Modal Manager
 * Handles all modal-related functionality for the admin interface
 */
class AdminModalManager {
    constructor(controller) {
        this.controller = controller;
        
        // Centralized button to modal mapping (single source of truth)
        this.buttonModalMap = {
            'create-user-btn': 'user-modal',
            'register-batch-btn': 'register-batch-modal',
            'upload-images-btn': 'upload-images-modal',
            'run-inference-btn': 'run-inference-modal',
            'create-category-btn': 'category-modal',
            'openBuildingModalBtn': 'buildingModal',
            'openModelModalBtn': 'modelModal',
            'openPipelineModalBtn': 'pipelineModal'
        };
        
        this.init();
    }

    /**
     * Initialize modal manager
     */
    init() {
        this.initializeAllModals();
        this.setupModalButtonHandlers();
    }

    /**
     * Setup modal button handlers for "Add" buttons (simplified)
     */
    setupModalButtonHandlers() {
        // Use event delegation on document body to handle ALL button clicks
        if (!document.body.hasAttribute('data-modal-delegation-attached')) {
            document.body.setAttribute('data-modal-delegation-attached', 'true');
            
            document.body.addEventListener('click', (e) => {
                // Check if clicked element or its parent has a modal mapping
                let target = e.target;
                let modalId = null;
                
                // Traverse up the DOM tree to find a button with modal mapping
                while (target && target !== document.body) {
                    if (target.id && this.buttonModalMap[target.id]) {
                        modalId = this.buttonModalMap[target.id];
                        break;
                    }
                    target = target.parentElement;
                }
                
                if (modalId) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openModal(modalId);
                }
            });
        }
    }

    /**
     * Initialize all modals for proper positioning
     */
    initializeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            this.ensureModalPositioning(modal);
        });
    }

    /**
     * Open a modal by ID using Bootstrap Modal with enhanced positioning
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return;
        }

        try {
            // Close any existing modals first
            this.closeAllModals();
            
            // Ensure proper positioning before showing
            this.ensureModalPositioning(modal);
            
            // Try Bootstrap modal first
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const bootstrapModal = new bootstrap.Modal(modal, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
                bootstrapModal.show();
            } else {
                // Fallback to manual modal handling
                this.showModalManually(modal);
            }
        } catch (error) {
            console.error('Error opening modal:', error);
            // Fallback to manual modal handling
            this.showModalManually(modal);
        }
    }

    /**
     * Ensure modal is properly positioned in DOM structure
     */
    ensureModalPositioning(modal) {
        // Ensure modal is a direct child of body for proper z-index layering
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }

        // Reset any inline styles that might interfere
        modal.style.display = '';
        modal.style.position = '';
        modal.style.zIndex = '';
        
        // Ensure modal has proper classes for Bootstrap
        if (!modal.classList.contains('modal')) {
            modal.classList.add('modal');
        }
        if (!modal.classList.contains('fade')) {
            modal.classList.add('fade');
        }

        // Ensure modal-dialog has proper positioning
        const modalDialog = modal.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.style.position = '';
            modalDialog.style.zIndex = '';
            modalDialog.style.margin = '';
            modalDialog.style.transform = '';
        }
    }

    /**
     * Show modal manually with proper styling and positioning
     */
    showModalManually(modal) {
        // Ensure modal positioning first
        this.ensureModalPositioning(modal);
        
        // Add required modal classes
        modal.classList.add('modal', 'fade', 'show');
        modal.style.display = 'block';
        modal.style.zIndex = '1055';
        modal.setAttribute('aria-hidden', 'false');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('role', 'dialog');
        
        // Ensure modal dialog is centered
        const modalDialog = modal.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.style.margin = '1.75rem auto';
            modalDialog.style.transform = 'none';
            modalDialog.style.position = 'relative';
        }
        
        // Create backdrop
        this.createModalBackdrop();
        
        // Prevent body scroll and add Bootstrap classes
        document.body.classList.add('modal-open');
        
        // Focus on modal for accessibility
        modal.focus();
    }

    /**
     * Create modal backdrop
     */
    createModalBackdrop() {
        // Remove any existing backdrop
        const existingBackdrop = document.querySelector('.modal-backdrop');
        if (existingBackdrop) {
            existingBackdrop.remove();
        }
        
        // Create new backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.style.zIndex = '1050'; // Ensure proper z-index
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        document.body.appendChild(backdrop);
        
        // Add click handler to close modal
        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeAllModals();
        });
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        // Close Bootstrap modals properly
        document.querySelectorAll('.modal').forEach(modal => {
            // Try Bootstrap modal first
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }
            
            // Manual cleanup
            modal.classList.remove('show');
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            modal.removeAttribute('aria-modal');
            modal.removeAttribute('role');
        });
        
        // Remove all backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });
        
        // Restore body scroll and clean up classes
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('modal-open');
    }

    /**
     * Handle modal close events in click handler
     */
    handleModalCloseClick(e) {
        // Handle modal close buttons
        if (e.target.matches('[data-bs-dismiss="modal"], .modal-close, .btn-close')) {
            e.preventDefault();
            this.closeAllModals();
            return true;
        }

        // Click outside modal to close
        if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
            e.preventDefault();
            this.closeAllModals();
            return true;
        }

        return false;
    }

    /**
     * Reinitialize modal handlers (simplified - delegation handles this automatically)
     */
    reinitializeModalHandlers() {
        // With event delegation, we don't need to manually reattach handlers
        // The delegation listener will automatically handle new buttons
    }

    /**
     * Refresh all modal button handlers to ensure they remain functional
     * Call this after modal close operations to prevent stuck buttons
     */
    refreshModalButtonHandlers() {
        // Clear any stuck event handlers and reinitialize
        this.reinitializeModalHandlers();
    }

    /**
     * Get button modal mapping
     */
    getButtonModalMap() {
        return { ...this.buttonModalMap };
    }

    /**
     * Add new button to modal mapping
     */
    addButtonModalMapping(buttonId, modalId) {
        this.buttonModalMap[buttonId] = modalId;
    }

    /**
     * Remove button from modal mapping
     */
    removeButtonModalMapping(buttonId) {
        delete this.buttonModalMap[buttonId];
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminModalManager;
}

// Expose to window for direct access
window.AdminModalManager = AdminModalManager;
