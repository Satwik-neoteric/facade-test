/**
 * Theme Manager for Dark/Light Mode Toggle
 * Core theme management functionality for the entire application
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.transitions = true;
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Check for saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme, false); // Don't animate initial load
        
        // Set up theme toggle button listener
        this.setupThemeToggle();
        
        // Listen for system theme changes
        this.setupSystemThemeListener();
        
        // Apply initial styles after a short delay to ensure DOM is ready
        setTimeout(() => {
            const effectiveTheme = this.getCurrentEffectiveTheme();
            if (effectiveTheme === 'dark') {
                this.applyDarkModeStyles();
            } else {
                this.applyLightModeStyles();
            }
        }, 100);
        
        console.log('🎨 Theme Manager initialized');
    }

    /**
     * Set theme with optional animation
     */
    setTheme(theme, animate = true) {
        const validThemes = ['light', 'dark', 'auto'];
        if (!validThemes.includes(theme)) {
            console.warn(`Invalid theme: ${theme}. Using 'light' as fallback.`);
            theme = 'light';
        }

        console.log(`🎨 Setting theme to: ${theme}`);
        this.currentTheme = theme;
        
        if (animate && this.transitions) {
            this.addTransitionEffect();
        }

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark-theme');
            this.applyDarkModeStyles();
            console.log('🌙 Applied dark theme classes');
        } else if (theme === 'light') {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark-theme');
            this.applyLightModeStyles();
            console.log('🌞 Applied light theme classes');
        } else if (theme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.classList.add('dark');
                document.body.classList.add('dark-theme');
                this.applyDarkModeStyles();
                console.log('🌙 Applied dark theme classes (auto mode)');
            } else {
                document.documentElement.classList.remove('dark');
                document.body.classList.remove('dark-theme');
                this.applyLightModeStyles();
                console.log('🌞 Applied light theme classes (auto mode)');
            }
        }
        
        localStorage.setItem('theme', theme);
        this.updateToggleButton(theme);
        this.dispatchThemeChangeEvent(theme);
        
        if (animate && this.transitions) {
            setTimeout(() => this.removeTransitionEffect(), 300);
        }
    }

    /**
     * Apply dark mode styles programmatically
     */
    applyDarkModeStyles() {
        // Force update CSS custom properties for navbar
        const root = document.documentElement;
        root.style.setProperty('--navbar-bg', '#1f2937');
        root.style.setProperty('--navbar-border', '#374151');
        root.style.setProperty('--toggle-bg', '#374151');
        root.style.setProperty('--toggle-color', '#d1d5db');
        root.style.setProperty('--toggle-icon-color', '#fbbf24');
        
        // Force update navbar specifically
        const navbar = document.querySelector('nav');
        if (navbar) {
            navbar.style.backgroundColor = '#1f2937';
            navbar.style.borderColor = '#374151';
        }
    }

    /**
     * Apply light mode styles programmatically
     */
    applyLightModeStyles() {
        // Reset CSS custom properties for navbar
        const root = document.documentElement;
        root.style.setProperty('--navbar-bg', 'white');
        root.style.setProperty('--navbar-border', '#e5e7eb');
        root.style.setProperty('--toggle-bg', '#f3f4f6');
        root.style.setProperty('--toggle-color', '#4b5563');
        root.style.setProperty('--toggle-icon-color', '#2563eb');
        
        // Force update navbar specifically
        const navbar = document.querySelector('nav');
        if (navbar) {
            navbar.style.backgroundColor = 'white';
            navbar.style.borderColor = '#e5e7eb';
        }
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = this.getCurrentEffectiveTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Get current effective theme (resolves 'auto' to actual theme)
     */
    getCurrentEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }

    /**
     * Update theme toggle button appearance
     */
    updateToggleButton(theme) {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('i');
        const effectiveTheme = this.getCurrentEffectiveTheme();
        
        console.log(`🎨 Updating toggle button for theme: ${effectiveTheme}`);
        
        if (effectiveTheme === 'dark') {
            // In dark mode, show sun icon (click to go to light)
            if (icon) {
                icon.className = 'fas fa-sun text-yellow-400';
                console.log('🌞 Set sun icon for dark mode');
            }
            toggleBtn.setAttribute('aria-label', 'Switch to light mode');
            toggleBtn.setAttribute('title', 'Switch to light mode');
        } else {
            // In light mode, show moon icon (click to go to dark)
            if (icon) {
                icon.className = 'fas fa-moon text-yellow-400';
                console.log('🌙 Set moon icon for light mode');
            }
            toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
            toggleBtn.setAttribute('title', 'Switch to dark mode');
        }
    }

    /**
     * Setup theme toggle button event listener
     */
    setupThemeToggle() {
        const setupToggle = () => {
            const toggleBtn = document.getElementById('theme-toggle');
            if (toggleBtn && !toggleBtn.hasAttribute('data-theme-setup')) {
                toggleBtn.setAttribute('data-theme-setup', 'true');
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.addLoadingEffect(toggleBtn);
                    setTimeout(() => {
                        this.toggleTheme();
                        this.removeLoadingEffect(toggleBtn);
                    }, 200);
                });
                console.log('🎨 Theme toggle button setup complete');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupToggle);
        } else {
            setupToggle();
        }

        // Also try to setup button if it's added dynamically
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const toggleBtn = node.id === 'theme-toggle' ? node : node.querySelector?.('#theme-toggle');
                        if (toggleBtn && !toggleBtn.hasAttribute('data-theme-setup')) {
                            setupToggle();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Setup system theme change listener
     */
    setupSystemThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.setTheme('auto', true);
            }
        });
    }

    /**
     * Add loading effect to button
     */
    addLoadingEffect(element) {
        if (!element) return;
        
        element.disabled = true;
        element.classList.add('opacity-50', 'pointer-events-none');
        const icon = element.querySelector('i');
        if (icon) {
            icon.dataset.originalClass = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
        }
    }

    /**
     * Remove loading effect from button
     */
    removeLoadingEffect(element) {
        if (!element) return;
        
        element.disabled = false;
        element.classList.remove('opacity-50', 'pointer-events-none');
        const icon = element.querySelector('i');
        if (icon && icon.dataset.originalClass) {
            icon.className = icon.dataset.originalClass;
            delete icon.dataset.originalClass;
        }
    }

    /**
     * Add smooth transition effect
     */
    addTransitionEffect() {
        if (!this.transitions) return;
        
        const style = document.createElement('style');
        style.id = 'theme-transition';
        style.textContent = `
            *, *::before, *::after {
                transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Remove transition effect
     */
    removeTransitionEffect() {
        const style = document.getElementById('theme-transition');
        if (style) {
            style.remove();
        }
    }

    /**
     * Dispatch theme change event
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: {
                theme: theme,
                effectiveTheme: this.getCurrentEffectiveTheme(),
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Enable/disable transitions
     */
    setTransitions(enabled) {
        this.transitions = enabled;
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Check if dark mode is active
     */
    isDarkMode() {
        return this.getCurrentEffectiveTheme() === 'dark';
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

// Export for browser global usage
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
}