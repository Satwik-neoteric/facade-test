class AdminSectionManager {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.components = controller.components;

        this.apiEndpoints = {
            users: ['/api/admin/users'],
            buildings: ['/api/buildings'],
            pipelines: ['/api/pipelines/inference'],
            batches: ['/api/admin/batches'],
            models: ['/api/models/inference']
        };

        this.refreshButton = null;
    }

    async loadInitialData() {
        this.state.loading = true;
        console.log('🚀 Admin Section Manager: Starting data loading...');

        try {
            await this.loadSectionsInOrder([
                ['buildings', 'pipelines'], // Critical
                ['batches', 'models'],
                ['users']                    // Dependent
            ]);
            this.finalizeInitialLoad();
        } catch (error) {
            console.error('❌ Critical error during initial data loading:', error);
            this.handleLoadingError(error);
        } finally {
            this.state.loading = false;
        }
    }

    async loadSectionsInOrder(sectionGroups) {
        for (const group of sectionGroups) {
            console.log(`📦 Loading group in parallel: [${group.join(', ')}]`);
            await Promise.all(group.map(section => this.loadSectionData(section)));
            console.log(`✅ Group loaded: [${group.join(', ')}]`);
        }
    }

    async loadSectionData(section) {
        const endpointList = this.apiEndpoints[section];
        try {
            this.showLoadingState(section);
            const data = await this.fetchWithFallback(endpointList);

            let processedData = Array.isArray(data) ? data : data[section] || [];

            if (section === 'batches') {
                processedData = this.enhanceBatchData(processedData);
            }

            if (section === 'models') {
                processedData = this.enhanceModelData(processedData);
            }

            this.state.data[section] = processedData;
            this.updateUIForSection(section);

            console.log(`✅ ${section} loaded: ${processedData.length} items`);
        } catch (error) {
            this.handleSectionLoadError(section, error);
        }
    }

    async refreshSection(section) {
        console.log(`🔄 Refreshing section: ${section}`);

        if (!this.refreshButton) {
            this.refreshButton = document.querySelector('button[onclick="window.refreshAdminData()"]');
        }

        if (this.refreshButton) {
            this.refreshButton.disabled = true;
            this.refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';
        }

        try {
            await this.loadSectionData(section);
            if (typeof ToastManager !== 'undefined') {
                const count = this.state.data[section]?.length || 0;
                ToastManager.success(`Refreshed ${section}: ${count} items`);
            }
        } catch (error) {
            this.handleSectionLoadError(section, error);
        } finally {
            if (this.refreshButton) {
                this.refreshButton.disabled = false;
                this.refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh Data';
            }
        }
    }

    async fetchWithFallback(endpoints) {
        let lastError = null;
        for (const endpoint of endpoints) {
            try {
                console.log(`🌐 Trying endpoint: ${endpoint}`);
                const response = await fetch(endpoint);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ Endpoint successful: ${endpoint}`);
                    return data;
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.warn(`⚠️ Endpoint failed: ${endpoint} - ${error.message}`);
                lastError = error;
            }
        }
        throw new Error(`All endpoints failed. Last error: ${lastError?.message}`);
    }

    enhanceBatchData(batchData) {
        return batchData.map(batch => ({
            ...batch,
            displayName: batch.batch_id || batch.id || 'Unknown Batch',
            statusClass: this.getBatchStatusClass(batch.status),
            lastModifiedDisplay: this.formatDate(batch.last_modified || batch.created_date),
            imageCountDisplay: this.formatImageCount(batch.image_count || 0)
        }));
    }

    enhanceModelData(modelData) {
        return modelData.map(model => ({
            ...model,
            displayName: model.ModelName || 'Unknown Model',
            modelType: model.AzureModelName || 'Unknown Type',
            version: model.Version || 'N/A'
        }));
    }

    showLoadingState(section) {
        if (this.components.cardsManager) {
            this.components.cardsManager.showLoading(section);
        }
        const loader = document.getElementById(`${section}-loading`);
        if (loader) loader.style.display = 'inline-block';
    }

    updateUIForSection(section) {
        const data = this.state.data[section];
        if (this.components.statsManager) {
            this.components.statsManager.updateSectionStats(section, data);
        }
        if (this.components.cardsManager) {
            this.components.cardsManager.hideLoading(section);
            this.components.cardsManager.renderSection(section, data);
        }
        if (this.state.currentSection === section) {
            const sectionElement = document.getElementById(`${section}-section`);
            if (sectionElement) {
                sectionElement.classList.remove('hidden');
            }
        }
        const loader = document.getElementById(`${section}-loading`);
        if (loader) loader.style.display = 'none';
    }

    handleSectionLoadError(section, error) {
        console.error(`❌ Section load error (${section}):`, error);
        if (this.components.cardsManager) {
            this.components.cardsManager.hideLoading(section);
            this.components.cardsManager.showError(section, `Unable to load ${section} data.`);
        }
        const loader = document.getElementById(`${section}-loading`);
        if (loader) loader.style.display = 'none';
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error(`Failed to load ${section} data: ${error.message}`);
        }
    }

    handleLoadingError(error) {
        console.error('❌ General loading error:', error);
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Failed to load admin data. Please refresh the page.');
        }
    }

    finalizeInitialLoad() {
        if (!this.state.currentSection) {
            this.controller.switchSection('batches');
        }
        if (typeof ToastManager !== 'undefined') {
            ToastManager.success('Admin data loaded');
        }
    }

    getBatchStatusClass(status) {
        const statusMap = {
            'completed': 'success',
            'processing': 'warning',
            'failed': 'danger',
            'pending': 'secondary'
        };
        return statusMap[status?.toLowerCase()] || 'secondary';
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    formatImageCount(count) {
        if (count === 0) return 'No images';
        if (count === 1) return '1 image';
        return `${count.toLocaleString()} images`;
    }
}

window.AdminSectionManager = AdminSectionManager;
console.log('✅ Optimized AdminSectionManager loaded with ordered parallel loading');
