// user-roles.js - User Role Management
// Handles user role information and permissions

import { getAppState } from './app-state.js';

/**
 * Initialize user role information
 */
export function initUserRole() {
    const AppState = getAppState();
    
    // Set default user data in AppState
    AppState.user = {
        name: 'User1',
        role: 'Default Admin', // 'Default Admin' or 'Reviewer'
        canLabel: true,
        canValidate: true
    };
    
    console.log('[DEBUG] User role initialized:', AppState.user);
}

/**
 * Initialize user roles (fetch from API if needed)
 */
export async function initializeUserRoles() {
    try {
        console.log("[DEBUG] Initializing user roles");
        const AppState = getAppState();
        
        // Check if window.userInfo exists
        if (window.userInfo) {
            console.log("[DEBUG] Using window.userInfo:", window.userInfo);
            AppState.user = {
                name: window.userInfo.name || 'User1',
                role: window.userInfo.role || 'Default Admin',
                canLabel: true,
                canValidate: true
            };
        } else {
            console.log("[DEBUG] No window.userInfo found, using defaults");
            // Use default values
            AppState.user = {
                name: 'User1',
                role: 'Default Admin',
                canLabel: true,
                canValidate: true
            };
        }
        
        console.log("[DEBUG] User roles initialized:", AppState.user);
        return AppState.user;
    } catch (error) {
        console.error("[DEBUG] Error initializing user roles:", error);
        // Fallback to default
        const AppState = getAppState();
        AppState.user = {
            name: 'User1',
            role: 'Default Admin',
            canLabel: true,
            canValidate: true
        };
        return AppState.user;
    }
}

/**
 * Check if user has Administrator role
 */
export function isAdministrator() {
    const AppState = getAppState();
    const userRole = AppState.user?.role || 'Default Admin';
    return userRole === 'Administrator' || userRole === 'Default Admin';
}

/**
 * Check if user has Labeller role
 */
export function isLabeller() {
    const AppState = getAppState();
    const userRole = AppState.user?.role || 'Default Admin';
    return userRole === 'Labeller' || userRole === 'Default Admin';
}

/**
 * Check if user has Reviewer role
 */
export function isReviewer() {
    const AppState = getAppState();
    const userRole = AppState.user?.role || 'Default Admin';
    return userRole === 'Reviewer';
}

/**
 * Setup UI based on user role
 */
export async function setupBasedOnRole() {
    const AppState = getAppState();
    const user = AppState.user;
    
    console.log(`[DEBUG] Setting up UI for role: ${user.role}`);
    
    if (isReviewer()) {
        // Reviewers should only see Validate mode
        const modeToggle = document.getElementById('mode-toggle-switch');
        if (modeToggle) {
            modeToggle.checked = true; // Set to Validate state
            modeToggle.disabled = true; // Disable the toggle
        }
        
        // Hide label-only buttons
        const submitBtn = document.getElementById('submit-btn');
        const deleteBtn = document.getElementById('delete-btn');
        if (submitBtn) submitBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        // Show validation buttons
        const acceptBtn = document.getElementById('accept-btn');
        const rejectBtn = document.getElementById('reject-btn');
        const skipBtn = document.getElementById('skip-btn');
        if (acceptBtn) acceptBtn.style.display = 'inline-flex';
        if (rejectBtn) rejectBtn.style.display = 'inline-flex';
        if (skipBtn) skipBtn.classList.add('validation-btn');
        
        // Set app state to validation mode
        if (window.toggleValidationMode) {
            window.toggleValidationMode(true);
        }
        
        console.log('[DEBUG] User is a Reviewer, validation mode enabled by default');
    } else {
        // Default to Label state for Admin and other roles
        const modeToggle = document.getElementById('mode-toggle-switch');
        if (modeToggle) {
            modeToggle.checked = false; // Set to Label state
            modeToggle.disabled = false; // Enable the toggle
        }
        
        // Show label buttons
        const submitBtn = document.getElementById('submit-btn');
        const deleteBtn = document.getElementById('delete-btn');
        if (submitBtn) submitBtn.style.display = 'inline-flex';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        
        // Hide validation buttons
        const acceptBtn = document.getElementById('accept-btn');
        const rejectBtn = document.getElementById('reject-btn');
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (rejectBtn) rejectBtn.style.display = 'none';
        
        console.log('[DEBUG] User is an Admin or Labeller, label mode enabled by default');
    }
}