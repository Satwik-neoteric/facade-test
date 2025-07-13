/**
 * Loading Manager - Centralized loading state management
 * Handles various loading states throughout the application
 */
class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
        this.config = {
            defaultTimeout: 10000, // 10 seconds
            spinnerSize: {
                small: 'h-4 w-4',
                medium: 'h-6 w-6',
                large: 'h-8 w-8',
                xlarge: 'h-12 w-12'
            }
        };
    }

    /**
     * Create spinner HTML
     */
    static createSpinner(size = 'medium', text = 'Loading...', showText = true) {
        const sizeClass = LoadingManager.prototype.config.spinnerSize[size] || LoadingManager.prototype.config.spinnerSize.medium;
        
        return `
            <div class="inline-flex items-center justify-center">
                <svg class="animate-spin ${sizeClass} text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ${showText ? `<span class="ml-2">${text}</span>` : ''}
            </div>
        `;
    }

    /**
     * Add loading state to button
     */
    static addButtonLoading(button, loadingText = 'Loading...', size = 'small') {
        if (!button) return false;
        
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
        button.dataset.originalDisabled = button.disabled;
        
        button.innerHTML = this.createSpinner(size, loadingText, true);
        button.classList.add('opacity-75', 'pointer-events-none');
        
        return true;
    }

    /**
     * Remove loading state from button
     */
    static removeButtonLoading(button) {
        if (!button) return false;
        
        button.disabled = button.dataset.originalDisabled === 'true';
        
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
            delete button.dataset.originalContent;
        }
        
        button.classList.remove('opacity-75', 'pointer-events-none');
        delete button.dataset.originalDisabled;
        
        return true;
    }

    /**
     * Show full page loading overlay
     */
    static showPageLoading(message = 'Loading...', id = 'page-loader') {
        // Remove existing loader if any
        this.hidePageLoading(id);
        
        const loader = document.createElement('div');
        loader.id = id;
        loader.className = 'fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-[9999] transition-opacity duration-300';
        loader.innerHTML = `
            <div class="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
                <p class="text-gray-600 dark:text-gray-300 text-lg font-medium">${message}</p>
            </div>
        `;
        
        // Animate in
        loader.style.opacity = '0';
        document.body.appendChild(loader);
        requestAnimationFrame(() => {
            loader.style.opacity = '1';
        });
        
        return loader;
    }

    /**
     * Hide full page loading overlay
     */
    static hidePageLoading(id = 'page-loader') {
        const loader = document.getElementById(id);
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 300);
            return true;
        }
        return false;
    }

    /**
     * Show loading overlay for specific element
     */
    static showElementLoading(element, message = 'Loading...') {
        if (!element) return null;
        
        const loaderId = `loader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Make element relative if it's not already positioned
        const originalPosition = window.getComputedStyle(element).position;
        if (originalPosition === 'static') {
            element.style.position = 'relative';
            element.dataset.originalPosition = 'static';
        }
        
        const loader = document.createElement('div');
        loader.id = loaderId;
        loader.className = 'absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-50 transition-opacity duration-300';
        loader.innerHTML = `
            <div class="text-center">
                ${this.createSpinner('medium', message, true)}
            </div>
        `;
        
        element.appendChild(loader);
        
        // Animate in
        requestAnimationFrame(() => {
            loader.style.opacity = '1';
        });
        
        return loaderId;
    }

    /**
     * Hide loading overlay for specific element
     */
    static hideElementLoading(element, loaderId = null) {
        if (!element) return false;
        
        const loader = loaderId ? 
            document.getElementById(loaderId) : 
            element.querySelector('[id^="loader-"]');
            
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
                
                // Restore original position if we changed it
                if (element.dataset.originalPosition === 'static') {
                    element.style.position = 'static';
                    delete element.dataset.originalPosition;
                }
            }, 300);
            return true;
        }
        return false;
    }

    /**
     * Create loading skeleton for cards/lists
     */
    static createSkeleton(type = 'card', count = 1) {
        const skeletons = {
            card: `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                    <div class="space-y-2">
                        <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                        <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                        <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
                    </div>
                    <div class="mt-4 flex space-x-2">
                        <div class="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                        <div class="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                    </div>
                </div>
            `,
            row: `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                    <div class="flex items-center space-x-4">
                        <div class="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
                            <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                        </div>
                        <div class="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                    </div>
                </div>
            `
        };
        
        const skeleton = skeletons[type] || skeletons.card;
        return Array(count).fill(skeleton).join('');
    }

    /**
     * Setup automatic loading effects for elements with data attributes
     */
    static setupAutoLoadingEffects() {
        const setupEffects = () => {
            // Handle buttons with data-loading attribute
            document.querySelectorAll('[data-loading]:not([data-loading-setup])').forEach(button => {
                button.setAttribute('data-loading-setup', 'true');
                button.addEventListener('click', (e) => {
                    const loadingText = button.dataset.loading || 'Loading...';
                    const timeout = parseInt(button.dataset.loadingTimeout) || 5000;
                    
                    this.addButtonLoading(button, loadingText);
                    
                    // Auto-remove loading after timeout if not manually removed
                    setTimeout(() => {
                        this.removeButtonLoading(button);
                    }, timeout);
                });
            });

            // Handle forms with data-loading-on-submit
            document.querySelectorAll('form[data-loading-on-submit]:not([data-loading-setup])').forEach(form => {
                form.setAttribute('data-loading-setup', 'true');
                form.addEventListener('submit', (e) => {
                    const message = form.dataset.loadingOnSubmit || 'Processing...';
                    this.showElementLoading(form, message);
                });
            });
        };

        // Setup on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEffects);
        } else {
            setupEffects();
        }

        // Setup for dynamically added elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        setupEffects();
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Promise wrapper with loading state
     */
    static async withLoading(promise, element, message = 'Loading...') {
        const loaderId = element ? this.showElementLoading(element, message) : null;
        
        try {
            const result = await promise;
            return result;
        } finally {
            if (element && loaderId) {
                this.hideElementLoading(element, loaderId);
            }
        }
    }
}

// Initialize automatic loading effects
LoadingManager.setupAutoLoadingEffects();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingManager;
}
