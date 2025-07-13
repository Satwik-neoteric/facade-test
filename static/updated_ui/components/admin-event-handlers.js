/**
 * Admin Event Handlers - Handles all admin interface events and actions
 */

class AdminEventHandlers {
    constructor() {
        this.bindEventHandlers();
    }

    /**
     * Bind all event handlers
     */
    bindEventHandlers() {
        // User management events
        this.bindUserEvents();
        
        // Batch management events
        this.bindBatchEvents();
        
        // Building management events
        this.bindBuildingEvents();
        
        // Model management events
        this.bindModelEvents();
        
        // Pipeline management events
        this.bindPipelineEvents();
    }

    /**
     * Bind user management events
     */
    bindUserEvents() {
        // Edit user
        window.editUser = (userId) => {
            console.log('Edit user:', userId);
            this.handleEditUser(userId);
        };

        // Delete user
        window.deleteUser = (userId) => {
            console.log('Delete user:', userId);
            this.handleDeleteUser(userId);
        };
    }

    /**
     * Bind batch management events
     */
    bindBatchEvents() {
        // Note: Global batch functions are now handled by AdminActionsManager in admin-actions.js
        // This prevents conflicts and circular calls
        console.log('Batch event binding delegated to AdminActionsManager');
    }

    /**
     * Bind building management events
     */
    bindBuildingEvents() {
        // Edit building
        window.editBuilding = (buildingId) => {
            console.log('Edit building:', buildingId);
            this.handleEditBuilding(buildingId);
        };

        // Delete building
        window.deleteBuilding = (buildingId) => {
            console.log('Delete building:', buildingId);
            this.handleDeleteBuilding(buildingId);
        };
    }

    /**
     * Bind model management events
     */
    bindModelEvents() {
        // Edit model
        window.editModel = (modelId) => {
            console.log('Edit model:', modelId);
            this.handleEditModel(modelId);
        };

        // Delete model
        window.deleteModel = (modelId) => {
            console.log('Delete model:', modelId);
            this.handleDeleteModel(modelId);
        };
    }

    /**
     * Bind pipeline management events
     */
    bindPipelineEvents() {
        // Edit pipeline
        window.editPipeline = (pipelineId) => {
            console.log('Edit pipeline:', pipelineId);
            this.handleEditPipeline(pipelineId);
        };

        // Delete pipeline
        window.deletePipeline = (pipelineId) => {
            console.log('Delete pipeline:', pipelineId);
            this.handleDeletePipeline(pipelineId);
        };

        // Run pipeline
        window.runPipeline = (pipelineId) => {
            console.log('Run pipeline:', pipelineId);
            this.handleRunPipeline(pipelineId);
        };
    }

    /**
     * Handle edit user
     */
    async handleEditUser(userId) {
        try {
            // Find the user and show edit modal
            if (typeof showEditUserModal === 'function') {
                const response = await fetch('/api/admin/users');
                const data = await response.json();
                const users = Array.isArray(data) ? data : (data.users || []);
                const user = users.find(u => u.id === userId);
                
                if (user) {
                    showEditUserModal(user);
                } else {
                    console.error('User not found:', userId);
                    this.showError('User not found');
                }
            } else {
                console.error('showEditUserModal function not available');
                this.showError('Edit user functionality not available');
            }
        } catch (error) {
            console.error('Error finding user:', error);
            this.showError('Error loading user data');
        }
    }

    /**
     * Handle delete user
     */
    async handleDeleteUser(userId) {
        if (!confirm('Are you sure you want to remove this user?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Reload users after successful deletion
                if (typeof loadADUsers === 'function') {
                    loadADUsers();
                } else if (window.dashboardStatsManager) {
                    window.dashboardStatsManager.loadSectionStats('users');
                }
                this.showSuccess('User deleted successfully');
            } else {
                throw new Error('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError('Failed to delete user. Please try again.');
        }
    }

    /**
     * Handle view batch images
     */
    handleViewBatchImages(batchId) {
        // Delegate to AdminActionsManager if available
        if (window.adminActionsManager && window.adminActionsManager.viewBatchImages) {
            window.adminActionsManager.viewBatchImages(batchId);
        } else {
            console.log('AdminActionsManager not available for viewing batch images');
            this.showError('Batch viewing functionality not available');
        }
    }

    /**
     * Handle run inference
     */
    handleRunInference(batchId) {
        // Delegate to AdminActionsManager if available
        if (window.adminActionsManager && window.adminActionsManager.runInference) {
            window.adminActionsManager.runInference(batchId);
        } else {
            console.log('AdminActionsManager not available for running inference');
            this.showError('Inference functionality not available');
        }
    }

    /**
     * Handle expand batch
     */
    handleExpandBatch(batchId) {
        // Same as view batch images - just delegate
        this.handleViewBatchImages(batchId);
    }

    /**
     * Handle download batch
     */
    handleDownloadBatch(batchId) {
        // Delegate to AdminActionsManager if available
        if (window.adminActionsManager && window.adminActionsManager.downloadBatchImages) {
            window.adminActionsManager.downloadBatchImages(batchId);
        } else {
            console.log('AdminActionsManager not available for downloading batch images');
            this.showError('Batch download functionality not available');
        }
    }

    /**
     * Handle edit building
     */
    handleEditBuilding(buildingId) {
        // This should integrate with existing building edit functionality
        console.log('Building edit not yet implemented');
        this.showError('Building edit functionality not yet implemented');
    }

    /**
     * Handle delete building
     */
    handleDeleteBuilding(buildingId) {
        if (!confirm('Are you sure you want to delete this building?')) {
            return;
        }
        
        // Implement building deletion
        console.log('Building deletion not yet implemented');
        this.showError('Building deletion functionality not yet implemented');
    }

    /**
     * Handle edit model
     */
    handleEditModel(modelId) {
        // This should integrate with existing model edit functionality
        console.log('Model edit not yet implemented');
        this.showError('Model edit functionality not yet implemented');
    }

    /**
     * Handle delete model
     */
    handleDeleteModel(modelId) {
        if (!confirm('Are you sure you want to delete this model?')) {
            return;
        }
        
        // Implement model deletion
        console.log('Model deletion not yet implemented');
        this.showError('Model deletion functionality not yet implemented');
    }

    /**
     * Handle edit pipeline
     */
    handleEditPipeline(pipelineId) {
        // This should integrate with existing pipeline edit functionality
        console.log('Pipeline edit not yet implemented');
        this.showError('Pipeline edit functionality not yet implemented');
    }

    /**
     * Handle delete pipeline
     */
    handleDeletePipeline(pipelineId) {
        if (!confirm('Are you sure you want to delete this pipeline?')) {
            return;
        }
        
        // Implement pipeline deletion
        console.log('Pipeline deletion not yet implemented');
        this.showError('Pipeline deletion functionality not yet implemented');
    }

    /**
     * Handle run pipeline
     */
    handleRunPipeline(pipelineId) {
        // This should integrate with existing pipeline run functionality
        console.log('Pipeline run not yet implemented');
        this.showError('Pipeline run functionality not yet implemented');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        // Implement success notification
        console.log('Success:', message);
        // You can integrate with your existing notification system here
    }

    /**
     * Show error message
     */
    showError(message) {
        // Implement error notification
        console.error('Error:', message);
        // You can integrate with your existing notification system here
        alert(message); // Fallback for now
    }
}

// Export for use in other modules
window.AdminEventHandlers = AdminEventHandlers;
