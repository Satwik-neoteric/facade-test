/**
 * Pagination Manager - Handles pagination logic and controls
 */

class PaginationManager {
    constructor(itemsPerPage = 5) {
        this.itemsPerPage = itemsPerPage;
        this.currentPages = {};
        this.originalData = {};
    }

    /**
     * Initialize pagination for a section
     */
    initSection(section) {
        this.currentPages[section] = 1;
        this.originalData[section] = [];
    }

    /**
     * Set data for a section
     */
    setData(section, data) {
        this.originalData[section] = data || [];
        this.validatePagination(section);
    }

    /**
     * Get paginated data for a section
     */
    getPaginatedData(section) {
        const data = this.originalData[section] || [];
        const currentPage = this.currentPages[section] || 1;
        const startIndex = (currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return data.slice(startIndex, endIndex);
    }

    /**
     * Get pagination info for a section
     */
    getPaginationInfo(section) {
        const totalItems = this.originalData[section] ? this.originalData[section].length : 0;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const currentPage = Math.min(this.currentPages[section] || 1, Math.max(1, totalPages));
        const startItem = totalItems > 0 ? (currentPage - 1) * this.itemsPerPage + 1 : 0;
        const endItem = Math.min(currentPage * this.itemsPerPage, totalItems);
        
        // Update current page if it was adjusted
        if (this.currentPages[section] !== currentPage) {
            this.currentPages[section] = currentPage;
        }
        
        return {
            totalItems,
            totalPages,
            currentPage,
            startItem,
            endItem,
            itemsPerPage: this.itemsPerPage
        };
    }

    /**
     * Navigate to previous page
     */
    previousPage(section) {
        if (!this.originalData[section]) return false;
        
        if (this.currentPages[section] > 1) {
            this.currentPages[section]--;
            return true;
        }
        return false;
    }

    /**
     * Navigate to next page
     */
    nextPage(section) {
        if (!this.originalData[section]) return false;
        
        const totalPages = Math.ceil(this.originalData[section].length / this.itemsPerPage);
        if (this.currentPages[section] < totalPages) {
            this.currentPages[section]++;
            return true;
        }
        return false;
    }

    /**
     * Navigate to specific page
     */
    goToPage(section, page) {
        if (!this.originalData[section]) return false;
        
        const totalPages = Math.ceil(this.originalData[section].length / this.itemsPerPage);
        const targetPage = Math.max(1, Math.min(page, totalPages));
        
        if (this.currentPages[section] !== targetPage) {
            this.currentPages[section] = targetPage;
            return true;
        }
        return false;
    }

    /**
     * Reset pagination for a section
     */
    resetPagination(section) {
        this.currentPages[section] = 1;
    }

    /**
     * Validate and fix pagination state
     */
    validatePagination(section) {
        const totalItems = this.originalData[section] ? this.originalData[section].length : 0;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Reset to page 1 if current page is invalid
        if (this.currentPages[section] > totalPages && totalPages > 0) {
            this.currentPages[section] = totalPages;
        } else if (this.currentPages[section] < 1) {
            this.currentPages[section] = 1;
        }
        
        return this.currentPages[section];
    }

    /**
     * Update items per page setting
     */
    setItemsPerPage(newItemsPerPage) {
        this.itemsPerPage = newItemsPerPage;
        // Reset all pages to 1
        Object.keys(this.currentPages).forEach(section => {
            this.currentPages[section] = 1;
        });
    }

    /**
     * Create pagination controls HTML
     */
    createPaginationControls(section, onPageChange) {
        const info = this.getPaginationInfo(section);
        
        if (info.totalPages <= 1) return '';
        
        return `
            <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div class="flex justify-between flex-1 sm:hidden">
                    <button onclick="${onPageChange}('${section}', 'prev')" 
                            ${info.currentPage === 1 ? 'disabled' : ''}
                            class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Previous
                    </button>
                    <button onclick="${onPageChange}('${section}', 'next')" 
                            ${info.currentPage === info.totalPages ? 'disabled' : ''}
                            class="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next
                    </button>
                </div>
                <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            ${info.totalItems > 0 
                                ? `Showing <span class="font-medium">${info.startItem}</span> to <span class="font-medium">${info.endItem}</span> of <span class="font-medium">${info.totalItems}</span> results`
                                : 'No results found'
                            }
                        </p>
                    </div>
                    <div>
                        <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button onclick="${onPageChange}('${section}', 'prev')" 
                                    ${info.currentPage === 1 ? 'disabled' : ''}
                                    class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            ${this.createPageNumbers(section, info.currentPage, info.totalPages, onPageChange)}
                            <button onclick="${onPageChange}('${section}', 'next')" 
                                    ${info.currentPage === info.totalPages ? 'disabled' : ''}
                                    class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create page number buttons
     */
    createPageNumbers(section, currentPage, totalPages, onPageChange) {
        let pages = [];
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage;
            pages.push(`
                <button onclick="${onPageChange}('${section}', ${i})" 
                        class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            isActive 
                                ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-200' 
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }">
                    ${i}
                </button>
            `);
        }
        
        return pages.join('');
    }

    /**
     * Check if pagination is needed
     */
    needsPagination(section) {
        const totalItems = this.originalData[section] ? this.originalData[section].length : 0;
        return totalItems > this.itemsPerPage;
    }
}

// Export for use in other modules
window.PaginationManager = PaginationManager;
