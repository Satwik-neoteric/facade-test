/**
 * Facade Studio Application Loader - Optimized Version (Cache-Free, Metrics-Free)
 *
 * Simplified loader that removes caching and performance metric tracking
 * for environments where minimal overhead and maximum clarity is preferred.
 */
class FacadeStudioLoader {
    constructor() {
        if (FacadeStudioLoader.instance) return FacadeStudioLoader.instance;
        FacadeStudioLoader.instance = this;

        this.config = {
            basePath: '/static/updated_ui',
            loadTimeout: 3000,
            retryAttempts: 1,
            parallel: true,
            debugMode: false,
            concurrencyLimit: 8,
            prioritizeAdmin: window.location.pathname.includes('/admin')
        };

        this.state = {
            loaded: new Set(),
            loading: new Set(),
            failed: new Set(),
            startTime: null,
        };

        this.modules = {
            critical: [
                'core/app.js',
                'core/theme-manager.js',
                'components/toast-manager.js'
            ],
            core: [
                'utils/loading-manager.js',
                'components/ui-components.js'
            ],
            rendering: [
                'components/card-factory.js',
                'components/table-factory.js',
                'components/pagination-manager.js'
            ],
            management: [
                'managers/dashboard-stats-manager.js'
            ],
            adminComponents: [
                'components/admin-cards-manager.js',
                'components/admin-event-handlers.js'
            ],
            controllers: {
                admin: [
                    'pages/admin/admin-modal-manager.js',
                    'pages/admin/admin-section-manager.js',
                    'pages/admin/admin-controller.js',
                    'pages/admin/admin-actions.js'
                ]
            },
            lazy: [
                'utils/analytics-tracker.js',
                'components/advanced-tooltips.js'
            ]
        };
    }

    async init() {
        try {
            this.state.startTime = Date.now();
            this.initSemaphore();

            await this.loadCriticalModules();
            await this.loadModuleGroup(this.modules.core);

            const currentPage = this.detectCurrentPage();
            if (currentPage === 'admin') {
                await this.loadOptimizedAdminStack();
            }

            await this.initializeApplication();
            this.dispatchReadyEvent();
            this.lazyLoadNonCriticalModules();

        } catch (error) {
            console.error('Loader initialization failed:', error);
        }
    }

    initSemaphore() {
        this.semaphore = {
            count: this.config.concurrencyLimit,
            waitQueue: [],
            async acquire() {
                if (this.count > 0) {
                    this.count--; return;
                }
                return new Promise(resolve => this.waitQueue.push(resolve));
            },
            release() {
                if (this.waitQueue.length) {
                    this.waitQueue.shift()();
                } else {
                    this.count++;
                }
            }
        };
    }

    async loadCriticalModules() {
        for (const module of this.modules.critical) {
            await this.loadModuleWithRetry(module);
        }
    }

    async loadOptimizedAdminStack() {
        await Promise.allSettled([
            this.loadModuleGroup(this.modules.rendering),
            this.loadModuleGroup(this.modules.management)
        ]);
        await this.loadModuleGroup(this.modules.adminComponents);

        for (const controller of this.modules.controllers.admin) {
            await this.loadModuleWithRetry(controller);
        }
    }

    async loadModuleGroup(modules) {
        if (!modules?.length) return;
        if (this.config.parallel) {
            await Promise.allSettled(modules.map(m => this.loadModuleWithRetry(m)));
        } else {
            for (const m of modules) await this.loadModuleWithRetry(m);
        }
    }

    async loadModuleWithRetry(path) {
        if (this.state.loaded.has(path)) return;
        if (this.state.loading.has(path)) return;

        this.state.loading.add(path);
        await this.semaphore.acquire();

        try {
            for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
                try {
                    await this.loadModule(path);
                    return;
                } catch (err) {
                    if (attempt === this.config.retryAttempts) throw err;
                }
            }
        } finally {
            this.state.loading.delete(path);
            this.semaphore.release();
        }
    }

    loadModule(path) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${this.config.basePath}/${path}`;
            script.async = true;

            const timeout = setTimeout(() => {
                script.remove();
                reject(new Error(`Timeout loading ${path}`));
            }, this.config.loadTimeout);

            script.onload = () => {
                clearTimeout(timeout);
                this.state.loaded.add(path);
                resolve();
            };

            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Error loading ${path}`));
            };

            document.head.appendChild(script);
        });
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/admin')) return 'admin';
        if (path.includes('/dashboard')) return 'dashboard';
        if (path.includes('/label')) return 'label';
        return null;
    }

    async initializeApplication() {
        if (typeof FacadeStudioApp !== 'undefined') {
            window.facadeStudioApp = new FacadeStudioApp();
            if (typeof window.facadeStudioApp.init === 'function') {
                await window.facadeStudioApp.init();
            }
        }

        if (this.detectCurrentPage() === 'admin' && typeof AdminPageController !== 'undefined') {
            window.adminPageController = new AdminPageController();
            if (typeof window.adminPageController.init === 'function') {
                await window.adminPageController.init();
            }
        }
    }

    dispatchReadyEvent() {
        const readyEvent = new CustomEvent('facadeStudioReady');
        document.dispatchEvent(readyEvent);
    }

    async lazyLoadNonCriticalModules() {
        const lazyModules = this.modules.lazy || [];
        for (const mod of lazyModules) {
            try {
                await this.loadModuleWithRetry(mod);
            } catch (e) {
                console.warn(`Lazy load failed: ${mod}`, e);
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.facadeStudioLoader) {
            window.facadeStudioLoader = new FacadeStudioLoader();
            window.facadeStudioLoader.init();
        }
    });
} else {
    if (!window.facadeStudioLoader) {
        window.facadeStudioLoader = new FacadeStudioLoader();
        window.facadeStudioLoader.init();
    }
}
