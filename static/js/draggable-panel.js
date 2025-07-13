// draggable-panel.js
// Handles draggable and collapsible logic for the draggable panel, left sidebar, and class selection panel

document.addEventListener('DOMContentLoaded', function() {
    // Collapsible left sidebar
    const leftSidebar = document.getElementById('left-sidebar');
    const collapseLeftBtn = document.getElementById('collapse-left-sidebar');
    // Add expand button for left sidebar
    let expandLeftBtn = document.getElementById('expand-left-sidebar');
    if (!expandLeftBtn) {
        expandLeftBtn = document.createElement('button');
        expandLeftBtn.id = 'expand-left-sidebar';
        expandLeftBtn.className = 'hidden absolute top-4 left-2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full p-2 shadow';
        expandLeftBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        leftSidebar.parentNode.insertBefore(expandLeftBtn, leftSidebar);
    }
    if (leftSidebar && collapseLeftBtn && expandLeftBtn) {
        collapseLeftBtn.addEventListener('click', function() {
            leftSidebar.classList.add('collapsed');
            collapseLeftBtn.style.display = 'none';
            expandLeftBtn.classList.remove('hidden');
            setTimeout(adjustCanvasContainer, 350);
        });
        expandLeftBtn.addEventListener('click', function() {
            leftSidebar.classList.remove('collapsed');
            collapseLeftBtn.style.display = '';
            expandLeftBtn.classList.add('hidden');
            setTimeout(adjustCanvasContainer, 350);
        });
    }

    const rightSidebar = document.getElementById('right-sidebar');
    const collapseRightBtn = document.getElementById('collapse-right-sidebar');
    let expandRightBtn = document.getElementById('expand-right-sidebar');
    if (!expandRightBtn) {
        expandRightBtn = document.createElement('button');
        expandRightBtn.id = 'expand-right-sidebar';
        expandRightBtn.className = 'hidden absolute top-4 right-2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full p-2 shadow';
        expandRightBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        rightSidebar.parentNode.insertBefore(expandRightBtn, rightSidebar);
    }
    if (rightSidebar && collapseRightBtn && expandRightBtn) {
        collapseRightBtn.addEventListener('click', function() {
            rightSidebar.classList.add('collapsed');
            collapseRightBtn.style.display = 'none';
            expandRightBtn.classList.remove('hidden');
            setTimeout(adjustCanvasContainer, 350);
        });
        expandRightBtn.addEventListener('click', function() {
            rightSidebar.classList.remove('collapsed');
            collapseRightBtn.style.display = '';
            expandRightBtn.classList.add('hidden');
            setTimeout(adjustCanvasContainer, 350);
        });
    }

    // Collapsible class selection panel (handled in template for icon logic)

    // Draggable/collapsible floating panel
    const draggablePanel = document.getElementById('draggable-panel');
    const draggableHeader = document.getElementById('draggable-panel-header');
    const collapseDraggableBtn = document.getElementById('collapse-draggable-panel');
    const draggableBody = document.getElementById('draggable-panel-body');
    let isCollapsed = false;
    if (draggablePanel && draggableHeader && collapseDraggableBtn && draggableBody) {
        collapseDraggableBtn.addEventListener('click', function() {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                draggableBody.style.display = 'none';
                collapseDraggableBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                draggableBody.style.display = '';
                collapseDraggableBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
            setTimeout(adjustCanvasContainer, 350);
        });

        // Drag logic
        let offsetX, offsetY, isDragging = false;
        draggableHeader.addEventListener('mousedown', function(e) {
            isDragging = true;
            const rect = draggablePanel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            draggablePanel.style.left = (e.clientX - offsetX) + 'px';
            draggablePanel.style.top = (e.clientY - offsetY) + 'px';
            draggablePanel.style.transform = '';
        });
        document.addEventListener('mouseup', function() {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }

    // Collapsible bottom class selection panel
    const bottomPanel = document.getElementById('bottom-panel');
    const collapseBottomBtn = document.getElementById('collapse-bottom-panel');

    if (bottomPanel && collapseBottomBtn) {
        collapseBottomBtn.addEventListener('click', function() {
            bottomPanel.classList.toggle('collapsed');
            // Optionally toggle icon direction for better UX
            const icon = collapseBottomBtn.querySelector('i');
            if (bottomPanel.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-down';
            } else {
                icon.className = 'fas fa-chevron-up';
            }
            setTimeout(adjustCanvasContainer, 350);
        });
    }
});

// Adjust canvas container size when panels collapse/expand
function adjustCanvasContainer() {
    // Optionally, add logic to resize canvas or container if needed
}