/**
 * WayDrive - Google Drive UI Rendering, Sorting, Move & Inspector
 */

// ==========================================
// 1. Helper Utilities
// ==========================================

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024, dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(dateVal) {
    if (!dateVal) return '--';
    const date = new Date(dateVal);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const map = {
        'mp4': { icon: 'fa-file-video text-amber-400' },
        'mkv': { icon: 'fa-file-video text-amber-400' },
        'mov': { icon: 'fa-file-video text-amber-400' },
        'webm': { icon: 'fa-file-video text-amber-400' },
        'avi': { icon: 'fa-file-video text-amber-400' },
        'mp3': { icon: 'fa-file-audio text-amber-300' },
        'wav': { icon: 'fa-file-audio text-amber-300' },
        'flac': { icon: 'fa-file-audio text-amber-300' },
        'm4a': { icon: 'fa-file-audio text-amber-300' },
        'pdf': { icon: 'fa-file-pdf text-rose-500' },
        'zip': { icon: 'fa-file-archive text-yellow-500' },
        'tar': { icon: 'fa-file-archive text-yellow-500' },
        'gz': { icon: 'fa-file-archive text-yellow-500' },
        'rar': { icon: 'fa-file-archive text-yellow-500' },
        'png': { icon: 'fa-file-image text-emerald-400' },
        'jpg': { icon: 'fa-file-image text-emerald-400' },
        'jpeg': { icon: 'fa-file-image text-emerald-400' },
        'webp': { icon: 'fa-file-image text-emerald-400' },
        'gif': { icon: 'fa-file-image text-emerald-400' },
        'xml': { icon: 'fa-file-code text-indigo-400' },
        'sqlite': { icon: 'fa-database text-cyan-400' },
        'json': { icon: 'fa-file-code text-cyan-400' },
        'js': { icon: 'fa-file-code text-yellow-400' },
        'txt': { icon: 'fa-file-alt text-slate-300' }
    };
    return map[ext] || { icon: 'fa-file text-slate-400' };
}

function isSystemFile(filename) {
    if (!filename) return false;
    const lower = filename.toLowerCase();
    return lower.endsWith('_files.xml') ||
           lower.endsWith('_meta.xml') ||
           lower.endsWith('_meta.sqlite') ||
           lower.endsWith('_archive.torrent') ||
           lower.startsWith('__ia_thumb') ||
           lower.includes('.thumbs/');
}

function isMediaVideo(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    return ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'm4v', 'ogv'].includes(ext);
}

function isMediaAudio(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    return ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus'].includes(ext);
}

function isMediaPdf(fileName) {
    return (fileName || '').toLowerCase().endsWith('.pdf');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const accent = type === 'success' ? 'border-l-4 border-emerald-500 bg-[#0a0a10]/95 text-emerald-400' :
                   type === 'error' ? 'border-l-4 border-rose-500 bg-[#0a0a10]/95 text-rose-400' :
                   type === 'warning' ? 'border-l-4 border-yellow-500 bg-[#0a0a10]/95 text-yellow-400' :
                   'border-l-4 border-amber-500 bg-[#0a0a10]/95 text-amber-400';
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.className = `flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 shadow-2xl transform translate-y-[20px] opacity-0 transition-all duration-300 pointer-events-auto backdrop-blur-xl ${accent}`;
    toast.innerHTML = `<i class="fas ${icon} text-base shrink-0"></i><span class="text-xs font-semibold text-slate-200">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-[20px]', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function setLoadingState(message) {
    const fileGrid = document.getElementById('fileGridBody');
    const foldersGrid = document.getElementById('foldersGridBody');
    const fileList = document.getElementById('fileListBody');
    const html = `
        <div class="col-span-full text-center py-16 text-slate-500">
            <div class="flex flex-col items-center gap-3">
                <i class="fas fa-spinner fa-spin text-2xl text-amber-400"></i>
                <span class="text-xs font-semibold">${message}</span>
            </div>
        </div>
    `;
    if (fileGrid) fileGrid.innerHTML = html;
    if (foldersGrid) foldersGrid.innerHTML = '';
    if (fileList) fileList.innerHTML = `<tr><td colspan="5" class="text-center py-12">${html}</td></tr>`;
}

function renderErrorState(message) {
    const fileGrid = document.getElementById('fileGridBody');
    if (!fileGrid) return;
    fileGrid.innerHTML = `
        <div class="col-span-full text-center py-16 text-rose-400">
            <div class="flex flex-col items-center gap-3">
                <i class="fas fa-exclamation-circle text-3xl"></i>
                <span class="font-semibold text-sm">${message}</span>
            </div>
        </div>
    `;
}

function updateStatusUI(online) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
        if (online) {
            indicator.className = 'flex items-center gap-1.5 text-emerald-400 text-xs font-semibold';
            indicator.innerHTML = '<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span><span>Online</span>';
        } else {
            indicator.className = 'flex items-center gap-1.5 text-rose-400 text-xs font-semibold';
            indicator.innerHTML = '<span class="w-2 h-2 bg-rose-500 rounded-full"></span><span>Offline</span>';
        }
    }
}

// ==========================================
// 2. Sorting System (Default: Newest First)
// ==========================================

function getItemTime(item) {
    if (!item) return 0;
    if (item.type === 'folder') {
        // For folders: check newest child item inside it
        const childTimes = allDriveItems
            .filter(child => child.parentId === item.id)
            .map(child => getItemTime(child));
        const maxChild = childTimes.length > 0 ? Math.max(...childTimes) : 0;
        const own = parseInt(item.createdAt || item.mtime || item.updatedAt || 0, 10);
        return Math.max(own, maxChild);
    }
    // For files: mtime is the exact Archive.org creation/upload timestamp!
    return parseInt(item.mtime || item.createdAt || item.updatedAt || 0, 10);
}

function sortItems(items) {
    return [...items].sort((a, b) => {
        const timeA = getItemTime(a);
        const timeB = getItemTime(b);

        switch (currentSort) {
            case 'date-desc': // Newest First (Default)
                return timeB - timeA;
            case 'date-asc':  // Oldest First
                return timeA - timeB;
            case 'name-asc':  // A-Z
                return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
            case 'name-desc': // Z-A
                return (b.name || '').localeCompare(a.name || '', undefined, { numeric: true, sensitivity: 'base' });
            case 'size-desc': // Largest
                return (b.size || 0) - (a.size || 0);
            case 'size-asc':  // Smallest
                return (a.size || 0) - (b.size || 0);
            default:
                return timeB - timeA;
        }
    });
}

window.setSortMode = (mode) => {
    currentSort = mode;
    localStorage.setItem('waydrive_sort', mode);
    updateSortUI();
    renderCurrentDirectory();

    const menu = document.getElementById('sortDropdownMenu');
    if (menu) menu.classList.add('hidden');
};

function updateSortUI() {
    const labels = {
        'date-desc': 'Newest First',
        'date-asc': 'Oldest First',
        'name-asc': 'Name (A-Z)',
        'name-desc': 'Name (Z-A)',
        'size-desc': 'Size (Largest)',
        'size-asc': 'Size (Smallest)'
    };

    const labelEl = document.getElementById('currentSortLabel');
    if (labelEl) labelEl.textContent = labels[currentSort] || 'Newest First';

    ['date-desc', 'date-asc', 'name-asc', 'name-desc', 'size-desc', 'size-asc'].forEach(m => {
        const check = document.getElementById(`sortCheck-${m}`);
        if (check) {
            if (m === currentSort) check.classList.remove('hidden');
            else check.classList.add('hidden');
        }
    });
}

// ==========================================
// 3. Directory, Path & Sidebar Rendering
// ==========================================

function renderCurrentDirectory() {
    updateSortUI();
    renderBreadcrumbsAndPath();
    renderSidebarFolderTree();

    const searchTerm = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

    // Filter items inside current directory
    let currentItems = allDriveItems.filter(item => {
        const matchesParent = (item.parentId || 'root') === currentFolderId;
        if (!matchesParent) return false;

        if (searchTerm && !(item.name || '').toLowerCase().includes(searchTerm)) {
            return false;
        }

        if (!showSystemFiles) {
            if (item.isSystem || isSystemFile(item.name)) return false;
        }

        return true;
    });

    let folders = currentItems.filter(it => it.type === 'folder');
    let files = currentItems.filter(it => it.type === 'file');

    // Apply Sorting (Newest First by default)
    folders = sortItems(folders);
    files = sortItems(files);

    const foldersSection = document.getElementById('foldersSection');
    const filesSection = document.getElementById('filesSection');
    const emptyState = document.getElementById('emptyStateContainer');
    const foldersCountBadge = document.getElementById('foldersCountBadge');
    const filesCountBadge = document.getElementById('filesCountBadge');

    if (foldersCountBadge) foldersCountBadge.textContent = `${folders.length} folder${folders.length === 1 ? '' : 's'}`;
    if (filesCountBadge) filesCountBadge.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;

    if (folders.length === 0 && files.length === 0) {
        if (foldersSection) foldersSection.classList.add('hidden');
        if (filesSection) filesSection.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // 1. Render Folders Section
    if (folders.length > 0) {
        if (foldersSection) foldersSection.classList.remove('hidden');
        renderFoldersGrid(folders);
    } else {
        if (foldersSection) foldersSection.classList.add('hidden');
    }

    // 2. Render Files Section
    if (files.length > 0) {
        if (filesSection) filesSection.classList.remove('hidden');
        if (currentView === 'grid') {
            document.getElementById('fileTableContainer')?.classList.add('hidden');
            document.getElementById('fileGridContainer')?.classList.remove('hidden');
            renderFilesGrid(files);
        } else {
            document.getElementById('fileGridContainer')?.classList.add('hidden');
            document.getElementById('fileTableContainer')?.classList.remove('hidden');
            renderFilesList(files);
        }
    } else {
        if (filesSection) filesSection.classList.add('hidden');
    }
}

// Render Folder Cards (Single click opens folder!)
function renderFoldersGrid(folders) {
    const container = document.getElementById('foldersGridBody');
    if (!container) return;

    container.innerHTML = folders.map(folder => {
        const isSelected = selectedItems.some(it => it.id === folder.id);
        const subCount = allDriveItems.filter(it => it.parentId === folder.id && (showSystemFiles || !isSystemFile(it.name))).length;
        const isReelz = folder.name.toLowerCase() === 'reelz';

        return `
            <div class="folder-card group relative bg-[#0b0b12] hover:bg-[#11111c] border ${isSelected ? 'border-amber-500/80 bg-amber-500/10' : 'border-white/[0.04] hover:border-amber-500/30'} rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-amber-500/5 select-none flex items-center justify-between"
                 draggable="true"
                 ondragstart="window.handleItemDragStart(event, '${folder.id}')"
                 ondragover="window.handleFolderDragOver(event, this)"
                 ondragleave="window.handleFolderDragLeave(event, this)"
                 ondrop="window.handleFolderDrop(event, '${folder.id}')"
                 onclick="window.openFolder('${folder.id}', '${escapeHtml(folder.name)}')">
                
                <div class="flex items-center gap-3.5 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-xl ${isReelz ? 'bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                        <i class="fas ${isReelz ? 'fa-film' : 'fa-folder'} text-lg"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="text-xs font-semibold text-slate-200 group-hover:text-amber-300 truncate" title="${escapeHtml(folder.name)}">
                            ${escapeHtml(folder.name)}
                        </h4>
                        <p class="text-[10px] text-slate-500 font-medium mt-0.5 font-mono">
                            ${subCount} item${subCount === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>

                <!-- 3-Dots Action Button (Options ONLY show when clicking here) -->
                <div class="shrink-0" onclick="event.stopPropagation()">
                    <button onclick="window.openActionMenu(event, '${folder.id}')" class="w-8 h-8 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition action-menu-btn" title="Options">
                        <i class="fas fa-ellipsis-v text-xs pointer-events-none"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render Files Grid View (Single click opens / plays file!)
function renderFilesGrid(files) {
    const container = document.getElementById('fileGridBody');
    if (!container) return;

    container.innerHTML = files.map(file => {
        const isSelected = selectedItems.some(it => it.id === file.id);
        const isVideo = isMediaVideo(file.name);
        const iconData = getFileIcon(file.name);

        let previewMarkup = '';

        if (isVideo && file.thumbnailUrl) {
            previewMarkup = `
                <div class="thumbnail-container">
                    <img src="${file.thumbnailUrl}" alt="${escapeHtml(file.name)}" loading="lazy"
                         onload="window.checkVideoThumbnail(this, '${file.id}')"
                         onerror="window.fallbackToVideoFrame(this, '${file.id}')" />
                    <div class="hidden absolute inset-0 flex items-center justify-center bg-black/40">
                        <i class="fas fa-file-video text-3xl text-amber-400"></i>
                    </div>
                    <div class="play-badge">
                        <div class="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-110 transition-transform">
                            <i class="fas fa-play text-xs ml-0.5"></i>
                        </div>
                    </div>
                </div>
            `;
        } else if (isVideo && file.downloadUrl) {
            previewMarkup = `
                <div class="thumbnail-container">
                    <video src="${file.downloadUrl}#t=1.5" preload="metadata" muted playsinline class="w-full h-full object-cover pointer-events-none"></video>
                    <div class="play-badge">
                        <div class="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-110 transition-transform">
                            <i class="fas fa-play text-xs ml-0.5"></i>
                        </div>
                    </div>
                </div>
            `;
        } else if (file.thumbnailUrl && (file.name.endsWith('.jpg') || file.name.endsWith('.png') || file.name.endsWith('.webp'))) {
            previewMarkup = `
                <div class="thumbnail-container">
                    <img src="${file.thumbnailUrl}" alt="${escapeHtml(file.name)}" loading="lazy" />
                </div>
            `;
        } else {
            previewMarkup = `
                <div class="w-full aspect-[16/9] rounded-xl bg-[#09090f] border border-white/[0.03] flex items-center justify-center">
                    <i class="fas ${iconData.icon} text-3xl opacity-80 group-hover:scale-110 transition-transform duration-200"></i>
                </div>
            `;
        }

        return `
            <div class="file-card group relative bg-[#0b0b12] hover:bg-[#11111c] border ${isSelected ? 'border-amber-500/80 bg-amber-500/10' : 'border-white/[0.04] hover:border-amber-500/30'} rounded-2xl p-3.5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-amber-500/5 select-none flex flex-col justify-between"
                 draggable="true"
                 ondragstart="window.handleItemDragStart(event, '${file.id}')"
                 onclick="window.openItemDirectly('${file.id}')">
                
                ${previewMarkup}

                <div class="flex items-center justify-between mt-3 gap-2">
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-slate-200 group-hover:text-amber-300 truncate" title="${escapeHtml(file.name)}">
                            ${escapeHtml(file.name)}
                        </p>
                        <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                            <span>${formatBytes(file.size)}</span>
                            <span>•</span>
                            <span class="truncate uppercase">${file.format || 'File'}</span>
                        </div>
                    </div>

                    <!-- 3-Dots Action Button (Options ONLY show when clicking here) -->
                    <div class="shrink-0" onclick="event.stopPropagation()">
                        <button onclick="window.openActionMenu(event, '${file.id}')" class="w-8 h-8 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition action-menu-btn" title="Options">
                            <i class="fas fa-ellipsis-v text-xs pointer-events-none"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Files List View (Table View: Row click opens file)
function renderFilesList(files) {
    const tbody = document.getElementById('fileListBody');
    if (!tbody) return;

    tbody.innerHTML = files.map(file => {
        const isSelected = selectedItems.some(it => it.id === file.id);
        const iconData = getFileIcon(file.name);

        return `
            <tr class="hover:bg-white/[0.02] ${isSelected ? 'bg-amber-500/10' : ''} transition cursor-pointer select-none"
                draggable="true"
                ondragstart="window.handleItemDragStart(event, '${file.id}')"
                onclick="window.openItemDirectly('${file.id}')">
                <td class="px-5 py-3.5" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="window.toggleSelectItem('${file.id}')" class="w-4 h-4 rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-amber-500">
                </td>
                <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                        <i class="fas ${iconData.icon} text-base shrink-0"></i>
                        <span class="text-xs font-medium text-slate-200 hover:text-amber-400 truncate max-w-md block" title="${escapeHtml(file.name)}">
                            ${escapeHtml(file.name)}
                        </span>
                    </div>
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-400 font-mono">${formatBytes(file.size)}</td>
                <td class="px-5 py-3.5 text-xs text-slate-400 uppercase font-mono">${file.format || '--'}</td>
                <td class="px-5 py-3.5 text-center" onclick="event.stopPropagation()">
                    <button onclick="window.openActionMenu(event, '${file.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition action-menu-btn" title="Options">
                        <i class="fas fa-ellipsis-v text-xs pointer-events-none"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Breadcrumbs and Phone/Server Raw Path
function renderBreadcrumbsAndPath() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    const topBarTitle = document.getElementById('topBarTitle');
    const rawPathDisplay = document.getElementById('rawPathDisplay');
    const activeBadge = document.getElementById('activeArchiveBadge');
    if (!breadcrumbs) return;

    const currentCrumb = folderPathStack[folderPathStack.length - 1];
    if (topBarTitle) topBarTitle.textContent = currentCrumb ? currentCrumb.name : 'My Drive';

    // Build raw virtual server path
    const rawPath = '/' + folderPathStack.map(c => c.id === 'root' ? 'WayDrive' : c.name).join('/');
    if (rawPathDisplay) rawPathDisplay.textContent = rawPath;

    if (activeBadge) {
        const curFolder = allDriveItems.find(it => it.id === currentFolderId);
        if (curFolder && curFolder.archiveId) {
            activeBadge.textContent = curFolder.archiveId;
            activeBadge.classList.remove('hidden');
        } else {
            activeBadge.classList.add('hidden');
        }
    }

    breadcrumbs.innerHTML = folderPathStack.map((crumb, index) => {
        const isLast = index === folderPathStack.length - 1;
        const icon = index === 0 ? '<i class="fas fa-hdd text-xs mr-1 text-amber-400"></i>' : '<i class="fas fa-folder text-xs mr-1 text-amber-400"></i>';

        if (isLast) {
            return `
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-xs font-bold text-amber-400 flex items-center bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        ${icon}${escapeHtml(crumb.name)}
                    </span>
                </div>
            `;
        } else {
            return `
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="window.navigateToPathIndex(${index})" class="text-xs font-medium text-slate-400 hover:text-slate-100 transition flex items-center px-1.5 py-1 rounded-lg hover:bg-white/[0.04]">
                        ${icon}${escapeHtml(crumb.name)}
                    </button>
                    <i class="fas fa-chevron-right text-[10px] text-slate-600"></i>
                </div>
            `;
        }
    }).join('');
}

// Render Folder Tree in the Sidebar for 1-Click Fast Navigation
function renderSidebarFolderTree() {
    const container = document.getElementById('sidebarFoldersTree');
    if (!container) return;

    const allFolders = allDriveItems.filter(it => it.type === 'folder');
    if (allFolders.length === 0) {
        container.innerHTML = '<span class="text-[11px] text-slate-600 px-2">No folders</span>';
        return;
    }

    container.innerHTML = allFolders.map(f => {
        const isActive = f.id === currentFolderId;
        const isReelz = f.name.toLowerCase() === 'reelz';
        return `
            <button onclick="window.openFolder('${f.id}', '${escapeHtml(f.name)}')" class="w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center gap-2 ${isActive ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'}">
                <i class="fas ${isReelz ? 'fa-film text-amber-400' : 'fa-folder text-amber-500/80'} text-[11px]"></i>
                <span class="truncate">${escapeHtml(f.name)}</span>
            </button>
        `;
    }).join('');
}

window.togglePathMode = () => {
    showRawPath = !showRawPath;
    localStorage.setItem('waydrive_raw_path', showRawPath);
    const rawPathDisplay = document.getElementById('rawPathDisplay');
    if (rawPathDisplay) {
        if (showRawPath) rawPathDisplay.classList.remove('hidden');
        else rawPathDisplay.classList.add('hidden');
    }
    showToast(showRawPath ? "Raw server path visible" : "Breadcrumb mode", "info");
};

window.copyCurrentPath = () => {
    const rawPath = '/' + folderPathStack.map(c => c.id === 'root' ? 'WayDrive' : c.name).join('/');
    navigator.clipboard.writeText(rawPath).then(() => {
        showToast(`Path copied: ${rawPath}`, "success");
    });
};

// ==========================================
// 4. Move to Folder System (Tree & Drag)
// ==========================================

window.promptMoveItem = (itemId) => {
    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;
    pendingMoveTarget = item;
    openMoveModal(`Move "${item.name}"`);
};

window.promptMoveSelected = () => {
    if (selectedItems.length === 0) {
        showToast("No items selected to move.", "warning");
        return;
    }
    pendingMoveTarget = { type: 'multi', items: [...selectedItems] };
    openMoveModal(`Move ${selectedItems.length} selected items`);
};

function openMoveModal(title) {
    const modal = document.getElementById('moveModal');
    const card = document.getElementById('moveModalCard');
    const list = document.getElementById('moveDestinationList');
    if (!modal || !list) return;

    let selectedDestination = 'root';
    const destinationLabel = document.getElementById('moveSelectedTargetLabel');

    // List all folders including Root
    const allFolders = allDriveItems.filter(it => it.type === 'folder');
    
    let listHtml = `
        <div class="move-dest-option flex items-center justify-between p-2.5 rounded-xl cursor-pointer bg-amber-500/10 border border-amber-500/30 text-amber-300 transition"
             data-id="root" onclick="window.selectMoveDestination('root', 'My Drive (Root)', this)">
            <div class="flex items-center gap-2.5">
                <i class="fas fa-hdd text-sm text-amber-400"></i>
                <span class="text-xs font-semibold">My Drive (Root / Home)</span>
            </div>
            <i class="fas fa-check text-xs text-amber-400"></i>
        </div>
    `;

    allFolders.forEach(folder => {
        if (pendingMoveTarget && pendingMoveTarget.id === folder.id) return;

        listHtml += `
            <div class="move-dest-option flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] text-slate-300 transition"
                 data-id="${folder.id}" onclick="window.selectMoveDestination('${folder.id}', '${escapeHtml(folder.name)}', this)">
                <div class="flex items-center gap-2.5">
                    <i class="fas fa-folder text-sm text-amber-400"></i>
                    <span class="text-xs font-medium">${escapeHtml(folder.name)}</span>
                </div>
            </div>
        `;
    });

    list.innerHTML = listHtml;
    window.currentSelectedMoveTarget = 'root';

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
    }, 10);
}

window.selectMoveDestination = (targetId, targetName, el) => {
    window.currentSelectedMoveTarget = targetId;
    const label = document.getElementById('moveSelectedTargetLabel');
    if (label) label.innerHTML = `Selected destination: <span class="text-white">${escapeHtml(targetName)}</span>`;

    document.querySelectorAll('.move-dest-option').forEach(opt => {
        opt.className = 'move-dest-option flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] text-slate-300 transition';
        const check = opt.querySelector('.fa-check');
        if (check) check.remove();
    });

    el.className = 'move-dest-option flex items-center justify-between p-2.5 rounded-xl cursor-pointer bg-amber-500/10 border border-amber-500/30 text-amber-300 transition';
    el.innerHTML += '<i class="fas fa-check text-xs text-amber-400"></i>';
};

window.executeMoveTarget = async () => {
    const targetFolderId = window.currentSelectedMoveTarget || 'root';
    const modal = document.getElementById('moveModal');

    if (!pendingMoveTarget) return;

    if (modal) {
        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }

    if (pendingMoveTarget.type === 'multi') {
        await moveMultipleItems(pendingMoveTarget.items, targetFolderId);
        clearSelection();
    } else {
        await moveDriveItem(pendingMoveTarget.id, targetFolderId);
    }

    pendingMoveTarget = null;
    renderCurrentDirectory();
};

// Drag & Drop onto Folder Cards
window.handleItemDragStart = (e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
};

window.handleFolderDragOver = (e, el) => {
    e.preventDefault();
    el.classList.add('folder-drop-active');
};

window.handleFolderDragLeave = (e, el) => {
    el.classList.remove('folder-drop-active');
};

window.handleFolderDrop = async (e, targetFolderId) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('text/plain');
    document.querySelectorAll('.folder-card').forEach(c => c.classList.remove('folder-drop-active'));

    if (!draggedItemId || draggedItemId === targetFolderId) return;

    const item = allDriveItems.find(it => it.id === draggedItemId);
    const targetFolder = allDriveItems.find(it => it.id === targetFolderId);

    if (item && targetFolder) {
        showToast(`Moving "${item.name}" into "${targetFolder.name}"...`, "info");
        await moveDriveItem(draggedItemId, targetFolderId);
        renderCurrentDirectory();
    }
};

// ==========================================
// 5. File Inspector / Details Drawer
// ==========================================

window.openDetailsDrawer = (itemId) => {
    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;

    activeDetailsItem = item;
    const drawer = document.getElementById('fileDetailsDrawer');
    const previewContainer = document.getElementById('drawerPreviewContainer');
    const nameEl = document.getElementById('drawerItemName');
    const pathEl = document.getElementById('drawerItemPath');
    const sizeEl = document.getElementById('drawerItemSize');
    const typeEl = document.getElementById('drawerItemType');
    const archiveEl = document.getElementById('drawerItemArchive');
    const dateEl = document.getElementById('drawerItemDate');
    const linkInput = document.getElementById('drawerItemLinkInput');
    const linkSection = document.getElementById('drawerLinkSection');

    if (!drawer) return;

    nameEl.textContent = item.name;
    sizeEl.textContent = item.size ? formatBytes(item.size) : '--';
    typeEl.textContent = item.format || item.type || '--';
    archiveEl.textContent = item.archiveId || 'Virtual Cloud Item';
    dateEl.textContent = formatDate(getItemTime(item));

    let path = '/WayDrive';
    if (item.parentId && item.parentId !== 'root') {
        const parentFolder = allDriveItems.find(it => it.id === item.parentId);
        if (parentFolder) path += '/' + parentFolder.name;
    }
    path += '/' + item.name;
    pathEl.textContent = path;

    if (item.downloadUrl) {
        linkSection.classList.remove('hidden');
        linkInput.value = item.downloadUrl;
    } else {
        linkSection.classList.add('hidden');
    }

    if (item.thumbnailUrl) {
        previewContainer.innerHTML = `<img src="${item.thumbnailUrl}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover" />`;
    } else {
        const iconData = getFileIcon(item.name);
        previewContainer.innerHTML = `<i class="fas ${iconData.icon} text-4xl opacity-80"></i>`;
    }

    document.getElementById('drawerOpenBtn').onclick = () => window.openItemDirectly(item.id);
    document.getElementById('drawerMoveBtn').onclick = () => window.promptMoveItem(item.id);
    document.getElementById('drawerRenameBtn').onclick = () => window.promptRename(item);
    document.getElementById('drawerDeleteBtn').onclick = () => window.promptDelete(item);

    drawer.classList.remove('drawer-closed');
    drawer.classList.add('drawer-open');
};

window.closeDetailsDrawer = () => {
    const drawer = document.getElementById('fileDetailsDrawer');
    if (!drawer) return;
    drawer.classList.remove('drawer-open');
    drawer.classList.add('drawer-closed');
    activeDetailsItem = null;
};

window.copyDrawerLink = () => {
    const input = document.getElementById('drawerItemLinkInput');
    if (input && input.value) {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast("Stream link copied to clipboard!", "success");
        });
    }
};

// ==========================================
// 6. Navigation Handlers
// ==========================================

window.openFolder = (folderId, folderName) => {
    folderPathStack.push({ id: folderId, name: folderName });
    currentFolderId = folderId;
    clearSelection();
    renderCurrentDirectory();
};

window.navigateToRoot = () => {
    folderPathStack = [{ id: 'root', name: 'My Drive' }];
    currentFolderId = 'root';
    clearSelection();
    renderCurrentDirectory();
};

window.openReelzFolder = () => {
    const reelz = allDriveItems.find(it => it.type === 'folder' && it.name.toLowerCase() === 'reelz');
    if (reelz) {
        window.openFolder(reelz.id, reelz.name);
    } else {
        showToast("Reelz folder not found.", "warning");
    }
};

window.navigateToPathIndex = (index) => {
    folderPathStack = folderPathStack.slice(0, index + 1);
    currentFolderId = folderPathStack[folderPathStack.length - 1].id;
    clearSelection();
    renderCurrentDirectory();
};

window.openItemDirectly = (itemId) => {
    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;

    if (item.type === 'folder') {
        window.openFolder(item.id, item.name);
    } else {
        if (isMediaVideo(item.name) || isMediaAudio(item.name)) {
            window.playMediaStream(item.downloadUrl, item.name, isMediaVideo(item.name));
        } else if (isMediaPdf(item.name)) {
            window.openPdfViewer(item.downloadUrl, item.name);
        } else {
            window.open(item.downloadUrl, '_blank');
        }
    }
};

// ==========================================
// 7. Modals & Actions
// ==========================================

window.promptNewFolder = () => {
    const modal = document.getElementById('newFolderModal');
    const input = document.getElementById('newFolderNameInput');
    if (!modal || !input) return;

    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        document.getElementById('newFolderModalCard')?.classList.remove('scale-95');
        document.getElementById('newFolderModalCard')?.classList.add('scale-100');
        input.focus();
    }, 10);
};

window.promptRename = (item) => {
    pendingRenameTarget = item;
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameItemInput');
    if (!modal || !input) return;

    input.value = item.name || '';
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        document.getElementById('renameModalCard')?.classList.remove('scale-95');
        document.getElementById('renameModalCard')?.classList.add('scale-100');
        input.focus();
        input.select();
    }, 10);
};

window.promptDelete = (item) => {
    pendingDeleteTarget = item;
    const modal = document.getElementById('confirmModal');
    const nameEl = document.getElementById('confirmModalFileName');
    if (!modal || !nameEl) return;

    nameEl.textContent = item.name;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        document.getElementById('confirmModalCard')?.classList.remove('scale-95');
        document.getElementById('confirmModalCard')?.classList.add('scale-100');
    }, 10);
};

// Context / Action Menu (ONLY opens when clicking 3-dots button)
window.openActionMenu = (event, itemId) => {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const item = allDriveItems.find(it => it.id === itemId);
    if (!item) return;

    const menu = document.getElementById('globalActionMenu');
    if (!menu) return;

    let itemsHtml = '';

    if (item.type === 'folder') {
        itemsHtml = `
            <button onclick="window.openFolder('${item.id}', '${escapeHtml(item.name)}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-folder-open text-amber-400 w-4"></i> Open Folder
            </button>
            <button onclick="window.promptMoveItem('${item.id}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-folder-tree text-amber-400 w-4"></i> Move to...
            </button>
            <button onclick="window.promptRename(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-pen text-blue-400 w-4"></i> Rename
            </button>
            <div class="h-px bg-white/[0.04] my-1"></div>
            <button onclick="window.promptDelete(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-2.5">
                <i class="fas fa-trash text-rose-400 w-4"></i> Delete
            </button>
        `;
    } else {
        const isVideo = isMediaVideo(item.name);
        const isAudio = isMediaAudio(item.name);
        const isPdf = isMediaPdf(item.name);

        let openAction = '';
        if (isVideo || isAudio) {
            openAction = `<button onclick="window.playMediaStream('${item.downloadUrl}', '${escapeHtml(item.name)}', ${isVideo})" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5"><i class="fas fa-play text-amber-400 w-4"></i> Play</button>`;
        } else if (isPdf) {
            openAction = `<button onclick="window.openPdfViewer('${item.downloadUrl}', '${escapeHtml(item.name)}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5"><i class="fas fa-eye text-rose-400 w-4"></i> View PDF</button>`;
        }

        itemsHtml = `
            ${openAction}
            <button onclick="window.openDetailsDrawer('${item.id}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-info-circle text-amber-400 w-4"></i> Properties & Info
            </button>
            <button onclick="window.promptMoveItem('${item.id}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-folder-tree text-amber-400 w-4"></i> Move to...
            </button>
            <a href="${item.downloadUrl}" target="_blank" download="${escapeHtml(item.name)}" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-download text-emerald-400 w-4"></i> Download
            </a>
            <button onclick="window.copyToClipboard('${item.downloadUrl}')" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-link text-indigo-400 w-4"></i> Copy Stream Link
            </button>
            <button onclick="window.promptRename(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] transition flex items-center gap-2.5">
                <i class="fas fa-pen text-blue-400 w-4"></i> Rename
            </button>
            <div class="h-px bg-white/[0.04] my-1"></div>
            <button onclick="window.promptDelete(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-2.5">
                <i class="fas fa-trash text-rose-400 w-4"></i> Delete
            </button>
        `;
    }

    menu.innerHTML = itemsHtml;
    menu.classList.remove('hidden');

    const clickX = event.clientX;
    const clickY = event.clientY;
    menu.style.left = `${Math.min(clickX, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(clickY, window.innerHeight - 250)}px`;
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Link copied to clipboard!", "success");
    }).catch(() => {
        showToast("Failed to copy link.", "error");
    });
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    isSidebarCollapsed = !isSidebarCollapsed;
    if (isSidebarCollapsed) {
        sidebar.classList.add('-translate-x-full');
        backdrop?.classList.add('hidden');
        backdrop?.classList.remove('opacity-100');
    } else {
        sidebar.classList.remove('-translate-x-full');
        backdrop?.classList.remove('hidden');
        setTimeout(() => backdrop?.classList.add('opacity-100'), 10);
    }
};

window.toggleSystemFiles = () => {
    showSystemFiles = !showSystemFiles;
    const btn = document.getElementById('toggleSystemBtn');
    if (btn) {
        if (showSystemFiles) {
            btn.classList.add('text-amber-400', 'bg-white/[0.04]');
            showToast("Showing system derivative files", "info");
        } else {
            btn.classList.remove('text-amber-400', 'bg-white/[0.04]');
            showToast("Hiding system derivative files", "info");
        }
    }
    renderCurrentDirectory();
};

const checkedThumbIds = new Set();

window.fallbackToVideoFrame = (imgEl, fileId) => {
    const item = allDriveItems.find(it => it.id === fileId);
    if (item && item.downloadUrl && imgEl && imgEl.parentElement) {
        const videoEl = document.createElement('video');
        videoEl.src = `${item.downloadUrl}#t=1.5`;
        videoEl.preload = 'metadata';
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.className = 'w-full h-full object-cover pointer-events-none';
        imgEl.replaceWith(videoEl);
    } else if (imgEl) {
        imgEl.style.display = 'none';
        if (imgEl.nextElementSibling) imgEl.nextElementSibling.classList.remove('hidden');
    }
    window.tryUpgradeArchiveThumb(fileId);
};

window.checkVideoThumbnail = (imgEl, fileId) => {
    if (!imgEl) return;
    // Archive.org default temple placeholder is 180x78 or <=180px
    if (imgEl.naturalWidth > 0 && imgEl.naturalWidth <= 180 && imgEl.naturalHeight <= 180) {
        window.fallbackToVideoFrame(imgEl, fileId);
        return;
    }
    const item = allDriveItems.find(it => it.id === fileId);
    if (item && item.thumbnailUrl && item.thumbnailUrl.endsWith('__ia_thumb.jpg')) {
        window.tryUpgradeArchiveThumb(fileId);
    }
};

window.tryUpgradeArchiveThumb = async (fileId) => {
    if (checkedThumbIds.has(fileId)) return;
    checkedThumbIds.add(fileId);
    const item = allDriveItems.find(it => it.id === fileId);
    if (!item || !item.archiveId) return;
    try {
        const res = await fetch(`https://archive.org/metadata/${item.archiveId}`);
        if (!res.ok) return;
        const data = await res.json();
        const files = data.files || [];
        const subThumbs = files.filter(f => f.name && f.name.includes('.thumbs/') && (f.name.endsWith('.jpg') || f.name.endsWith('.png')));
        if (subThumbs.length > 0) {
            const chosen = subThumbs[1] || subThumbs[0];
            const newThumbUrl = `https://archive.org/download/${item.archiveId}/${encodeURIComponent(chosen.name)}`;
            if (newThumbUrl !== item.thumbnailUrl) {
                await ITEMS_COL.doc(item.id).update({
                    thumbnailUrl: newThumbUrl
                });
            }
        }
    } catch (e) {
        // Ignore background metadata fetch errors
    }
};
