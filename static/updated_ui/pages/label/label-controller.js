/**
 * Label Page Controller
 * Handles image labeling and annotation functionality
 */
class LabelPageController {
    constructor() {
        this.components = {};
        this.config = {
            autoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            shortcuts: true,
            zoomLevel: 1,
            gridEnabled: false
        };
        this.state = {
            initialized: false,
            currentImage: null,
            currentBatch: null,
            annotations: [],
            categories: [],
            selectedCategory: null,
            mode: 'view', // view, annotate, edit
            unsavedChanges: false
        };
        this.init();
    }

    /**
     * Initialize label page
     */
    async init() {
        try {
            console.log('🏷️ Initializing Label Page Controller...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup auto-save
            if (this.config.autoSave) {
                this.setupAutoSave();
            }
            
            this.state.initialized = true;
            console.log('✅ Label Page Controller initialized successfully');
            
            // Dispatch ready event
            this.dispatchEvent('labelPageReady', { controller: this });
            
        } catch (error) {
            console.error('❌ Failed to initialize label page:', error);
            ToastManager.error('Failed to initialize labeling interface. Please refresh the page.');
        }
    }

    /**
     * Initialize labeling components
     */
    async initializeComponents() {
        // Initialize annotation manager (if available)
        if (typeof AnnotationManager !== 'undefined') {
            this.components.annotationManager = new AnnotationManager();
            console.log('✅ Annotation Manager initialized');
        }

        // Initialize canvas manager (if available)
        if (typeof CanvasManager !== 'undefined') {
            this.components.canvasManager = new CanvasManager();
            console.log('✅ Canvas Manager initialized');
        }

        // Initialize category manager (if available)
        if (typeof CategoryManager !== 'undefined') {
            this.components.categoryManager = new CategoryManager();
            console.log('✅ Category Manager initialized');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Image navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-image-nav]')) {
                const direction = e.target.dataset.imageNav;
                this.navigateImage(direction);
            }
        });

        // Mode switching
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-mode]')) {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            }
        });

        // Category selection
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-category]')) {
                const categoryId = e.target.dataset.category;
                this.selectCategory(categoryId);
            }
        });

        // Save actions
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-save]')) {
                this.saveAnnotations();
            }
        });

        // Keyboard shortcuts
        if (this.config.shortcuts) {
            this.setupKeyboardShortcuts();
        }

        // Canvas events (if canvas is available)
        const canvas = document.getElementById('annotation-canvas');
        if (canvas) {
            this.setupCanvasEvents(canvas);
        }

        // Zoom controls
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-zoom]')) {
                const action = e.target.dataset.zoom;
                this.handleZoom(action);
            }
        });

        // Before unload warning for unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.state.unsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateImage('previous');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateImage('next');
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveAnnotations();
                    }
                    break;
                case 'Escape':
                    this.cancelCurrentAnnotation();
                    break;
                case 'Delete':
                case 'Backspace':
                    this.deleteSelectedAnnotation();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.handleZoom('in');
                    break;
                case '-':
                    e.preventDefault();
                    this.handleZoom('out');
                    break;
                case '0':
                    e.preventDefault();
                    this.handleZoom('fit');
                    break;
            }

            // Number keys for category selection
            if (e.key >= '1' && e.key <= '9') {
                const categoryIndex = parseInt(e.key) - 1;
                if (this.state.categories[categoryIndex]) {
                    this.selectCategory(this.state.categories[categoryIndex].id);
                }
            }
        });
    }

    /**
     * Setup canvas events
     */
    setupCanvasEvents(canvas) {
        let isDrawing = false;
        let currentAnnotation = null;

        canvas.addEventListener('mousedown', (e) => {
            if (this.state.mode !== 'annotate') return;
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.config.zoomLevel;
            const y = (e.clientY - rect.top) / this.config.zoomLevel;
            
            currentAnnotation = this.startAnnotation(x, y);
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing || !currentAnnotation) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.config.zoomLevel;
            const y = (e.clientY - rect.top) / this.config.zoomLevel;
            
            this.updateAnnotation(currentAnnotation, x, y);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (isDrawing && currentAnnotation) {
                this.finishAnnotation(currentAnnotation);
                isDrawing = false;
                currentAnnotation = null;
            }
        });

        // Touch events for mobile
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            await Promise.allSettled([
                this.loadCategories(),
                this.loadCurrentBatch(),
                this.loadCurrentImage()
            ]);
            
            ToastManager.success('Labeling interface loaded successfully');
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            ToastManager.error('Failed to load labeling data');
        }
    }

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                this.state.categories = await response.json();
                this.renderCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            throw error;
        }
    }

    /**
     * Load current batch
     */
    async loadCurrentBatch() {
        try {
            const batchId = this.getBatchIdFromUrl();
            if (batchId) {
                const response = await fetch(`/api/batches/${batchId}`);
                if (response.ok) {
                    this.state.currentBatch = await response.json();
                    this.renderBatchInfo();
                }
            }
        } catch (error) {
            console.error('Error loading batch:', error);
            throw error;
        }
    }

    /**
     * Load current image
     */
    async loadCurrentImage() {
        try {
            const imageId = this.getImageIdFromUrl();
            if (imageId) {
                const response = await fetch(`/api/images/${imageId}`);
                if (response.ok) {
                    this.state.currentImage = await response.json();
                    await this.loadImageAnnotations(imageId);
                    this.renderImage();
                }
            }
        } catch (error) {
            console.error('Error loading image:', error);
            throw error;
        }
    }

    /**
     * Load annotations for current image
     */
    async loadImageAnnotations(imageId) {
        try {
            const response = await fetch(`/api/images/${imageId}/annotations`);
            if (response.ok) {
                this.state.annotations = await response.json();
                this.renderAnnotations();
            }
        } catch (error) {
            console.error('Error loading annotations:', error);
            throw error;
        }
    }

    /**
     * Render categories panel
     */
    renderCategories() {
        const categoriesContainer = document.getElementById('categories-panel');
        if (!categoriesContainer || !this.state.categories.length) return;

        const categoriesHtml = this.state.categories.map((category, index) => `
            <div class="category-item p-3 rounded-lg border ${this.state.selectedCategory === category.id ? 
                'border-blue-500 bg-blue-50 dark:bg-blue-900' : 
                'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            } cursor-pointer transition-colors" 
                 data-category="${category.id}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-4 h-4 rounded" style="background-color: ${category.color}"></div>
                        <span class="font-medium">${category.name}</span>
                    </div>
                    <span class="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                        ${index + 1}
                    </span>
                </div>
                ${category.description ? `
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${category.description}</p>
                ` : ''}
            </div>
        `).join('');

        categoriesContainer.innerHTML = `
            <div class="space-y-2">
                <h3 class="text-lg font-semibold mb-4">Categories</h3>
                ${categoriesHtml}
            </div>
        `;
    }

    /**
     * Render batch information
     */
    renderBatchInfo() {
        const batchContainer = document.getElementById('batch-info');
        if (!batchContainer || !this.state.currentBatch) return;

        batchContainer.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 class="font-semibold mb-2">${this.state.currentBatch.name}</h3>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    <p>Images: ${this.state.currentBatch.imageCount || 0}</p>
                    <p>Status: ${this.state.currentBatch.status}</p>
                </div>
            </div>
        `;
    }

    /**
     * Render current image
     */
    renderImage() {
        const imageContainer = document.getElementById('image-container');
        if (!imageContainer || !this.state.currentImage) return;

        imageContainer.innerHTML = `
            <div class="relative">
                <img id="current-image" 
                     src="${this.state.currentImage.url}" 
                     alt="${this.state.currentImage.filename}"
                     class="max-w-full h-auto"
                     style="transform: scale(${this.config.zoomLevel})">
                <canvas id="annotation-canvas" 
                        class="absolute top-0 left-0 pointer-events-auto"
                        style="transform: scale(${this.config.zoomLevel})">
                </canvas>
            </div>
        `;

        // Setup canvas after image loads
        const img = document.getElementById('current-image');
        img.onload = () => {
            this.setupCanvas();
        };
    }

    /**
     * Setup annotation canvas
     */
    setupCanvas() {
        const canvas = document.getElementById('annotation-canvas');
        const img = document.getElementById('current-image');
        if (!canvas || !img) return;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.style.width = img.offsetWidth + 'px';
        canvas.style.height = img.offsetHeight + 'px';

        this.renderAnnotations();
    }

    /**
     * Render annotations on canvas
     */
    renderAnnotations() {
        const canvas = document.getElementById('annotation-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.state.annotations.forEach(annotation => {
            this.drawAnnotation(ctx, annotation);
        });
    }

    /**
     * Draw single annotation
     */
    drawAnnotation(ctx, annotation) {
        const category = this.state.categories.find(cat => cat.id === annotation.categoryId);
        const color = category ? category.color : '#ff0000';

        ctx.strokeStyle = color;
        ctx.fillStyle = color + '40'; // Semi-transparent fill
        ctx.lineWidth = 2;

        switch (annotation.type) {
            case 'rectangle':
                ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
                ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(annotation.x, annotation.y, annotation.radius, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fill();
                break;
            case 'polygon':
                ctx.beginPath();
                ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
                annotation.points.forEach(point => {
                    ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
                break;
        }

        // Draw label
        if (category) {
            ctx.fillStyle = color;
            ctx.font = '12px Arial';
            ctx.fillText(category.name, annotation.x, annotation.y - 5);
        }
    }

    /**
     * Navigation methods
     */
    navigateImage(direction) {
        // Implementation depends on how images are organized
        console.log(`Navigate ${direction}`);
        ToastManager.info(`Navigating ${direction}`);
    }

    /**
     * Mode switching
     */
    switchMode(mode) {
        this.state.mode = mode;
        
        // Update UI
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update cursor
        const canvas = document.getElementById('annotation-canvas');
        if (canvas) {
            canvas.style.cursor = mode === 'annotate' ? 'crosshair' : 'default';
        }

        ToastManager.info(`Switched to ${mode} mode`);
    }

    /**
     * Category selection
     */
    selectCategory(categoryId) {
        this.state.selectedCategory = categoryId;
        this.renderCategories(); // Re-render to update selection
        
        const category = this.state.categories.find(cat => cat.id === categoryId);
        if (category) {
            ToastManager.info(`Selected category: ${category.name}`);
        }
    }

    /**
     * Annotation methods
     */
    startAnnotation(x, y) {
        if (!this.state.selectedCategory) {
            ToastManager.warning('Please select a category first');
            return null;
        }

        const annotation = {
            id: this.generateId(),
            categoryId: this.state.selectedCategory,
            type: 'rectangle', // Default type
            x: x,
            y: y,
            width: 0,
            height: 0,
            timestamp: Date.now()
        };

        return annotation;
    }

    updateAnnotation(annotation, x, y) {
        annotation.width = x - annotation.x;
        annotation.height = y - annotation.y;
        
        // Redraw canvas with current annotation
        this.renderAnnotations();
        const canvas = document.getElementById('annotation-canvas');
        const ctx = canvas.getContext('2d');
        this.drawAnnotation(ctx, annotation);
    }

    finishAnnotation(annotation) {
        // Only add if annotation has meaningful size
        if (Math.abs(annotation.width) > 10 && Math.abs(annotation.height) > 10) {
            this.state.annotations.push(annotation);
            this.state.unsavedChanges = true;
            this.renderAnnotations();
            ToastManager.success('Annotation added');
        }
    }

    cancelCurrentAnnotation() {
        this.renderAnnotations(); // Clear any temporary drawing
    }

    deleteSelectedAnnotation() {
        // Implementation would depend on how annotations are selected
        console.log('Delete selected annotation');
    }

    /**
     * Save annotations
     */
    async saveAnnotations() {
        if (!this.state.currentImage || !this.state.annotations.length) {
            ToastManager.warning('No annotations to save');
            return;
        }

        try {
            const loadingToast = ToastManager.loading('Saving annotations...');
            
            const response = await fetch(`/api/images/${this.state.currentImage.id}/annotations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.state.annotations)
            });

            if (response.ok) {
                this.state.unsavedChanges = false;
                ToastManager.success('Annotations saved successfully');
            } else {
                throw new Error('Failed to save annotations');
            }
        } catch (error) {
            console.error('Error saving annotations:', error);
            ToastManager.error('Failed to save annotations');
        }
    }

    /**
     * Auto-save setup
     */
    setupAutoSave() {
        setInterval(() => {
            if (this.state.unsavedChanges) {
                this.saveAnnotations();
            }
        }, this.config.autoSaveInterval);
    }

    /**
     * Zoom handling
     */
    handleZoom(action) {
        switch (action) {
            case 'in':
                this.config.zoomLevel = Math.min(this.config.zoomLevel * 1.2, 5);
                break;
            case 'out':
                this.config.zoomLevel = Math.max(this.config.zoomLevel / 1.2, 0.1);
                break;
            case 'fit':
                this.config.zoomLevel = 1;
                break;
        }
        
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const img = document.getElementById('current-image');
        const canvas = document.getElementById('annotation-canvas');
        
        if (img) {
            img.style.transform = `scale(${this.config.zoomLevel})`;
        }
        if (canvas) {
            canvas.style.transform = `scale(${this.config.zoomLevel})`;
        }

        const zoomDisplay = document.getElementById('zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.config.zoomLevel * 100)}%`;
        }
    }

    /**
     * Touch event handlers
     */
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        e.target.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        e.target.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        e.target.dispatchEvent(mouseEvent);
    }

    /**
     * Utility methods
     */
    getBatchIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('batch') || urlParams.get('batchId');
    }

    getImageIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('image') || urlParams.get('imageId');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    getState() {
        return { ...this.state };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the label page
    if (document.body.classList.contains('label-page') || window.location.pathname.includes('label')) {
        window.labelPageController = new LabelPageController();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LabelPageController;
}
