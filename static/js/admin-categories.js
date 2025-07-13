/* 
 * Categories Management Module
 * 
 * This module handles all categories-related functionality:
 * - Load and display categories from /api/classes
 * - Add new categories via modal form
 * - Category table rendering and management
 * - Integration with supercategory system
 * 
 * Dependencies: Bootstrap 5, admin-main.js (for utilities)
 * API Endpoints: GET/POST /api/classes
 */

// Load categories from API
async function loadCategories() {
    try {
        // Use utility function from main admin.js if available
        if (typeof setLoading === 'function') {
            setLoading('categories', true);
        }
       
        const response = await fetch('/api/classes');
       
        if (!response.ok) {
            throw new Error('Failed to load categories');
        }
       
        const data = await response.json();
       
        // Populate categories table
        const tableBody = document.getElementById('categories-table-body');
        if (tableBody) {
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
        }
       
        // Show the table
        const loadingElement = document.getElementById('loading-categories');
        const tableContainer = document.getElementById('categories-table-container');
        
        if (loadingElement) loadingElement.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
       
    } catch (error) {
        console.error('Error loading categories:', error);
        const errorElement = document.getElementById('categories-error');
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    } finally {
        // Use utility function from main admin.js if available
        if (typeof setLoading === 'function') {
            setLoading('categories', false);
        }
        
        
    }
}

// Show add category modal
function showAddCategoryModal() {
    const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
    const form = document.getElementById('add-category-form');
    const errorElement = document.getElementById('add-category-error');
    
    if (form) form.reset();
    if (errorElement) errorElement.style.display = 'none';
    
    modal.show();
}

// Add a new category
async function addCategory() {
    const name = document.getElementById('category-name').value;
    const supercategory = document.getElementById('category-supercategory').value;
    const errorElement = document.getElementById('add-category-error');
   
    if (!name) {
        if (errorElement) {
            errorElement.textContent = 'Please enter a category name.';
            errorElement.style.display = 'block';
        }
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
        if (modal) modal.hide();
        
        await loadCategories();
        
        // Show success notification (use utility function from main admin.js)
        if (typeof showNotification === 'function') {
            showNotification('Success', `Category "${name}" created successfully`, 'success');
        } else {
            alert(`Category "${name}" created successfully!`);
        }
       
    } catch (error) {
        console.error('Error adding category:', error);
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    }
}

// Edit category function (placeholder)
function editCategory(categoryId) {
    console.log('Edit category:', categoryId);
    alert(`Edit category ${categoryId} - Not implemented yet`);
}

// Delete category function (placeholder)
function deleteCategory(categoryId) {
    console.log('Delete category:', categoryId);
    
    if (!confirm(`Are you sure you want to delete this category? This action cannot be undone.`)) {
        return;
    }
    
    alert(`Delete category ${categoryId} - Not implemented yet`);
}

// Initialize categories management when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on admin page with categories section
    const categoriesSection = document.getElementById('categories-management-section') || 
                             document.getElementById('categories-table-body');
    if (!categoriesSection) {
        return;
    }
    
    console.log('Initializing categories management...');
    
    // Set up event listeners for categories management
    const createCategoryBtn = document.getElementById('create-category-btn');
    if (createCategoryBtn) {
        createCategoryBtn.addEventListener('click', () => {
            const categoryModal = bootstrap.Modal.getInstance(document.getElementById('category-modal')) || 
                                new bootstrap.Modal(document.getElementById('category-modal')) ||
                                bootstrap.Modal.getInstance(document.getElementById('addCategoryModal')) || 
                                new bootstrap.Modal(document.getElementById('addCategoryModal'));
            
            const form = document.getElementById('add-category-form');
            if (form) form.reset();
            
            if (categoryModal) categoryModal.show();
        });
        console.log('Create category button event listener added');
    }
    
    // Category form submission
    const categoryForm = document.getElementById('add-category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addCategory();
        });
    }
    
    // Refresh categories button
    const refreshCategoriesBtn = document.getElementById('refresh-categories');
    if (refreshCategoriesBtn) {
        refreshCategoriesBtn.addEventListener('click', loadCategories);
    }
    
    // Load categories immediately if admin access is already granted
    // Add a small delay to ensure other initialization is complete
    setTimeout(() => {
        console.log('Loading categories on page load...');
        loadCategories().catch(error => {
            console.error('Failed to load categories on page load:', error);
        });
    }, 500);
});

// Export functions for debugging
window.testCategoriesLoad = function() {
    console.log("=== MANUAL CATEGORIES TEST ===");
    console.log("Calling loadCategories() directly...");
    return loadCategories();
};
