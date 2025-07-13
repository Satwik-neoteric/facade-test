/* 
 * Main Admin Management Module
 * 
 * This is the core admin module that handles:
 * - User management (Azure AD integration)
 * - Admin page initialization and access control
 * - Modal utilities and notification system
 * - Loading state management
 * - Cross-module coordination
 * 
 * Dependencies: Bootstrap 5, jQuery
 * Used by: admin-buildings.js, admin-categories.js
 */

function initializeAdminPageContent(roles) {
    console.log("Initializing admin page content with roles:", roles);
    if (roles && roles.includes('Administrator')) {
        // User is an admin, load admin-specific content
        document.getElementById('admin-content-wrapper').style.display = 'block'; // Show main admin content
        document.getElementById('admin-access-denied').style.display = 'none';  // Hide access denied message
 
        console.log("Admin access granted, loading admin content...");
        loadADUsers();  // Load users directly from Azure AD
        
        // Categories and buildings are now loaded by their respective modules
        // But we can still call them here for immediate loading
        if (typeof loadCategories === 'function') {
            console.log("Loading categories...");
            loadCategories();
        }
        
        if (typeof loadBuildings === 'function') {
            console.log("Loading buildings...");
            loadBuildings();
        }

        // Event listeners for create user button that opens modal
        const createUserBtn = document.getElementById('create-user-btn');
        if (createUserBtn) {
            console.log("Found create user button, adding event listener");
            createUserBtn.addEventListener('click', () => {
                console.log("Create user button clicked - preparing modal");
                
                // Reset form to Add mode
                const userForm = document.getElementById('user-form');
                const userModalLabel = document.getElementById('user-modal-label');
                const submitButton = document.getElementById('add-user-btn');
                const errorElement = document.getElementById('add-user-error');
                
                if (userForm) {
                    userForm.reset();
                    console.log("Form reset");
                } else {
                    console.error("User form not found");
                }
                
                if (userModalLabel) {
                    userModalLabel.textContent = 'Add New User';
                    console.log("Modal title set to Add New User");
                } else {
                    console.error("User modal label not found");
                }
                
                if (submitButton) {
                    submitButton.textContent = 'Add User';
                    submitButton.dataset.mode = 'add';
                    delete submitButton.dataset.userId;
                    console.log("Submit button configured for add mode");
                } else {
                    console.error("Submit button not found");
                }
                
                if (errorElement) {
                    errorElement.style.display = 'none';
                    console.log("Error element hidden");
                } else {
                    console.error("Error element not found");
                }
                
                // Show modal
                const userModalElement = document.getElementById('user-modal');
                if (userModalElement) {
                    console.log("Found user modal element, creating Bootstrap modal instance");
                    try {
                        const userModal = new bootstrap.Modal(userModalElement);
                        console.log("Bootstrap modal instance created, showing modal");
                        userModal.show();
                        console.log("Modal show() called");
                    } catch (error) {
                        console.error("Error creating or showing modal:", error);
                    }
                } else {
                    console.error("User modal element not found");
                }
            });
        } else {
            console.error("Create user button not found");
        }
 
    } else {
        // User is not an admin or roles not available, redirect or show access denied
        console.log("User is not an administrator or roles are not determined. Redirecting to home.");
        // Option 1: Redirect
        // window.location.href = '/';
        // Option 2: Show an access denied message on the admin page itself
        document.getElementById('admin-content-wrapper').style.display = 'none'; // Hide main admin content
        document.getElementById('admin-access-denied').style.display = 'block'; // Show access denied message
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Admin.js DOMContentLoaded.");
    
    // First check if we're on the admin page by looking for admin elements
    const isAdminPage = document.getElementById('users-table-body') || 
                       document.getElementById('create-user-btn');
    
    if (!isAdminPage) {
        console.log("Not on admin page, skipping admin initialization");
        return;
    }
    
    console.log("Detected admin page, initializing...");
    
    // Show status notification that the modular admin system is loaded
    setTimeout(() => {
        showNotification('Info', 'Modular Admin System Loaded: Main + Buildings + Categories modules active', 'info');
    }, 1000);
    
    // Initialize admin content directly to ensure users are loaded
    loadADUsers();
    
    // Also check roles for proper access control
    console.log("Fetching user roles...");
    fetch("/api/users/roles")
        .then(response => {
            console.log("Roles API response status:", response.status);
            if (!response.ok) {
                throw new Error("Failed to fetch roles");
            }
            return response.json();
        })
        .then(data => {
            console.log("Admin.js: Available roles:", data.roles);
            if (data.roles.includes('Administrator')) {
                console.log("User has Administrator role, calling initializeAdminPageContent...");
                initializeAdminPageContent(['Administrator']);
            } else {
                const adminContentWrapper = document.getElementById('admin-content-wrapper');
                const accessDenied = document.getElementById('admin-access-denied');
                
                if (adminContentWrapper) adminContentWrapper.style.display = 'none';
                if (accessDenied) accessDenied.style.display = 'block';
                
                console.warn("User does not have Administrator role");
            }
        })
        .catch(error => {
            console.error("Error fetching roles:", error);
            document.getElementById('admin-content-wrapper').style.display = 'none';
            document.getElementById('admin-access-denied').style.display = 'block';
        });

    // Wire up the user form submission handler
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('user-email').value.trim();
            const role = document.getElementById('user-role').value;
            const submitButton = document.getElementById('add-user-btn');
            const isEditMode = submitButton && submitButton.dataset.mode === 'edit';
            const userId = isEditMode ? submitButton.dataset.userId : null;
            
            // Validate form
            let isValid = true;
            if (!email) {
                document.getElementById('add-user-error').textContent = 'Please enter an email address.';
                document.getElementById('add-user-error').style.display = 'block';
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                document.getElementById('add-user-error').textContent = 'Please enter a valid email address.';
                document.getElementById('add-user-error').style.display = 'block';
                isValid = false;
            } else if (!role) {
                document.getElementById('add-user-error').textContent = 'Please select a role.';
                document.getElementById('add-user-error').style.display = 'block';
                isValid = false;
            }
            
            if (isValid) {
                console.log(`Form submitted with email=${email}, role=${role}, isEditMode=${isEditMode}, userId=${userId}`);
                
                if (isEditMode && userId) {
                    // Handle update operation
                    updateUserRole(userId, role);
                    
                    // Reset the form to add mode after update
                    submitButton.textContent = 'Add User';
                    submitButton.dataset.mode = 'add';
                    delete submitButton.dataset.userId;
                    document.getElementById('user-modal-label').textContent = 'Add New User';
                    
                    // Close the modal
                    const userModal = bootstrap.Modal.getInstance(document.getElementById('user-modal'));
                    if (userModal) {
                        userModal.hide();
                    }
                } else {
                    // Handle add operation - wait for it to complete
                    addUser(email, role).then(() => {
                        // Only close modal on success
                        console.log('Add user successful, closing modal');
                        
                        // Reset form first
                        document.getElementById('user-form').reset();
                        document.getElementById('add-user-error').style.display = 'none';
                        
                        // Close modal with more robust handling
                        const userModalElement = document.getElementById('user-modal');
                        if (userModalElement) {
                            // Try to get existing modal instance first
                            let userModal = bootstrap.Modal.getInstance(userModalElement);
                            if (userModal) {
                                console.log('Found existing modal instance, hiding it');
                                userModal.hide();
                            } else {
                                console.log('No existing modal instance, creating new one to hide');
                                userModal = new bootstrap.Modal(userModalElement);
                                userModal.hide();
                            }
                            
                            // Ensure modal backdrop is removed after animation
                            setTimeout(() => {
                                const backdrop = document.querySelector('.modal-backdrop');
                                if (backdrop) {
                                    backdrop.remove();
                                }
                                userModalElement.classList.remove('show');
                                userModalElement.style.display = 'none';
                                document.body.classList.remove('modal-open');
                                document.body.style.removeProperty('overflow');
                                document.body.style.removeProperty('padding-right');
                            }, 300);
                        }
                        
                        // Show success notification (moved here from addUser function)
                        showNotification('Success', `User ${email} added successfully with role ${role}`, 'success');
                        
                    }).catch((error) => {
                        // Error handling is done in addUser function, just log here
                        console.log('Add user failed, keeping modal open');
                    });
                }
            }
        });
        
        // Also handle the submit button click directly
        document.getElementById('add-user-btn').addEventListener('click', function(e) {
            e.preventDefault();
            // Trigger form submission
            document.getElementById('user-form').dispatchEvent(new Event('submit'));
        });
    }
});

// Azure AD User Management Functions
async function loadADUsers() {
    const loadingElement = document.getElementById('loading-users');
    const errorElement = document.getElementById('users-error');
    const tableBody = document.getElementById('users-table-body');
    const tableContainer = document.getElementById('users-table-container');
    
    try {
        console.log("Loading AD users...");
        
        // Show loading state
        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.style.display = 'none';
        if (tableContainer) tableContainer.style.opacity = '0.6';
        
        const response = await fetch('/api/admin/users');
        console.log("Users API response status:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            
            // Special handling for different error types
            if (response.status === 401) {
                throw new Error('Azure AD authentication failed. Please check your Azure AD configuration and permissions.');
            } else if (response.status === 403) {
                throw new Error('Access denied. You may not have sufficient permissions to manage users.');
            } else if (response.status === 500) {
                throw new Error('Server error occurred while loading users. Please check the server logs for more details.');
            } else {
                throw new Error(errorData.detail || `Failed to load users (HTTP ${response.status})`);
            }
        }
        
        const data = await response.json();
        console.log("Users data received:", data);
        
        // Clear existing table content
        if (tableBody) {
            tableBody.innerHTML = '';
            
            // Check if data is an array or has a users property
            const users = Array.isArray(data) ? data : (data.users || []);
            
            if (users.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="3" class="text-center">No users found</td>';
                tableBody.appendChild(emptyRow);
            } else {
                users.forEach(user => {
                    const row = document.createElement('tr');
                    
                    // Email/Name cell
                    const emailCell = document.createElement('td');
                    emailCell.textContent = user.email || user.name || 'N/A';
                    row.appendChild(emailCell);
                    
                    // Role cell
                    const roleCell = document.createElement('td');
                    roleCell.textContent = user.role || 'N/A';
                    row.appendChild(roleCell);
                    
                    // Actions cell
                    const actionsCell = document.createElement('td');
                    actionsCell.className = 'action-buttons';
                    
                    const editButton = document.createElement('button');
                    editButton.className = 'btn btn-sm btn-primary me-2';
                    editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
                    editButton.addEventListener('click', () => showEditUserModal(user));
                    actionsCell.appendChild(editButton);
                    
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'btn btn-sm btn-danger';
                    deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
                    deleteButton.addEventListener('click', () => {
                        if (confirm(`Are you sure you want to remove user ${user.email || user.name}?`)) {
                            deleteUser(user.id);
                        }
                    });
                    actionsCell.appendChild(deleteButton);
                    
                    row.appendChild(actionsCell);
                    tableBody.appendChild(row);
                });
            }
        }
        
        // Show the table
        if (loadingElement) loadingElement.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        
        
        
    } catch (error) {
        console.error('Error loading users:', error);
        
        // Show error with helpful information
        if (errorElement) {
            let errorMessage = error.message;
            
            // Add helpful context for common errors
            if (error.message.includes('Azure AD authentication failed')) {
                errorMessage += '\n\nTroubleshooting steps:\n• Check if the Azure AD service principal is configured correctly\n• Verify that the application has the necessary Microsoft Graph permissions\n• Ensure the service principal credentials are valid';
            }
            
            errorElement.innerHTML = errorMessage.replace(/\n/g, '<br>');
            errorElement.style.display = 'block';
        }
        
        // Show a fallback message in the table
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">
                        <i class="fas fa-exclamation-triangle"></i><br>
                        Unable to load users<br>
                        <small class="text-muted">Check the error message above for details</small>
                    </td>
                </tr>
            `;
        }
        
        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';
        
    } finally {
        // Reset loading state
        if (tableContainer) tableContainer.style.opacity = '1';
    }
}

async function addUser(email, role) {
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                role: role
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            
            // Provide more specific error messages based on status codes
            if (response.status === 401) {
                throw new Error('Azure AD authentication failed. Unable to add user.');
            } else if (response.status === 403) {
                throw new Error('Access denied. You may not have sufficient permissions to add users.');
            } else if (response.status === 400) {
                throw new Error(errorData.detail || 'Invalid user data. Please check the email address and role.');
            } else if (response.status === 409) {
                throw new Error('User already exists in the system.');
            } else {
                throw new Error(errorData.detail || `Failed to add user (HTTP ${response.status})`);
            }
        }
        
        const result = await response.json();
        console.log('User added successfully:', result);
        
        // Reload user list on success
        loadADUsers();
        
        return result;
        
    } catch (error) {
        console.error('Error adding user:', error);
        
        // Show error in the modal
        const errorElement = document.getElementById('add-user-error');
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
        
        // Re-throw the error so the calling code knows it failed
        throw error;
    } finally {
        // Reset any loading states
        const submitButton = document.getElementById('add-user-btn');
        if (submitButton) {
            submitButton.disabled = false;
            // Don't change the text here as it might be in edit mode
        }
    }
}

async function updateUserRole(userId, newRole) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: newRole
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            
            if (response.status === 401) {
                throw new Error('Azure AD authentication failed. Unable to update user role.');
            } else if (response.status === 403) {
                throw new Error('Access denied. You may not have sufficient permissions to update user roles.');
            } else if (response.status === 404) {
                throw new Error('User not found. They may have been removed from the system.');
            } else {
                throw new Error(errorData.detail || `Failed to update user role (HTTP ${response.status})`);
            }
        }
        
        // Reload user list on success
        loadADUsers();
        
        // Show success message
        showNotification('Success', 'User role updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating user role:', error);
        showNotification('Error', error.message, 'danger');
    } finally {
        // Reset any loading states
        const submitButton = document.getElementById('add-user-btn');
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            
            if (response.status === 401) {
                throw new Error('Azure AD authentication failed. Unable to delete user.');
            } else if (response.status === 403) {
                throw new Error('Access denied. You may not have sufficient permissions to delete users.');
            } else if (response.status === 404) {
                throw new Error('User not found. They may have already been removed from the system.');
            } else {
                throw new Error(errorData.detail || `Failed to delete user (HTTP ${response.status})`);
            }
        }
        
        // Reload user list on success
        loadADUsers();
        
        // Show success message
        showNotification('Success', 'User removed successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error', error.message, 'danger');
    }
}

// Function to show the edit user modal with the provided user data
function showEditUserModal(user) {
    console.log("Showing edit modal for user:", user);

    // Populate the modal with user data
    const emailInput = document.getElementById('user-email');
    const roleSelect = document.getElementById('user-role');
    const modalLabel = document.getElementById('user-modal-label');
    const submitButton = document.getElementById('add-user-btn');
    const errorElement = document.getElementById('add-user-error');
    
    if (emailInput) {
        emailInput.value = user.email || '';
        console.log("Email field populated:", user.email);
    } else {
        console.error("Email input not found");
    }
    
    if (roleSelect) {
        for (let i = 0; i < roleSelect.options.length; i++) {
            if (roleSelect.options[i].value === user.role) {
                roleSelect.selectedIndex = i;
                console.log("Role selected:", user.role);
                break;
            }
        }
    } else {
        console.error("Role select not found");
    }

    // Update modal title and button text
    if (modalLabel) {
        modalLabel.textContent = 'Edit User';
        console.log("Modal title set to Edit User");
    } else {
        console.error("Modal label not found");
    }
    
    if (submitButton) {
        submitButton.textContent = 'Update User';
        submitButton.dataset.userId = user.id; // Store user ID for the update operation
        submitButton.dataset.mode = 'edit'; // Mark as edit mode
        console.log("Submit button configured for edit mode, userId:", user.id);
    } else {
        console.error("Submit button not found");
    }
    
    if (errorElement) {
        errorElement.style.display = 'none';
        console.log("Error element hidden");
    } else {
        console.error("Error element not found");
    }

    // Show the modal
    const userModalElement = document.getElementById('user-modal');
    if (userModalElement) {
        console.log("Found user modal element for edit, creating Bootstrap modal instance");
        try {
            const bsModal = new bootstrap.Modal(userModalElement);
            console.log("Bootstrap modal instance created for edit, showing modal");
            bsModal.show();
            console.log("Edit modal show() called");
        } catch (error) {
            console.error("Error creating or showing edit modal:", error);
        }
    } else {
        console.error("User modal element not found for edit");
    }
}

// Notification system
function showNotification(title, message, type) {
    // Create a Bootstrap toast notification
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(container);
    }
    
    const toastId = `toast-${Date.now()}`;
    const toastHTML = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    document.getElementById('toast-container').insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Show success message utility
function showSuccessMessage(message) {
    // Create a temporary success alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

// Utility function for loading states
function setLoading(type, isLoading) {
    const errorElement = document.getElementById(`${type}-error`);
    const tableContainer = document.getElementById(`${type}-table-container`);
    
    if (errorElement) errorElement.style.display = 'none';
    if (tableContainer) tableContainer.style.opacity = isLoading ? '0.6' : '1';
}

// Modal utility functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Close any open modals first
        document.querySelectorAll('.modal.show').forEach(m => {
            if (m !== modal) hideModal(m.id);
        });
       
        document.body.style.overflow = 'hidden';
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        document.body.style.overflow = '';
        modal.classList.remove('show');
        modal.addEventListener('transitionend', function handler() {
            if (!modal.classList.contains('show')) {
                modal.style.display = 'none';
            }
            modal.removeEventListener('transitionend', handler);
        });
    }
}

// Initialize modals
document.addEventListener('DOMContentLoaded', () => {
    // Clean up any open modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
        modal.classList.remove('show', 'fade');
    });

    // Update click handlers
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            hideModal(modal.id);
        });
    }
});

// Prevent clicks inside modal from closing it
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
});

// Event Listeners for modal close buttons
document.addEventListener('DOMContentLoaded', function() {
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
});
