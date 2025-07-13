/**
 * Toast Notification Manager
 * Handles displaying temporary notification messages
 */
class ToastManager {
    constructor() {
        this.toasts = new Map();
        this.config = {
            defaultDuration: 5000,
            maxToasts: 5,
            position: 'top-right',
            autoRemove: true
        };
        this.container = null;
        this.init();
    }

    /**
     * Initialize toast manager
     */
    init() {
        this.createContainer();
        this.setupStyles();
    }

    /**
     * Create or get toast container
     */
    createContainer() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = this.getContainerClasses();
            document.body.appendChild(this.container);
        }
    }

    /**
     * Get container classes based on position
     */
    getContainerClasses() {
        const positions = {
            'top-right': 'fixed top-4 right-4 z-50 space-y-2',
            'top-left': 'fixed top-4 left-4 z-50 space-y-2',
            'bottom-right': 'fixed bottom-4 right-4 z-50 space-y-2',
            'bottom-left': 'fixed bottom-4 left-4 z-50 space-y-2',
            'top-center': 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2',
            'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2'
        };
        return positions[this.config.position] || positions['top-right'];
    }

    /**
     * Setup CSS styles for animations
     */
    setupStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-enter {
                transform: translateX(100%);
                opacity: 0;
            }
            .toast-enter-active {
                transform: translateX(0);
                opacity: 1;
                transition: all 0.3s ease-out;
            }
            .toast-exit {
                transform: translateX(0);
                opacity: 1;
            }
            .toast-exit-active {
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease-in;
            }
            .toast-progress {
                animation: toast-progress linear forwards;
            }
            @keyframes toast-progress {
                from { width: 100%; }
                to { width: 0%; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a toast notification
     */
    show(message, options = {}) {
        const {
            type = 'info',
            duration = this.config.defaultDuration,
            persistent = false,
            actions = [],
            title = '',
            icon = null,
            className = ''
        } = options;

        // Remove oldest toast if at max capacity
        if (this.toasts.size >= this.config.maxToasts) {
            const oldestToast = this.toasts.keys().next().value;
            this.remove(oldestToast);
        }

        const toastId = this.generateId();
        const toast = this.createToast(toastId, message, type, title, icon, actions, className);
        
        this.container.appendChild(toast);
        this.toasts.set(toastId, {
            element: toast,
            type,
            persistent,
            duration,
            timeout: null
        });

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('toast-enter');
            toast.classList.add('toast-enter-active');
        });

        // Setup auto-removal
        if (!persistent && duration > 0) {
            this.setupAutoRemoval(toastId, duration);
        }

        return toastId;
    }

    /**
     * Create toast element
     */
    createToast(id, message, type, title, icon, actions, className) {
        const toast = document.createElement('div');
        toast.id = `toast-${id}`;
        toast.className = `toast-enter max-w-sm bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${className}`;
        
        const typeConfig = this.getTypeConfig(type);
        toast.classList.add(...typeConfig.borderClass.split(' '));

        const iconHtml = icon || typeConfig.icon ? 
            `<div class="flex-shrink-0">
                <i class="${icon || typeConfig.icon}"></i>
            </div>` : '';

        const titleHtml = title ? 
            `<p class="text-sm font-medium text-gray-900 dark:text-gray-100">${title}</p>` : '';

        const actionsHtml = actions.length > 0 ? 
            `<div class="mt-3 flex space-x-2">
                ${actions.map(action => action).join('')}
            </div>` : '';

        const progressHtml = !actions.length ? 
            `<div class="absolute bottom-0 left-0 h-1 bg-gray-200 dark:bg-gray-700 w-full">
                <div class="h-full ${typeConfig.progressClass} toast-progress" style="animation-duration: ${this.toasts.get(id)?.duration || 5000}ms;"></div>
            </div>` : '';

        toast.innerHTML = `
            <div class="p-4 relative">
                <div class="flex items-start">
                    ${iconHtml}
                    <div class="ml-3 w-0 flex-1">
                        ${titleHtml}
                        <p class="text-sm text-gray-600 dark:text-gray-300 ${title ? 'mt-1' : ''}">${message}</p>
                        ${actionsHtml}
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors" 
                                onclick="toastManager.remove('${id}')" 
                                aria-label="Dismiss notification">
                            <i class="fas fa-times text-sm"></i>
                        </button>
                    </div>
                </div>
                ${progressHtml}
            </div>
        `;

        return toast;
    }

    /**
     * Get type configuration
     */
    getTypeConfig(type) {
        const configs = {
            success: {
                borderClass: 'border-l-4 border-green-400',
                icon: 'fas fa-check-circle text-green-400',
                progressClass: 'bg-green-400'
            },
            error: {
                borderClass: 'border-l-4 border-red-400',
                icon: 'fas fa-exclamation-circle text-red-400',
                progressClass: 'bg-red-400'
            },
            warning: {
                borderClass: 'border-l-4 border-yellow-400',
                icon: 'fas fa-exclamation-triangle text-yellow-400',
                progressClass: 'bg-yellow-400'
            },
            info: {
                borderClass: 'border-l-4 border-blue-400',
                icon: 'fas fa-info-circle text-blue-400',
                progressClass: 'bg-blue-400'
            },
            loading: {
                borderClass: 'border-l-4 border-gray-400',
                icon: 'fas fa-spinner fa-spin text-gray-400',
                progressClass: 'bg-gray-400'
            }
        };
        return configs[type] || configs.info;
    }

    /**
     * Setup auto-removal for toast
     */
    setupAutoRemoval(toastId, duration) {
        const toastData = this.toasts.get(toastId);
        if (toastData) {
            toastData.timeout = setTimeout(() => {
                this.remove(toastId);
            }, duration);
        }
    }

    /**
     * Remove a toast
     */
    remove(toastId) {
        const toastData = this.toasts.get(toastId);
        if (!toastData) return false;

        const toast = toastData.element;
        
        // Clear timeout
        if (toastData.timeout) {
            clearTimeout(toastData.timeout);
        }

        // Animate out
        toast.classList.remove('toast-enter-active');
        toast.classList.add('toast-exit', 'toast-exit-active');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toastId);
        }, 300);

        return true;
    }

    /**
     * Remove all toasts
     */
    removeAll() {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.remove(id));
    }

    /**
     * Update toast position
     */
    setPosition(position) {
        this.config.position = position;
        if (this.container) {
            this.container.className = this.getContainerClasses();
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Static convenience methods
     */
    static success(message, options = {}) {
        return window.toastManager.show(message, { ...options, type: 'success' });
    }

    static error(message, options = {}) {
        return window.toastManager.show(message, { ...options, type: 'error' });
    }

    static warning(message, options = {}) {
        return window.toastManager.show(message, { ...options, type: 'warning' });
    }

    static info(message, options = {}) {
        return window.toastManager.show(message, { ...options, type: 'info' });
    }

    static loading(message, options = {}) {
        return window.toastManager.show(message, { ...options, type: 'loading', persistent: true });
    }
}

// Create global instance
window.toastManager = new ToastManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
