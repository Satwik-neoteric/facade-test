/**
 * Dashboard Statistics Manager
 * Manages dashboard statistics loading, caching, and real-time updates
 */
class DashboardStatsManager {
    constructor() {
        this.config = {
            refreshInterval: 300000, // 5 minutes
            autoRefreshEnabled: false,
            cacheTimeout: 60000, // 1 minute cache
            retryAttempts: 3,
            retryDelay: 1000
        };
        
        this.state = {
            isRefreshing: false,
            intervalId: null,
            lastRefresh: null,
            cache: new Map(),
            stats: {
                users: { count: 0, data: [] },
                batches: { count: 0, data: [] },
                buildings: { count: 0, data: [] },
                models: { count: 0, data: [] },
                pipelines: { count: 0, data: [] }
            }
        };
        
        this.endpoints = {
            users: '/api/admin/users',
            batches: '/api/batches',
            buildings: '/api/buildings',
            models: '/api/models/inference',
            pipelines: '/api/pipelines/inference',
            summary: '/api/dashboard/stats'
        };
        
        this.elements = {
            users: {
                loading: 'users-loading',
                count: 'total-users-count',
                lastUpdated: 'users-last-updated',
                error: 'users-error'
            },
            batches: {
                loading: 'batches-loading',
                count: 'batches-count',
                lastUpdated: 'batches-last-updated',
                error: 'batches-error'
            },
            buildings: {
                loading: 'buildings-loading',
                count: 'buildings-count',
                lastUpdated: 'buildings-last-updated',
                error: 'buildings-error'
            },
            models: {
                loading: 'models-loading',
                count: 'models-count',
                lastUpdated: 'models-last-updated',
                error: 'models-error'
            },
            pipelines: {
                loading: 'pipelines-loading',
                count: 'active-pipelines-count',
                lastUpdated: 'pipelines-last-updated',
                error: 'pipelines-error'
            }
        };
    }

    /**
     * Initialize dashboard statistics manager
     */
    async init() {
        try {
            console.log('📊 Initializing Dashboard Stats Manager...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize with zero counts (will be updated by admin controller)
            Object.keys(this.state.stats).forEach(section => {
                this.showLoading(section);
            });
            
            console.log('✅ Dashboard Stats Manager initialized (ready for external updates)');
            
        } catch (error) {
            console.error('❌ Failed to initialize Dashboard Stats Manager:', error);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh button listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-stats-refresh]')) {
                const section = e.target.dataset.statsRefresh;
                if (section === 'all') {
                    this.refresh();
                } else {
                    this.loadSectionStats(section);
                }
            }
        });

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }

        // Refresh interval selector
        const intervalSelector = document.getElementById('refresh-interval');
        if (intervalSelector) {
            intervalSelector.addEventListener('change', (e) => {
                this.setRefreshInterval(parseInt(e.target.value) * 1000);
            });
        }
    }

    /**
     * Load all dashboard statistics
     */
    async loadAllStats() {
        if (this.state.isRefreshing) {
            console.log('📊 Stats refresh already in progress...');
            return;
        }

        this.state.isRefreshing = true;
        this.state.lastRefresh = Date.now();

        try {
            // Try to load summary first (faster)
            const summaryLoaded = await this.loadStatsSummary();
            
            if (!summaryLoaded) {
                // Fallback to individual section loading
                console.log('📊 Loading individual section stats...');
                const promises = Object.keys(this.endpoints)
                    .filter(key => key !== 'summary')
                    .map(section => this.loadSectionStats(section));

                await Promise.allSettled(promises);
            }

            this.dispatchStatsUpdatedEvent();
            
        } catch (error) {
            console.error('❌ Error loading dashboard stats:', error);
            ToastManager.error('Failed to load dashboard statistics');
        } finally {
            this.state.isRefreshing = false;
        }
    }

    /**
     * Load stats summary from dedicated endpoint
     */
    async loadStatsSummary() {
        try {
            const response = await this.fetchWithRetry(this.endpoints.summary);
            if (response.ok) {
                const summaryData = await response.json();
                
                // Update all stats from summary
                Object.entries(summaryData).forEach(([section, data]) => {
                    if (this.state.stats[section]) {
                        this.state.stats[section] = {
                            count: data.count || (Array.isArray(data) ? data.length : 0),
                            data: Array.isArray(data) ? data : data.items || []
                        };
                        this.updateUI(section);
                    }
                });

                console.log('✅ Stats summary loaded successfully');
                return true;
            }
        } catch (error) {
            console.log('📊 Stats summary endpoint not available, falling back to individual loading');
        }
        return false;
    }

    /**
     * Load statistics for a specific section
     */
    async loadSectionStats(section) {
        const elements = this.elements[section];
        const endpoint = this.endpoints[section];

        if (!endpoint) {
            console.warn(`No endpoint defined for section: ${section}`);
            return;
        }

        // Check cache first
        if (this.isCacheValid(section)) {
            console.log(`📊 Using cached data for ${section}`);
            this.updateUI(section);
            return;
        }

        this.showLoading(section);

        try {
            console.log(`📊 Loading ${section} from ${endpoint}...`);
            const response = await this.fetchWithRetry(endpoint);
            
            if (response.ok) {
                const data = await response.json();
                const processedData = this.processResponseData(data, section);
                
                // Update state
                this.state.stats[section] = {
                    count: processedData.length,
                    data: processedData
                };

                // Update cache
                this.updateCache(section, processedData);
                
                // Update UI
                this.updateUI(section);
                
                // Render via admin cards manager if available
                this.renderSectionData(section, processedData);
                
                console.log(`✅ ${section} stats loaded successfully (${processedData.length} items)`);
                
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${section} stats:`, error);
            this.showError(section, error.message);
        } finally {
            this.hideLoading(section);
        }
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, options);
                return response;
            } catch (error) {
                lastError = error;
                console.warn(`Fetch attempt ${attempt}/${this.config.retryAttempts} failed:`, error);
                
                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Process response data based on section type
     */
    processResponseData(data, section) {
        if (Array.isArray(data)) {
            return data;
        }

        // Handle different response structures
        const dataKey = section === 'buildings' ? 'buildings' : section;
        return data[dataKey] || data.data || data.items || [];
    }

    /**
     * Update UI elements for a section
     */
    updateUI(section) {
        console.log(`📊 Updating UI for ${section}...`);
        const elements = this.elements[section];
        const stats = this.state.stats[section];

        if (!elements) {
            console.warn(`⚠️ No elements defined for section: ${section}`);
            return;
        }

        if (!stats) {
            console.warn(`⚠️ No stats available for section: ${section}`);
            return;
        }

        console.log(`📊 ${section} stats:`, stats);

        // Update count
        const countEl = document.getElementById(elements.count);
        if (countEl) {
            countEl.textContent = stats.count.toLocaleString();
            console.log(`✅ Updated ${section} count to: ${stats.count}`);
        } else {
            console.warn(`⚠️ Count element not found for ${section}: ${elements.count}`);
        }

        // Update last updated time
        const lastUpdatedEl = document.getElementById(elements.lastUpdated);
        if (lastUpdatedEl) {
            const timeStr = `Updated ${new Date().toLocaleTimeString()}`;
            lastUpdatedEl.textContent = timeStr;
            console.log(`✅ Updated ${section} timestamp: ${timeStr}`);
        } else {
            console.warn(`⚠️ Last updated element not found for ${section}: ${elements.lastUpdated}`);
        }

        // Hide loading
        this.hideLoading(section);

        // Hide error if any
        this.hideError(section);
    }

    /**
     * Show loading state
     */
    showLoading(section) {
        const loadingEl = document.getElementById(this.elements[section]?.loading);
        if (loadingEl) {
            loadingEl.style.display = 'inline';
        }
    }

    /**
     * Hide loading state
     */
    hideLoading(section) {
        const loadingEl = document.getElementById(this.elements[section]?.loading);
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Show error state
     */
    showError(section, message) {
        const elements = this.elements[section];
        
        // Update count to show error
        const countEl = document.getElementById(elements.count);
        if (countEl) {
            countEl.textContent = 'Error';
            countEl.className += ' text-red-500';
        }

        // Update last updated to show error
        const lastUpdatedEl = document.getElementById(elements.lastUpdated);
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = 'Failed to load';
            lastUpdatedEl.className += ' text-red-500';
        }

        // Show error element if available
        const errorEl = document.getElementById(elements.error);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Hide error state
     */
    hideError(section) {
        const elements = this.elements[section];
        
        // Reset count styling
        const countEl = document.getElementById(elements.count);
        if (countEl) {
            countEl.className = countEl.className.replace(' text-red-500', '');
        }

        // Reset last updated styling
        const lastUpdatedEl = document.getElementById(elements.lastUpdated);
        if (lastUpdatedEl) {
            lastUpdatedEl.className = lastUpdatedEl.className.replace(' text-red-500', '');
        }

        // Hide error element
        const errorEl = document.getElementById(elements.error);
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    /**
     * Render section data using AdminCardsManager
     */
    renderSectionData(section, data) {
        if (!window.adminCardsManager) return;

        const renderMethods = {
            users: 'renderUsers',
            batches: 'renderBatches',
            buildings: 'renderBuildings',
            models: 'renderModels',
            pipelines: 'renderPipelines'
        };

        const method = renderMethods[section];
        if (method && typeof window.adminCardsManager[method] === 'function') {
            console.log(`📊 Rendering ${section} data via AdminCardsManager`);
            window.adminCardsManager[method](data);
        }
    }

    /**
     * Cache management
     */
    updateCache(section, data) {
        this.state.cache.set(section, {
            data: data,
            timestamp: Date.now()
        });
    }

    isCacheValid(section) {
        const cached = this.state.cache.get(section);
        if (!cached) return false;
        
        const age = Date.now() - cached.timestamp;
        return age < this.config.cacheTimeout;
    }

    clearCache(section = null) {
        if (section) {
            this.state.cache.delete(section);
        } else {
            this.state.cache.clear();
        }
    }

    /**
     * Auto-refresh management
     */
    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval
        
        this.config.autoRefreshEnabled = true;
        this.state.intervalId = setInterval(() => {
            console.log('📊 Auto-refreshing dashboard stats...');
            this.loadAllStats();
        }, this.config.refreshInterval);
        
        console.log(`✅ Auto-refresh started (interval: ${this.config.refreshInterval/1000} seconds)`);
        ToastManager.success('Auto-refresh enabled');
    }

    stopAutoRefresh() {
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = null;
            this.config.autoRefreshEnabled = false;
            console.log('✅ Auto-refresh stopped');
            ToastManager.info('Auto-refresh disabled');
        }
    }

    setRefreshInterval(milliseconds) {
        this.config.refreshInterval = milliseconds;
        if (this.isAutoRefreshActive()) {
            this.startAutoRefresh(); // Restart with new interval
        }
        console.log(`📊 Refresh interval set to ${milliseconds/1000} seconds`);
    }

    isAutoRefreshActive() {
        return this.state.intervalId !== null;
    }

    /**
     * Manual refresh
     */
    async refresh() {
        console.log('📊 Manual refresh triggered');
        this.clearCache(); // Clear cache to force fresh data
        await this.loadAllStats();
        ToastManager.success('Dashboard statistics refreshed');
    }

    /**
     * Get current stats
     */
    getStats(section = null) {
        if (section) {
            return this.state.stats[section] || null;
        }
        return this.state.stats;
    }

    /**
     * Get last refresh time
     */
    getLastRefreshTime() {
        return this.state.lastRefresh;
    }

    /**
     * Dispatch stats updated event
     */
    dispatchStatsUpdatedEvent() {
        const event = new CustomEvent('dashboardStatsUpdated', {
            detail: {
                stats: this.state.stats,
                lastRefresh: this.state.lastRefresh
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update stats for a specific section with provided data
     * This allows other managers to update stats without re-fetching
     */
    updateSectionStats(section, data) {
        try {
            if (!this.state.stats[section]) {
                console.warn(`⚠️ Unknown section: ${section}`);
                return;
            }

            const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
            this.state.stats[section] = {
                count: count,
                data: Array.isArray(data) ? data : (data ? [data] : [])
            };

            console.log(`📊 Updated ${section} stats externally: ${count} items`);
            
            // Hide loading and update UI
            this.hideLoading(section);
            this.updateUI(section);
            
        } catch (error) {
            console.error(`❌ Error updating ${section} stats:`, error);
        }
    }

    /**
     * Update all stats from provided data object
     */
    updateAllStats(statsData) {
        try {
            Object.entries(statsData).forEach(([section, data]) => {
                this.updateSectionStats(section, data);
            });
            
            this.dispatchStatsUpdatedEvent();
            
        } catch (error) {
            console.error('❌ Error updating all stats:', error);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardStatsManager;
}
