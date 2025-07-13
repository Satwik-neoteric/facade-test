/**
 * Main Admin Cards Manager - Orchestrates all admin interface components
 * This is the main controller that uses all the component modules
 */

class AdminCardsManager {
    constructor() {
        // Check for required dependencies
        if (typeof CardFactory === 'undefined') {
            throw new Error('CardFactory is not available. Ensure it is loaded before AdminCardsManager.');
        }
        if (typeof TableFactory === 'undefined') {
            throw new Error('TableFactory is not available. Ensure it is loaded before AdminCardsManager.');
        }
        if (typeof PaginationManager === 'undefined') {
            throw new Error('PaginationManager is not available. Ensure it is loaded before AdminCardsManager.');
        }
        
        // Initialize component dependencies
        this.cardFactory = new CardFactory();
        this.tableFactory = new TableFactory();
        this.paginationManager = new PaginationManager(5); // 5 items per page
        
        // Wait for DOM to be ready before finding containers
        this.containerLookupRetries = 0;
        this.maxContainerLookupRetries = 10;
        
        this.findContainers();
        
        // Initialize sections
        this.initializeSections();
        
        // Setup dark mode compatibility
        setTimeout(() => this.ensureDarkModeCompat(), 100);
    }

    /**
     * Find containers with retry logic
     */
    findContainers() {
        // Container references with fallback options
        this.containers = {
            users: document.getElementById('users-table-container'),
            batches: document.getElementById('batches-table-container'),
            buildings: document.getElementById('buildings-container'),
            models: document.getElementById('models-container'),
            pipelines: document.getElementById('pipelines-container')
        };
        
        // Log container status for debugging
        console.log('🔍 AdminCardsManager containers lookup:', this.containers);
        const missingContainers = [];
        
        Object.entries(this.containers).forEach(([key, container]) => {
            if (!container) {
                console.warn(`❌ Container not found for ${key}`);
                missingContainers.push(key);
            } else {
                console.log(`✅ Container found for ${key}:`, container.id);
            }
        });
        
        // Retry if we're missing containers and haven't exceeded retry limit
        if (missingContainers.length > 0 && this.containerLookupRetries < this.maxContainerLookupRetries) {
            this.containerLookupRetries++;
            console.log(`🔄 Retrying container lookup (${this.containerLookupRetries}/${this.maxContainerLookupRetries})...`);
            setTimeout(() => this.findContainers(), 500);
        } else if (missingContainers.length > 0) {
            console.error(`💥 Failed to find containers after ${this.maxContainerLookupRetries} retries:`, missingContainers);
        }
    }

    /**
     * Initialize pagination for all sections
     */
    initializeSections() {
        const sections = ['users', 'batches', 'buildings', 'models', 'pipelines'];
        sections.forEach(section => {
            this.paginationManager.initSection(section);
        });
    }

    /**
     * Generic render method for any section
     */
    renderSection(section, data, renderType = 'auto') {
        console.log(`Rendering ${section} with ${data?.length || 0} items`);
        
        // Set data in pagination manager
        this.paginationManager.setData(section, data);
        
        // Get paginated data
        const paginatedData = this.paginationManager.getPaginatedData(section);
        
        // Render based on section type and render type
        if (renderType === 'auto') {
            renderType = this.getDefaultRenderType(section);
        }
        
        if (renderType === 'table') {
            this.renderTable(section, paginatedData);
        } else {
            this.renderCards(section, paginatedData);
        }
        
        // Add pagination controls if needed
        this.addPaginationControls(section);
        
        // Ensure dark mode compatibility
        this.ensureDarkModeCompat();
        
        console.log(`✅ Section ${section} rendering completed successfully`);
    }

    /**
     * Get default render type for a section
     */
    getDefaultRenderType(section) {
        const tableTypes = ['users', 'batches', 'buildings', 'models', 'pipelines'];
        return tableTypes.includes(section) ? 'table' : 'cards';
    }

    /**
     * Render table view
     */
    renderTable(section, data) {
        let container = this.containers[section];
        
        // If container not found, try to find it again
        if (!container) {
            console.warn(`🔍 Container for ${section} not found, searching again...`);
            container = document.getElementById(`${section}-table-view`) || 
                       document.getElementById(`${section}-table-container`) ||
                       document.getElementById(`${section}-cards-container`);
            
            if (container) {
                console.log(`✅ Found container for ${section}:`, container.id);
                this.containers[section] = container;
            }
        }
        
        if (!container) {
            console.error(`❌ Container not found for section: ${section}`);
            console.log('Available containers:', Object.keys(this.containers));
            
            // Try to create a fallback message in any admin section
            const fallbackContainer = document.querySelector(`#${section}-section`);
            if (fallbackContainer) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg m-4';
                errorDiv.innerHTML = `
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-500 mr-3 text-lg"></i>
                        <span class="text-red-800 dark:text-red-200 font-medium">
                            Table container not found for ${section}. Please refresh the page.
                        </span>
                    </div>
                `;
                fallbackContainer.appendChild(errorDiv);
            }
            return;
        }

        console.log(`🖼️ Rendering table for ${section} with ${data?.length || 0} items in container:`, container.id);
        console.log(`🖼️ Data to render:`, data);

        let tableHTML = '';
        
        if (!data || data.length === 0) {
            const originalData = this.paginationManager.originalData[section];
            if (originalData && originalData.length === 0) {
                tableHTML = this.tableFactory.createEmptyState({
                    icon: this.getSectionIcon(section),
                    title: `No ${section.charAt(0).toUpperCase() + section.slice(1)} Found`,
                    message: this.getEmptyMessage(section)
                });
            } else {
                tableHTML = this.tableFactory.createPaginationEmptyState({
                    icon: this.getSectionIcon(section),
                    type: section
                });
            }
        } else {
            const createMethod = `create${section.charAt(0).toUpperCase() + section.slice(1)}Table`;
            console.log(`Calling TableFactory method: ${createMethod}`);
            
            if (typeof this.tableFactory[createMethod] === 'function') {
                tableHTML = this.tableFactory[createMethod](data);
                console.log(`✅ Table HTML generated for ${section}`);
            } else {
                console.error(`❌ TableFactory method not found: ${createMethod}`);
                tableHTML = `
                    <div class="p-6 text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <i class="fas fa-exclamation-triangle text-yellow-500 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Table Method Missing</h3>
                        <p class="text-yellow-600 dark:text-yellow-300">Method ${createMethod} not found in TableFactory</p>
                    </div>
                `;
            }
        }

        // Clear any existing content including initial loading states
        container.innerHTML = tableHTML;
        console.log(`✅ Table rendered for ${section}`);
    }

    /**
     * Render cards view
     */
    renderCards(section, data) {
        const container = this.containers[section];
        if (!container) {
            console.error(`Container not found for section: ${section}`);
            return;
        }

        container.innerHTML = '';
        container.classList.remove('hidden');

        if (!data || data.length === 0) {
            const originalData = this.paginationManager.originalData[section];
            if (originalData.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <i class="${this.getSectionIcon(section)} text-4xl text-gray-400 mb-4"></i>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No ${section.charAt(0).toUpperCase() + section.slice(1)} Found</h3>
                        <p class="text-gray-600 dark:text-gray-300">${this.getEmptyMessage(section)}</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <i class="${this.getSectionIcon(section)} text-4xl text-gray-400 mb-4"></i>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No ${section.charAt(0).toUpperCase() + section.slice(1)} on This Page</h3>
                        <p class="text-gray-600 dark:text-gray-300">Try navigating to a different page.</p>
                    </div>
                `;
            }
            return;
        }

        // Create cards using card factory
        const createMethod = `create${section.charAt(0).toUpperCase() + section.slice(1).slice(0, -1)}Card`;
        data.forEach(item => {
            if (typeof this.cardFactory[createMethod] === 'function') {
                const card = this.cardFactory[createMethod](item);
                container.appendChild(card);
            }
        });
    }

    /**
     * Add pagination controls
     */
    addPaginationControls(section) {
        const needsPagination = this.paginationManager.needsPagination(section);
        console.log(`📄 Adding pagination controls for ${section}: needsPagination = ${needsPagination}`);
        
        if (!needsPagination) {
            console.log(`📄 No pagination needed for ${section}`);
            return;
        }

        const container = this.containers[section];
        if (!container) {
            console.warn(`📄 No container found for section: ${section}`);
            return;
        }

        // Create wrapper if it doesn't exist
        let wrapper = container.parentElement;
        if (!wrapper.classList.contains('admin-section-wrapper')) {
            const newWrapper = document.createElement('div');
            newWrapper.className = 'admin-section-wrapper';
            container.parentElement.insertBefore(newWrapper, container);
            newWrapper.appendChild(container);
            wrapper = newWrapper;
        }

        // Remove existing pagination
        const existingPagination = wrapper.querySelector('.pagination-controls');
        if (existingPagination) {
            existingPagination.remove();
        }

        // Add new pagination
        const paginationHTML = this.paginationManager.createPaginationControls(
            section, 
            'window.handleAdminPagination'
        );
        
        if (paginationHTML) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls rounded-b-lg';
            paginationDiv.innerHTML = paginationHTML;
            wrapper.appendChild(paginationDiv);
            console.log(`✅ Pagination controls added for ${section}`);
        } else {
            console.warn(`❌ No pagination HTML generated for ${section}`);
        }
    }

    /**
     * Handle page change events - client-side only, no refresh
     */
    handlePageChange(section, action) {
        console.log(`📄 Client-side pagination: ${section} - ${action}`);
        
        let changed = false;
        
        if (action === 'prev') {
            changed = this.paginationManager.previousPage(section);
        } else if (action === 'next') {
            changed = this.paginationManager.nextPage(section);
        } else if (typeof action === 'number') {
            changed = this.paginationManager.goToPage(section, action);
        }
        
        console.log(`📄 Pagination change result: ${changed}`);
        
        if (changed) {
            // Re-render with the new page data (no API call)
            this.renderCurrentPage(section);
        }
    }

    /**
     * Render current page without making API calls
     */
    renderCurrentPage(section) {
        console.log(`🔄 Re-rendering current page for section: ${section}`);
        
        // Get the paginated data for current page
        const paginatedData = this.paginationManager.getPaginatedData(section);
        
        // Render based on section type
        const renderType = this.getDefaultRenderType(section);
        
        if (renderType === 'table') {
            this.renderTable(section, paginatedData);
        } else {
            this.renderCards(section, paginatedData);
        }
        
        // Update pagination controls to reflect new page
        this.updatePaginationControls(section);
        
        console.log(`✅ Page re-rendered for ${section}`);
    }

    /**
     * Update pagination controls without recreating them
     */
    updatePaginationControls(section) {
        const container = this.containers[section];
        if (!container) return;

        const wrapper = container.parentElement;
        if (!wrapper || !wrapper.classList.contains('admin-section-wrapper')) return;

        const existingPagination = wrapper.querySelector('.pagination-controls');
        if (!existingPagination) return;

        // Get current pagination info
        const info = this.paginationManager.getPaginationInfo(section);
        
        // Update pagination info text
        const infoElements = existingPagination.querySelectorAll('p');
        infoElements.forEach(p => {
            if (p.textContent.includes('Showing')) {
                p.innerHTML = info.totalItems > 0 
                    ? `Showing <span class="font-medium">${info.startItem}</span> to <span class="font-medium">${info.endItem}</span> of <span class="font-medium">${info.totalItems}</span> results`
                    : 'No results found';
            }
        });

        // Update button states
        const prevButtons = existingPagination.querySelectorAll('button[onclick*="prev"]');
        const nextButtons = existingPagination.querySelectorAll('button[onclick*="next"]');
        
        prevButtons.forEach(btn => {
            if (info.currentPage === 1) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        nextButtons.forEach(btn => {
            if (info.currentPage === info.totalPages) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        // Update page number buttons
        const pageNumberContainer = existingPagination.querySelector('nav');
        if (pageNumberContainer) {
            // Remove existing page number buttons (keep prev/next)
            const pageButtons = pageNumberContainer.querySelectorAll('button:not([onclick*="prev"]):not([onclick*="next"])');
            pageButtons.forEach(btn => btn.remove());

            // Insert new page number buttons
            const nextButton = pageNumberContainer.querySelector('button[onclick*="next"]');
            if (nextButton) {
                const newPageNumbers = this.paginationManager.createPageNumbers(section, info.currentPage, info.totalPages, 'window.handleAdminPagination');
                nextButton.insertAdjacentHTML('beforebegin', newPageNumbers);
            }
        }

        console.log(`📄 Pagination controls updated for ${section} - page ${info.currentPage}/${info.totalPages}`);
    }

    /**
     * Refresh a specific section (server call)
     */
    refreshSection(section) {
        console.log(`🔄 Refreshing section from server: ${section}`);
        
        // Use the showLoading method instead of directly setting innerHTML
        this.showLoading(section);
        
        // Trigger refresh through global admin controller if available
        if (window.adminPageController && window.adminPageController.sectionManager) {
            window.adminPageController.sectionManager.refreshSection(section);
        } else {
            console.warn('⚠️ Admin page controller not available for refresh');
        }
    }

    /**
     * Force refresh from server (public method)
     */
    forceRefresh(section) {
        this.refreshSection(section);
    }

    /**
     * Render section with enhanced error handling
     */
    renderSectionSafe(section, data, renderType = 'auto') {
        try {
            this.renderSection(section, data, renderType);
        } catch (error) {
            console.error(`❌ Error rendering ${section}:`, error);
            
            // Show error message in container
            const container = this.containers[section];
            if (container) {
                container.innerHTML = `
                    <div class="p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl mb-4"></i>
                        <h3 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Rendering Error</h3>
                        <p class="text-red-600 dark:text-red-300 mb-4">Failed to render ${section} table</p>
                        <button onclick="window.adminCardsManager.refreshSection('${section}')" 
                                class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Pagination helper methods
     */
    previousPage(section) {
        this.handlePageChange(section, 'prev');
    }

    nextPage(section) {
        this.handlePageChange(section, 'next');
    }

    goToPage(section, page) {
        this.handlePageChange(section, page);
    }

    setItemsPerPage(newItemsPerPage) {
        this.paginationManager.setItemsPerPage(newItemsPerPage);
        // Refresh all sections with data
        Object.keys(this.paginationManager.originalData).forEach(section => {
            if (this.paginationManager.originalData[section].length > 0) {
                this.refreshSection(section);
            }
        });
    }

    getPaginationInfo(section) {
        return this.paginationManager.getPaginationInfo(section);
    }

    /**
     * Debug method to show pagination status
     */
    showPaginationStatus() {
        console.log('📊 Pagination Status:');
        Object.keys(this.paginationManager.originalData).forEach(section => {
            const data = this.paginationManager.originalData[section];
            const info = this.paginationManager.getPaginationInfo(section);
            console.log(`  ${section}: ${data.length} total items, page ${info.currentPage}/${info.totalPages}`);
        });
    }

    /**
     * Loading state management
     */
    showLoading(section) {
        const container = this.containers[section];
        
        if (container) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                    <p class="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading ${section}...</p>
                </div>
            `;
            container.classList.remove('hidden');
        }
    }

    hideLoading(section) {
        // Loading is hidden by rendering actual content
        // This method is now mainly for compatibility
        const container = this.containers[section];
        if (container) {
            container.classList.remove('hidden');
        }
    }

    showError(section, message) {
        const loadingElement = document.getElementById(`loading-${section}`);
        const container = this.containers[section];
        const errorElement = document.getElementById(`${section}-error`);
        
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
        if (container) {
            container.classList.add('hidden');
        }
        if (errorElement) {
            errorElement.classList.remove('hidden');
            const messageSpan = errorElement.querySelector('span');
            if (messageSpan) {
                messageSpan.textContent = message;
            }
        }
    }

    /**
     * Dark mode compatibility
     */
    ensureDarkModeCompat() {
        const containers = Object.values(this.containers);
        
        containers.forEach(container => {
            if (container) {
                const isDark = document.documentElement.classList.contains('dark');
                if (isDark) {
                    if (container.classList.contains('bg-white')) {
                        container.style.background = '#1f2937';
                    } else {
                        container.style.background = 'transparent';
                    }
                }
                
                // Add mutation observer for dark mode changes
                if (!container.dataset.darkModeObserver) {
                    const observer = new MutationObserver(() => {
                        this.ensureDarkModeCompat();
                    });
                    observer.observe(document.documentElement, {
                        attributes: true,
                        attributeFilter: ['class']
                    });
                    container.dataset.darkModeObserver = 'true';
                }
            }
        });
    }

    /**
     * Backward compatibility methods
     */
    get usersContainer() {
        return this.containers.users;
    }

    get batchesContainer() {
        return this.containers.batches;
    }

    get originalData() {
        return this.paginationManager.originalData;
    }

    get currentPages() {
        return this.paginationManager.currentPages;
    }

    get itemsPerPage() {
        return this.paginationManager.itemsPerPage;
    }

    // Legacy methods for backward compatibility
    renderUsersTable(users) {
        this.renderUsers(users);
    }

    renderBatchesTable(batches) {
        this.renderBatches(batches);
    }

    populateBuildingsCards(buildings) {
        this.renderBuildings(buildings);
    }

    populateModelsCards(models) {
        this.renderModels(models);
    }

    populatePipelinesCards(pipelines) {
        this.renderPipelines(pipelines);
    }

    /**
     * Get section icon
     */
    getSectionIcon(section) {
        const icons = {
            users: 'fas fa-users',
            batches: 'fas fa-layer-group',
            buildings: 'fas fa-building',
            models: 'fas fa-brain',
            pipelines: 'fas fa-cogs'
        };
        return icons[section] || 'fas fa-circle';
    }

    /**
     * Get empty message for section
     */
    getEmptyMessage(section) {
        const messages = {
            users: 'No users are currently available in the system.',
            batches: 'No image batches have been created yet.',
            buildings: 'No buildings are registered in the system.',
            models: 'No AI models are currently available.',
            pipelines: 'No inference pipelines are configured.'
        };
        return messages[section] || `No ${section} found.`;
    }

    /**
     * Render batches in a table format
     */
    renderBatches(batches) {
        const container = this.containers.batches;
        if (!container) {
            console.warn('⚠️ Batches container not found');
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Check if we have data
        if (!batches || batches.length === 0) {
            container.innerHTML = this.getEmptyStateHTML('batches');
            return;
        }
        
        // Create responsive table
        const tableHTML = `
        <div class="overflow-x-auto relative">
            <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" class="px-6 py-3">Batch ID</th>
                        <th scope="col" class="px-6 py-3">Created Date</th>
                        <th scope="col" class="px-6 py-3">Status</th>
                        <th scope="col" class="px-6 py-3">Image Count</th>
                        <th scope="col" class="px-6 py-3">Last Modified</th>
                        <th scope="col" class="px-6 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody id="batches-tbody">
                    ${batches.map(batch => this.getBatchRowHTML(batch)).join('')}
                </tbody>
            </table>
        </div>
        
        ${this.getPaginationHTML('batches')}
        `;
        
        container.innerHTML = tableHTML;
        
        // Add event listeners to action buttons
        this.addBatchActionEventListeners();
    }

    /**
     * Generate HTML for a batch table row
     */
    getBatchRowHTML(batch) {
        const createdDate = new Date(batch.created_date).toLocaleString();
        const lastModified = new Date(batch.last_modified).toLocaleString();
        
        return `
        <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                ${batch.batch_id}
            </td>
            <td class="px-6 py-4">${createdDate}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${this.getStatusBadgeClass(batch.status)}">
                    ${batch.status}
                </span>
            </td>
            <td class="px-6 py-4">${batch.image_count}</td>
            <td class="px-6 py-4">${lastModified}</td>
            <td class="px-6 py-4 flex space-x-2">
                <button data-action="view-batch-images" data-batch-id="${batch.batch_id}" data-bs-toggle="modal" data-bs-target="#batch-images-modal" 
                        class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="View Images">
                    <i class="fas fa-images"></i>
                </button>
                <a href="/api/admin/batches/${batch.batch_id}/download" 
                   class="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                   title="Download Batch">
                    <i class="fas fa-download"></i>
                </a>
                <button data-action="delete-batch" data-batch-id="${batch.batch_id}"
                        class="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Delete Batch">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    }
    
    /**
     * Get CSS class for status badge
     */
    getStatusBadgeClass(status) {
        const statusClasses = {
            'ready': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            'processing': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            'error': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
            'empty': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            'inference': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
        };
        
        return statusClasses[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
    
    /**
     * Add event listeners to batch action buttons
     */
    addBatchActionEventListeners() {
        // View batch images
        document.querySelectorAll('[data-action="view-batch-images"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const batchId = e.currentTarget.getAttribute('data-batch-id');
                if (window.batchManagement && typeof window.batchManagement.viewBatchImages === 'function') {
                    window.batchManagement.viewBatchImages(batchId);
                }
            });
        });
        
        // Delete batch
        document.querySelectorAll('[data-action="delete-batch"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const batchId = e.currentTarget.getAttribute('data-batch-id');
                if (confirm(`Are you sure you want to delete batch ${batchId}? This action cannot be undone.`)) {
                    // TODO: Implement batch deletion
                    console.log(`Delete batch ${batchId}`);
                }
            });
        });
    }
}

// Expose the class globally
window.AdminCardsManager = AdminCardsManager;

// Also expose a global method for pagination callbacks
window.handleAdminPagination = function(section, action) {
    console.log(`🌐 Global pagination handler called: ${section} - ${action}`);
    
    if (window.adminCardsManager && window.adminCardsManager.handlePageChange) {
        window.adminCardsManager.handlePageChange(section, action);
    } else {
        console.warn('AdminCardsManager instance not available for pagination');
        console.warn('Available window.adminCardsManager:', window.adminCardsManager);
    }
};

// Add a separate refresh function for when you actually want to refresh from server
window.refreshAdminSection = function(section) {
    console.log(`🔄 Manual refresh requested for: ${section}`);
    
    if (window.adminCardsManager && window.adminCardsManager.forceRefresh) {
        window.adminCardsManager.forceRefresh(section);
    } else {
        console.warn('AdminCardsManager instance not available for refresh');
    }
};

// Debug helper
window.showPaginationStatus = function() {
    if (window.adminCardsManager && window.adminCardsManager.showPaginationStatus) {
        window.adminCardsManager.showPaginationStatus();
    } else {
        console.warn('AdminCardsManager instance not available');
    }
};
