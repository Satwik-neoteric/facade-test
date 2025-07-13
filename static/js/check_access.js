// check_access.js - Utility script to check API endpoint accessibility
// This script runs in the browser console to diagnose API endpoint issues

/**
 * Tests all API endpoints and reports on their status.
 * To use: Run in browser console on any page of the application.
 */
async function checkApiEndpoints() {
  console.group('API Endpoint Check');
  console.log('Testing API endpoints accessibility...');
  
  const endpoints = [
    '/api/batches',
    '/api/batches/',
    '/api/statistics',
    '/api/statistics/',
    '/api/statistics/offline',
    '/api/classes',
    '/api/classes/',
    '/diagnostic/api-health',
    '/diagnostic/route-test',
    '/healthcheck'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const startTime = Date.now();
      const response = await fetch(endpoint);
      const responseTime = Date.now() - startTime;
      
      let status;
      try {
        const data = await response.json();
        status = {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          responseTime: `${responseTime}ms`,
          ok: response.ok,
          dataReceived: !!data,
          headers: Object.fromEntries(response.headers)
        };
      } catch (jsonError) {
        status = {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          responseTime: `${responseTime}ms`,
          ok: response.ok,
          dataReceived: false,
          error: 'Could not parse JSON response',
          headers: Object.fromEntries(response.headers)
        };
      }
      
      results.push(status);
      console.log(`${endpoint}: ${response.status} ${response.statusText} (${responseTime}ms)`);
    } catch (error) {
      results.push({
        endpoint,
        error: error.toString(),
        ok: false
      });
      console.error(`${endpoint}: ERROR - ${error}`);
    }
  }
  
  console.log('=== RESULTS SUMMARY ===');
  const successful = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`${successful} endpoints accessible, ${failed} endpoints failed`);
  
  console.table(results.map(r => ({
    Endpoint: r.endpoint,
    Status: r.status || 'ERROR',
    OK: r.ok || false,
    ResponseTime: r.responseTime || 'N/A'
  })));
  
  console.log('Full details:', results);
  console.groupEnd();
  
  return results;
}

// Export the function for browser console use
window.checkApiEndpoints = checkApiEndpoints;
console.log('API endpoint checker ready. Run checkApiEndpoints() to test endpoints.');
