/**
 * Core Application Entry Point
 * Main initialization and configuration for the entire application
 */

class FacadeStudioApp {
    constructor() {
        this.config = {
            version: '2.0.0',
            environment: 'production',
            debugMode: false,
            modules: {
                admin: true,
                dashboard: true,
                label: true,
                theme: true
            }
        };
        
        this.modules = {};
        this.isInitialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        
        try {
            // Initialize core components first
            await this.initCore();
            
            // Initialize page-specific modules
            await this.initModules();
            
            // Setup global event handlers
            this.setupGlobalHandlers();
            
            this.isInitialized = true;
            console.log('✅ Facade Studio Application initialized successfully');
            
            // Dispatch ready event
            this.dispatchReadyEvent();
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.handleInitError(error);
        }
    }

    /**
     * Initialize core components
     */
    async initCore() {
        // Initialize theme manager
        if (typeof ThemeManager !== 'undefined') {
            this.modules.theme = new ThemeManager();
        }
        
        // Initialize loading manager
        if (typeof LoadingManager !== 'undefined') {
            this.modules.loading = LoadingManager;
        }
        
        // Initialize UI components
        if (typeof UIComponents !== 'undefined') {
            this.modules.ui = UIComponents;
        }
    }

    /**
     * Initialize page-specific modules based on current page
     */
    async initModules() {
        const currentPage = this.detectCurrentPage();
        
        switch (currentPage) {
            case 'admin':
                await this.initAdminModule();
                break;
            case 'dashboard':
                await this.initDashboardModule();
                break;
            case 'label':
                await this.initLabelModule();
                break;
            default:
                console.log(`📄 Page type '${currentPage}' detected, loading common modules only`);
        }
    }

    /**
     * Detect current page type
     */
    detectCurrentPage() {
        const url = window.location.pathname;
        const body = document.body;
        
        if (url.includes('/admin') || body.classList.contains('admin-page')) {
            return 'admin';
        } else if (url.includes('/dashboard') || body.classList.contains('dashboard-page')) {
            return 'dashboard';
        } else if (url.includes('/label') || body.classList.contains('label-page')) {
            return 'label';
        }
        
        return 'home';
    }

    /**
     * Initialize admin module
     */
    async initAdminModule() {
        console.log('📋 Initializing Admin Module...');
        
        if (typeof AdminCardsManager !== 'undefined') {
            this.modules.adminCards = new AdminCardsManager();
        }
        
        if (typeof AdminEventHandlers !== 'undefined') {
            this.modules.adminEvents = new AdminEventHandlers();
        }
        
        if (typeof AdminDebugUtils !== 'undefined') {
            this.modules.adminDebug = new AdminDebugUtils();
        }
    }

    /**
     * Initialize dashboard module
     */
    async initDashboardModule() {
        console.log('📊 Initializing Dashboard Module...');
        
        if (typeof DashboardStatsManager !== 'undefined') {
            this.modules.dashboardStats = new DashboardStatsManager();
            this.modules.dashboardStats.init();
        }
    }

    /**
     * Initialize label module
     */
    async initLabelModule() {
        console.log('🏷️ Initializing Label Module...');
        
        // Label-specific initialization will go here
        console.log('Label module initialization placeholder');
    }

    /**
     * Setup global event handlers
     */
    setupGlobalHandlers() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });

        // Global unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });

        // Theme change handler
        document.addEventListener('themeChanged', (event) => {
            console.log('Theme changed to:', event.detail.theme);
        });
    }

    /**
     * Handle initialization errors
     */
    handleInitError(error) {
        // Show user-friendly error message
        const errorContainer = document.createElement('div');
        errorContainer.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50';
        errorContainer.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>Application initialization failed. Please refresh the page.</span>
            </div>
        `;
        document.body.appendChild(errorContainer);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.parentNode.removeChild(errorContainer);
            }
        }, 10000);
    }

    /**
     * Dispatch application ready event
     */
    dispatchReadyEvent() {
        const event = new CustomEvent('facadeStudioReady', {
            detail: {
                version: this.config.version,
                modules: Object.keys(this.modules),
                initTime: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get module instance
     */
    getModule(name) {
        return this.modules[name];
    }

    /**
     * Check if application is ready
     */
    isReady() {
        return this.isInitialized;
    }
}

// Export the class for manual instantiation by the loader
// The facade-studio-loader.js will handle creating and initializing the instance
// This prevents conflicts and allows for controlled initialization sequencing

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FacadeStudioApp;
}

// Make the class globally available for the loader
window.FacadeStudioApp = FacadeStudioApp;
