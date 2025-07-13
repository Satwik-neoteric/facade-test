/**
 * Analytics Tracker - Non-Critical Module
 * 
 * This module provides basic analytics tracking for user interactions
 * and performance metrics. It's designed to be loaded lazily and not
 * block critical application functionality.
 */

class AnalyticsTracker {
    constructor() {
        this.config = {
            enabled: false, // Disabled by default for privacy
            sessionId: this.generateSessionId(),
            startTime: Date.now(),
            debug: false
        };
        
        this.events = [];
        this.pageViews = [];
        this.performanceMarks = new Map();
    }
    
    /**
     * Initialize analytics tracking
     */
    init(options = {}) {
        this.config = { ...this.config, ...options };
        
        if (this.config.enabled) {
            console.log('📊 Analytics tracking enabled');
            this.trackPageView();
            this.setupPerformanceTracking();
        } else {
            console.log('📊 Analytics tracking disabled (privacy mode)');
        }
    }
    
    /**
     * Track a custom event
     */
    trackEvent(eventName, properties = {}) {
        if (!this.config.enabled) return;
        
        const event = {
            name: eventName,
            properties,
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            url: window.location.href
        };
        
        this.events.push(event);
        
        if (this.config.debug) {
            console.log('📊 Event tracked:', event);
        }
    }
    
    /**
     * Track page view
     */
    trackPageView() {
        if (!this.config.enabled) return;
        
        const pageView = {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            referrer: document.referrer
        };
        
        this.pageViews.push(pageView);
        
        if (this.config.debug) {
            console.log('📊 Page view tracked:', pageView);
        }
    }
    
    /**
     * Setup performance tracking
     */
    setupPerformanceTracking() {
        if (!this.config.enabled) return;
        
        // Track navigation timing
        if (window.performance && window.performance.timing) {
            setTimeout(() => {
                const timing = window.performance.timing;
                const navigationTime = timing.loadEventEnd - timing.navigationStart;
                
                this.trackEvent('page_load_complete', {
                    loadTime: navigationTime,
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    firstPaint: timing.responseStart - timing.navigationStart
                });
            }, 1000);
        }
        
        // Track unload to calculate session duration
        window.addEventListener('beforeunload', () => {
            const sessionDuration = Date.now() - this.config.startTime;
            this.trackEvent('session_end', {
                duration: sessionDuration,
                pageViews: this.pageViews.length,
                events: this.events.length
            });
        });
    }
    
    /**
     * Add performance mark
     */
    markPerformance(markName) {
        if (!this.config.enabled) return;
        
        this.performanceMarks.set(markName, Date.now());
        
        if (window.performance && window.performance.mark) {
            window.performance.mark(markName);
        }
    }
    
    /**
     * Measure performance between two marks
     */
    measurePerformance(measureName, startMark, endMark) {
        if (!this.config.enabled) return;
        
        const startTime = this.performanceMarks.get(startMark);
        const endTime = this.performanceMarks.get(endMark);
        
        if (startTime && endTime) {
            const duration = endTime - startTime;
            
            this.trackEvent('performance_measure', {
                measureName,
                duration,
                startMark,
                endMark
            });
            
            if (window.performance && window.performance.measure) {
                window.performance.measure(measureName, startMark, endMark);
            }
        }
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Get analytics summary
     */
    getSummary() {
        return {
            sessionId: this.config.sessionId,
            sessionDuration: Date.now() - this.config.startTime,
            eventsCount: this.events.length,
            pageViewsCount: this.pageViews.length,
            performanceMarks: Array.from(this.performanceMarks.keys())
        };
    }
    
    /**
     * Clear analytics data
     */
    clear() {
        this.events = [];
        this.pageViews = [];
        this.performanceMarks.clear();
        console.log('📊 Analytics data cleared');
    }
}

// Create global instance
window.analyticsTracker = new AnalyticsTracker();

// Auto-initialize with privacy-friendly defaults
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsTracker.init({
        enabled: false, // Disabled by default - user can enable if desired
        debug: window.location.hostname === 'localhost'
    });
});

console.log('📊 Analytics tracker module loaded (lazy)');
