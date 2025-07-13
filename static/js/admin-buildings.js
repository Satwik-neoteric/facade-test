/* 
 * Buildings Management Module
 * 
 * This module handles all buildings-related functionality:
 * - Load and display buildings from /api/buildings
 * - Add new buildings via modal form
 * - Edit existing buildings (placeholder for future implementation)
 * - Delete buildings with confirmation
 * - Building modal management and validation
 * 
 * Dependencies: Bootstrap 5, admin-main.js (for utilities)
 * API Endpoints: GET/POST/DELETE /api/buildings
 */

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
        
        // Show success message (use utility function from main admin.js)
        if (typeof showSuccessMessage === 'function') {
            showSuccessMessage('Building created successfully!');
        } else {
            alert('Building created successfully!');
        }
        
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

// Edit building function
function editBuilding(buildingId) {
    console.log('Edit building:', buildingId);
    alert(`Edit building ${buildingId} - Not implemented yet`);
}

// Delete building function
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
        
        // Show success message (use utility function from main admin.js)
        if (typeof showSuccessMessage === 'function') {
            showSuccessMessage('Building deleted successfully!');
        } else {
            alert('Building deleted successfully!');
        }
        
    } catch (error) {
        console.error('Error deleting building:', error);
        alert(`Error deleting building: ${error.message}`);
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

// Debug function for testing
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

// Initialize buildings management when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on admin page with buildings section
    const buildingsSection = document.getElementById('buildings-management-section');
    if (!buildingsSection) {
        return;
    }
    
    console.log('Initializing buildings management...');
    
    // Set up event listeners for buildings management
    const createBuildingBtn = document.getElementById('openBuildingModalBtn');
    if (createBuildingBtn) {
        createBuildingBtn.addEventListener('click', function(e) {
            console.log('Building button clicked');
            e.preventDefault();
            showAddBuildingModal();
        });
        console.log('Building button event listener added');
    } else {
        console.warn('openBuildingModalBtn element not found');
    }
    
    // Building form submission
    const buildingForm = document.getElementById('buildingForm');
    if (buildingForm) {
        buildingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addBuilding();
        });
    }
    
    // Refresh buildings button
    const refreshBuildingsBtn = document.getElementById('refresh-buildings');
    if (refreshBuildingsBtn) {
        refreshBuildingsBtn.addEventListener('click', loadBuildings);
    }
    
    // Load buildings immediately if admin access is already granted
    // Add a small delay to ensure other initialization is complete
    setTimeout(() => {
        console.log('Loading buildings on page load...');
        loadBuildings().catch(error => {
            console.error('Failed to load buildings on page load:', error);
        });
    }, 1000);
});

// Export functions for debugging
window.testBuildingsLoad = function() {
    console.log("=== MANUAL BUILDINGS TEST ===");
    console.log("Calling loadBuildings() directly...");
    return loadBuildings();
};

window.debugBuildingsManual = function() {
    console.log("=== MANUAL DEBUG TEST ===");
    return debugBuildingsAPI();
};
