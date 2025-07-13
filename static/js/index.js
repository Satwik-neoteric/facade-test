
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    checkAuth(function(user) {
        if (user) {
            document.getElementById('userInfo').textContent = user.username;
            loadBatches();
        } else {
            // If not authenticated, redirect to login
            window.location.href = '/login';
        }
    });

    // Initialize logout button
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
});

// Load batches from the API
function loadBatches() {
    fetch('/api/batches', {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        displayBatches(data);
    })
    .catch(error => {
        console.error('Error loading batches:', error);
        showNotification('Error loading batches', 'error');
    });
}

// Display batches in the UI
function displayBatches(batches) {
    const batchList = document.getElementById('batchList');
    if (!batchList) return;
    
    batchList.innerHTML = '';
    
    if (batches.length === 0) {
        batchList.innerHTML = '<div class="alert alert-info">No batches found.</div>';
        return;
    }
    
    batches.forEach(batch => {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header d-flex justify-content-between align-items-center';
        cardHeader.innerHTML = `<h5 class="mb-0">Batch ${batch.batchID || batch.id}</h5>`;
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        // Add batch details
        let imageCount = 0;
        let annotationCount = 0;
        
        if (batch.images && Array.isArray(batch.images)) {
            imageCount = batch.images.length;
        }
        
        if (batch.annotations && Array.isArray(batch.annotations)) {
            annotationCount = batch.annotations.length;
        }
        
        cardBody.innerHTML = `
            <p><strong>Images:</strong> ${imageCount}</p>
            <p><strong>Annotations:</strong> ${annotationCount}</p>
            <button class="btn btn-primary view-batch" data-batch-id="${batch.batchID || batch.id}">View Batch</button>
        `;
        
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        batchList.appendChild(card);
    });
    
    // Add event listeners to batch buttons
    document.querySelectorAll('.view-batch').forEach(button => {
        button.addEventListener('click', function() {
            const batchId = this.getAttribute('data-batch-id');
            window.location.href = `/batches/${batchId}`;
        });
    });
}

// Show notification
function showNotification(message, type) {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.getElementById('notificationContainer').appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
