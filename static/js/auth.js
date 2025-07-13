/* static/js/auth.js - REVISED SECTIONS */

let currentUser = null;
let authToken = null;
let userRoles = []; // Global variable in auth.js to hold current roles

// Function to dispatch a custom event when auth state is known
function dispatchAuthStateKnownEvent(isAuthenticated, rolesDetails) {
    console.log('Dispatching authStateKnown:', { isAuthenticated, rolesDetails });
    const event = new CustomEvent('authStateKnown', { 
        detail: { 
            isAuthenticated: isAuthenticated, 
            roles: rolesDetails 
        } 
    });
    document.dispatchEvent(event);
}

document.addEventListener('DOMContentLoaded', async function() { // Make async
    authToken = localStorage.getItem('jwtToken'); // Using 'jwtToken' consistently

    if (authToken) {
        // Try to use locally stored user details first for faster UI update
        const storedUsername = localStorage.getItem('username');
        const storedUserRolesRaw = localStorage.getItem('userRoles'); // Expecting JSON string array
        if (storedUsername && storedUserRolesRaw) {
            try {
                userRoles = JSON.parse(storedUserRolesRaw);
                currentUser = storedUsername;
                updateUserDisplay(currentUser, userRoles); // Update UI immediately
            } catch (e) {
                console.error("Error parsing stored user roles:", e);
                userRoles = []; // Reset if parsing failed
            }
        }
        await fetchAndVerifyCurrentUser(); // Then verify/refresh with server
    } else {
        updateUserDisplay(null, []);
        dispatchAuthStateKnownEvent(false, []); // Not authenticated
    }
});

async function fetchAndVerifyCurrentUser() {
    if (!authToken) {
        updateUserDisplay(null, []);
        dispatchAuthStateKnownEvent(false, []);
        return;
    }
    
    try {
        const response = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to authenticate token or fetch user.');
        }
        
        const userData = await response.json(); // Expecting { username: "...", roles: ["role1", "role2"] }
        
        currentUser = userData.username;
        userRoles = userData.roles || []; // Populate the global userRoles
        
        // Store fetched details in localStorage for persistence and immediate UI on next load
        localStorage.setItem('username', currentUser);
        localStorage.setItem('userRoles', JSON.stringify(userRoles));
        
        updateUserDisplay(currentUser, userRoles);
        dispatchAuthStateKnownEvent(true, userRoles); // Authenticated, pass roles
        
    } catch (error) {
        console.error('Authentication error in fetchAndVerifyCurrentUser:', error);
        // Clear invalid token and user details
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userRoles');
        authToken = null;
        currentUser = null;
        userRoles = [];
        updateUserDisplay(null, []);
        dispatchAuthStateKnownEvent(false, []); // Authentication failed
    }
}

function showLoginModal() {
    const loginModalEl = document.getElementById('loginModal');
    if (loginModalEl) {
        // Clear any previous error messages
        const loginErrorDiv = document.getElementById('login-error');
        if (loginErrorDiv) {
            loginErrorDiv.style.display = 'none';
            loginErrorDiv.textContent = '';
        }
        
        // Clear form fields
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        if (usernameField) usernameField.value = '';
        if (passwordField) passwordField.value = '';
        
        // Show the modal
        const loginModal = new bootstrap.Modal(loginModalEl);
        loginModal.show();
    } else {
        console.error('Login modal element not found');
    }
}

async function login() {
    // ... (your existing login form data gathering) ...
    const username = document.getElementById('username').value; // Ensure these IDs are in login modal
    const password = document.getElementById('password').value;
    const loginErrorDiv = document.getElementById('login-error');

    // Basic validation
    if (!username || !password) {
        if (loginErrorDiv) {
            loginErrorDiv.textContent = 'Please enter both username and password.';
            loginErrorDiv.style.display = 'block';
        }
        return;
    }

    try {
        const response = await fetch('/api/users/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', },
            body: new URLSearchParams({ 'username': username, 'password': password }),
        });
        
        const data = await response.json(); // Try to parse JSON always

        if (!response.ok) {
            throw new Error(data.detail || 'Login failed. Please check your credentials.');
        }
        
        localStorage.setItem('jwtToken', data.access_token); // Consistent key
        authToken = data.access_token;
        
        await fetchAndVerifyCurrentUser(); // This will set userRoles, update localStorage, and dispatch event

        const loginModalEl = document.getElementById('loginModal');
        if (loginModalEl) {
            const loginModalInstance = bootstrap.Modal.getInstance(loginModalEl);
            if (loginModalInstance) loginModalInstance.hide();
        }
        
    } catch (error) {
        if(loginErrorDiv) {
            loginErrorDiv.textContent = error.message;
            loginErrorDiv.style.display = 'block';
        }
    }
}

function logout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRoles');
    authToken = null;
    currentUser = null;
    userRoles = [];
    
    updateUserDisplay(null, []); // Update UI to logged-out state
    dispatchAuthStateKnownEvent(false, []); // Signal logged out state
    
    // Consider redirecting to home or login page after logout
    // window.location.href = '/';
    window.location.reload(); // Or simply reload to ensure state is cleared everywhere
}

// Ensure updateUserDisplay correctly uses the roles array for .admin-only logic
function updateUserDisplay(username, roles) {
    // ... (code to update login/logout buttons, user avatar, name, role span) ...
    // From your base.html, the elements are:
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDetailsContainer = document.getElementById('user-details-container');
    const userAvatar = userDetailsContainer ? userDetailsContainer.querySelector('.user-avatar') : null;
    const userNameSpan = userDetailsContainer ? userDetailsContainer.querySelector('.user-name') : null;
    const userRoleSpan = userDetailsContainer ? userDetailsContainer.querySelector('.user-role') : null;

    if (username && authToken && roles) {
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        if(userDetailsContainer) userDetailsContainer.style.display = 'flex';

        if(userNameSpan) userNameSpan.textContent = username;
        if(userAvatar) userAvatar.textContent = username.charAt(0).toUpperCase();
        // Displaying roles: if it's an array, join them or pick the primary one.
        if(userRoleSpan) userRoleSpan.textContent = Array.isArray(roles) ? roles.join(', ') : (roles || 'User');

        if (roles.includes('Administrator')) {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = ''); // Show
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none'); // Hide
        }
    } else {
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'none';
        if(userDetailsContainer) userDetailsContainer.style.display = 'flex'; // Or 'none' if you prefer to hide it
        if(userNameSpan) userNameSpan.textContent = 'Guest';
        if(userAvatar) userAvatar.textContent = 'G';
        if(userRoleSpan) userRoleSpan.textContent = '';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

// Make functions globally accessible if called by onclick attributes in HTML
window.login = login;
window.logout = logout;
window.showLoginModal = showLoginModal;
