// dashboard-api.js - API functions specifically for the dashboard
// No ES6 imports used here for compatibility

// Dashboard API functions
async function fetchBatchList() {
  try {
    console.log('Fetching batch list from /api/batches...');
    const response = await fetch('/api/batches');
    if (!response.ok) {
      console.error('Failed to load batches:', response.status, response.statusText);
      console.log('Trying alternative path /api/batches/...');
      // Try with a trailing slash as fallback
      const altResponse = await fetch('/api/batches/');
      if (!altResponse.ok) {
        console.error('Alternative path also failed:', altResponse.status, altResponse.statusText);
        
        // Try the offline fallback endpoint
        console.log('Trying fallback endpoint /api/batches/offline...');
        const fallbackResponse = await fetch('/api/batches/offline');
        if (!fallbackResponse.ok) {
          console.error('Fallback endpoint also failed:', fallbackResponse.status, fallbackResponse.statusText);
          return []; // Return empty array as last resort
        }
        
        // Process the fallback response
        const fallbackData = await fallbackResponse.json();
        console.log('Received data from fallback endpoint:', fallbackData);
        if (fallbackData && Array.isArray(fallbackData.batches)) {
          return fallbackData.batches;
        }
        return [];
      }
      
      const altData = await altResponse.json();
      console.log('Received data from alternative path:', altData);
      if (altData && Array.isArray(altData.batches)) {
        return altData.batches;
      }
      return [];
    }
    const data = await response.json();
    // Based on BatchListResponse model in batches.py, data should have a batches property
    if (data && Array.isArray(data.batches)) {
      console.log('Received batches:', data.batches);
      return data.batches;
    }
    console.warn('Unexpected response format:', data);
    return [];  } catch (error) {
    console.error('Error loading batches:', error);
    return []; // Return empty array instead of throwing
  }
}

async function fetchStatistics(batchId = null) {
  try {
    // Build URL with optional batch parameter
    const url = batchId 
      ? `/api/statistics?batch_id=${encodeURIComponent(batchId)}` 
      : '/api/statistics';
      
    console.log(`Fetching statistics from ${url}...`);
    
    // Try primary endpoint
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to load statistics from ${url}:`, response.status, response.statusText);
      
      // Try alternative paths in order
      const alternatives = [
        '/api/statistics/',                                     // with trailing slash
        `/api/stats/statistics${batchId ? '?batch_id=' + encodeURIComponent(batchId) : ''}`,  // alternative prefix
        '/api/statistics/offline'                               // offline fallback
      ];
      
      for (const altUrl of alternatives) {
        console.log(`Trying alternative path ${altUrl}...`);
        try {
          const altResponse = await fetch(altUrl);
          if (altResponse.ok) {
            const altData = await altResponse.json();
            console.log(`Received data from ${altUrl}:`, altData);
            return altData;
          }
          console.error(`Alternative path ${altUrl} failed:`, altResponse.status, altResponse.statusText);
        } catch (altError) {
          console.error(`Error with alternative path ${altUrl}:`, altError);
        }
      }
      
      // Return empty data structure as last resort
      console.warn('All statistics endpoints failed, returning empty data');
      return {
        images_per_batch: [],
        label_status: [],
        label_breakdown: [],
        review_stats: [],
        user_comparisons: []
      };
    }
    
    const data = await response.json();
    console.log('Received statistics:', data);
    return data;
  } catch (error) {
    console.error('Error loading statistics:', error);
    // Return empty data structure instead of throwing
    return {
      images_per_batch: [],
      label_status: [],
      label_breakdown: [],
      review_stats: [],
      user_comparisons: []
    };
  }
}

// Process raw statistics data into chart-friendly format
function processDashboardData(rawData) {
  const result = {
    images_per_batch: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    label_status: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    label_breakdown: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    review_stats: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    user_comparisons: {
      labels: [],
      datasets: [
        {
          label: 'Images Labelled',
          data: []
        },
        {
          label: 'Images Reviewed',
          data: []
        }
      ]
    }
  };
  
  try {
    // Images per batch
    if (rawData.images_per_batch && rawData.images_per_batch.length) {
      result.images_per_batch.labels = rawData.images_per_batch.map(item => item.batch_id);
      result.images_per_batch.datasets[0].data = rawData.images_per_batch.map(item => item.count);
    }
    
    // Label status
    if (rawData.label_status && rawData.label_status.length) {
      result.label_status.labels = rawData.label_status.map(item => item.status);
      result.label_status.datasets[0].data = rawData.label_status.map(item => item.count);
    }
    
    // Label breakdown
    if (rawData.label_breakdown && rawData.label_breakdown.length) {
      result.label_breakdown.labels = rawData.label_breakdown.map(item => item.category);
      result.label_breakdown.datasets[0].data = rawData.label_breakdown.map(item => item.count);
    }
    
    // Review status
    if (rawData.review_stats && rawData.review_stats.length) {
      result.review_stats.labels = rawData.review_stats.map(item => item.status);
      result.review_stats.datasets[0].data = rawData.review_stats.map(item => item.count);
    }
    
    // User comparisons
    if (rawData.user_comparisons && rawData.user_comparisons.length) {
      result.user_comparisons.labels = rawData.user_comparisons.map(item => item.user);
      // For labelled images
      result.user_comparisons.datasets[0].data = rawData.user_comparisons.map(item => item.count);
      // For reviewed images - using the same data for now, would be updated with real data
      result.user_comparisons.datasets[1].data = rawData.user_comparisons.map(item => 
        Math.floor(item.count * 0.8)); // Mock data: assume 80% of labeled images are reviewed
    }
  } catch (error) {
    console.error('Error processing dashboard data:', error);
  }
    return result;
}

// Function to create empty dashboard data structure
function getEmptyDashboardData() {
  return {
    images_per_batch: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    label_status: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    label_breakdown: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    review_stats: {
      labels: [],
      datasets: [{
        data: []
      }]
    },
    user_comparisons: {
      labels: [],
      datasets: [
        {
          label: 'Images Labelled',
          data: []
        },
        {
          label: 'Images Reviewed',
          data: []
        }
      ]
    }
  };
}

// Create a promise that resolves when the API functions are ready
window.dashboardApiReady = new Promise((resolve) => {
  window.dashboardApi = {
    fetchBatchList,
    fetchStatistics
  };
  resolve();
});
