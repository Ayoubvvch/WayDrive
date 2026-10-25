/**
 * WayDrive - Main Application Bootstrapper & Global Events
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Setup UI components & Modals
    setupModalsAndDropdowns();
    setupDragAndDropUploads();
    setupMarqueeSelection();
    setupVinylRotation();

    // 2. Initialize Realtime Firestore VFS listener
    initFirestoreListener();
}

function setupModalsAndDropdowns() {
    const newDropdownBtn = document.getElementById('newDropdownBtn');
    const newDropdownMenu = document.getElementById('newDropdownMenu');
    const sortDropdownBtn = document.getElementById('sortDropdownBtn');
    const sortDropdownMenu = document.getElementById('sortDropdownMenu');
    const searchInput = document.getElementById('searchInput');
    const listViewBtn = document.getElementById('listViewBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');

    // 1. New Dropdown Menu Toggle
    if (newDropdownBtn && newDropdownMenu) {
        newDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = newDropdownMenu.classList.contains('hidden');
            if (isHidden) {
                newDropdownMenu.classList.remove('hidden');
                setTimeout(() => {
                    newDropdownMenu.classList.remove('scale-95', 'opacity-0');
                    newDropdownMenu.classList.add('scale-100', 'opacity-100');
                }, 10);
            } else {
                newDropdownMenu.classList.remove('scale-100', 'opacity-100');
                newDropdownMenu.classList.add('scale-95', 'opacity-0');
                setTimeout(() => newDropdownMenu.classList.add('hidden'), 200);
            }
        });
    }

    // 2. Sort Dropdown Menu Toggle
    if (sortDropdownBtn && sortDropdownMenu) {
        sortDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = sortDropdownMenu.classList.contains('hidden');
            if (isHidden) {
                sortDropdownMenu.classList.remove('hidden');
            } else {
                sortDropdownMenu.classList.add('hidden');
            }
        });
    }

    // Global Click to Close Dropdowns & Action Menus
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#newDropdownContainer')) {
            if (newDropdownMenu && !newDropdownMenu.classList.contains('hidden')) {
                newDropdownMenu.classList.remove('scale-100', 'opacity-100');
                newDropdownMenu.classList.add('scale-95', 'opacity-0');
                setTimeout(() => newDropdownMenu.classList.add('hidden'), 200);
            }
        }
        if (!e.target.closest('#sortDropdownContainer')) {
            if (sortDropdownMenu && !sortDropdownMenu.classList.contains('hidden')) {
                sortDropdownMenu.classList.add('hidden');
            }
        }
        const actionMenu = document.getElementById('globalActionMenu');
        if (actionMenu && !e.target.closest('#globalActionMenu') && !e.target.closest('.action-menu-btn')) {
            actionMenu.classList.add('hidden');
        }
    });

    // 3. View mode toggles
    if (listViewBtn && gridViewBtn) {
        listViewBtn.addEventListener('click', () => {
            currentView = 'list';
            listViewBtn.className = 'p-2 rounded-lg text-amber-400 bg-white/[0.04] text-xs font-semibold transition-all duration-200 flex items-center justify-center w-8 h-8';
            gridViewBtn.className = 'p-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all duration-200 flex items-center justify-center w-8 h-8';
            renderCurrentDirectory();
        });

        gridViewBtn.addEventListener('click', () => {
            currentView = 'grid';
            gridViewBtn.className = 'p-2 rounded-lg text-amber-400 bg-white/[0.04] text-xs font-semibold transition-all duration-200 flex items-center justify-center w-8 h-8';
            listViewBtn.className = 'p-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all duration-200 flex items-center justify-center w-8 h-8';
            renderCurrentDirectory();
        });
    }

    // 4. Search input
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderCurrentDirectory();
        });
    }

    // 5. File / Folder input triggers
    window.triggerFileInput = () => {
        document.getElementById('fileInput').click();
    };

    window.triggerFolderInput = () => {
        document.getElementById('folderInput').click();
    };

    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                enqueueUploads(Array.from(e.target.files));
                fileInput.value = '';
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                files.forEach(f => {
                    if (f.webkitRelativePath) f.relativePath = f.webkitRelativePath;
                });
                enqueueUploads(files);
                folderInput.value = '';
            }
        });
    }

    // 6. New Folder Modal Handlers
    const newFolderModal = document.getElementById('newFolderModal');
    const newFolderModalCard = document.getElementById('newFolderModalCard');
    const newFolderNameInput = document.getElementById('newFolderNameInput');

    const closeNewFolderModal = () => {
        newFolderModal.classList.remove('opacity-100');
        newFolderModal.classList.add('opacity-0');
        newFolderModalCard.classList.remove('scale-100');
        newFolderModalCard.classList.add('scale-95');
        setTimeout(() => newFolderModal.classList.add('hidden'), 250);
    };

    document.getElementById('cancelNewFolderBtn')?.addEventListener('click', closeNewFolderModal);

    const handleCreateFolder = async () => {
        const name = newFolderNameInput.value.trim();
        if (!name) return;
        closeNewFolderModal();
        await createFolder(name, currentFolderId);
    };

    document.getElementById('confirmNewFolderBtn')?.addEventListener('click', handleCreateFolder);
    newFolderNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCreateFolder();
    });

    // 7. Rename Modal Handlers
    const renameModal = document.getElementById('renameModal');
    const renameModalCard = document.getElementById('renameModalCard');
    const renameItemInput = document.getElementById('renameItemInput');

    const closeRenameModal = () => {
        renameModal.classList.remove('opacity-100');
        renameModal.classList.add('opacity-0');
        renameModalCard.classList.remove('scale-100');
        renameModalCard.classList.add('scale-95');
        setTimeout(() => {
            renameModal.classList.add('hidden');
            pendingRenameTarget = null;
        }, 250);
    };

    document.getElementById('cancelRenameBtn')?.addEventListener('click', closeRenameModal);

    const handleRenameSubmit = async () => {
        if (!pendingRenameTarget) return;
        const newName = renameItemInput.value.trim();
        if (!newName) return;
        const targetId = pendingRenameTarget.id;
        closeRenameModal();
        await renameDriveItem(targetId, newName);
    };

    document.getElementById('confirmRenameBtn')?.addEventListener('click', handleRenameSubmit);
    renameItemInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleRenameSubmit();
    });

    // 8. Move Modal Handlers
    const moveModal = document.getElementById('moveModal');
    const moveModalCard = document.getElementById('moveModalCard');
    const closeMoveModal = () => {
        moveModal.classList.remove('opacity-100');
        moveModal.classList.add('opacity-0');
        moveModalCard.classList.remove('scale-100');
        moveModalCard.classList.add('scale-95');
        setTimeout(() => {
            moveModal.classList.add('hidden');
            pendingMoveTarget = null;
        }, 250);
    };

    document.getElementById('cancelMoveBtn')?.addEventListener('click', closeMoveModal);
    document.getElementById('confirmMoveBtn')?.addEventListener('click', () => {
        window.executeMoveTarget();
    });

    // 9. Confirm Delete Modal Handlers
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalCard = document.getElementById('confirmModalCard');
    const closeConfirmModal = () => {
        confirmModal.classList.remove('opacity-100');
        confirmModal.classList.add('opacity-0');
        confirmModalCard.classList.remove('scale-100');
        confirmModalCard.classList.add('scale-95');
        setTimeout(() => {
            confirmModal.classList.add('hidden');
            pendingDeleteTarget = null;
        }, 250);
    };

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeConfirmModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
        closeConfirmModal();
        executePendingDeletion();
    });

    // 10. Create Archive Modal Handlers
    const createArchiveModal = document.getElementById('createArchiveModal');
    const createArchiveModalCard = document.getElementById('createArchiveModalCard');
    const archiveIdentifierInput = document.getElementById('archiveIdentifierInput');
    const archiveTitleInput = document.getElementById('archiveTitleInput');
    const archiveMediatypeSelect = document.getElementById('archiveMediatypeSelect');

    window.promptNewArchive = () => {
        archiveIdentifierInput.value = '';
        archiveTitleInput.value = '';
        createArchiveModal.classList.remove('hidden');
        setTimeout(() => {
            createArchiveModal.classList.remove('opacity-0');
            createArchiveModal.classList.add('opacity-100');
            createArchiveModalCard.classList.remove('scale-95');
            createArchiveModalCard.classList.add('scale-100');
            archiveIdentifierInput.focus();
        }, 10);
    };

    const closeCreateArchiveModal = () => {
        createArchiveModal.classList.remove('opacity-100');
        createArchiveModal.classList.add('opacity-0');
        createArchiveModalCard.classList.remove('scale-100');
        createArchiveModalCard.classList.add('scale-95');
        setTimeout(() => createArchiveModal.classList.add('hidden'), 250);
    };

    document.getElementById('cancelCreateArchiveBtn')?.addEventListener('click', closeCreateArchiveModal);

    document.getElementById('confirmCreateArchiveBtn')?.addEventListener('click', async () => {
        let identifier = archiveIdentifierInput.value.trim().toLowerCase();
        const title = archiveTitleInput.value.trim() || identifier;
        const mediatype = archiveMediatypeSelect.value;

        identifier = identifier.replace(/[^a-z0-9_-]/g, '-');
        if (!identifier) {
            showToast("Identifier cannot be empty.", "error");
            return;
        }

        closeCreateArchiveModal();
        showToast(`Creating Archive "${identifier}"...`, "info");

        try {
            const createUrl = `${S3_ENDPOINT}/${identifier}/_archive_init.txt`;
            const response = await fetch(createUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': IA_AUTH_HEADER,
                    'x-archive-auto-make-bucket': '1',
                    'x-archive-meta-title': title,
                    'x-archive-meta-mediatype': mediatype,
                    'x-archive-meta-collection': 'opensource'
                },
                body: `Archive initialized via WayDrive on ${new Date().toISOString()}`
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            // Add folder to Firestore
            await ITEMS_COL.add({
                name: title,
                type: 'folder',
                parentId: currentFolderId,
                archiveId: identifier,
                mediatype: mediatype,
                itemCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            showToast(`Archive "${title}" created successfully!`, "success");
        } catch (err) {
            console.error("Error creating archive item:", err);
            showToast("Failed to create archive: " + err.message, "error");
        }
    });

    // Close Modals on outside click
    newFolderModal?.addEventListener('click', (e) => {
        if (e.target === newFolderModal) closeNewFolderModal();
    });
    renameModal?.addEventListener('click', (e) => {
        if (e.target === renameModal) closeRenameModal();
    });
    moveModal?.addEventListener('click', (e) => {
        if (e.target === moveModal) closeMoveModal();
    });
    confirmModal?.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
    });
    createArchiveModal?.addEventListener('click', (e) => {
        if (e.target === createArchiveModal) closeCreateArchiveModal();
    });
    document.getElementById('mediaPlayerModal')?.addEventListener('click', (e) => {
        if (!isPlayerMinimized && e.target === document.getElementById('mediaPlayerModal')) {
            window.closeMediaPlayer();
        }
    });
    document.getElementById('pdfViewerModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('pdfViewerModal')) {
            window.closePdfViewer();
        }
    });
}

// Drag & Drop Files from Desktop into Window
function setupDragAndDropUploads() {
    const globalDragOverlay = document.getElementById('globalDragOverlay');
    if (!globalDragOverlay) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            globalDragOverlay.classList.remove('hidden');
            setTimeout(() => {
                globalDragOverlay.classList.remove('opacity-0');
                globalDragOverlay.classList.add('opacity-100');
            }, 10);
        }
    });

    window.addEventListener('dragleave', (e) => {
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            globalDragOverlay.classList.remove('opacity-100');
            globalDragOverlay.classList.add('opacity-0');
            setTimeout(() => {
                if (dragCounter === 0) globalDragOverlay.classList.add('hidden');
            }, 250);
        }
    });

    window.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        dragCounter = 0;
        globalDragOverlay.classList.remove('opacity-100');
        globalDragOverlay.classList.add('opacity-0');
        setTimeout(() => globalDragOverlay.classList.add('hidden'), 250);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            enqueueUploads(files);
        }
    });
}
