/* Dashboard Chart Modal Functionality */
/* dashboard-modal.js */

// Modal state
let modalChart = null;
let currentChartData = null;
let currentChartType = null;

// Initialize modal functionality
function initializeChartModal() {
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.getElementById('close-modal');
    const modalCanvas = document.getElementById('modal-chart');
    
    // Add click handlers to all chart cards
    document.querySelectorAll('.chart-card').forEach(card => {
        card.addEventListener('click', function() {
            expandChart(this);
        });
    });
    
    // Close modal handlers
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Keyboard handler
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Expand chart in modal
function expandChart(cardElement) {
    const modal = document.getElementById('chart-modal');
    const modalTitle = document.getElementById('modal-chart-title');
    const modalIcon = document.getElementById('modal-icon');
    const modalCanvas = document.getElementById('modal-chart');
    
    // Get chart info from the card
    const chartCanvas = cardElement.querySelector('.chart-canvas');
    const chartTitle = cardElement.querySelector('h3 span').textContent.trim();
    const chartIcon = cardElement.querySelector('h3 i').className;
    
    // Set modal title and icon
    modalTitle.textContent = chartTitle;
    modalIcon.className = chartIcon;
    
    // Show modal
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    
    // Create expanded chart
    createExpandedChart(chartCanvas.id, modalCanvas);
}

// Create expanded chart
function createExpandedChart(originalChartId, modalCanvas) {
    // Destroy existing modal chart
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
    
    // Get original chart data
    const originalChart = getChartById(originalChartId);
    if (!originalChart) return;
    
    // Create new chart with same data but larger size
    const ctx = modalCanvas.getContext('2d');
    const chartColors = getChartColors();
    
    // Clone the original chart configuration with safe fallbacks
    const originalOptions = originalChart.config.options || {};
    const originalPlugins = originalOptions.plugins || {};
    const originalLegend = originalPlugins.legend || {};
    const originalDatalabels = originalPlugins.datalabels || {};
    
    const config = {
        type: originalChart.config.type,
        data: JSON.parse(JSON.stringify(originalChart.data)),
        options: {
            ...originalOptions,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                ...originalPlugins,
                legend: {
                    ...originalLegend,
                    labels: {
                        ...originalLegend.labels,
                        font: { 
                            size: 14, 
                            weight: 'bold', 
                            family: 'Segoe UI, Arial, sans-serif' 
                        }
                    }
                },
                datalabels: {
                    ...originalDatalabels,
                    font: { 
                        weight: 'bold', 
                        size: 14, 
                        family: 'Segoe UI, Arial, sans-serif' 
                    }
                }
            },
            scales: originalOptions.scales ? {
                ...originalOptions.scales,
                x: originalOptions.scales.x ? {
                    ...originalOptions.scales.x,
                    ticks: {
                        ...originalOptions.scales.x.ticks,
                        font: { size: 12 }
                    }
                } : undefined,
                y: originalOptions.scales.y ? {
                    ...originalOptions.scales.y,
                    ticks: {
                        ...originalOptions.scales.y.ticks,
                        font: { size: 12 }
                    }
                } : undefined
            } : undefined
        }
    };
    
    // Create the modal chart
    modalChart = new Chart(ctx, config);
}

// Get chart by canvas ID
function getChartById(canvasId) {
    switch (canvasId) {
        case 'images-per-batch-chart':
            return imagesPerBatchChart;
        case 'labelled-chart':
            return labelledChart;
        case 'categories-chart':
            return categoriesChart;
        case 'review-status-chart':
            return reviewStatusChart;
        case 'labeller-chart':
            return labellerChart;
        case 'reviewer-chart':
            return reviewerChart;
        default:
            return null;
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('chart-modal');
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    
    // Destroy modal chart
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
}

// Initialize when DOM is loaded
// Utility to set modal background color dynamically
function setModalThemeBg() {
    // getChartColors is defined in dashboard.js and should be globally available
    if (typeof getChartColors !== 'function') return;
    const isDark = document.documentElement.classList.contains('dark');
    // Use the same background as the chart card in dark mode: bg-gray-800 (#1f2937), light mode: bg-gray-50 (#f9fafb)
    const color = isDark ? '#1f2937' : '#f9fafb';
    document.querySelectorAll('.modal-theme-bg').forEach(el => {
        el.style.backgroundColor = color;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initializeChartModal();
        setModalThemeBg();
    }, 100);
});

// Listen for theme changes and update modal background
document.addEventListener('themeChanged', setModalThemeBg);

