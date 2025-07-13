/**
 * Admin Cards - Legacy Compatibility Loader
 * This file provides backward compatibility while using the new modular architecture
 * 
 * NOTICE: This is the legacy loader. For new projects, use:
 * <script src="/static/updated_ui/facade-studio-loader.js"></script>
 */

(function() {
    'use strict';
    
    console.log('📦 Loading Admin Interface (Legacy Mode)...');
    console.log('ℹ️ Consider upgrading to facade-studio-loader.js for better performance');
    
    // Check if new loader is already active
    if (window.facadeStudioLoader) {
        console.log('✅ New Facade Studio loader detected, skipping legacy loader');
        return;
    }
    
    // Configuration
    const CONFIG = {
        componentPath: '/static/updated_ui/components/',
        utilsPath: '/static/updated_ui/utils/',
        managersPath: '/static/updated_ui/managers/',
        pagesPath: '/static/updated_ui/pages/',
        loadTimeout: 10000, // 10 seconds timeout
        retryAttempts: 2
    };
    
    // Component loading order (dependencies first)
    const COMPONENTS = [
        // Utilities first
        { path: 'utils/', file: 'loading-manager.js' },
        
        // Base components
        { path: 'components/', file: 'ui-components.js' },
        { path: 'components/', file: 'toast-manager.js' },
        { path: 'components/', file: 'card-factory.js' },
        { path: 'components/', file: 'table-factory.js' },
        { path: 'components/', file: 'pagination-manager.js' },
        
        // Managers
        { path: 'managers/', file: 'dashboard-stats-manager.js' },
        
        // Admin components
        { path: 'components/', file: 'admin-event-handlers.js' },
        { path: 'components/', file: 'admin-debug-utils.js' },
        { path: 'components/', file: 'admin-cards-manager.js' },
        
        // Page controllers (if admin page)
        ...(isAdminPage() ? [
            { path: 'pages/admin/', file: 'admin-controller.js' },
            { path: 'pages/admin/', file: 'admin-actions.js' }
        ] : [])
    ];    
    // Helper function to detect admin page
    function isAdminPage() {
        return window.location.pathname.includes('/admin') || 
               document.body.classList.contains('admin-page');
    }
    
    // Loading state management
    const loadingState = {
        componentsLoaded: 0,
        totalComponents: COMPONENTS.length,
        errors: [],
        startTime: Date.now()
    };

    /**
     * Load components with error handling and retry logic
     */
    function loadComponents() {
        const promises = COMPONENTS.map((component, index) => 
            loadComponent(component, index)
        );
        
        Promise.allSettled(promises)
            .then(results => {
                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected');
                
                console.log(`📊 Component Loading Summary: ${successful}/${COMPONENTS.length} successful`);
                
                if (failed.length > 0) {
                    console.warn('⚠️ Some components failed to load:', failed.map(f => f.reason));
                }
                
                // Initialize components after loading
                initializeComponents();
                
                // Notify completion
                console.log('🎉 Legacy admin interface initialized');
                document.dispatchEvent(new CustomEvent('adminInterfaceReady', {
                    detail: {
                        componentsLoaded: loadingState.componentsLoaded,
                        errors: loadingState.errors,
                        loadTime: Date.now() - loadingState.startTime,
                        legacy: true
                    }
                }));
            });
    }

    /**
     * Load individual component with timeout and retry
     */
    function loadComponent(component, index) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const componentPath = component.path || 'components/';
            const componentFile = component.file || component;
            const fullPath = CONFIG.componentPath.replace('components/', componentPath) + componentFile;
            
            function attemptLoad() {
                attempts++;
                const script = document.createElement('script');
                script.src = fullPath;
                script.async = true;
                
                const timeout = setTimeout(() => {
                    script.remove();
                    if (attempts < CONFIG.retryAttempts) {
                        console.warn(`⏳ Retrying ${componentFile} (attempt ${attempts + 1})`);
                        setTimeout(attemptLoad, 1000);
                    } else {
                        reject(`Timeout loading ${componentFile}`);
                    }
                }, CONFIG.loadTimeout);
                
                script.onload = () => {
                    clearTimeout(timeout);
                    loadingState.componentsLoaded++;
                    console.log(`✅ Loaded: ${componentFile} (${loadingState.componentsLoaded}/${loadingState.totalComponents})`);
                    resolve(componentFile);
                };
                
                script.onerror = () => {
                    clearTimeout(timeout);
                    script.remove();
                    if (attempts < CONFIG.retryAttempts) {
                        console.warn(`⏳ Retrying ${componentFile} (attempt ${attempts + 1})`);
                        setTimeout(attemptLoad, 1000);
                    } else {
                        loadingState.errors.push(componentFile);
                        reject(`Failed to load ${componentFile}`);
                    }
                };
                
                document.head.appendChild(script);
            }
            
            attemptLoad();
        });
    }

    /**
     * Initialize components after loading
     */
    function initializeComponents() {
        console.log('🔧 Initializing loaded components...');
        
        // Initialize theme manager if available
        if (typeof ThemeManager !== 'undefined' && !window.themeManager) {
            window.themeManager = new ThemeManager();
        }
        
        // Initialize toast manager if available
        if (typeof ToastManager !== 'undefined' && !window.toastManager) {
            window.toastManager = new ToastManager();
        }
        
        // Initialize admin components
        setTimeout(() => {
            if (typeof AdminCardsManager !== 'undefined') {
                window.adminCardsManager = new AdminCardsManager();
                console.log('✅ AdminCardsManager initialized');
            }
            
            if (typeof DashboardStatsManager !== 'undefined') {
                window.dashboardStatsManager = new DashboardStatsManager();
                console.log('✅ DashboardStatsManager initialized');
            }
            
            if (typeof AdminEventHandlers !== 'undefined') {
                window.adminEventHandlers = new AdminEventHandlers();
                console.log('✅ AdminEventHandlers initialized');
            }
            
            if (typeof AdminDebugUtils !== 'undefined') {
                window.adminDebugUtils = new AdminDebugUtils();
                console.log('✅ AdminDebugUtils initialized');
            }
            
            // Initialize page controller if on admin page
            if (isAdminPage() && typeof AdminPageController !== 'undefined' && !window.adminPageController) {
                window.adminPageController = new AdminPageController();
                console.log('✅ AdminPageController initialized');
            }
            
            // Initialize actions manager
            if (typeof AdminActionsManager !== 'undefined' && !window.adminActionsManager) {
                window.adminActionsManager = new AdminActionsManager();
                window.adminActionsManager.init();
                console.log('✅ AdminActionsManager initialized');
            }
            
        }, 100);
    }
    
    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadComponents);
    } else {
        loadComponents();
    }
})();

/**
 * Placeholder class for graceful degradation
 */
class AdminCardsManagerPlaceholder {
    constructor() {
        console.log('⏳ AdminCardsManager placeholder active, waiting for components...');
        this.isPlaceholder = true;
    }
    
    renderUsers(users) { 
        console.log('⏳ AdminCardsManager loading...', users?.length ? `${users.length} users` : ''); 
    }
    
    renderBatches(batches) { 
        console.log('⏳ AdminCardsManager loading...', batches?.length ? `${batches.length} batches` : ''); 
    }
    
    renderBuildings(buildings) { 
        console.log('⏳ AdminCardsManager loading...', buildings?.length ? `${buildings.length} buildings` : ''); 
    }
    
    renderModels(models) { 
        console.log('⏳ AdminCardsManager loading...', models?.length ? `${models.length} models` : ''); 
    }
    
    renderPipelines(pipelines) { 
        console.log('⏳ AdminCardsManager loading...', pipelines?.length ? `${pipelines.length} pipelines` : ''); 
    }
    
    // Legacy compatibility methods
    renderUsersTable(users) { this.renderUsers(users); }
    renderBatchesTable(batches) { this.renderBatches(batches); }
    populateBuildingsCards(buildings) { this.renderBuildings(buildings); }
    populateModelsCards(models) { this.renderModels(models); }
    populatePipelinesCards(pipelines) { this.renderPipelines(pipelines); }
    
    // Placeholder for pagination methods
    previousPage() { console.log('⏳ Pagination loading...'); }
    nextPage() { console.log('⏳ Pagination loading...'); }
    goToPage() { console.log('⏳ Pagination loading...'); }
}

// Provide placeholder until real components load
if (!window.AdminCardsManager) {
    window.AdminCardsManager = AdminCardsManagerPlaceholder;
}

// Legacy compatibility functions
window.renderUserTable = function(users) {
    if (window.adminCardsManager) {
        window.adminCardsManager.renderUsers(users);
    } else {
        console.warn('AdminCardsManager not available');
    }
};

window.populatePipelineCards = function(pipelines) {
    if (window.adminCardsManager) {
        window.adminCardsManager.renderPipelines(pipelines);
    } else {
        console.warn('AdminCardsManager not available');
    }
};

window.populateModelsCards = function(models) {
    if (window.adminCardsManager) {
        window.adminCardsManager.renderModels(models);
    } else {
        console.warn('AdminCardsManager not available');
    }
};

window.renderBatchesTable = function(batches) {
    if (window.adminCardsManager) {
        window.adminCardsManager.renderBatches(batches);
    } else {
        console.warn('AdminCardsManager not available');
    }
};

window.populateBuildingsCards = function(buildings) {
    if (window.adminCardsManager) {
        window.adminCardsManager.renderBuildings(buildings);
    } else {
        console.warn('AdminCardsManager not available');
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminCardsManagerPlaceholder;
}
