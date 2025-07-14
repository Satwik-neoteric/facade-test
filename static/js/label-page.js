/**
 * Label page specific JavaScript functionality
 * Handles class loading, sidebar toggle, mode switching, and skip button visibility
 */

// Class loading functionality
async function loadClasses() {
    try {
        const response = await fetch('/api/classes');
        const data = await response.json();
        const container = document.getElementById('class-selection-table');
        if (!container) {
            console.warn('Class selection table container not found');
            return;
        }
        
        container.innerHTML = '';
        data.classes.forEach((cls, index) => {
            const button = document.createElement('button');
            button.className = 'class-button px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-md';
            button.dataset.class = cls.name;
            button.style.backgroundColor = cls.color;
            button.style.color = '#ffffff';
            button.textContent = cls.name.replace(/-/g, ' ');
            container.appendChild(button);
        });
        console.log(`[DEBUG] Loaded ${data.classes.length} classes`);
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

// Sidebar and panel collapse/expand functionality
function setupSidebarControls() {
    // Bottom class selection panel logic
    const classPanel = document.getElementById('class-selection-panel');
    const collapseClassBtn = document.getElementById('collapse-class-selection');
    const expandClassBtn = document.getElementById('expand-class-selection');
    
    if (collapseClassBtn && classPanel && expandClassBtn) {
        collapseClassBtn.addEventListener('click', function() {
            classPanel.classList.add('collapsed');
            collapseClassBtn.style.display = 'none';
            expandClassBtn.style.display = 'flex';
            console.log('[DEBUG] Collapsed class selection panel');
        });
        
        expandClassBtn.addEventListener('click', function() {
            classPanel.classList.remove('collapsed');
            collapseClassBtn.style.display = '';
            expandClassBtn.style.display = 'none';
            console.log('[DEBUG] Expanded class selection panel');
        });
    }

    // Left sidebar collapse/expand logic
    const leftSidebar = document.getElementById('left-sidebar');
    const collapseLeftBtn = document.getElementById('collapse-left-sidebar');
    let expandLeftBtn = document.getElementById('expand-left-sidebar');
    
    if (!expandLeftBtn && leftSidebar) {
        expandLeftBtn = document.createElement('button');
        expandLeftBtn.id = 'expand-left-sidebar';
        expandLeftBtn.className = 'expand-left-sidebar-btn hidden absolute top-4 left-2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full p-2 shadow';
        expandLeftBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        leftSidebar.parentNode.insertBefore(expandLeftBtn, leftSidebar);
    }
    
    if (leftSidebar && collapseLeftBtn && expandLeftBtn) {
        collapseLeftBtn.addEventListener('click', function() {
            leftSidebar.classList.add('collapsed');
            collapseLeftBtn.style.display = 'none';
            expandLeftBtn.classList.remove('hidden');
            console.log('[DEBUG] Collapsed left sidebar');
        });
        
        expandLeftBtn.addEventListener('click', function() {
            leftSidebar.classList.remove('collapsed');
            collapseLeftBtn.style.display = '';
            expandLeftBtn.classList.add('hidden');
            console.log('[DEBUG] Expanded left sidebar');
        });
    }
}

// Skip button visibility enforcement
function enforceSkipButtonVisibility() {
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
        // Force the skip button to be visible with inline styles
        skipBtn.setAttribute('style', 'display: inline-flex !important; visibility: visible !important; opacity: 1 !important;');
        skipBtn.classList.add('global-button');
        skipBtn.disabled = false;
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
            console.log('[DEBUG] Enforcing skip button visibility');
        }
    }
}

// Mode toggle functionality
function setupModeToggle() {
    const modeToggle = document.getElementById('mode-toggle-switch');
    if (modeToggle) {
        modeToggle.addEventListener('change', function() {
            // Run immediately after toggle
            enforceSkipButtonVisibility();
            
            // And after slight delays to override any other scripts
            setTimeout(enforceSkipButtonVisibility, 100);
            setTimeout(enforceSkipButtonVisibility, 500);
            
            console.log('[DEBUG] Mode toggle changed, enforcing skip button visibility');
        });
    }
}

// Initialize all label page functionality
function initializeLabelPage() {
    console.log('[DEBUG] Initializing label page functionality');
    
    // Load classes
    loadClasses();
    
    // Setup sidebar controls
    setupSidebarControls();
    
    // Setup mode toggle
    setupModeToggle();
    
    // Run skip button enforcement immediately
    enforceSkipButtonVisibility();
    
    // Then run periodically every second
    setInterval(enforceSkipButtonVisibility, 1000);
    
    console.log('[DEBUG] Label page initialization complete');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLabelPage);
} else {
    initializeLabelPage();
}