/**
 * WayDrive - Multi-Selection & Marquee Drag Handlers
 */

// Handle card or row click for selection
window.handleItemClick = (e, itemId) => {
    // If clicking on a button, link, or input, ignore card selection
    if (e.target.closest('button, a, input, select, .action-menu-btn')) return;

    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;

    if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        const idx = selectedItems.findIndex(it => it.id === itemId);
        if (idx >= 0) {
            selectedItems.splice(idx, 1);
        } else {
            selectedItems.push(item);
        }
    } else if (e.shiftKey && selectedItems.length > 0) {
        // Range selection
        if (!selectedItems.some(it => it.id === itemId)) {
            selectedItems.push(item);
        }
    } else {
        // Single select
        selectedItems = [item];
    }

    updateSelectionUI();
    renderCurrentDirectory();
};

window.toggleSelectItem = (itemId) => {
    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;

    const idx = selectedItems.findIndex(it => it.id === itemId);
    if (idx >= 0) {
        selectedItems.splice(idx, 1);
    } else {
        selectedItems.push(item);
    }

    updateSelectionUI();
};

window.toggleSelectAll = (masterCheckbox) => {
    const searchTerm = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const currentItems = allDriveItems.filter(item => {
        const matchesParent = (item.parentId || 'root') === currentFolderId;
        if (!matchesParent) return false;
        if (searchTerm && !(item.name || '').toLowerCase().includes(searchTerm)) return false;
        if (!showSystemFiles && (item.isSystem || isSystemFile(item.name))) return false;
        return true;
    });

    if (masterCheckbox.checked) {
        selectedItems = [...currentItems];
    } else {
        selectedItems = [];
    }

    updateSelectionUI();
    renderCurrentDirectory();
};

window.clearSelection = () => {
    selectedItems = [];
    const master = document.getElementById('selectAllCheckbox');
    if (master) master.checked = false;
    updateSelectionUI();
    renderCurrentDirectory();
};

function updateSelectionUI() {
    const bar = document.getElementById('selectionBar');
    const countLabel = document.getElementById('selectionCount');
    if (!bar || !countLabel) return;

    if (selectedItems.length > 0) {
        countLabel.textContent = `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} selected`;
        bar.classList.remove('hidden');
        setTimeout(() => {
            bar.classList.remove('translate-y-10', 'opacity-0');
            bar.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    } else {
        bar.classList.remove('translate-y-0', 'opacity-100');
        bar.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => {
            if (selectedItems.length === 0) bar.classList.add('hidden');
        }, 250);
    }
}

window.deleteSelected = () => {
    if (selectedItems.length === 0) return;
    pendingDeleteTarget = { type: 'multi' };
    
    const nameEl = document.getElementById('confirmModalFileName');
    if (nameEl) nameEl.textContent = `${selectedItems.length} selected items`;
    
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalCard = document.getElementById('confirmModalCard');
    if (confirmModal && confirmModalCard) {
        confirmModal.classList.remove('hidden');
        setTimeout(() => {
            confirmModal.classList.remove('opacity-0');
            confirmModal.classList.add('opacity-100');
            confirmModalCard.classList.remove('scale-95');
            confirmModalCard.classList.add('scale-100');
        }, 10);
    }
};

window.downloadSelectedAsZip = async () => {
    const filesToDownload = selectedItems.filter(it => it.type === 'file' && it.downloadUrl);
    if (filesToDownload.length === 0) {
        showToast("No files selected to download.", "warning");
        return;
    }

    try {
        showToast(`Preparing ZIP with ${filesToDownload.length} files...`, "info");
        const zip = new JSZip();

        for (const file of filesToDownload) {
            try {
                const res = await fetch(file.downloadUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    zip.file(file.name, blob);
                }
            } catch (dlErr) {
                console.warn(`Failed to fetch ${file.name}:`, dlErr);
            }
        }

        showToast("Packaging archive...", "info");
        const content = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `WayDrive_export_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        showToast("ZIP downloaded successfully!", "success");
    } catch (err) {
        console.error("ZIP download error:", err);
        showToast("Failed to generate ZIP archive.", "error");
    }
};

// Windows-style Mouse Marquee Drag Selection
function setupMarqueeSelection() {
    const explorerArea = document.getElementById('explorerArea');
    const marquee = document.getElementById('selection-marquee');
    if (!explorerArea || !marquee) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    explorerArea.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('button, input, select, textarea, a, .action-menu-btn, #globalActionMenu, .group')) return;
        isDragging = true;
        const rect = explorerArea.getBoundingClientRect();
        dragStartX = e.clientX - rect.left;
        dragStartY = e.clientY - rect.top;
        marquee.style.left = `${dragStartX}px`;
        marquee.style.top = `${dragStartY}px`;
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        
        if (!e.shiftKey && !e.ctrlKey) window.clearSelection();

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const rect = explorerArea.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const left = Math.min(dragStartX, currentX);
        const top = Math.min(dragStartY, currentY);
        const width = Math.abs(dragStartX - currentX);
        const height = Math.abs(dragStartY - currentY);

        if (width > 6 || height > 6) {
            marqueeDragStarted = true;
            marquee.classList.remove('hidden');
            marquee.style.left = `${left}px`;
            marquee.style.top = `${top}px`;
            marquee.style.width = `${width}px`;
            marquee.style.height = `${height}px`;
        }
    }

    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        marquee.classList.add('hidden');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setTimeout(() => { marqueeDragStarted = false; }, 50);
    }
}
