// static/js/pipelineAdmin.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("pipelineAdmin.js loaded and DOM fully parsed!");

    const API_BASE_URL = '/api/pipelines';

    // DOM Elements
    const openModalBtn = document.getElementById('openPipelineModalBtn');
    const pipelineListContainer = document.getElementById('pipelineListContainer');
    
    // Modal specific elements
    const modalElement = document.getElementById('pipelineModal'); // The main modal div
    let pipelineBootstrapModal = null; // Variable to hold the Bootstrap Modal instance
    if (modalElement) {
        pipelineBootstrapModal = new bootstrap.Modal(modalElement); // Initialize Bootstrap Modal
    } else {
        console.error("Modal element with ID 'pipelineModal' not found!");
    }

    const modalTitle = document.getElementById('pipelineModalTitle');
    const pipelineForm = document.getElementById('pipelineForm');
    const formIdInput = document.getElementById('pipelineFormIdInput');
    const formNameInput = document.getElementById('pipelineFormName');
    const formVersionInput = document.getElementById('pipelineFormVersion');
    const formAmlIdInput = document.getElementById('pipelineFormAmlId');
    const modalErrorDiv = document.getElementById('pipelineModalError');
    const saveBtn = document.getElementById('pipelineFormSaveBtn'); // The save button inside the modal
    // Note: pipelineModalCloseBtn and pipelineFormCancelBtn can often be handled by data-bs-dismiss="modal"

    let currentEditId = null;

    // --- API Helper Functions (keep as before) ---
    async function fetchPipelines() { /* ... same as before ... */
        console.log("Fetching pipelines...");
        const response = await fetch(`${API_BASE_URL}/inference`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error fetching pipelines" }));
            console.error("Failed to fetch pipelines:", errorData);
            throw new Error(errorData.detail || `Failed to fetch pipelines: ${response.statusText}`);
        }
        const pipelines = await response.json();
        console.log("Pipelines fetched:", pipelines);
        return pipelines;
    }

    async function upsertPipelineAPI(pipelineData) { /* ... same as before ... */
        console.log("Upserting pipeline with data:", pipelineData);
        const response = await fetch(`${API_BASE_URL}/inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pipelineData),
        });
        const responseData = await response.json();
        if (!response.ok) {
            console.error("API upsert error responseData:", responseData);
            const error = new Error(responseData.detail || `API Error: ${response.status}`);
            error.status = response.status;
            error.data = responseData;
            throw error;
        }
        console.log("Pipeline upserted successfully via API:", responseData);
        return { data: responseData, status: response.status };
    }

    // --- UI Update Functions (keep renderPipelines, loadAndDisplayPipelines as before) ---
    function renderPipelines(pipelines) { /* ... same as before ... */
        console.log("Rendering pipelines:", pipelines);
        pipelineListContainer.innerHTML = '';
        if (!pipelines || pipelines.length === 0) {
            pipelineListContainer.innerHTML = '<p>No pipelines registered yet.</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'table table-striped table-hover'; // Bootstrap table classes
        table.innerHTML = `<thead><tr><th>Name</th><th>Version</th><th>AML ID</th><th>Actions</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        pipelines.forEach(p => {
            const tr = tbody.insertRow();
            tr.insertCell().textContent = p.name;
            tr.insertCell().textContent = p.version;
            tr.insertCell().textContent = p.amlId || p.aml_id;

            const actionsCell = tr.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'btn btn-sm btn-info me-2'; // Bootstrap classes
            editButton.onclick = () => {
                console.log("Edit button clicked for pipeline:", p);
                showModal('edit', p);
            };
            actionsCell.appendChild(editButton);
        });
        table.appendChild(tbody);
        pipelineListContainer.appendChild(table);
    }
    async function loadAndDisplayPipelines() { /* ... same as before ... */
        if (!pipelineListContainer) {
            console.error("pipelineListContainer not found in DOM. Cannot load pipelines.");
            return;
        }
        pipelineListContainer.innerHTML = '<p>Loading pipelines...</p>';
        try {
            const pipelines = await fetchPipelines();
            renderPipelines(pipelines);
        } catch (error) {
            console.error("Error in loadAndDisplayPipelines:", error);
            pipelineListContainer.innerHTML = `<p class="text-danger">Error loading pipelines: ${error.message}</p>`;
        }
    }


    // --- MODIFIED Modal Functions for Bootstrap ---
    function showModal(mode = 'register', pipeline = null) {
        console.log("showModal called. Mode:", mode, "Pipeline data:", pipeline);
        if (!pipelineBootstrapModal || !pipelineForm || !modalTitle || !formNameInput || !formVersionInput || !formAmlIdInput || !modalErrorDiv || !formIdInput) {
            console.error("One or more modal DOM elements are missing or Bootstrap modal not initialized. Cannot show modal.");
            return;
        }
        currentEditId = null;
        pipelineForm.reset();
        modalErrorDiv.textContent = '';
        modalErrorDiv.style.display = 'none';
        formIdInput.value = '';

        if (mode === 'edit' && pipeline) {
            if(modalTitle) modalTitle.textContent = 'Edit Pipeline';
            currentEditId = pipeline.id;
            if(formIdInput) formIdInput.value = pipeline.id;
            if(formNameInput) formNameInput.value = pipeline.name || '';
            if(formVersionInput) formVersionInput.value = pipeline.version || '';
            if(formAmlIdInput) formAmlIdInput.value = pipeline.amlId || pipeline.aml_id || '';
        } else {
            if(modalTitle) modalTitle.textContent = 'Register New Pipeline';
        }
        pipelineBootstrapModal.show(); // USE BOOTSTRAP METHOD
        console.log("Bootstrap modal should be shown now.");
    }

    function closeModal() { // This can be called programmatically if needed
        if (!pipelineBootstrapModal) {
            console.error("Bootstrap modal instance not found. Cannot close modal programmatically.");
            return;
        }
        pipelineBootstrapModal.hide(); // USE BOOTSTRAP METHOD
        console.log("Bootstrap modal hidden programmatically.");
    }

    // --- Event Handlers (handleFormSubmit mostly same, listeners need checking) ---
    async function handleFormSubmit(event) { /* ... same as before ... */
        event.preventDefault();
        console.log("Pipeline form submitted.");
        if (!modalErrorDiv || !saveBtn || !formNameInput || !formVersionInput || !formAmlIdInput) {
            console.error("Form submission elements missing.");
            return;
        }

        modalErrorDiv.textContent = '';
        modalErrorDiv.style.display = 'none';
        saveBtn.disabled = true; // Disable save button
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...'; // Bootstrap loading spinner

        const name = formNameInput.value.trim();
        const version = formVersionInput.value.trim();
        const amlId = formAmlIdInput.value.trim();

        if (!name || !version || !amlId) {
            modalErrorDiv.textContent = 'Name, Version, and AML ID are required.';
            modalErrorDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Pipeline';
            console.log("Form validation failed: required fields missing.");
            return;
        }

        const pipelineData = { name, version, amlId };
        if (currentEditId) {
            pipelineData.id = currentEditId;
        }
        console.log("Submitting pipelineData:", pipelineData);

        try {
            const { data: savedPipeline, status } = await upsertPipelineAPI(pipelineData);
            console.log("Pipeline save successful. API Status:", status, "Saved data:", savedPipeline);
            closeModal(); // Programmatically close modal on success
            await loadAndDisplayPipelines();
        } catch (error) {
            console.error("Error saving pipeline:", error);
            modalErrorDiv.textContent = error.data?.detail || error.message || 'An unexpected error occurred during save.';
            modalErrorDiv.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Pipeline';
        }
    }

    // --- Attach Event Listeners ---
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => showModal('register'));
    } else {
        console.warn("'openPipelineModalBtn' not found.");
    }

    // Bootstrap's data-bs-dismiss="modal" handles most close scenarios for buttons.
    // You might not need explicit listeners for pipelineModalCloseBtn and pipelineFormCancelBtn if they have data-bs-dismiss.
    // However, if you need to do something extra before closing (like reset form state beyond what closeModal does),
    // you can keep them or listen to Bootstrap modal events.

    // Example: Listening to Bootstrap modal hidden event to clear errors if needed
    if(modalElement) {
        modalElement.addEventListener('hidden.bs.modal', function (event) {
            console.log('Bootstrap modal has been hidden.');
            if(modalErrorDiv) { // Clear errors when modal is fully hidden
                modalErrorDiv.textContent = '';
                modalErrorDiv.style.display = 'none';
            }
        });
    }


    if (pipelineForm) {
        pipelineForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.warn("'pipelineForm' not found. Form submission will not work.");
    }

    // --- Initial Load ---
    console.log("Attempting initial load of pipelines...");
    loadAndDisplayPipelines();
});