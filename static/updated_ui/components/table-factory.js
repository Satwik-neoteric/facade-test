/**
 * Table Factory - Creates standardized tables for different data types
 * Handles the creation of user, batch, building, model, and pipeline tables
 */

class TableFactory {
    constructor() {
        this.roleColors = {
            'Administrator': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            'Labeller': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'Reviewer': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        };

        this.roleIcons = {
            'Administrator': 'fas fa-crown',
            'Labeller': 'fas fa-tags',
            'Reviewer': 'fas fa-check-circle'
        };

        this.statusColors = {
            'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'available': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'registered': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'processing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'error': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            'running': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'inactive': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
            'unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
            'demo mode': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        };

        this.statusIcons = {
            'active': 'fas fa-play',
            'available': 'fas fa-check-circle',
            'registered': 'fas fa-clipboard-check',
            'processing': 'fas fa-spinner fa-spin',
            'completed': 'fas fa-check',
            'error': 'fas fa-exclamation-triangle',
            'running': 'fas fa-spinner fa-spin',
            'inactive': 'fas fa-pause',
            'unknown': 'fas fa-question-circle',
            'demo mode': 'fas fa-code'
        };
    }

    /**
     * Create a standardized table structure
     */
    createTable(config) {
        return `
            <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-t-lg">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            ${config.headers.map(header => `
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    ${header}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        ${config.rows.join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Create a user table row
     */
    createUserTableRow(user) {
        const userRole = Array.isArray(user.roles) ? user.roles[0] : user.role;
        const displayRole = userRole || 'Unknown';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gradient-to-r ${this.roleColors[displayRole] ? 'from-blue-500 to-blue-600' : 'from-gray-500 to-gray-600'} flex items-center justify-center">
                                <i class="${this.roleIcons[displayRole] || 'fas fa-user'} text-white text-sm"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                                ${user.displayName || user.display_name || user.name || 'Unknown User'}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">${user.email || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.roleColors[displayRole] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
                        <i class="${this.roleIcons[displayRole] || 'fas fa-user'} mr-1"></i>
                        ${displayRole}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="editUser('${user.id}')" 
                                class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150"
                                title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteUser('${user.id}')" 
                                class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-150"
                                title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create a batch table row
     */
    createBatchTableRow(batch) {
        // Handle different batch data formats and provide fallbacks
        const batchId = batch.batch_id || batch.id || batch.BatchID || 'Unknown';
        const rawStatus = batch.status || 'unknown';
        const status = rawStatus.toLowerCase().trim(); // Normalize status to lowercase for consistent mapping
        const imageCount = batch.image_count || batch.images?.length || 0;
        
        // Handle different date field names from the API
        const createdAt = batch.created_date || batch.created_at || batch.createdDate || null;
        const lastModified = batch.last_modified || batch.lastModified || batch.updated_at || null;
        
        // Get status styling with proper fallback
        const statusClass = this.statusColors[status] || this.statusColors['unknown'];
        const statusIcon = this.statusIcons[status] || this.statusIcons['unknown'];
        
        // Format creation date with better handling
        let createdDisplay = 'N/A';
        if (createdAt) {
            try {
                const date = new Date(createdAt);
                if (!isNaN(date.getTime())) {
                    // Format: MM/DD/YYYY HH:MM
                    createdDisplay = date.toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                } else {
                    createdDisplay = 'Invalid Date';
                }
            } catch (e) {
                createdDisplay = 'Invalid Date';
            }
        }

        // Format last modified date for tooltip
        let lastModifiedDisplay = '';
        if (lastModified) {
            try {
                const date = new Date(lastModified);
                if (!isNaN(date.getTime())) {
                    lastModifiedDisplay = date.toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                }
            } catch (e) {
                // Silent fail for last modified date
            }
        }

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                        ${batchId}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        <i class="${statusIcon} mr-1"></i>
                        ${rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${imageCount} images
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" ${lastModifiedDisplay ? `title="Last modified: ${lastModifiedDisplay}"` : ''}>
                    ${createdDisplay}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="viewBatchImages('${batchId}')" 
                                class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150"
                                title="View Images">
                            <i class="fas fa-images"></i>
                        </button>
                        <button onclick="downloadBatchImages('${batchId}')" 
                                class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-150"
                                title="Download Images">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="runInference('${batchId}')" 
                                class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                                title="Run Inference">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create a building table row
     */
    createBuildingTableRow(building) {
        const status = building.status || 'active';
        const statusClass = this.statusColors[status] || 'bg-green-100 text-green-800';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                        ${building.name || 'Unknown Building'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">
                        ${building.address || 'N/A'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="editBuilding('${building.id}')" 
                                class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Edit Building">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteBuilding('${building.id}')" 
                                class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete Building">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create a model table row
     */
    createModelTableRow(model) {
        const status = model.status || 'active';
        const statusClass = this.statusColors[status] || this.statusColors['active'];
        const statusIcon = this.statusIcons[status] || this.statusIcons['active'];

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                        ${model.displayName ||  'Unknown Model'}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        ${model.modelType || 'Unknown Type'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">
                       <div class="text-xs text-gray-500 dark:text-gray-400">Confidence: ${model.Confidence}%</div>
                    </div>
                    ${model.ModelAccuracy ? `<div class="text-xs text-gray-500 dark:text-gray-400">Accuracy: ${model.ModelAccuracy}%</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        <i class="${statusIcon} mr-1"></i>
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="editModel('${model.id}')" 
                                class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150"
                                title="Edit Model">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteModel('${model.id}')" 
                                class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-150"
                                title="Delete Model">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create a pipeline table row
     */
    createPipelineTableRow(pipeline) {
        const status = pipeline.status || 'active';
        const statusClass = this.statusColors[status] || 'bg-green-100 text-green-800';
        const statusIcon = this.statusIcons[status] || 'fas fa-play';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                        ${pipeline.name || pipeline.pipeline_name || 'Unknown Pipeline'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">
                        ${pipeline.type || pipeline.pipeline_type || 'Inference'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        <i class="${statusIcon} mr-1"></i>
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="runPipeline('${pipeline.id}')" 
                                class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                title="Run Pipeline">
                            <i class="fas fa-play"></i>
                        </button>
                        <button onclick="editPipeline('${pipeline.id}')" 
                                class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Edit Pipeline">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePipeline('${pipeline.id}')" 
                                class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete Pipeline">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Create users table
     */
    createUsersTable(users) {
        if (!users || users.length === 0) {
            return this.createEmptyState({
                icon: 'fas fa-users',
                title: 'No Users Found',
                message: 'No users are currently available in the system.'
            });
        }

        const headers = ['User', 'Email', 'Role', 'Actions'];
        const rows = users.map(user => this.createUserTableRow(user));

        return this.createTable({ headers, rows });
    }

    /**
     * Create batches table
     */
    createBatchesTable(batches) {
        if (!batches || batches.length === 0) {
            return this.createEmptyState({
                icon: 'fas fa-layer-group',
                title: 'No Batches Found',
                message: 'No image batches are currently available.'
            });
        }

        const headers = ['Batch ID', 'Status', 'Images', 'Created', 'Actions'];
        const rows = batches.map(batch => this.createBatchTableRow(batch));

        return this.createTable({ headers, rows });
    }

    /**
     * Create complete buildings table
     */
    createBuildingsTable(buildings) {
        if (!buildings || buildings.length === 0) {
            return this.createEmptyState({
                icon: 'fas fa-building',
                title: 'No Buildings Found',
                message: 'No buildings are currently registered in the system.'
            });
        }

        const headers = ['Building Name', 'Address', 'Status', 'Actions'];
        const rows = buildings.map(building => this.createBuildingTableRow(building));

        return this.createTable({ headers, rows });
    }

    /**
     * Create complete models table
     */
    createModelsTable(models) {
        if (!models || models.length === 0) {
            return this.createEmptyState({
                icon: 'fas fa-brain',
                title: 'No Models Found',
                message: 'No AI models are currently available.'
            });
        }

        const headers = ['Model Name', 'Score', 'Status', 'Actions'];
        const rows = models.map(model => this.createModelTableRow(model));

        return this.createTable({ headers, rows });
    }

    /**
     * Create complete pipelines table
     */
    createPipelinesTable(pipelines) {
        if (!pipelines || pipelines.length === 0) {
            return this.createEmptyState({
                icon: 'fas fa-cogs',
                title: 'No Pipelines Found',
                message: 'No inference pipelines are currently configured.'
            });
        }

        const headers = ['Pipeline Name', 'Type', 'Status', 'Actions'];
        const rows = pipelines.map(pipeline => this.createPipelineTableRow(pipeline));

        return this.createTable({ headers, rows });
    }

    /**
     * Create empty state message
     */
    createEmptyState(config) {
        return `
            <div class="text-center py-12">
                <i class="${config.icon} text-4xl text-gray-400 mb-4"></i>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${config.title}</h3>
                <p class="text-gray-600 dark:text-gray-300">${config.message}</p>
            </div>
        `;
    }

    /**
     * Create pagination empty state
     */
    createPaginationEmptyState(config) {
        return `
            <div class="text-center py-12">
                <i class="${config.icon} text-4xl text-gray-400 mb-4"></i>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No ${config.type} on This Page</h3>
                <p class="text-gray-600 dark:text-gray-300">Try navigating to a different page.</p>
            </div>
        `;
    }
}

// Export for use in other modules
window.TableFactory = TableFactory;
