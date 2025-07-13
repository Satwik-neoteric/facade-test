/**
 * Card Factory - Creates standardized cards for different data types
 * Handles the creation of user, batch, building, model, and pipeline cards
 */

class CardFactory {
    constructor() {
        this.roleColors = {
            'Administrator': 'from-red-500 to-red-600',
            'Labeller': 'from-blue-500 to-blue-600',
            'Reviewer': 'from-green-500 to-green-600'
        };

        this.roleIcons = {
            'Administrator': 'fas fa-crown',
            'Labeller': 'fas fa-tags',
            'Reviewer': 'fas fa-check-circle'
        };

        this.statusColors = {
            'active': 'from-green-500 to-green-600',
            'processing': 'from-yellow-500 to-yellow-600',
            'completed': 'from-blue-500 to-blue-600',
            'error': 'from-red-500 to-red-600',
            'running': 'from-yellow-500 to-yellow-600',
            'inactive': 'from-gray-500 to-gray-600'
        };

        this.statusIcons = {
            'active': 'fas fa-play',
            'processing': 'fas fa-spinner fa-spin',
            'completed': 'fas fa-check',
            'error': 'fas fa-exclamation-triangle',
            'running': 'fas fa-spinner fa-spin',
            'inactive': 'fas fa-pause'
        };
    }

    /**
     * Create a standardized card structure
     */
    createCard(config) {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group';
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 bg-gradient-to-r ${config.iconBg} rounded-xl flex items-center justify-center shadow-lg">
                        <i class="${config.icon} text-white text-xl"></i>
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-900 dark:text-white">${config.title}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300">${config.subtitle}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    ${config.actions.map(action => `
                        <button class="p-2 text-gray-400 hover:text-${action.color}-600 dark:hover:text-${action.color}-400 transition-colors duration-200"
                                onclick="${action.onclick}" title="${action.title}">
                            <i class="${action.icon}"></i>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="space-y-3">
                ${config.details.map(detail => `
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600 dark:text-gray-300">${detail.label}</span>
                        ${detail.type === 'badge' ? `
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${detail.badgeColor} text-white">
                                <i class="${detail.icon} mr-1"></i>
                                ${detail.value}
                            </span>
                        ` : detail.type === 'progress' ? `
                            <div class="flex items-center space-x-2">
                                <div class="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div class="bg-gradient-to-r ${detail.progressColor} h-2 rounded-full" style="width: ${detail.value}%"></div>
                                </div>
                                <span class="text-sm font-semibold text-gray-900 dark:text-white">${detail.value}%</span>
                            </div>
                        ` : `
                            <span class="text-sm ${detail.bold ? 'font-semibold' : ''} text-gray-900 dark:text-white">${detail.value}</span>
                        `}
                    </div>
                `).join('')}
            </div>
        `;

        return card;
    }

    /**
     * Create a user card
     */
    createUserCard(user) {
        const userRole = Array.isArray(user.roles) ? user.roles[0] : user.role;
        const displayRole = userRole || 'Unknown';

        return this.createCard({
            iconBg: this.roleColors[displayRole] || 'from-gray-500 to-gray-600',
            icon: this.roleIcons[displayRole] || 'fas fa-user',
            title: user.displayName || user.display_name || user.email,
            subtitle: user.email,
            actions: [
                {
                    icon: 'fas fa-edit',
                    color: 'blue',
                    onclick: `editUser('${user.id}')`,
                    title: 'Edit User'
                },
                {
                    icon: 'fas fa-trash',
                    color: 'red',
                    onclick: `deleteUser('${user.id}')`,
                    title: 'Delete User'
                }
            ],
            details: [
                {
                    label: 'Role',
                    type: 'badge',
                    value: displayRole,
                    badgeColor: this.roleColors[displayRole] || 'from-gray-500 to-gray-600',
                    icon: this.roleIcons[displayRole] || 'fas fa-user'
                },
                {
                    label: 'Status',
                    type: 'text',
                    value: 'Active'
                }
            ]
        });
    }

    /**
     * Create a batch card
     */
    createBatchCard(batch) {
        const imageCount = batch.imageCount || 0;
        const lastModified = batch.lastModified ? new Date(batch.lastModified).toLocaleDateString() : 'N/A';

        return this.createCard({
            iconBg: 'from-indigo-500 to-indigo-600',
            icon: 'fas fa-layer-group',
            title: batch.id,
            subtitle: batch.description || 'No description',
            actions: [
                {
                    icon: 'fas fa-images',
                    color: 'blue',
                    onclick: `viewBatchImages('${batch.id}')`,
                    title: 'View Images'
                },
                {
                    icon: 'fas fa-play',
                    color: 'green',
                    onclick: `runInference('${batch.id}')`,
                    title: 'Run Inference'
                }
            ],
            details: [
                {
                    label: 'Images',
                    type: 'text',
                    value: imageCount,
                    bold: true
                },
                {
                    label: 'Modified',
                    type: 'text',
                    value: lastModified
                },
                {
                    label: 'Status',
                    type: 'badge',
                    value: batch.status || 'Unknown',
                    badgeColor: this.statusColors[batch.status] || 'from-gray-500 to-gray-600',
                    icon: this.statusIcons[batch.status] || 'fas fa-question'
                }
            ]
        });
    }

    /**
     * Create a building card
     */
    createBuildingCard(building) {
        return this.createCard({
            iconBg: 'from-yellow-500 to-yellow-600',
            icon: 'fas fa-building',
            title: building.name,
            subtitle: building.address,
            actions: [
                {
                    icon: 'fas fa-edit',
                    color: 'blue',
                    onclick: `editBuilding('${building.id}')`,
                    title: 'Edit Building'
                },
                {
                    icon: 'fas fa-trash',
                    color: 'red',
                    onclick: `deleteBuilding('${building.id}')`,
                    title: 'Delete Building'
                }
            ],
            details: [
                {
                    label: 'Building ID',
                    type: 'text',
                    value: building.id
                },
                {
                    label: 'Status',
                    type: 'badge',
                    value: 'Active',
                    badgeColor: 'from-green-500 to-green-600',
                    icon: 'fas fa-check'
                }
            ]
        });
    }

    /**
     * Create a model card
     */
    createModelCard(model) {
        const accuracy = model.modelAccuracy || model.accuracy || 0;
        const confidence = model.confidence || 0;

        return this.createCard({
            iconBg: 'from-purple-500 to-purple-600',
            icon: 'fas fa-brain',
            title: model.modelName || model.name,
            subtitle: model.azureModelName || 'Azure Model',
            actions: [
                {
                    icon: 'fas fa-edit',
                    color: 'blue',
                    onclick: `editModel('${model.id}')`,
                    title: 'Edit Model'
                },
                {
                    icon: 'fas fa-trash',
                    color: 'red',
                    onclick: `deleteModel('${model.id}')`,
                    title: 'Delete Model'
                }
            ],
            details: [
                {
                    label: 'Accuracy',
                    type: 'progress',
                    value: accuracy,
                    progressColor: 'from-purple-500 to-purple-600'
                },
                {
                    label: 'Confidence',
                    type: 'text',
                    value: `${confidence}%`,
                    bold: true
                },
                {
                    label: 'Category',
                    type: 'badge',
                    value: model.categoryNo || 'N/A',
                    badgeColor: 'from-purple-500 to-purple-600',
                    icon: 'fas fa-tag'
                }
            ]
        });
    }

    /**
     * Create a pipeline card
     */
    createPipelineCard(pipeline) {
        return this.createCard({
            iconBg: 'from-green-500 to-green-600',
            icon: 'fas fa-cogs',
            title: pipeline.name || pipeline.pipelineName,
            subtitle: pipeline.description || 'Processing Pipeline',
            actions: [
                {
                    icon: 'fas fa-play',
                    color: 'green',
                    onclick: `runPipeline('${pipeline.id}')`,
                    title: 'Run Pipeline'
                },
                {
                    icon: 'fas fa-edit',
                    color: 'blue',
                    onclick: `editPipeline('${pipeline.id}')`,
                    title: 'Edit Pipeline'
                },
                {
                    icon: 'fas fa-trash',
                    color: 'red',
                    onclick: `deletePipeline('${pipeline.id}')`,
                    title: 'Delete Pipeline'
                }
            ],
            details: [
                {
                    label: 'Type',
                    type: 'text',
                    value: pipeline.type || 'Standard',
                    bold: true
                },
                {
                    label: 'Last Run',
                    type: 'text',
                    value: pipeline.lastRun ? new Date(pipeline.lastRun).toLocaleDateString() : 'Never',
                    bold: true
                },
                {
                    label: 'Status',
                    type: 'badge',
                    value: pipeline.status || 'Inactive',
                    badgeColor: this.statusColors[pipeline.status] || 'from-gray-500 to-gray-600',
                    icon: 'fas fa-circle'
                }
            ]
        });
    }
}

// Export for use in other modules
window.CardFactory = CardFactory;
