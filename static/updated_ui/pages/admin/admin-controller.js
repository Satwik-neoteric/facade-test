/**
 * Admin Page Main Controller
 * Orchestrates all admin interface functionality
 */
class AdminPageController {
    constructor() {
        // Singleton pattern
        if (AdminPageController.instance) {
            return AdminPageController.instance;
        }
        AdminPageController.instance = this;
        
        this.components = {};
        this.config = {
            autoRefresh: false,
            refreshInterval: 30000
        };
        this.state = {
            initialized: false,
            loading: false,
            currentSection: null,
            data: {
                users: [],
                batches: [],
                buildings: [],
                models: [],
                pipelines: []
            }
        };
        
        // Don't auto-initialize in constructor
        // Let the facade loader handle initialization
    }

    /**
     * Initialize admin page
     */
    async init() {
        if (this.state.initialized) {
            return;
        }
        
        try {
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.sectionManager.loadInitialData();
            
            // Setup auto-refresh if enabled
            if (this.config.autoRefresh) {
                this.setupAutoRefresh();
            }
            
            this.state.initialized = true;
            
            // Dispatch ready event
            this.dispatchEvent('adminPageReady', { controller: this });
            
        } catch (error) {
            console.error('❌ Failed to initialize AdminPageController:', error);
            this.state.initialized = false;
            
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Failed to initialize admin interface. Please refresh the page.');
            }
            
            // Re-throw to let facade loader know initialization failed
            throw error;
        }
    }

    /**
     * Initialize all components
     */
    async initializeComponents() {
        // Check if required classes are available
        if (typeof AdminModalManager === 'undefined') {
            throw new Error('AdminModalManager class not found. Script loading order issue.');
        }
        
        if (typeof AdminSectionManager === 'undefined') {
            throw new Error('AdminSectionManager class not found. Script loading order issue.');
        }
        
        // Initialize modal manager
        this.modalManager = new AdminModalManager(this);
        this.components.modalManager = this.modalManager;
        
        // Initialize section manager
        this.sectionManager = new AdminSectionManager(this);
        this.components.sectionManager = this.sectionManager;
        
        // Initialize cards manager - use global instance if available
        if (window.adminCardsManager) {
            this.components.cardsManager = window.adminCardsManager;
        } else if (typeof AdminCardsManager !== 'undefined') {
            this.components.cardsManager = new AdminCardsManager();
            // Set as global instance for pagination callbacks
            window.adminCardsManager = this.components.cardsManager;
        }

        // Initialize event handlers
        if (typeof AdminEventHandlers !== 'undefined') {
            this.components.eventHandlers = new AdminEventHandlers();
        }

        // Initialize actions manager
        if (typeof AdminActionsManager !== 'undefined') {
            this.components.actionsManager = new AdminActionsManager();
            await this.components.actionsManager.init();
            // Set as global instance for button callbacks
            window.adminActionsManager = this.components.actionsManager;
        } else {
            console.warn('AdminActionsManager class not found');
        }

        // Initialize dashboard stats
        if (typeof DashboardStatsManager !== 'undefined') {
            this.components.statsManager = new DashboardStatsManager();
            // Initialize the stats manager
            await this.components.statsManager.init();
        }

        // Initialize building manager
        if (typeof BuildingManagement !== 'undefined') {
            this.components.buildingManager = new BuildingManagement(this);
            this.components.buildingManager.init();
        }
        // Initialize Pipeline management
        if (typeof PipelineManagement !== 'undefined') {
            this.components.pipelineManager = new PipelineManagement(this);
            this.components.pipelineManager.init();
        }

    }

    /**
     * Setup global event listeners (consolidated)
     */
    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;
        
        // Single delegated event listener for all click interactions
        document.addEventListener('click', this.handleAllClicks.bind(this));
        
        // Search functionality
        const searchInput = document.getElementById('admin-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.sectionManager.handleSearch(e.target.value);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    /**
     * Consolidated click handler for all admin interactions
     */
    handleAllClicks(e) {
        // Handle modal close events
        if (this.modalManager.handleModalCloseClick(e)) {
            return;
        }

        // Handle section navigation
        const sectionBtn = e.target.closest('[data-section]');
        if (sectionBtn) {
            e.preventDefault();
            const section = sectionBtn.getAttribute('data-section');
            this.switchSection(section);
            return;
        }

        // Handle refresh buttons
        if (e.target.matches('[data-refresh]')) {
            e.preventDefault();
            const section = e.target.getAttribute('data-refresh');
            if (section === 'all') {
                this.refreshAllData();
            } else {
                this.sectionManager.refreshSection(section);
            }
            return;
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'r':
                    e.preventDefault();
                    this.refreshCurrentSection();
                    break;
                case 'n':
                    e.preventDefault();
                    // Open modal for current section if available
                    const currentSectionModal = this.getSectionModal(this.state.currentSection);
                    if (currentSectionModal) {
                        this.modalManager.openModal(currentSectionModal);
                    }
                    break;
            }
        } else if (e.key === 'Escape') {
            this.modalManager.closeAllModals();
        }
    }

    /**
     * Get modal ID for a given section
     */
    getSectionModal(section) {
        const sectionModalMap = {
            users: 'user-modal',
            batches: 'register-batch-modal',
            buildings: 'buildingModal',
            models: 'modelModal',
            pipelines: 'pipelineModal'
        };
        return sectionModalMap[section];
    }

    /**
     * Switch to a different section
     */
    switchSection(section) {
        if (this.state.currentSection === section) return;

        // Update active navigation cards
        document.querySelectorAll('.dashboard-stats-card').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900');
        });

        // Set active state for clicked card
        const activeBtn = document.querySelector(`[data-section="${section}"]`);
        if (activeBtn) {
            activeBtn.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900');
        }

        // Show/hide sections
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.add('hidden');
        });

        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        } else {
            console.error(`❌ Target section not found: ${section}-section`);
        }

        this.state.currentSection = section;
        this.dispatchEvent('sectionChanged', { section });
        
        // Smooth scroll to the management section
        this.scrollToManagementSection(targetSection);
    }

    /**
     * Smooth scroll to the management section
     */
    scrollToManagementSection(targetSection) {
        const managementContainer = document.getElementById('management-sections') || 
                                   document.querySelector('.space-y-8') || 
                                   document.querySelector('[id*="section"]')?.parentElement;
        
        if (managementContainer) {
            const offsetPosition = managementContainer.offsetTop - 100; // 100px offset for header
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Refresh current section
     */
    refreshCurrentSection() {
        this.sectionManager.refreshSection(this.state.currentSection);
    }

    /**
     * Refresh all data and update dashboard stats
     */
    async refreshAllData() {
        try {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.info('Refreshing all data...');
            }
            
            // Reload all data
            await this.sectionManager.loadInitialData();
            
            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('All data refreshed successfully');
            }
            
        } catch (error) {
            console.error('❌ Error refreshing all data:', error);
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Failed to refresh data');
            }
        }
    }

    /**
     * Setup auto-refresh
     */
    setupAutoRefresh() {
        setInterval(() => {
            if (!this.state.loading) {
                this.refreshCurrentSection();
            }
        }, this.config.refreshInterval);
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Get component
     */
    getComponent(name) {
        return this.components[name];
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Legacy compatibility methods - delegate to section manager
     */
    renderUserTable(users) {
        return this.sectionManager.renderUserTable(users);
    }

    populatePipelineCards(pipelines) {
        return this.sectionManager.populatePipelineCards(pipelines);
    }

    populateModelsCards(models) {
        return this.sectionManager.populateModelsCards(models);
    }

    renderBatchesTable(batches) {
        return this.sectionManager.renderBatchesTable(batches);
    }

    populateBuildingsCards(buildings) {
        return this.sectionManager.populateBuildingsCards(buildings);
    }

    showFallbackUsersTable() {
        return this.sectionManager.showFallbackUsersTable();
    }

    forceRenderAllData() {
        return this.sectionManager.forceRenderAllData();
    }

    async forceRefreshAll() {
        return this.sectionManager.forceRefreshAll();
    }

    refreshModalButtonHandlers() {
        return this.modalManager.refreshModalButtonHandlers();
    }

    // Modal management delegates
    openModal(modalId) {
        return this.modalManager.openModal(modalId);
    }

    closeAllModals() {
        return this.modalManager.closeAllModals();
    }

    // Section management delegates
    loadUsers() {
        return this.sectionManager.refreshSection('users');
    }

    loadBatches() {
        return this.sectionManager.refreshSection('batches');
    }

    loadBuildings() {
        return this.sectionManager.refreshSection('buildings');
    }

    loadModels() {
        return this.sectionManager.refreshSection('models');
    }

    loadPipelines() {
        return this.sectionManager.refreshSection('pipelines');
    }

    renderCurrentSection(data = null) {
        return this.sectionManager.renderCurrentSection(data);
    }
}

// Expose the class to window for the facade loader
window.AdminPageController = AdminPageController;

// Legacy compatibility - only create instance if not already created by facade loader
document.addEventListener('DOMContentLoaded', () => {
    if (!window.adminPageController) {
        try {
            window.adminPageController = new AdminPageController();
            window.adminPageController.init();
        } catch (error) {
            console.error('❌ Legacy AdminPageController creation failed:', error);
        }
    }
});

// Legacy compatibility functions (consolidated)
const legacyMethods = {
    renderUserTable: (users) => {
        if (!window.adminPageController?.sectionManager) {
            console.warn('renderUserTable called but admin controller not initialized');
            return;
        }
        return window.adminPageController.renderUserTable(users);
    },
    populatePipelineCards: (pipelines) => {
        if (!window.adminPageController?.sectionManager) {
            console.warn('populatePipelineCards called but admin controller not initialized');
            return;
        }
        return window.adminPageController.populatePipelineCards(pipelines);
    },
    populateModelsCards: (models) => {
        if (!window.adminPageController?.sectionManager) {
            console.warn('populateModelsCards called but admin controller not initialized');
            return;
        }
        return window.adminPageController.populateModelsCards(models);
    },
    renderBatchesTable: (batches) => {
        if (!window.adminPageController?.sectionManager) {
            console.warn('renderBatchesTable called but admin controller not initialized');
            return;
        }
        return window.adminPageController.renderBatchesTable(batches);
    },
    populateBuildingsCards: (buildings) => {
        if (!window.adminPageController?.sectionManager) {
            console.warn('populateBuildingsCards called but admin controller not initialized');
            return;
        }
        return window.adminPageController.populateBuildingsCards(buildings);
    }
};

Object.assign(window, legacyMethods);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminPageController;
}