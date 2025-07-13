/**
 * Dashboard Page Controller
 * Handles dashboard functionality and data visualization
 */
class DashboardPageController {
    constructor() {
        this.components = {};
        this.config = {
            autoRefresh: true,
            refreshInterval: 30000, // 30 seconds
            animations: true,
            realTimeUpdates: false
        };
        this.state = {
            initialized: false,
            loading: false,
            data: {
                stats: {},
                charts: {},
                activities: [],
                alerts: []
            }
        };
        this.init();
    }

    /**
     * Initialize dashboard page
     */
    async init() {
        try {
            console.log('📊 Initializing Dashboard Page Controller...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Setup auto-refresh
            if (this.config.autoRefresh) {
                this.setupAutoRefresh();
            }
            
            this.state.initialized = true;
            console.log('✅ Dashboard Page Controller initialized successfully');
            
            // Dispatch ready event
            this.dispatchEvent('dashboardPageReady', { controller: this });
            
        } catch (error) {
            console.error('❌ Failed to initialize dashboard page:', error);
            ToastManager.error('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    /**
     * Initialize dashboard components
     */
    async initializeComponents() {
        // Initialize stats manager
        if (typeof DashboardStatsManager !== 'undefined') {
            this.components.statsManager = new DashboardStatsManager();
            console.log('✅ Dashboard Stats Manager initialized');
        }

        // Initialize chart manager (if available)
        if (typeof ChartManager !== 'undefined') {
            this.components.chartManager = new ChartManager();
            console.log('✅ Chart Manager initialized');
        }

        // Initialize activity manager (if available)
        if (typeof ActivityManager !== 'undefined') {
            this.components.activityManager = new ActivityManager();
            console.log('✅ Activity Manager initialized');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-dashboard-refresh]')) {
                const section = e.target.dataset.dashboardRefresh;
                this.refreshSection(section);
            }
        });

        // Chart type toggles
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-chart-type]')) {
                const chartId = e.target.dataset.chartId;
                const chartType = e.target.value;
                this.updateChart(chartId, chartType);
            }
        });

        // Time range selectors
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-time-range]')) {
                const range = e.target.value;
                this.updateTimeRange(range);
            }
        });

        // Real-time toggle
        const realTimeToggle = document.getElementById('real-time-toggle');
        if (realTimeToggle) {
            realTimeToggle.addEventListener('change', (e) => {
                this.config.realTimeUpdates = e.target.checked;
                if (this.config.realTimeUpdates) {
                    this.startRealTimeUpdates();
                } else {
                    this.stopRealTimeUpdates();
                }
            });
        }
    }

    /**
     * Load all dashboard data
     */
    async loadDashboardData() {
        this.state.loading = true;
        
        try {
            const loadingId = LoadingManager.showPageLoading('Loading dashboard data...');
            
            await Promise.allSettled([
                this.loadStats(),
                this.loadCharts(),
                this.loadActivities(),
                this.loadAlerts()
            ]);
            
            LoadingManager.hidePageLoading(loadingId);
            ToastManager.success('Dashboard data loaded successfully');
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            ToastManager.error('Failed to load dashboard data');
        } finally {
            this.state.loading = false;
        }
    }

    /**
     * Load dashboard statistics
     */
    async loadStats() {
        try {
            if (this.components.statsManager) {
                await this.components.statsManager.loadStats();
                this.state.data.stats = this.components.statsManager.getStats();
            } else {
                // Fallback: load stats directly
                const response = await fetch('/api/dashboard/stats');
                if (response.ok) {
                    this.state.data.stats = await response.json();
                    this.renderStats();
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            throw error;
        }
    }

    /**
     * Load chart data
     */
    async loadCharts() {
        try {
            const response = await fetch('/api/dashboard/charts');
            if (response.ok) {
                this.state.data.charts = await response.json();
                this.renderCharts();
            }
        } catch (error) {
            console.error('Error loading charts:', error);
            throw error;
        }
    }

    /**
     * Load recent activities
     */
    async loadActivities() {
        try {
            const response = await fetch('/api/dashboard/activities');
            if (response.ok) {
                this.state.data.activities = await response.json();
                this.renderActivities();
            }
        } catch (error) {
            console.error('Error loading activities:', error);
            throw error;
        }
    }

    /**
     * Load system alerts
     */
    async loadAlerts() {
        try {
            const response = await fetch('/api/dashboard/alerts');
            if (response.ok) {
                this.state.data.alerts = await response.json();
                this.renderAlerts();
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
            throw error;
        }
    }

    /**
     * Render dashboard statistics
     */
    renderStats() {
        const statsContainer = document.getElementById('dashboard-stats');
        if (!statsContainer || !this.state.data.stats) return;

        const stats = this.state.data.stats;
        const statsCards = Object.entries(stats).map(([key, value]) => {
            const config = this.getStatConfig(key);
            return UIComponents.createCard(
                config.title,
                `
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="text-3xl font-bold text-${config.color}-600 dark:text-${config.color}-400">
                                ${this.formatStatValue(value, config.type)}
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                ${config.subtitle}
                            </div>
                        </div>
                        <div class="text-${config.color}-600 dark:text-${config.color}-400">
                            <i class="${config.icon} text-2xl"></i>
                        </div>
                    </div>
                `,
                [],
                { variant: 'default', className: 'dashboard-stat-card' }
            );
        }).join('');

        statsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                ${statsCards}
            </div>
        `;
    }

    /**
     * Get stat configuration
     */
    getStatConfig(statKey) {
        const configs = {
            totalUsers: {
                title: 'Total Users',
                subtitle: 'Registered users',
                icon: 'fas fa-users',
                color: 'blue',
                type: 'number'
            },
            totalBatches: {
                title: 'Total Batches',
                subtitle: 'Image batches',
                icon: 'fas fa-images',
                color: 'green',
                type: 'number'
            },
            totalBuildings: {
                title: 'Buildings',
                subtitle: 'Managed buildings',
                icon: 'fas fa-building',
                color: 'purple',
                type: 'number'
            },
            totalModels: {
                title: 'AI Models',
                subtitle: 'Active models',
                icon: 'fas fa-brain',
                color: 'orange',
                type: 'number'
            }
        };

        return configs[statKey] || {
            title: statKey,
            subtitle: '',
            icon: 'fas fa-chart-bar',
            color: 'gray',
            type: 'number'
        };
    }

    /**
     * Format stat value
     */
    formatStatValue(value, type) {
        switch (type) {
            case 'number':
                return typeof value === 'number' ? value.toLocaleString() : value;
            case 'percentage':
                return `${value}%`;
            case 'currency':
                return `$${value.toLocaleString()}`;
            default:
                return value;
        }
    }

    /**
     * Render charts
     */
    renderCharts() {
        const chartsContainer = document.getElementById('dashboard-charts');
        if (!chartsContainer || !this.state.data.charts) return;

        // This would integrate with a charting library like Chart.js or D3.js
        chartsContainer.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h3 class="text-lg font-semibold mb-4">Usage Over Time</h3>
                    <div id="usage-chart" class="h-64 flex items-center justify-center text-gray-500">
                        Chart placeholder - integrate with Chart.js
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h3 class="text-lg font-semibold mb-4">Model Performance</h3>
                    <div id="performance-chart" class="h-64 flex items-center justify-center text-gray-500">
                        Chart placeholder - integrate with Chart.js
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recent activities
     */
    renderActivities() {
        const activitiesContainer = document.getElementById('dashboard-activities');
        if (!activitiesContainer || !this.state.data.activities) return;

        const activities = this.state.data.activities.slice(0, 10); // Show last 10 activities
        
        const activitiesHtml = activities.map(activity => `
            <div class="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <i class="${this.getActivityIcon(activity.type)} text-blue-600 dark:text-blue-400 text-sm"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900 dark:text-gray-100">${activity.message}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${this.formatTime(activity.timestamp)}</p>
                </div>
            </div>
        `).join('');

        activitiesContainer.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold">Recent Activities</h3>
                </div>
                <div class="divide-y divide-gray-200 dark:divide-gray-700">
                    ${activitiesHtml}
                </div>
            </div>
        `;
    }

    /**
     * Get activity icon
     */
    getActivityIcon(type) {
        const icons = {
            user_created: 'fas fa-user-plus',
            batch_uploaded: 'fas fa-upload',
            model_trained: 'fas fa-brain',
            inference_completed: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle'
        };
        return icons[type] || 'fas fa-info-circle';
    }

    /**
     * Format timestamp
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }

    /**
     * Render system alerts
     */
    renderAlerts() {
        const alertsContainer = document.getElementById('dashboard-alerts');
        if (!alertsContainer || !this.state.data.alerts.length) return;

        const alertsHtml = this.state.data.alerts.map(alert => 
            UIComponents.createAlert(alert.message, {
                type: alert.type,
                dismissible: true,
                id: `alert-${alert.id}`
            })
        ).join('');

        alertsContainer.innerHTML = `
            <div class="space-y-4">
                ${alertsHtml}
            </div>
        `;
    }

    /**
     * Refresh specific section
     */
    async refreshSection(section) {
        const refreshMethods = {
            stats: () => this.loadStats(),
            charts: () => this.loadCharts(),
            activities: () => this.loadActivities(),
            alerts: () => this.loadAlerts(),
            all: () => this.loadDashboardData()
        };

        const method = refreshMethods[section];
        if (method) {
            try {
                ToastManager.info(`Refreshing ${section}...`);
                await method();
                ToastManager.success(`${section} refreshed successfully`);
            } catch (error) {
                console.error(`Error refreshing ${section}:`, error);
                ToastManager.error(`Failed to refresh ${section}`);
            }
        }
    }

    /**
     * Setup auto-refresh
     */
    setupAutoRefresh() {
        setInterval(() => {
            if (!this.state.loading) {
                this.loadStats(); // Only refresh stats automatically
            }
        }, this.config.refreshInterval);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        // Implement WebSocket or Server-Sent Events for real-time updates
        console.log('Starting real-time updates...');
        ToastManager.info('Real-time updates enabled');
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        console.log('Stopping real-time updates...');
        ToastManager.info('Real-time updates disabled');
    }

    /**
     * Update chart type
     */
    updateChart(chartId, chartType) {
        console.log(`Updating chart ${chartId} to ${chartType}`);
        // Implement chart type change logic
    }

    /**
     * Update time range
     */
    updateTimeRange(range) {
        console.log(`Updating time range to ${range}`);
        this.loadCharts(); // Reload charts with new time range
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Get component
     */
    getComponent(name) {
        return this.components[name];
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the dashboard page
    if (document.body.classList.contains('dashboard-page') || window.location.pathname.includes('dashboard')) {
        window.dashboardPageController = new DashboardPageController();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardPageController;
}
