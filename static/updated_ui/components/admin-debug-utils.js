/**
 * Admin Debug Utilities - Debug and testing functions for the admin interface
 */

class AdminDebugUtils {
    constructor() {
        this.bindDebugFunctions();
    }

    /**
     * Bind debug functions to window object
     */
    bindDebugFunctions() {
        // Dashboard management functions
        window.refreshDashboard = () => this.refreshDashboard();
        window.toggleAutoRefresh = (enable) => this.toggleAutoRefresh(enable);
        window.stopAutoRefresh = () => this.stopAutoRefresh();
        window.manualRefresh = () => this.manualRefresh();
        
        // Test functions
        window.testAdminPagination = () => this.testAdminPagination();
        window.testUserData = () => this.testUserData();
        window.testAdminDashboard = () => this.testAdminDashboard();
        window.forceLoadUsers = () => this.forceLoadUsers();
        
        // Debug functions
        window.debugAdminContainers = () => this.debugAdminContainers();
        window.debugDarkModeBackgrounds = () => this.debugDarkModeBackgrounds();
    }

    /**
     * Refresh dashboard
     */
    refreshDashboard() {
        if (window.dashboardStatsManager) {
            window.dashboardStatsManager.refresh();
            console.log('Dashboard manually refreshed');
        } else {
            console.error('Dashboard stats manager not initialized');
        }
    }

    /**
     * Toggle auto-refresh
     */
    toggleAutoRefresh(enable) {
        if (window.dashboardStatsManager) {
            if (enable) {
                window.dashboardStatsManager.startAutoRefresh();
                console.log('Auto-refresh enabled');
            } else {
                window.dashboardStatsManager.stopAutoRefresh();
                console.log('Auto-refresh disabled');
            }
        } else {
            console.error('Dashboard stats manager not initialized');
        }
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (window.dashboardStatsManager) {
            window.dashboardStatsManager.stopAutoRefresh();
            console.log('✅ Auto-refresh stopped');
        } else {
            console.error('Dashboard stats manager not initialized');
        }
    }

    /**
     * Manual refresh
     */
    manualRefresh() {
        console.log('🔄 Starting manual refresh...');
        
        if (window.dashboardStatsManager) {
            window.dashboardStatsManager.refresh();
        }
        
        if (window.simpleAdminLoader) {
            window.simpleAdminLoader.refreshAll();
        }
        
        console.log('✅ Manual refresh completed');
    }

    /**
     * Test admin pagination
     */
    testAdminPagination() {
        if (!window.adminCardsManager) {
            console.error('AdminCardsManager not initialized');
            return;
        }
        
        console.log('🧪 Testing admin pagination...');
        
        // Generate test data
        const testData = this.generateTestData();
        
        // Render with pagination
        window.adminCardsManager.renderUsers(testData.users);
        window.adminCardsManager.renderBatches(testData.batches);
        window.adminCardsManager.renderBuildings(testData.buildings);
        window.adminCardsManager.renderModels(testData.models);
        window.adminCardsManager.renderPipelines(testData.pipelines);
        
        console.log('✅ Test data loaded with pagination');
        this.logTestDataSummary(testData);
        this.logPaginationStatus();
        this.logTestCommands();
    }

    /**
     * Generate test data
     */
    generateTestData() {
        return {
            users: Array.from({length: 12}, (_, i) => ({
                id: `user-${i + 1}`,
                displayName: `Test User ${i + 1}`,
                email: `user${i + 1}@example.com`,
                roles: [['Administrator', 'Labeller', 'Reviewer'][i % 3]]
            })),
            batches: Array.from({length: 8}, (_, i) => ({
                id: `batch-${i + 1}`,
                description: `Test Batch ${i + 1}`,
                imageCount: Math.floor(Math.random() * 100) + 10,
                status: ['active', 'processing', 'completed'][i % 3],
                lastModified: new Date().toISOString()
            })),
            buildings: Array.from({length: 7}, (_, i) => ({
                id: `building-${i + 1}`,
                name: `Building ${i + 1}`,
                address: `123 Test St ${i + 1}`
            })),
            models: Array.from({length: 9}, (_, i) => ({
                id: `model-${i + 1}`,
                modelName: `AI Model ${i + 1}`,
                name: `AI Model ${i + 1}`,
                azureModelName: `azure-model-${i + 1}`,
                modelAccuracy: Math.floor(Math.random() * 30) + 70,
                confidence: Math.floor(Math.random() * 20) + 80,
                categoryNo: `Cat-${i + 1}`
            })),
            pipelines: Array.from({length: 6}, (_, i) => ({
                id: `pipeline-${i + 1}`,
                name: `Pipeline ${i + 1}`,
                description: `Test Pipeline ${i + 1}`,
                version: `v1.${i}`,
                amlId: `aml-${i + 1}`,
                status: ['running', 'idle', 'error'][i % 3],
                lastRun: Math.random() > 0.5 ? new Date().toISOString() : null
            }))
        };
    }

    /**
     * Log test data summary
     */
    logTestDataSummary(testData) {
        console.log('📊 Data summary:');
        Object.entries(testData).forEach(([key, value]) => {
            console.log(`   ${key}: ${value.length} items`);
        });
    }

    /**
     * Log pagination status
     */
    logPaginationStatus() {
        if (!window.adminCardsManager) return;
        
        console.log('📄 Pagination status:');
        Object.keys(window.adminCardsManager.originalData).forEach(section => {
            const info = window.adminCardsManager.getPaginationInfo(section);
            if (info.totalItems > 0) {
                console.log(`   ${section.padEnd(12)}: Page ${info.currentPage}/${info.totalPages} (${info.startItem}-${info.endItem} of ${info.totalItems})`);
            } else {
                console.log(`   ${section.padEnd(12)}: No data`);
            }
        });
    }

    /**
     * Log test commands
     */
    logTestCommands() {
        console.log('🔧 Try these commands:');
        console.log('   adminCardsManager.nextPage("users")     - Go to next page');
        console.log('   adminCardsManager.goToPage("models", 1) - Go to specific page');
        console.log('   adminCardsManager.setItemsPerPage(3)    - Change items per page');
    }

    /**
     * Test user data specifically
     */
    testUserData() {
        console.log('🧪 Testing user data specifically...');
        
        // Test if containers exist
        const usersContainer = document.getElementById('users-table-view');
        const adminCardsManager = window.adminCardsManager;
        
        console.log('📋 Container check:');
        console.log('   users-table-view element:', usersContainer);
        console.log('   AdminCardsManager:', adminCardsManager);
        
        if (!usersContainer) {
            console.error('❌ users-table-view container not found!');
            return;
        }
        
        if (!adminCardsManager) {
            console.error('❌ AdminCardsManager not initialized!');
            return;
        }
        
        // Test API call
        this.testApiCall('/api/admin/users', 'users', adminCardsManager);
    }

    /**
     * Test API call
     */
    async testApiCall(endpoint, section, manager) {
        console.log('🌐 Testing API call...');
        
        try {
            const response = await fetch(endpoint);
            console.log('API Response status:', response.status);
            
            const data = await response.json();
            console.log('API Response data:', data);
            console.log('Data type:', typeof data);
            console.log('Is array:', Array.isArray(data));
            
            if (Array.isArray(data)) {
                console.log('Data count:', data.length);
                if (data.length > 0) {
                    console.log('First item:', data[0]);
                    console.log('First item fields:', Object.keys(data[0]));
                }
            }
            
            // Force render
            const renderMethod = `render${section.charAt(0).toUpperCase() + section.slice(1)}`;
            if (typeof manager[renderMethod] === 'function') {
                manager[renderMethod](data);
            }
            
            // Check result
            this.checkRenderResult(section);
            
        } catch (error) {
            console.error('API Error:', error);
            this.testWithMockData(section, manager);
        }
    }

    /**
     * Test with mock data
     */
    testWithMockData(section, manager) {
        console.log('API failed, trying with mock data...');
        
        const mockData = this.generateMockData(section);
        console.log(`Rendering mock ${section}:`, mockData);
        
        const renderMethod = `render${section.charAt(0).toUpperCase() + section.slice(1)}`;
        if (typeof manager[renderMethod] === 'function') {
            manager[renderMethod](mockData);
        }
        
        this.checkRenderResult(section);
    }

    /**
     * Generate mock data for a section
     */
    generateMockData(section) {
        const mockData = {
            users: [
                {
                    id: 'mock-1',
                    displayName: 'Mock User 1',
                    email: 'mock1@test.com',
                    roles: ['Administrator']
                },
                {
                    id: 'mock-2', 
                    displayName: 'Mock User 2',
                    email: 'mock2@test.com',
                    roles: ['Labeller']
                }
            ]
        };
        
        return mockData[section] || [];
    }

    /**
     * Check render result
     */
    checkRenderResult(section) {
        setTimeout(() => {
            const containerMap = {
                users: 'users-table-view',
                batches: 'batches-table-view',
                buildings: 'buildings-cards-container',
                models: 'models-cards-container',
                pipelines: 'pipelines-cards-container'
            };
            
            const containerId = containerMap[section];
            const container = document.getElementById(containerId);
            
            if (container) {
                console.log(`Container after render (${section}):`);
                console.log('   Content length:', container.innerHTML.length);
                console.log('   Has table:', container.querySelector('table') ? 'YES' : 'NO');
                console.log('   Has rows:', container.querySelectorAll('tr').length);
            }
        }, 500);
    }

    /**
     * Test admin dashboard
     */
    testAdminDashboard() {
        console.log('🧪 Testing admin dashboard...');
        
        // Test dashboard stats
        if (window.dashboardStatsManager) {
            console.log('📊 Loading dashboard statistics...');
            window.dashboardStatsManager.refresh();
        }
        
        // Test pagination
        if (window.adminCardsManager) {
            console.log('📄 Testing pagination...');
            this.testAdminPagination();
        }
        
        console.log('🔧 Dashboard commands:');
        console.log('   refreshDashboard()           - Manually refresh stats');
        console.log('   toggleAutoRefresh(false)     - Disable auto-refresh');
        console.log('   toggleAutoRefresh(true)      - Enable auto-refresh');
        console.log('   testUserData()               - Test user data specifically');
    }

    /**
     * Force load users
     */
    forceLoadUsers() {
        console.log('🔄 Force loading users...');
        
        if (!window.adminCardsManager) {
            console.error('AdminCardsManager not available');
            return;
        }
        
        this.testApiCall('/api/admin/users', 'users', window.adminCardsManager);
    }

    /**
     * Debug admin containers
     */
    debugAdminContainers() {
        console.log('🔍 Debugging admin containers...');
        
        const containers = {
            'users-table-view': document.getElementById('users-table-view'),
            'batches-table-view': document.getElementById('batches-table-view'),
            'buildings-cards-container': document.getElementById('buildings-cards-container'),
            'models-cards-container': document.getElementById('models-cards-container'),
            'pipelines-cards-container': document.getElementById('pipelines-cards-container'),
            'total-users-count': document.getElementById('total-users-count'),
            'active-pipelines-count': document.getElementById('active-pipelines-count'),
            'models-count': document.getElementById('models-count'),
            'batches-count': document.getElementById('batches-count')
        };
        
        console.log('📋 Container elements:');
        Object.entries(containers).forEach(([name, element]) => {
            if (element) {
                console.log(`   ✅ ${name}: Found (${element.tagName})`);
            } else {
                console.log(`   ❌ ${name}: NOT FOUND`);
            }
        });
        
        this.debugManagerInstances();
    }

    /**
     * Debug manager instances
     */
    debugManagerInstances() {
        // Check if AdminCardsManager is initialized
        if (window.adminCardsManager) {
            console.log('✅ AdminCardsManager initialized');
            console.log('   usersContainer:', window.adminCardsManager.usersContainer);
            console.log('   batchesContainer:', window.adminCardsManager.batchesContainer);
            console.log('   originalData:', window.adminCardsManager.originalData);
        } else {
            console.log('❌ AdminCardsManager NOT initialized');
        }
        
        // Check if DashboardStatsManager is initialized
        if (window.dashboardStatsManager) {
            console.log('✅ DashboardStatsManager initialized');
            console.log('   isRefreshing:', window.dashboardStatsManager.isRefreshing);
            console.log('   refreshInterval:', window.dashboardStatsManager.refreshInterval);
        } else {
            console.log('❌ DashboardStatsManager NOT initialized');
        }
    }

    /**
     * Debug dark mode backgrounds
     */
    debugDarkModeBackgrounds() {
        console.log('=== Dark Mode Background Debug ===');
        
        const isDarkMode = document.documentElement.classList.contains('dark');
        console.log('Dark mode active:', isDarkMode);
        
        const containers = [
            'buildings-cards-container',
            'models-cards-container', 
            'pipelines-cards-container',
            'users-table-view',
            'batches-table-view',
            'buildings-table-container',
            'models-table-container',
            'pipelines-table-container'
        ];
        
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const computed = window.getComputedStyle(element);
                console.log(`${id}:`, {
                    background: computed.backgroundColor,
                    classes: element.className,
                    computed: computed.backgroundColor
                });
            }
        });
        
        console.log('=== End Debug ===');
    }
}

// Export for use in other modules
window.AdminDebugUtils = AdminDebugUtils;
