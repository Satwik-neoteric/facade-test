/**
 * UI Components Library
 * Reusable UI components for consistent design across the application
 */
class UIComponents {
    static config = {
        transitions: {
            fast: 'transition-all duration-150',
            normal: 'transition-all duration-300',
            slow: 'transition-all duration-500'
        },
        shadows: {
            sm: 'shadow-sm',
            md: 'shadow-lg',
            lg: 'shadow-xl',
            xl: 'shadow-2xl'
        }
    };

    /**
     * Create a card component
     */
    static createCard(title, content, actions = [], options = {}) {
        const {
            className = '',
            variant = 'default',
            shadow = 'md',
            hover = true,
            padding = 'p-6'
        } = options;

        const variants = {
            default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
            primary: 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700',
            success: 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700',
            warning: 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700',
            danger: 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
        };

        const hoverClass = hover ? 'hover:shadow-xl hover:scale-105 cursor-pointer' : '';
        const variantClass = variants[variant] || variants.default;

        return `
            <div class="rounded-xl ${this.config.shadows[shadow]} ${this.config.transitions.normal} ${variantClass} ${hoverClass} ${className}">
                <div class="${padding}">
                    ${title ? `<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${title}</h3>` : ''}
                    <div class="text-gray-600 dark:text-gray-300">
                        ${content}
                    </div>
                    ${actions.length > 0 ? `
                        <div class="mt-4 flex flex-wrap gap-2">
                            ${actions.join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Create a button component
     */
    static createButton(text, options = {}) {
        const {
            variant = 'primary',
            size = 'md',
            icon = '',
            loading = false,
            disabled = false,
            className = '',
            onclick = '',
            type = 'button',
            fullWidth = false
        } = options;

        const variants = {
            primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white border-transparent',
            secondary: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white border-transparent',
            success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white border-transparent',
            danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white border-transparent',
            warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 text-white border-transparent',
            outline: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500',
            ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
            link: 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline focus:ring-blue-500'
        };

        const sizes = {
            xs: 'px-2 py-1 text-xs',
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
            xl: 'px-8 py-4 text-lg'
        };

        const variantClass = variants[variant] || variants.primary;
        const sizeClass = sizes[size] || sizes.md;
        const widthClass = fullWidth ? 'w-full' : '';
        const disabledClass = (disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105';

        return `
            <button 
                type="${type}"
                class="inline-flex items-center justify-center font-medium rounded-lg border ${this.config.transitions.fast} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${variantClass} ${sizeClass} ${widthClass} ${disabledClass} ${className}"
                ${(disabled || loading) ? 'disabled' : ''}
                ${onclick ? `onclick="${onclick}"` : ''}
            >
                ${loading ? `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ` : ''}
                ${icon && !loading ? `<i class="${icon} ${text ? 'mr-2' : ''}"></i>` : ''}
                ${text}
            </button>
        `;
    }

    /**
     * Create a modal component
     */
    static createModal(id, title, content, options = {}) {
        const {
            actions = [],
            size = 'md',
            closeButton = true,
            backdrop = true,
            className = ''
        } = options;

        const sizes = {
            xs: 'max-w-xs',
            sm: 'max-w-sm',
            md: 'max-w-md',
            lg: 'max-w-lg',
            xl: 'max-w-xl',
            '2xl': 'max-w-2xl',
            '3xl': 'max-w-3xl',
            '4xl': 'max-w-4xl',
            full: 'max-w-full'
        };

        const sizeClass = sizes[size] || sizes.md;

        return `
            <div id="${id}" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4" ${backdrop ? 'data-backdrop="true"' : ''}>
                <div class="bg-white dark:bg-gray-800 rounded-2xl ${this.config.shadows.xl} ${sizeClass} w-full max-h-[90vh] overflow-hidden transform ${this.config.transitions.normal} scale-95 opacity-0 ${className}" 
                     id="${id}-content" role="dialog" aria-labelledby="${id}-title" aria-modal="true">
                    
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 relative">
                        <h3 id="${id}-title" class="text-lg font-semibold text-white pr-8">${title}</h3>
                        ${closeButton ? `
                            <button class="absolute top-4 right-4 text-white hover:text-gray-200 ${this.config.transitions.fast}" 
                                    onclick="UIComponents.closeModal('${id}')" aria-label="Close modal">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        ` : ''}
                    </div>
                    
                    <!-- Content -->
                    <div class="p-6 overflow-y-auto max-h-96">
                        ${content}
                    </div>
                    
                    <!-- Actions -->
                    ${actions.length > 0 ? `
                        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex flex-wrap gap-2 justify-end">
                            ${actions.join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Create an alert component
     */
    static createAlert(message, options = {}) {
        const {
            type = 'info',
            dismissible = true,
            icon = true,
            className = '',
            id = ''
        } = options;

        const types = {
            success: {
                bg: 'bg-green-50 dark:bg-green-900',
                border: 'border-green-200 dark:border-green-700',
                text: 'text-green-800 dark:text-green-200',
                icon: 'fas fa-check-circle text-green-400'
            },
            error: {
                bg: 'bg-red-50 dark:bg-red-900',
                border: 'border-red-200 dark:border-red-700',
                text: 'text-red-800 dark:text-red-200',
                icon: 'fas fa-exclamation-circle text-red-400'
            },
            warning: {
                bg: 'bg-yellow-50 dark:bg-yellow-900',
                border: 'border-yellow-200 dark:border-yellow-700',
                text: 'text-yellow-800 dark:text-yellow-200',
                icon: 'fas fa-exclamation-triangle text-yellow-400'
            },
            info: {
                bg: 'bg-blue-50 dark:bg-blue-900',
                border: 'border-blue-200 dark:border-blue-700',
                text: 'text-blue-800 dark:text-blue-200',
                icon: 'fas fa-info-circle text-blue-400'
            }
        };

        const typeConfig = types[type] || types.info;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div ${idAttr} class="border rounded-lg p-4 ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text} ${dismissible ? 'relative pr-12' : ''} ${className}" role="alert">
                <div class="flex items-start">
                    ${icon ? `
                        <div class="flex-shrink-0 mr-3">
                            <i class="${typeConfig.icon}"></i>
                        </div>
                    ` : ''}
                    <div class="flex-1">
                        ${message}
                    </div>
                    ${dismissible ? `
                        <button class="absolute top-3 right-3 text-current hover:opacity-70 ${this.config.transitions.fast}" 
                                onclick="this.parentElement.remove()" aria-label="Dismiss alert">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Create a table component
     */
    static createTable(headers, rows, options = {}) {
        const {
            className = '',
            striped = true,
            hover = true,
            responsive = true,
            sortable = false
        } = options;

        const stripedClass = striped ? 'divide-y divide-gray-200 dark:divide-gray-700' : '';
        const hoverClass = hover ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : '';
        const wrapperClass = responsive ? 'overflow-x-auto' : '';

        return `
            <div class="${wrapperClass} bg-white dark:bg-gray-800 rounded-xl ${this.config.shadows.md} border border-gray-200 dark:border-gray-700 ${className}">
                <table class="min-w-full">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            ${headers.map((header, index) => `
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}"
                                    ${sortable ? `onclick="UIComponents.sortTable(this, ${index})"` : ''}>
                                    <div class="flex items-center">
                                        ${header}
                                        ${sortable ? '<i class="fas fa-sort ml-2 text-gray-400"></i>' : ''}
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 ${stripedClass}">
                        ${rows.map(row => `
                            <tr class="${this.config.transitions.fast} ${hoverClass}">
                                ${row.map(cell => `
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        ${cell}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Create a form input component
     */
    static createInput(options = {}) {
        const {
            type = 'text',
            id = '',
            name = '',
            label = '',
            placeholder = '',
            value = '',
            required = false,
            disabled = false,
            className = '',
            helpText = '',
            error = ''
        } = options;

        const inputId = id || name || 'input-' + Math.random().toString(36).substr(2, 9);
        const requiredAttr = required ? 'required' : '';
        const disabledAttr = disabled ? 'disabled' : '';
        const errorClass = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500';

        return `
            <div class="space-y-1 ${className}">
                ${label ? `
                    <label for="${inputId}" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ${label}
                        ${required ? '<span class="text-red-500 ml-1">*</span>' : ''}
                    </label>
                ` : ''}
                
                <input
                    type="${type}"
                    id="${inputId}"
                    name="${name}"
                    placeholder="${placeholder}"
                    value="${value}"
                    ${requiredAttr}
                    ${disabledAttr}
                    class="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${this.config.transitions.fast} ${errorClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                
                ${helpText && !error ? `
                    <p class="text-sm text-gray-500 dark:text-gray-400">${helpText}</p>
                ` : ''}
                
                ${error ? `
                    <p class="text-sm text-red-600 dark:text-red-400">${error}</p>
                ` : ''}
            </div>
        `;
    }

    /**
     * Modal utility functions
     */
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        const content = document.getElementById(modalId + '-content');
        if (modal && content) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
            
            // Focus management
            const firstFocusable = content.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            
            requestAnimationFrame(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
                if (firstFocusable) firstFocusable.focus();
            });
        }
    }

    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const content = document.getElementById(modalId + '-content');
        if (modal && content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                document.body.style.overflow = ''; // Restore scroll
            }, 300);
        }
    }

    /**
     * Table sorting utility
     */
    static sortTable(header, columnIndex) {
        const table = header.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        const isAscending = !header.classList.contains('sort-asc');
        
        // Reset all sort indicators
        table.querySelectorAll('th i').forEach(icon => {
            icon.className = 'fas fa-sort ml-2 text-gray-400';
        });
        
        // Set current sort indicator
        const icon = header.querySelector('i');
        if (icon) {
            icon.className = `fas fa-sort-${isAscending ? 'up' : 'down'} ml-2 text-gray-600`;
        }
        
        header.classList.toggle('sort-asc', isAscending);
        
        // Sort rows
        rows.sort((a, b) => {
            const aText = a.children[columnIndex].textContent.trim();
            const bText = b.children[columnIndex].textContent.trim();
            
            const comparison = aText.localeCompare(bText, undefined, { numeric: true });
            return isAscending ? comparison : -comparison;
        });
        
        // Reappend sorted rows
        rows.forEach(row => tbody.appendChild(row));
    }
}

// Event listeners for modal backdrop clicks and escape key
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('bg-black') && e.target.classList.contains('bg-opacity-50') && e.target.dataset.backdrop === 'true') {
        const modal = e.target;
        const modalId = modal.id;
        if (modalId) {
            UIComponents.closeModal(modalId);
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('[id$="-content"].scale-100');
        if (openModal) {
            const modalId = openModal.id.replace('-content', '');
            UIComponents.closeModal(modalId);
        }
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponents;
}
