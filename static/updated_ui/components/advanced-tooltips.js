/**
 * Advanced Tooltips - Non-Critical Enhancement Module
 * 
 * This module provides enhanced tooltip functionality for the Facade Studio
 * application. It's designed to be loaded lazily and provides rich, interactive
 * tooltips with better UX than standard browser tooltips.
 */

class AdvancedTooltips {
    constructor() {
        this.config = {
            enabled: true,
            delay: 500,           // Show delay in ms
            hideDelay: 100,       // Hide delay in ms
            maxWidth: 300,        // Max tooltip width
            offset: 10,           // Distance from target element
            animation: 'fade',    // 'fade', 'slide', 'none'
            theme: 'dark',        // 'dark', 'light', 'auto'
            html: true,           // Allow HTML content
            debug: false
        };
        
        this.activeTooltip = null;
        this.tooltipElement = null;
        this.showTimeout = null;
        this.hideTimeout = null;
        this.initialized = false;
    }
    
    /**
     * Initialize advanced tooltips
     */
    init(options = {}) {
        if (this.initialized) return;
        
        this.config = { ...this.config, ...options };
        
        if (!this.config.enabled) {
            console.log('💡 Advanced tooltips disabled');
            return;
        }
        
        console.log('💡 Advanced tooltips initialized');
        
        this.createTooltipElement();
        this.setupEventListeners();
        this.addStyles();
        
        this.initialized = true;
    }
    
    /**
     * Create the tooltip DOM element
     */
    createTooltipElement() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = `advanced-tooltip ${this.config.theme}`;
        this.tooltipElement.style.cssText = `
            position: absolute;
            z-index: 10000;
            max-width: ${this.config.maxWidth}px;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            line-height: 1.4;
            pointer-events: none;
            opacity: 0;
            transform: translateY(5px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        // Apply theme styles
        if (this.config.theme === 'dark') {
            this.tooltipElement.style.backgroundColor = '#333';
            this.tooltipElement.style.color = '#fff';
            this.tooltipElement.style.border = '1px solid #555';
        } else if (this.config.theme === 'light') {
            this.tooltipElement.style.backgroundColor = '#fff';
            this.tooltipElement.style.color = '#333';
            this.tooltipElement.style.border = '1px solid #ddd';
        }
        
        document.body.appendChild(this.tooltipElement);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle elements with data-tooltip attribute
        document.addEventListener('mouseenter', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.showTooltip(element, element.getAttribute('data-tooltip'));
            }
        }, true);
        
        document.addEventListener('mouseleave', (e) => {
            const element = e.target.closest('[data-tooltip]');
            if (element) {
                this.hideTooltip();
            }
        }, true);
        
        // Handle elements with title attribute (enhance browser tooltips)
        document.addEventListener('mouseenter', (e) => {
            if (e.target.title && !e.target.hasAttribute('data-tooltip')) {
                const title = e.target.title;
                e.target.setAttribute('data-original-title', title);
                e.target.removeAttribute('title');
                this.showTooltip(e.target, title);
            }
        }, true);
        
        document.addEventListener('mouseleave', (e) => {
            if (e.target.hasAttribute('data-original-title')) {
                e.target.setAttribute('title', e.target.getAttribute('data-original-title'));
                e.target.removeAttribute('data-original-title');
                this.hideTooltip();
            }
        }, true);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.activeTooltip) {
                this.positionTooltip(this.activeTooltip.element);
            }
        });
        
        // Handle scroll
        document.addEventListener('scroll', () => {
            if (this.activeTooltip) {
                this.positionTooltip(this.activeTooltip.element);
            }
        }, true);
    }
    
    /**
     * Show tooltip for element
     */
    showTooltip(element, content) {
        if (!this.config.enabled || !content.trim()) return;
        
        // Clear any existing timeouts
        if (this.showTimeout) clearTimeout(this.showTimeout);
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        
        // Store active tooltip info
        this.activeTooltip = { element, content };
        
        this.showTimeout = setTimeout(() => {
            this.displayTooltip(element, content);
        }, this.config.delay);
    }
    
    /**
     * Display the tooltip
     */
    displayTooltip(element, content) {
        if (!this.tooltipElement) return;
        
        // Set content
        if (this.config.html) {
            this.tooltipElement.innerHTML = content;
        } else {
            this.tooltipElement.textContent = content;
        }
        
        // Position tooltip
        this.positionTooltip(element);
        
        // Show tooltip with animation
        this.tooltipElement.style.display = 'block';
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.tooltipElement.style.opacity = '1';
            this.tooltipElement.style.transform = 'translateY(0)';
        });
        
        if (this.config.debug) {
            console.log('💡 Tooltip shown:', content);
        }
    }
    
    /**
     * Position tooltip relative to target element
     */
    positionTooltip(element) {
        if (!this.tooltipElement) return;
        
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        let top = rect.bottom + this.config.offset;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Adjust for viewport boundaries
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > viewport.width - 10) {
            left = viewport.width - tooltipRect.width - 10;
        }
        
        // If tooltip would go below viewport, show above element
        if (top + tooltipRect.height > viewport.height - 10) {
            top = rect.top - tooltipRect.height - this.config.offset;
        }
        
        // Ensure tooltip is not above viewport
        if (top < 10) {
            top = rect.bottom + this.config.offset;
        }
        
        this.tooltipElement.style.left = `${left + window.scrollX}px`;
        this.tooltipElement.style.top = `${top + window.scrollY}px`;
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (!this.config.enabled) return;
        
        // Clear show timeout if it hasn't executed yet
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        
        // Clear existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        this.hideTimeout = setTimeout(() => {
            this.hideTooltipImmediate();
        }, this.config.hideDelay);
    }
    
    /**
     * Hide tooltip immediately
     */
    hideTooltipImmediate() {
        if (!this.tooltipElement) return;
        
        this.tooltipElement.style.opacity = '0';
        this.tooltipElement.style.transform = 'translateY(5px)';
        
        setTimeout(() => {
            if (this.tooltipElement) {
                this.tooltipElement.style.display = 'none';
            }
        }, 200);
        
        this.activeTooltip = null;
        
        if (this.config.debug) {
            console.log('💡 Tooltip hidden');
        }
    }
    
    /**
     * Add CSS styles for enhanced tooltips
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .advanced-tooltip {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .advanced-tooltip.multiline {
                white-space: normal;
                max-width: ${this.config.maxWidth}px;
            }
            
            .advanced-tooltip.dark {
                background-color: #333;
                color: #fff;
                border: 1px solid #555;
            }
            
            .advanced-tooltip.light {
                background-color: #fff;
                color: #333;
                border: 1px solid #ddd;
            }
            
            .advanced-tooltip code {
                background-color: rgba(255, 255, 255, 0.1);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 0.9em;
            }
            
            .advanced-tooltip .tooltip-title {
                font-weight: bold;
                margin-bottom: 4px;
            }
            
            .advanced-tooltip .tooltip-description {
                font-size: 0.9em;
                opacity: 0.9;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Add tooltip to element programmatically
     */
    addTooltip(element, content, options = {}) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        element.setAttribute('data-tooltip', content);
        
        // Apply custom options
        if (options.class) {
            element.classList.add(options.class);
        }
        
        if (options.html) {
            element.setAttribute('data-tooltip-html', 'true');
        }
    }
    
    /**
     * Remove tooltip from element
     */
    removeTooltip(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        element.removeAttribute('data-tooltip');
        element.removeAttribute('data-tooltip-html');
        
        // If this element has the active tooltip, hide it
        if (this.activeTooltip && this.activeTooltip.element === element) {
            this.hideTooltipImmediate();
        }
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.tooltipElement) {
            this.tooltipElement.style.maxWidth = `${this.config.maxWidth}px`;
            
            // Update theme
            this.tooltipElement.className = `advanced-tooltip ${this.config.theme}`;
        }
    }
    
    /**
     * Destroy tooltips system
     */
    destroy() {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }
        
        if (this.showTimeout) clearTimeout(this.showTimeout);
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        
        this.activeTooltip = null;
        this.initialized = false;
        
        console.log('💡 Advanced tooltips destroyed');
    }
}

// Create global instance
window.advancedTooltips = new AdvancedTooltips();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.advancedTooltips.init({
        debug: window.location.hostname === 'localhost'
    });
});

// Enhance existing admin tooltips
document.addEventListener('facadeStudioReady', () => {
    // Add enhanced tooltips to admin interface elements
    if (window.location.pathname.includes('/admin')) {
        console.log('💡 Enhancing admin page tooltips');
        
        // Add tooltips to buttons and controls
        document.querySelectorAll('[title]').forEach(element => {
            if (!element.hasAttribute('data-tooltip')) {
                const title = element.getAttribute('title');
                element.setAttribute('data-tooltip', title);
                element.removeAttribute('title');
            }
        });
        
        // Add specific admin tooltips
        window.advancedTooltips.addTooltip('#refresh-all-btn', 'Refresh all admin data sections');
        window.advancedTooltips.addTooltip('.pagination-info', 'Navigate through data pages');
    }
});

console.log('💡 Advanced tooltips module loaded (lazy)');
