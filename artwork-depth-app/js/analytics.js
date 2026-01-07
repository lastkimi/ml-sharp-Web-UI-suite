/**
 * Vercel Analytics Integration
 * This script will automatically work when deployed on Vercel
 * For local development, it will gracefully fail without errors
 */
(function() {
    'use strict';
    
    // Check if we're on Vercel (has __VERCEL_ANALYTICS_ID__)
    if (typeof window !== 'undefined' && window.__VERCEL_ANALYTICS_ID__) {
        // Vercel automatically injects analytics, but we can add custom tracking
        console.log('Vercel Analytics enabled');
    }
    
    // Track page views manually (works everywhere)
    if (typeof window !== 'undefined' && window.location) {
        // Track custom events if needed
        window.trackEvent = function(eventName, properties) {
            if (window.va && window.va.track) {
                window.va.track(eventName, properties);
            } else {
                // Fallback: log to console in development
                console.log('Event:', eventName, properties);
            }
        };
        
        // Track page load
        if (document.readyState === 'complete') {
            trackEvent('page_view', {
                path: window.location.pathname,
                title: document.title
            });
        } else {
            window.addEventListener('load', function() {
                trackEvent('page_view', {
                    path: window.location.pathname,
                    title: document.title
                });
            });
        }
    }
})();
