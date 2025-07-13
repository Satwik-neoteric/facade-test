/**
 * Performance Monitor - Non-Critical Module
 * 
 * This module provides detailed performance monitoring and reporting
 * capabilities for the Facade Studio application. It's designed to be
 * loaded lazily and provides insights into application performance.
 */

// Check if PerformanceMonitor already exists to prevent redeclaration
if (!window.PerformanceMonitor) {
    class PerformanceMonitor {
        constructor() {
            this.config = {
            enabled: true,
            sampleRate: 1.0, // Monitor 100% of sessions by default
            thresholds: {
                loadTime: 3000,        // 3 seconds
                firstPaint: 1000,      // 1 second
                largestContentfulPaint: 2500, // 2.5 seconds
                cumulativeLayoutShift: 0.1,   // 0.1 CLS score
                firstInputDelay: 100   // 100ms
            },
            debug: false
        };
        
        this.metrics = {
            navigation: {},
            resources: [],
            webVitals: {},
            customMarks: new Map(),
            userInteractions: []
        };
        
        this.observers = [];
    }
    
    /**
     * Initialize performance monitoring
     */
    init(options = {}) {
        this.config = { ...this.config, ...options };
        
        if (!this.config.enabled || Math.random() > this.config.sampleRate) {
            console.log('📈 Performance monitoring disabled or not sampled');
            return;
        }
        
        console.log('📈 Performance monitoring initialized');
        
        this.setupNavigationObserver();
        this.setupResourceObserver();
        this.setupWebVitalsObserver();
        this.setupUserInteractionTracking();
        this.setupCustomMetrics();
    }
    
    /**
     * Setup navigation timing observer
     */
    setupNavigationObserver() {
        if (!window.performance || !window.performance.getEntriesByType) return;
        
        setTimeout(() => {
            const navigation = window.performance.getEntriesByType('navigation')[0];
            if (navigation) {
                this.metrics.navigation = {
                    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    firstPaint: navigation.responseStart - navigation.requestStart,
                    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
                    tcp: navigation.connectEnd - navigation.connectStart,
                    request: navigation.responseStart - navigation.requestStart,
                    response: navigation.responseEnd - navigation.responseStart,
                    dom: navigation.domContentLoadedEventStart - navigation.responseEnd
                };
                
                this.analyzeNavigationMetrics();
            }
        }, 1000);
    }
    
    /**
     * Setup resource timing observer
     */
    setupResourceObserver() {
        if (!window.PerformanceObserver) return;
        
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                        this.metrics.resources.push({
                            name: entry.name,
                            type: this.getResourceType(entry.name),
                            duration: entry.duration,
                            size: entry.transferSize || 0,
                            startTime: entry.startTime
                        });
                    }
                }
            });
            
            observer.observe({ entryTypes: ['resource'] });
            this.observers.push(observer);
        } catch (error) {
            console.warn('📈 Resource observer setup failed:', error);
        }
    }
    
    /**
     * Setup Web Vitals observer
     */
    setupWebVitalsObserver() {
        if (!window.PerformanceObserver) return;
        
        // Largest Contentful Paint (LCP)
        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.webVitals.lcp = lastEntry.startTime;
                this.analyzeWebVital('LCP', lastEntry.startTime);
            });
            
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);
        } catch (error) {
            console.warn('📈 LCP observer setup failed:', error);
        }
        
        // First Input Delay (FID)
        try {
            const fidObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.metrics.webVitals.fid = entry.processingStart - entry.startTime;
                    this.analyzeWebVital('FID', entry.processingStart - entry.startTime);
                }
            });
            
            fidObserver.observe({ entryTypes: ['first-input'] });
            this.observers.push(fidObserver);
        } catch (error) {
            console.warn('📈 FID observer setup failed:', error);
        }
        
        // Cumulative Layout Shift (CLS)
        try {
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                }
                this.metrics.webVitals.cls = clsValue;
                this.analyzeWebVital('CLS', clsValue);
            });
            
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(clsObserver);
        } catch (error) {
            console.warn('📈 CLS observer setup failed:', error);
        }
    }
    
    /**
     * Setup user interaction tracking
     */
    setupUserInteractionTracking() {
        const trackInteraction = (event) => {
            this.metrics.userInteractions.push({
                type: event.type,
                timestamp: Date.now(),
                target: event.target.tagName,
                targetId: event.target.id,
                targetClass: event.target.className
            });
        };
        
        ['click', 'scroll', 'keydown'].forEach(eventType => {
            document.addEventListener(eventType, trackInteraction, { passive: true });
        });
    }
    
    /**
     * Setup custom metrics for Facade Studio
     */
    setupCustomMetrics() {
        // Monitor admin page load time
        if (window.location.pathname.includes('/admin')) {
            this.markCustomMetric('admin_page_start');
            
            document.addEventListener('facadeStudioReady', () => {
                this.markCustomMetric('admin_page_ready');
                this.measureCustomMetric('admin_load_time', 'admin_page_start', 'admin_page_ready');
            });
        }
        
        // Monitor module loading
        if (window.facadeStudioLoader) {
            const originalInit = window.facadeStudioLoader.init;
            window.facadeStudioLoader.init = async function() {
                window.performanceMonitor.markCustomMetric('modules_load_start');
                const result = await originalInit.call(this);
                window.performanceMonitor.markCustomMetric('modules_load_end');
                window.performanceMonitor.measureCustomMetric('modules_load_time', 'modules_load_start', 'modules_load_end');
                return result;
            };
        }
    }
    
    /**
     * Mark custom performance metric
     */
    markCustomMetric(markName) {
        const timestamp = Date.now();
        this.metrics.customMarks.set(markName, timestamp);
        
        if (window.performance && window.performance.mark) {
            window.performance.mark(markName);
        }
        
        if (this.config.debug) {
            console.log(`📈 Custom mark: ${markName} at ${timestamp}`);
        }
    }
    
    /**
     * Measure time between custom marks
     */
    measureCustomMetric(measureName, startMark, endMark) {
        const startTime = this.metrics.customMarks.get(startMark);
        const endTime = this.metrics.customMarks.get(endMark);
        
        if (startTime && endTime) {
            const duration = endTime - startTime;
            
            if (window.performance && window.performance.measure) {
                window.performance.measure(measureName, startMark, endMark);
            }
            
            console.log(`📈 ${measureName}: ${duration}ms`);
            
            // Analyze custom metric
            this.analyzeCustomMetric(measureName, duration);
            
            return duration;
        }
        
        return null;
    }
    
    /**
     * Analyze navigation metrics
     */
    analyzeNavigationMetrics() {
        const nav = this.metrics.navigation;
        
        if (nav.loadTime > this.config.thresholds.loadTime) {
            console.warn(`📈 Slow page load detected: ${nav.loadTime}ms (threshold: ${this.config.thresholds.loadTime}ms)`);
        }
        
        if (nav.firstPaint > this.config.thresholds.firstPaint) {
            console.warn(`📈 Slow first paint detected: ${nav.firstPaint}ms (threshold: ${this.config.thresholds.firstPaint}ms)`);
        }
    }
    
    /**
     * Analyze Web Vitals
     */
    analyzeWebVital(vitalName, value) {
        const thresholds = this.config.thresholds;
        
        switch (vitalName) {
            case 'LCP':
                if (value > thresholds.largestContentfulPaint) {
                    console.warn(`📈 Poor LCP: ${value}ms (threshold: ${thresholds.largestContentfulPaint}ms)`);
                }
                break;
            case 'FID':
                if (value > thresholds.firstInputDelay) {
                    console.warn(`📈 Poor FID: ${value}ms (threshold: ${thresholds.firstInputDelay}ms)`);
                }
                break;
            case 'CLS':
                if (value > thresholds.cumulativeLayoutShift) {
                    console.warn(`📈 Poor CLS: ${value} (threshold: ${thresholds.cumulativeLayoutShift})`);
                }
                break;
        }
    }
    
    /**
     * Analyze custom metrics
     */
    analyzeCustomMetric(metricName, value) {
        if (metricName === 'admin_load_time' && value > 5000) {
            console.warn(`📈 Slow admin page load: ${value}ms`);
        }
        
        if (metricName === 'modules_load_time' && value > 3000) {
            console.warn(`📈 Slow module loading: ${value}ms`);
        }
    }
    
    /**
     * Get resource type from URL
     */
    getResourceType(url) {
        if (url.includes('.js')) return 'script';
        if (url.includes('.css')) return 'stylesheet';
        if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
        if (url.includes('/api/')) return 'api';
        return 'other';
    }
    
    /**
     * Generate performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            metrics: this.metrics,
            thresholds: this.config.thresholds,
            summary: this.generateSummary()
        };
        
        if (this.config.debug) {
            console.log('📈 Performance Report:', report);
        }
        
        return report;
    }
    
    /**
     * Generate performance summary
     */
    generateSummary() {
        const nav = this.metrics.navigation;
        const vitals = this.metrics.webVitals;
        
        return {
            pageLoadTime: nav.loadTime || 0,
            resourceCount: this.metrics.resources.length,
            lcp: vitals.lcp || 0,
            fid: vitals.fid || 0,
            cls: vitals.cls || 0,
            interactionCount: this.metrics.userInteractions.length,
            customMetricsCount: this.metrics.customMarks.size
        };
    }
    
    /**
     * Clean up observers
     */
    destroy() {
        this.observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (error) {
                console.warn('📈 Error disconnecting observer:', error);
            }
        });
        
        this.observers = [];
        console.log('📈 Performance monitor destroyed');
    }
}

    // Create global instance
    window.performanceMonitor = new PerformanceMonitor();

    // Auto-initialize
    document.addEventListener('DOMContentLoaded', () => {
        window.performanceMonitor.init({
            debug: window.location.hostname === 'localhost'
        });
    });
} else {
    console.log('📈 Performance monitor already exists, using existing instance');
}

console.log('📈 Performance monitor module loaded (lazy)');
