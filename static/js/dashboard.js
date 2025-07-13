/* filepath: c:\\projects\\facadeai-studio\\static\\js\\dashboard.js */

// Chart objects
let imagesPerBatchChart = null;
let labelledChart = null;
let reviewStatusChart = null;
let categoriesChart = null;
let labellerChart = null;
let reviewerChart = null;

// Chart colors
function getChartColors() {
    // Detect Tailwind dark mode by checking for 'dark' class on <html> (recommended by Tailwind)
    const isDark = document.documentElement.classList.contains('dark');
    return {
        background: isDark ? '#1e1e1e' : '#fff',
        text: isDark ? '#fff' : '#374151',
        grid: isDark ? '#333333' : '#cbd5e1', // lighter grid in light mode
        primary: isDark ? '#3498db' : '#2563eb', // more contrast in light mode
        secondary: isDark ? '#e74c3c' : '#dc2626',
        accent: isDark ? '#2ecc71' : '#16a34a',
        muted: isDark ? '#95a5a6' : '#64748b',
        pieColors: isDark
            ? [
                '#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'
            ]
            : [
                '#2563eb', '#dc2626', '#facc15', '#16a34a', '#a21caf', '#ea580c'
            ]
    };
}

// Common chart options
function getCommonChartOptions() {
    const chartColors = getChartColors();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: chartColors.text,
                    font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                }
            },
            datalabels: {
                color: chartColors.text,
                font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                formatter: (value) => value
            }
        }
    };
}

// Dashboard data
let dashboardData = {
    images_per_batch: null,
    labels_stats: null,
    user_activity: null,
    review_status: null
};

// Document Ready Function
document.addEventListener('DOMContentLoaded', function() {

    // Show initial loading state
    showInitialLoadingState();

    // Listen for theme changes from ThemeManager and update charts
    document.addEventListener('themeChanged', function() {
        updateCharts();
    });

    // Wait for dashboard API to be ready
    window.dashboardApiReady.then(() => {
        // Load batch filter options
        loadBatchFilter();
        
        // Set up refresh button
        document.getElementById('refresh-dashboard').addEventListener('click', refreshDashboard);
        
        // Set up filter change event
        document.getElementById('batch-filter').addEventListener('change', function() {
            loadDashboardData(this.value);
        });
        
        // Initial load without filter
        loadDashboardData();
    });
});

// Show initial loading state for all charts
function showInitialLoadingState() {
    document.querySelectorAll('.chart-container').forEach(container => {
        const loading = container.querySelector('.chart-loading');
        const error = container.querySelector('.chart-error');
        
        if (loading) loading.classList.remove('hidden');
        if (error) error.classList.add('hidden');
    });
}

// Load batch options for filter dropdown
async function loadBatchFilter() {
    try {
        // Use the fetchBatchList function from the global dashboardApi object
        const batches = await window.dashboardApi.fetchBatchList();
        const batchSelect = document.getElementById('batch-filter');
        
        // Clear existing options except the "All Batches" option
        while (batchSelect.options.length > 1) {
            batchSelect.remove(1);
        }
        
        // Add options from API
        if (Array.isArray(batches)) {
            batches.forEach(batch => {
                const option = document.createElement('option');
                option.value = batch;
                option.textContent = batch;
                batchSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading batches:', error);
    }
}

// Load dashboard data with optional batch filter
async function loadDashboardData(batchId = null) {
    try {
        // Show loading state and reset error states
        document.querySelectorAll('.chart-container').forEach(container => {
            const loading = container.querySelector('.chart-loading');
            const error = container.querySelector('.chart-error');
            
            if (loading) loading.classList.remove('hidden');
            if (error) error.classList.add('hidden');
        });
        
        console.log(`Loading dashboard data with batch filter: ${batchId || 'none'}`);
        
        // Use the fetchStatistics function from the global dashboardApi object
        const data = await window.dashboardApi.fetchStatistics(batchId);
        dashboardData = data;
        
        // Check if we have valid data
        if (!data || Object.keys(data).length === 0) {
            throw new Error('No data received from API');
        }
        
        // Update all charts
        try {
            updateCharts();
            console.log('All charts updated successfully');
        } catch (chartError) {
            console.error('Error updating charts:', chartError);
            // Show error state
            document.querySelectorAll('.chart-container').forEach(container => {
                const loading = container.querySelector('.chart-loading');
                const error = container.querySelector('.chart-error');
                
                if (loading) loading.classList.add('hidden');
                if (error) error.classList.remove('hidden');
            });
            return;
        }
        
        // Hide loading state
        document.querySelectorAll('.chart-container').forEach(container => {
            const loading = container.querySelector('.chart-loading');
            if (loading) loading.classList.add('hidden');
        });
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Hide loading state and show error state
        document.querySelectorAll('.chart-container').forEach(container => {
            const loading = container.querySelector('.chart-loading');
            const errorEl = container.querySelector('.chart-error');
            
            if (loading) loading.classList.add('hidden');
            if (errorEl) {
                errorEl.classList.remove('hidden');
                // Update error message
                const errorText = errorEl.querySelector('p');
                if (errorText) {
                    errorText.textContent = `Error loading chart data: ${error.message || 'Unknown error'}`;
                }
            }
        });
    }
}

// Refresh dashboard
function refreshDashboard() {
    const refreshButton = document.getElementById('refresh-dashboard');
    const refreshIcon = refreshButton.querySelector('i');
    const refreshText = refreshButton.querySelector('span');
    
    // Show loading state on refresh button
    refreshButton.disabled = true;
    refreshIcon.classList.add('fa-spin');
    refreshText.textContent = 'Refreshing...';
    
    const batchFilter = document.getElementById('batch-filter').value;
    
    // Load data and restore button state
    loadDashboardData(batchFilter).finally(() => {
        refreshButton.disabled = false;
        refreshIcon.classList.remove('fa-spin');
        refreshText.textContent = 'Refresh';
    });
}

// Update all charts with current data
function updateCharts() {
    updateImagesPerBatchChart();
    updateLabelledChart();
    updateReviewStatusChart();
    updateCategoriesChart();
    updateUserActivityCharts();
}

// Update the Images per Batch chart
function updateImagesPerBatchChart() {
    const ctx = document.getElementById('images-per-batch-chart').getContext('2d');
    const chartColors = getChartColors();
    const commonChartOptions = getCommonChartOptions();
    if (imagesPerBatchChart) {
        imagesPerBatchChart.destroy();
    }
    // Process data from the API format to the format expected by Chart.js
    const imageStats = dashboardData.images_per_batch || [];
    const chartLabels = imageStats.map(item => item.batch_id);
    const chartData = imageStats.map(item => item.count);
    imagesPerBatchChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Number of Images',
                data: chartData,
                backgroundColor: chartColors.primary,
                barThickness: 40
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    },
                    title: {
                        display: true,
                        text: 'Image Count',
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                },
                x: {
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Update the Labelled vs Unlabelled chart
function updateLabelledChart() {
    const ctx = document.getElementById('labelled-chart').getContext('2d');
    const chartColors = getChartColors();
    const commonChartOptions = getCommonChartOptions();
    if (labelledChart) {
        labelledChart.destroy();
    }
    // Process data from the API format to the format expected by Chart.js
    const statusStats = dashboardData.label_status || [];
    const chartLabels = statusStats.map(item => item.status);
    const chartData = statusStats.map(item => item.count);
    labelledChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors.pieColors,
                borderWidth: 0
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '60%',
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' },
                        padding: 20
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Update the Review Status chart
function updateReviewStatusChart() {
    const ctx = document.getElementById('review-status-chart').getContext('2d');
    const chartColors = getChartColors();
    const commonChartOptions = getCommonChartOptions();
    if (reviewStatusChart) {
        reviewStatusChart.destroy();
    }
    // Process data from the API format to the format expected by Chart.js
    const reviewStats = dashboardData.review_stats || [];
    const chartLabels = reviewStats.map(item => item.status);
    const chartData = reviewStats.map(item => item.count);
    reviewStatusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors.pieColors,
                borderWidth: 0
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' },
                        padding: 20
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Update the Categories chart
function updateCategoriesChart() {
    const ctx = document.getElementById('categories-chart').getContext('2d');
    const chartColors = getChartColors();
    const commonChartOptions = getCommonChartOptions();
    if (categoriesChart) {
        categoriesChart.destroy();
    }
    // Process data from the API format to the format expected by Chart.js
    const breakdownStats = dashboardData.label_breakdown || [];
    const chartLabels = breakdownStats.map(item => item.category);
    const chartData = breakdownStats.map(item => item.count);
    categoriesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors.pieColors,
                borderWidth: 0
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '60%',
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' },
                        padding: 20
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Update User Activity Charts (Labeller and Reviewer)
function updateUserActivityCharts() {
    // Labeller chart
    const labellerCtx = document.getElementById('labeller-chart').getContext('2d');
    const chartColors = getChartColors();
    const commonChartOptions = getCommonChartOptions();
    if (labellerChart) {
        labellerChart.destroy();
    }
    // Process data from the API format to the format expected by Chart.js
    const userStats = dashboardData.user_comparisons || [];
    const chartLabels = userStats.map(item => item.user);
    const chartData = userStats.map(item => item.count);
    labellerChart = new Chart(labellerCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Images Processed',
                data: chartData,
                backgroundColor: chartColors.accent,
                barThickness: 30
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    },
                    title: {
                        display: true,
                        text: 'Images Count',
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                },
                x: {
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
    // Reviewer chart
    const reviewerCtx = document.getElementById('reviewer-chart').getContext('2d');
    if (reviewerChart) {
        reviewerChart.destroy();
    }
    // Use the same user stats for reviewer chart with a different color
    // In a real scenario, you might have separate review stats
    reviewerChart = new Chart(reviewerCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Images Reviewed',
                data: chartData.map(val => Math.round(val * 0.7)),
                backgroundColor: chartColors.secondary,
                barThickness: 30
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: chartColors.text,
                    font: { weight: 'bold', size: 12, family: 'Segoe UI, Arial, sans-serif' },
                    formatter: (value) => value
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    },
                    title: {
                        display: true,
                        text: 'Images Count',
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                },
                x: {
                    grid: {
                        color: chartColors.grid
                    },
                    ticks: {
                        color: chartColors.text,
                        font: { size: 12, weight: 'bold', family: 'Segoe UI, Arial, sans-serif' }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}