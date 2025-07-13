// utilities.js - Utility Functions
// Common utility functions used across the application

import { getAppState } from './app-state.js';

/**
 * Display a message to the user
 */
export function showMessage(message, type = 'info', duration = 3000) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white border-0 ${getToastClass(type)}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Find or create toast container
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '1055';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    if (window.bootstrap && window.bootstrap.Toast) {
        const bsToast = new window.bootstrap.Toast(toast, {
            autohide: true,
            delay: duration
        });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    } else {
        // Fallback without Bootstrap
        toast.style.display = 'block';
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Get toast class based on message type
 */
function getToastClass(type) {
    switch (type) {
        case 'success': return 'bg-success';
        case 'error': return 'bg-danger';
        case 'warning': return 'bg-warning';
        case 'info': 
        default: return 'bg-primary';
    }
}

/**
 * Add entry to annotation log
 */
export function addLogEntry(message) {
    const AppState = getAppState();
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    AppState.logEntries.unshift(logEntry);
    
    // Keep only last 50 entries
    if (AppState.logEntries.length > 50) {
        AppState.logEntries = AppState.logEntries.slice(0, 50);
    }
    
    // Update log display
    const logBox = document.getElementById('log-box');
    if (logBox) {
        logBox.innerHTML = AppState.logEntries.map(entry => 
            `<div class="log-entry text-xs mb-1 p-1 bg-gray-100 dark:bg-gray-600 rounded">${entry}</div>`
        ).join('');
        
        // Scroll to top to show latest entry
        logBox.scrollTop = 0;
    }
    
    console.log(`[LOG] ${message}`);
}

/**
 * Get category color by name
 */
export function getCategoryColorByName(className, asTransparentFill = false) {
    const AppState = getAppState();
    const category = AppState.classes.find(cls => cls.name === className);
    let resultColor = null;
    if (category) {
        if (asTransparentFill) {
            // Convert solid color to transparent fill
            const color = category.color;
            if (color.startsWith('#')) {
                // Convert hex to rgba with transparency
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                resultColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
            } else if (color.startsWith('rgb')) {
                // Convert rgb to rgba with transparency
                resultColor = color.replace('rgb', 'rgba').replace(')', ', 0.3)');
            }
        } else {
            resultColor = category.color;
        }
        console.log('[getCategoryColorByName]', { className, asTransparentFill, resultColor });
        return resultColor;
    } else {
        console.log('[getCategoryColorByName] Category not found:', { className });
        return null;
    }
    
    // Default color if not found
    return asTransparentFill ? 'rgba(0, 123, 255, 0.3)' : '#007bff';
}

/**
 * Generate unique object ID for annotations
 */
export function generateObjectId(className) {
    const AppState = getAppState();
    const id = `${className}_${AppState.nextObjectId.toString().padStart(3, '0')}`;
    AppState.nextObjectId++;
    return id;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date for display
 */
export function formatDate(date) {
    if (!date) return 'Unknown';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

/**
 * Debounce function execution
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Throttle function execution
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === "object") {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Check if value is empty
 */
export function isEmpty(value) {
    return value === null || value === undefined || value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
}

/**
 * Generate random ID
 */
export function generateRandomId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize HTML string
 */
export function sanitizeHtml(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}