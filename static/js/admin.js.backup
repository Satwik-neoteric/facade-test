/* Main Admin Management Module */

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
        if (createUserBtn) createUserBtn.addEventListener('click', () => {
            // Reset form to Add mode
            document.getElementById('user-form').reset();
            document.getElementById('user-modal-label').textContent = 'Add New User';
            const submitButton = document.getElementById('add-user-btn');
            submitButton.textContent = 'Add User';
            submitButton.dataset.mode = 'add';
            delete submitButton.dataset.userId;
            document.getElementById('add-user-error').style.display = 'none';
            
            // Show modal
            const userModal = new bootstrap.Modal(document.getElementById('user-modal'));
            userModal.show();
        });
 
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
            console.log("Due to role check failure, loadBuildings() will not be called!");
            
            // Still try to load buildings for debugging purposes
            console.log("Attempting to load buildings anyway for debugging...");
            try {
                loadBuildings();
            } catch (buildingError) {
                console.error("Failed to load buildings in fallback:", buildingError);
            }
            
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
            // Directly handle the form submission instead of dispatching an event
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
    }
});
 
 
 
// Load users from API
async function loadUsers() {
    try {
        setLoading('users', true);
       
        const response = await fetch('/api/admin/users');
       
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
       
        const data = await response.json();
       
        // Populate users table
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '';
       
        data.users.forEach(user => {
            const row = document.createElement('tr');
           
            // Username cell
            const usernameCell = document.createElement('td');
            usernameCell.textContent = user.username;
            row.appendChild(usernameCell);
           
            // Password cell (masked)
            const passwordCell = document.createElement('td');
            passwordCell.textContent = '********';
            row.appendChild(passwordCell);
           
            // Roles cell
            const rolesCell = document.createElement('td');
            rolesCell.textContent = user.roles.join(', ');
            row.appendChild(rolesCell);
           
            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'action-buttons';
           
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-sm btn-primary';
            editButton.textContent = 'Edit Roles';
            editButton.addEventListener('click', () => showEditRolesModal(user.username, user.roles));
            actionsCell.appendChild(editButton);
           
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => confirmDeleteUser(user.username));
            actionsCell.appendChild(deleteButton);
           
            row.appendChild(actionsCell);
           
            tableBody.appendChild(row);
        });
       
        // Show the table
        document.getElementById('loading-users').style.display = 'none';
        document.getElementById('users-table-container').style.display = 'block';
       
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-error').textContent = error.message;
        document.getElementById('users-error').style.display = 'block';
    } finally {
        setLoading('users', false);
    }
}
 
// Load categories from API
async function loadCategories() {
    try {
        setLoading('categories', true);
       
        const response = await fetch('/api/classes');
       
        if (!response.ok) {
            throw new Error('Failed to load categories');
        }
       
        const data = await response.json();
       
        // Populate categories table
        const tableBody = document.getElementById('categories-table-body');
        tableBody.innerHTML = '';
       
        data.categories.forEach(category => {
            const row = document.createElement('tr');
           
            // ID cell
            const idCell = document.createElement('td');
            idCell.textContent = category.id;
            row.appendChild(idCell);
           
            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = category.name;
            row.appendChild(nameCell);
           
            // Supercategory cell
            const supercategoryCell = document.createElement('td');
            supercategoryCell.textContent = category.supercategory || '-';
            row.appendChild(supercategoryCell);
           
            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'action-buttons';
           
            // Category actions (disabled for now as not implemented in API)
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-sm btn-primary';
            editButton.textContent = 'Edit';
            editButton.disabled = true;
            editButton.title = 'Not implemented yet';
            actionsCell.appendChild(editButton);
           
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.textContent = 'Delete';
            deleteButton.disabled = true;
            deleteButton.title = 'Not implemented yet';
            actionsCell.appendChild(deleteButton);
           
            row.appendChild(actionsCell);
           
            tableBody.appendChild(row);
        });
       
        // Show the table
        document.getElementById('loading-categories').style.display = 'none';
        document.getElementById('categories-table-container').style.display = 'block';
       
    } catch (error) {
        console.error('Error loading categories:', error);
        document.getElementById('categories-error').textContent = error.message;
        document.getElementById('categories-error').style.display = 'block';
    } finally {
        setLoading('categories', false);
    }
}
 
// Show add user modal
function showAddUserModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('user-modal')) || 
                 new bootstrap.Modal(document.getElementById('user-modal'));
    document.getElementById('user-form').reset();
    document.getElementById('add-user-error').style.display = 'none';
    modal.show();
}
 
// Add a new user
async function addUser() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
   
    if (!username || !password) {
        document.getElementById('add-user-error').textContent = 'Please fill in all required fields.';
        document.getElementById('add-user-error').style.display = 'block';
        return;
    }
   
    // Get selected roles
    const roles = [];
    document.querySelectorAll('#user-form input[type="checkbox"]:checked').forEach(checkbox => {
        roles.push(checkbox.value);
    });
   
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, roles })
        });
       
        if (!response.ok) throw new Error('Failed to create user');
       
        hideModal('user-modal');
        loadUsers();
    } catch (error) {
        console.error('Error adding user:', error);
        document.getElementById('add-user-error').textContent = error.message;
        document.getElementById('add-user-error').style.display = 'block';
    }
}
 
// Show edit roles modal
function showEditRolesModal(username, roles) {
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-username-display').textContent = username;
   
    // Set checkboxes based on current roles
    document.getElementById('edit-role-administrator').checked = roles.includes('Administrator');
    document.getElementById('edit-role-labeller').checked = roles.includes('Labeller');
    document.getElementById('edit-role-reviewer').checked = roles.includes('Reviewer');
   
    document.getElementById('edit-roles-error').style.display = 'none';
   
    const modal = new bootstrap.Modal(document.getElementById('editRolesModal'));
    modal.show();
}
 
// Update user roles
async function updateUserRoles() {
    const username = document.getElementById('edit-username').value;
   
    // Collect selected roles
    const roles = [];
    if (document.getElementById('edit-role-administrator').checked) {
        roles.push('Administrator');
    }
    if (document.getElementById('edit-role-labeller').checked) {
        roles.push('Labeller');
    }
    if (document.getElementById('edit-role-reviewer').checked) {
        roles.push('Reviewer');
    }
   
    if (roles.length === 0) {
        document.getElementById('edit-roles-error').textContent = 'Please select at least one role.';
        document.getElementById('edit-roles-error').style.display = 'block';
        return;
    }
   
    try {
        const response = await fetch(`/api/admin/users/${username}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roles
            })
        });
       
        if (!response.ok) {
            throw new Error('Failed to update user roles');
        }
       
        // Close modal and reload users
        const modal = bootstrap.Modal.getInstance(document.getElementById('editRolesModal'));
        modal.hide();
        loadUsers();
       
    } catch (error) {
        console.error('Error updating user roles:', error);
        document.getElementById('edit-roles-error').textContent = error.message;
        document.getElementById('edit-roles-error').style.display = 'block';
    }
}
 
// Confirm delete user
function confirmDeleteUser(username) {
    if (confirm(`Are you sure you want to delete user '${username}'? This action cannot be undone.`)) {
        deleteUser(username);
    }
}
 
// Delete user
async function deleteUser(username) {
    try {
        const response = await fetch(`/api/admin/users/${username}`, {
            method: 'DELETE'
        });
       
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
       
        // Reload users
        loadUsers();
       
    } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Error deleting user: ${error.message}`);
    }
}
 
// Show add category modal
function showAddCategoryModal() {
    const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
    document.getElementById('add-category-form').reset();
    document.getElementById('add-category-error').style.display = 'none';
    modal.show();
}
 
// Add a new category
async function addCategory() {
    const name = document.getElementById('category-name').value;
    const supercategory = document.getElementById('category-supercategory').value;
   
    if (!name) {
        document.getElementById('add-category-error').textContent = 'Please enter a category name.';
        document.getElementById('add-category-error').style.display = 'block';
        return;
    }
   
    try {
        const response = await fetch('/api/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                supercategory: supercategory || null
            })
        });
       
        if (!response.ok) {
            throw new Error('Failed to create category');
        }
       
        // Close modal and reload categories
        const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
        modal.hide();
        loadCategories();
       
    } catch (error) {
        console.error('Error adding category:', error);
        document.getElementById('add-category-error').textContent = error.message;
        document.getElementById('add-category-error').style.display = 'block';
    }
}
 
// Show edit user modal
function showEditUserModal(username, email) {
    const modal = document.getElementById('edit-user-modal');
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-email').value = email;
    showModal('edit-user-modal');
}
 
// Update user
async function updateUser() {
    const username = document.getElementById('edit-user-username').value;
    const email = document.getElementById('edit-user-email').value;
 
    try {
        const response = await fetch(`/api/admin/users/${username}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
 
        if (!response.ok) throw new Error('Failed to update user');
 
        hideModal('edit-user-modal');
        loadUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error updating user:', error);
    }
}
 
// Update loading state visuals
function setLoading(type, isLoading) {
    const errorElement = document.getElementById(`${type}-error`);
    const tableContainer = document.getElementById(`${type}-table-container`);
   
    errorElement.style.display = 'none';
    tableContainer.style.opacity = isLoading ? '0.6' : '1';
}
 
// Modal Functions
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
 
// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Button click handlers
    const createUserBtn = document.getElementById('create-user-btn');
    const createCategoryBtn = document.getElementById('create-category-btn');
 
    if (createUserBtn) {
        createUserBtn.addEventListener('click', () => {
            showModal('user-modal');
        });
    }
 
    if (createCategoryBtn) {
        createCategoryBtn.addEventListener('click', () => {
            showModal('category-modal');
        });
    }
 
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
 
// Azure AD User Management Functions
async function loadADUsers() {
    const loadingElement = document.getElementById('loading-users');
    const errorElement = document.getElementById('users-error');
    const tableBody = document.getElementById('users-table-body');
    const tableContainer = document.getElementById('users-table-container');
    
    try {
        console.log("Loading AD users...");
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        
        // Make sure the table container is visible
        if (tableContainer) {
            tableContainer.style.display = 'block';
        } else {
            console.error("Table container element not found!");
        }
        
        tableBody.innerHTML = '';
        
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
            throw new Error(`Error fetching users: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("AD users response:", data);
        
        // Handle both array format and object with users property
        const users = Array.isArray(data) ? data : (data.users || []);
        
        console.log(`API returned ${users.length} users:`, users);
        
        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center">No users found</td></tr>`;
        } else {
            users.forEach(user => {
                const row = document.createElement('tr');
                
                // Email cell
                const emailCell = document.createElement('td');
                emailCell.textContent = user.email;
                emailCell.className = 'email-column';
                row.appendChild(emailCell);
                
                // Role cell - display as text instead of dropdown
                const roleCell = document.createElement('td');
                roleCell.textContent = user.role || 'Unknown';
                roleCell.className = 'role-column';
                row.appendChild(roleCell);
                
                // Actions cell with both edit and delete buttons
                const actionsCell = document.createElement('td');
                actionsCell.className = 'action-buttons';
                
                // Edit button
                const editButton = document.createElement('button');
                editButton.classList.add('btn', 'btn-info', 'btn-sm');
                editButton.textContent = 'Edit';
                editButton.addEventListener('click', () => {
                    showEditUserModal(user);
                });
                actionsCell.appendChild(editButton);
                
                // Delete button
                const deleteButton = document.createElement('button');
                deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', () => {
                    if (confirm(`Are you sure you want to remove ${user.email} from this application?`)) {
                        deleteUser(user.id);
                    }
                });
                actionsCell.appendChild(deleteButton);
                row.appendChild(actionsCell);
                
                tableBody.appendChild(row);
            });
            
            console.log(`Populated table with ${users.length} users`);
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    } finally {
        loadingElement.style.display = 'none';
    }
}

async function addUser(email, role) {
    try {
        // Show loading state
        document.getElementById('add-user-error').style.display = 'none';
        const addButton = document.querySelector('#user-modal .btn-primary');
        const originalText = addButton.innerHTML;
        addButton.disabled = true;
        addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        console.log(`Adding user with email: ${email}, role: ${role}`);
        
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, role }),
            credentials: 'same-origin' // Include cookies for authentication
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to add user';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (parseError) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        // Parse response
        let responseData;
        try {
            responseData = await response.json();
        } catch (parseError) {
            console.warn('Response is not JSON, but request was successful');
        }
        
        // Reload user list on success
        await loadADUsers();
        
        // Return success
        return Promise.resolve();
        
    } catch (error) {
        console.error('Error adding user:', error);
        const errorElement = document.getElementById('add-user-error');
        let errorMessage = error.message;
        
        // Handle specific error types
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            errorMessage = 'Network error: Unable to connect to server. Please check your connection and try again.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Connection failed: Please check if the server is running and try again.';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.style.display = 'block';
        
        // Return rejected promise to indicate failure
        return Promise.reject(error);
        
    } finally {
        // Reset button state
        const addButton = document.querySelector('#user-modal .btn-primary');
        if (addButton) {
            addButton.disabled = false;
            addButton.innerHTML = 'Add User';
        }
    }
}

async function updateUserRole(userId, newRole) {
    try {
        console.log(`Updating user ${userId} to role ${newRole}`);
        
        // Show loading UI or disable the select
        const select = document.querySelector(`select[data-user-id="${userId}"]`);
        if (select) {
            select.disabled = true;
        }
        
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update user role');
        }
        
        // Reload user list to show updated data
        await loadADUsers();
        
        // Show success message
        showNotification('Success', `User role updated to ${newRole}`, 'success');
        
    } catch (error) {
        console.error('Error updating user role:', error);
        showNotification('Error', error.message, 'danger');
        loadADUsers(); // Reload to reset the UI
    } finally {
        // Re-enable the select if it exists
        const select = document.querySelector(`select[data-user-id="${userId}"]`);
        if (select) {
            select.disabled = false;
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
            throw new Error(errorData.detail || 'Failed to delete user');
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

// Function to show the edit user modal with the provided user data
function showEditUserModal(user) {
    console.log("Showing edit modal for user:", user);

    // Populate the modal with user data
    document.getElementById('user-email').value = user.email || '';
    const roleSelect = document.getElementById('user-role');
    if (roleSelect) {
        for (let i = 0; i < roleSelect.options.length; i++) {
            if (roleSelect.options[i].value === user.role) {
                roleSelect.selectedIndex = i;
                break;
            }
        }
    }

    // Update modal title and button text
    document.getElementById('user-modal-label').textContent = 'Edit User';
    const submitButton = document.getElementById('add-user-btn');
    if (submitButton) {
        submitButton.textContent = 'Update User';
        submitButton.dataset.userId = user.id; // Store user ID for the update operation
        submitButton.dataset.mode = 'edit'; // Mark as edit mode
    }

    // Show the modal
    const userModal = document.getElementById('user-modal');
    if (userModal) {
        const bsModal = new bootstrap.Modal(userModal);
        bsModal.show();
    } else {
        console.error("User modal element not found");
    }
}




// Load buildings from API
async function loadBuildings() {
    console.log('Loading buildings...');
    const buildingListContainer = document.getElementById('buildingListContainer');
    const errorElement = document.getElementById('buildings-error');
    
    // Show loading state in container
    if (errorElement) errorElement.style.display = 'none';
    if (buildingListContainer) {
        buildingListContainer.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> Loading buildings...</div>';
    }
    
    try {
        const response = await fetch('/api/buildings');
        console.log('Buildings API response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load buildings`);
        }
        
        const data = await response.json();
        console.log('Buildings API response:', data);
        
        // Handle both direct array and object responses
        let buildings;
        if (Array.isArray(data)) {
            buildings = data;
        } else if (data.buildings) {
            buildings = data.buildings;
        } else if (data.building && Array.isArray(data.building)) {
            buildings = data.building;
        } else {
            buildings = [];
        }
        
        console.log('Processed buildings:', buildings);
        renderBuildings(buildings);
        
    } catch (error) {
        console.error('Error loading buildings:', error);
        
        // Show error
        if (errorElement) {
            errorElement.textContent = `Error loading buildings: ${error.message}`;
            errorElement.style.display = 'block';
        }
        
        // Fallback display in container
        if (buildingListContainer) {
            buildingListContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <h5>Error Loading Buildings</h5>
                    <p>Failed to load buildings: ${error.message}</p>
                    <button class="btn btn-sm btn-outline-danger" onclick="loadBuildings()">Retry</button>
                </div>
            `;
        }
    }
}

function renderBuildings(buildings) {
    const buildingListContainer = document.getElementById('buildingListContainer');
    
    if (!buildingListContainer) {
        console.error('buildingListContainer element not found in DOM');
        return;
    }
    
    buildingListContainer.innerHTML = '';
    
    if (!buildings || buildings.length === 0) {
        buildingListContainer.innerHTML = `
            <div class="alert alert-info" role="alert">
                <h5>No Buildings Found</h5>
                <p>No buildings are registered yet. Use the "Register New Building" button to create your first building.</p>
            </div>
        `;
        return;
    }
    
    // Create responsive table
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-responsive';
    
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';
    
    // Create table header
    table.innerHTML = `
        <thead class="table-dark">
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Address</th>
                <th>Actions</th>
            </tr>
        </thead>
    `;
    
    const tbody = document.createElement('tbody');
    
    buildings.forEach((building) => {
        const tr = document.createElement('tr');
        
        // ID cell
        const idCell = tr.insertCell();
        idCell.textContent = building.id || 'N/A';
        
        // Name cell
        const nameCell = tr.insertCell();
        nameCell.textContent = building.name || 'N/A';
        
        // Address cell
        const addressCell = tr.insertCell();
        addressCell.textContent = building.address || 'N/A';
        
        // Actions cell
        const actionsCell = tr.insertCell();
        actionsCell.className = 'action-buttons';
        actionsCell.innerHTML = `
            <button class="btn btn-sm btn-primary me-1" onclick="editBuilding('${building.id}')" title="Edit Building">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteBuilding('${building.id}')" title="Delete Building">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    buildingListContainer.appendChild(tableWrapper);
    
    console.log('Buildings rendered successfully');
}



// Show add building modal
function showAddBuildingModal() {
    console.log('showAddBuildingModal called');
    
    const modalElement = document.getElementById('buildingModal');
    const form = document.getElementById('buildingForm');
    const errorElement = document.getElementById('buildingModalError');
    
    console.log('Modal element found:', !!modalElement);
    console.log('Form element found:', !!form);
    console.log('Error element found:', !!errorElement);
    
    if (!modalElement) {
        console.error('buildingModal element not found');
        return;
    }
    
    // Reset form and hide errors
    if (form) {
        form.reset();
        console.log('Form reset');
    }
    if (errorElement) {
        errorElement.style.display = 'none';
        console.log('Error element hidden');
    }
    
    // Try different ways to show the modal
    try {
        // Method 1: Bootstrap 5 way
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        console.log('Modal shown using Bootstrap 5 method');
        
        // Verify modal is actually visible
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(modalElement);
            console.log('Modal display style:', computedStyle.display);
            console.log('Modal visibility:', computedStyle.visibility);
            console.log('Modal z-index:', computedStyle.zIndex);
            console.log('Modal position:', computedStyle.position);
            
            if (computedStyle.display === 'none') {
                console.warn('Modal is not visible! Forcing visibility...');
                modalElement.style.display = 'block';
                modalElement.style.position = 'fixed';
                modalElement.style.top = '50px';
                modalElement.style.left = '50%';
                modalElement.style.transform = 'translateX(-50%)';
                modalElement.style.zIndex = '9999';
                modalElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
            }
        }, 100);
        
    } catch (error) {
        console.error('Bootstrap 5 modal failed:', error);
        
        try {
            // Method 2: jQuery way (fallback)
            $(modalElement).modal('show');
            console.log('Modal shown using jQuery method');
        } catch (jqueryError) {
            console.error('jQuery modal failed:', jqueryError);
            
            // Method 3: Manual show (last resort)
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
            document.body.classList.add('modal-open');
            console.log('Modal shown manually');
        }
    }
}

// Add a new building
async function addBuilding() {
    const name = document.getElementById('buildingName').value.trim();
    const address = document.getElementById('buildingAddress').value.trim();
    const errorElement = document.getElementById('buildingModalError');
    
    if (!name || !address) {
        showBuildingError('Please fill in all required fields.');
        return;
    }
    
    try {
        // Show loading state
        const submitButton = document.querySelector('#buildingForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        }
        
        const response = await fetch('/api/buildings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                address: address
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(errorData.detail || 'Failed to create building');
        }
        
        const result = await response.json();
        console.log('Building created:', result);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('buildingModal'));
        if (modal) modal.hide();
        
        // Reset form
        const form = document.getElementById('buildingForm');
        if (form) form.reset();
        
        // Hide any error messages
        if (errorElement) errorElement.style.display = 'none';
        
        // Refresh buildings list
        await loadBuildings();
        
        // Show success message
        showSuccessMessage('Building created successfully!');
        
    } catch (error) {
        console.error('Error creating building:', error);
        showBuildingError(error.message);
    } finally {
        // Reset button state
        const submitButton = document.querySelector('#buildingForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Create Building';
        }
    }
}

// Show error in building modal
function showBuildingError(message) {
    const errorElement = document.getElementById('buildingModalError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Show success message
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

// Placeholder functions for edit/delete (implement as needed)
function editBuilding(buildingId) {
    console.log('Edit building:', buildingId);
    alert(`Edit building ${buildingId} - Not implemented yet`);
}

async function deleteBuilding(buildingId) {
    console.log('Delete building:', buildingId);
    
    if (!confirm(`Are you sure you want to delete this building? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/buildings/${buildingId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to delete building' }));
            throw new Error(errorData.detail || 'Failed to delete building');
        }
        
        // Refresh buildings list
        await loadBuildings();
        
        // Show success message
        showSuccessMessage('Building deleted successfully!');
        
    } catch (error) {
        console.error('Error deleting building:', error);
        alert(`Error deleting building: ${error.message}`);
    }
}

// Debug function - call this from browser console to test API
async function debugBuildingsAPI() {
    try {
        console.log('=== DEBUGGING BUILDINGS API ===');
        console.log('Testing /api/buildings endpoint...');
        
        const response = await fetch('/api/buildings');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            console.error('API request failed with status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        console.log('Data type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        
        if (Array.isArray(data)) {
            console.log('Buildings count:', data.length);
        } else if (data.buildings && Array.isArray(data.buildings)) {
            console.log('Buildings count:', data.buildings.length);
        }
        
        return data;
    } catch (error) {
        console.error('=== API TEST FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

// Manual test function - call this from browser console
window.testBuildingsLoad = function() {
    console.log("=== MANUAL BUILDINGS TEST ===");
    console.log("Calling loadBuildings() directly...");
    return loadBuildings();
};

// Add this to window for easy access
window.debugBuildingsManual = function() {
    console.log("=== MANUAL DEBUG TEST ===");
    return debugBuildingsAPI();
};

// Add immediate test on page load (for debugging)
document.addEventListener('DOMContentLoaded', function() {
    // Add a delay to ensure other scripts have loaded
    setTimeout(() => {
        console.log("=== IMMEDIATE BUILDINGS TEST ===");
        console.log("Testing buildings API immediately...");
        if (typeof loadBuildings === 'function') {
            console.log("loadBuildings function exists, calling it...");
            loadBuildings().catch(error => {
                console.error("Immediate buildings test failed:", error);
            });
        } else {
            console.error("loadBuildings function not found!");
        }
    }, 2000); // Wait 2 seconds for other initialization
});


// Utility functions
function setLoading(type, isLoading) {
    const errorElement = document.getElementById(`${type}-error`);
    const tableContainer = document.getElementById(`${type}-table-container`);
    
    if (errorElement) errorElement.style.display = 'none';
    if (tableContainer) tableContainer.style.opacity = isLoading ? '0.6' : '1';
}





























