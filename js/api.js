/**
 * WayDrive — Open-Source Cloud Drive & Virtual File System (VFS) on Internet Archive S3
 * VFS Synchronization, Archive.org IAS3 Engine & Onboarding Wizard
 */

let activeVfsUnsubscribe = null;

// ==========================================
// 1. Realtime VFS Synchronization (Firebase or Local VFS)
// ==========================================

function initFirestoreListener() {
    if (!ITEMS_COL) {
        console.error("VFS Engine not initialized.");
        showToast("VFS connection error. Please check Settings.", "error");
        return;
    }

    if (activeVfsUnsubscribe && typeof activeVfsUnsubscribe === 'function') {
        activeVfsUnsubscribe();
    }

    setLoadingState("Connecting to WayDrive VFS...");
    updateEngineStatusBadges();

    activeVfsUnsubscribe = ITEMS_COL.onSnapshot(snapshot => {
        allDriveItems = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            };
        });

        updateDriveStats();
        renderCurrentDirectory();
        updateStatusUI(true);

        // If user hasn't configured Archive.org S3 keys yet, open the Onboarding Settings Modal
        if (!isArchiveConfigured() && !sessionStorage.getItem('waydrive_prompted_setup')) {
            sessionStorage.setItem('waydrive_prompted_setup', '1');
            setTimeout(() => window.openSettingsModal(), 400);
        } else if (allDriveItems.length === 0 && !isSyncingArchive && isArchiveConfigured()) {
            showToast("WayDrive is ready! Click 'Sync Archive.org' or upload files to begin.", "info");
        }
    }, err => {
        console.error("VFS listener error:", err);
        updateStatusUI(false);
        showToast("VFS Sync error: " + err.message, "error");
        renderErrorState("Failed to connect to WayDrive VFS Database.");
    });
}

function updateEngineStatusBadges() {
    const vfsLabel = document.getElementById('vfsEngineStatusLabel');
    const s3Label = document.getElementById('s3EngineStatusLabel');
    const ownerEl = document.getElementById('ownerNameDisplay');

    if (vfsLabel) {
        vfsLabel.textContent = VFS_MODE === 'firebase' ? 'Firebase VFS Online' : 'Local Browser VFS';
    }
    if (s3Label) {
        s3Label.textContent = isArchiveConfigured() ? 'Archive.org S3 Ready' : 'S3 Keys Not Set';
    }
    const savedOwner = localStorage.getItem('waydrive_owner_name');
    if (ownerEl) {
        ownerEl.textContent = savedOwner || (isArchiveConfigured() ? 'Connected Account' : 'Not Configured');
    }
}

// Update drive statistics in sidebar
function updateDriveStats() {
    let totalBytes = 0;
    let folderCount = 0;
    let fileCount = 0;

    allDriveItems.forEach(item => {
        if (item.type === 'folder') {
            folderCount++;
        } else {
            fileCount++;
            totalBytes += (item.size || 0);
        }
    });

    const totalArchivesEl = document.getElementById('totalArchivesStat');
    const totalFilesEl = document.getElementById('totalFilesStat');
    const totalSizeEl = document.getElementById('totalSizeStat');

    if (totalArchivesEl) totalArchivesEl.textContent = folderCount;
    if (totalFilesEl) totalFilesEl.textContent = fileCount;
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(totalBytes);
}

// ==========================================
// 2. VFS CRUD Operations (Instant Metadata)
// ==========================================

// Create a new Folder
async function createFolder(folderName, parentId = currentFolderId) {
    if (!folderName || !folderName.trim()) {
        showToast("Folder name cannot be empty.", "warning");
        return;
    }

    try {
        const docRef = await ITEMS_COL.add({
            name: folderName.trim(),
            type: 'folder',
            parentId: parentId || 'root',
            itemCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        showToast(`Folder "${folderName}" created!`, "success");
        return docRef.id;
    } catch (err) {
        console.error("Create folder error:", err);
        showToast("Failed to create folder: " + err.message, "error");
    }
}

// Rename an Item (Folder or File)
async function renameDriveItem(itemId, newName) {
    if (!newName || !newName.trim()) {
        showToast("Name cannot be empty.", "warning");
        return;
    }

    try {
        await ITEMS_COL.doc(itemId).update({
            name: newName.trim(),
            updatedAt: Date.now()
        });

        showToast("Renamed successfully!", "success");
    } catch (err) {
        console.error("Rename error:", err);
        showToast("Failed to rename: " + err.message, "error");
    }
}

// Move Item to Target Folder
async function moveDriveItem(itemId, targetFolderId) {
    try {
        await ITEMS_COL.doc(itemId).update({
            parentId: targetFolderId,
            updatedAt: Date.now()
        });
        showToast("Item moved successfully.", "success");
    } catch (err) {
        console.error("Move error:", err);
        showToast("Failed to move item: " + err.message, "error");
    }
}

// Delete Item from Drive (and optionally Archive.org S3 with cascade delete)
async function deleteDriveItem(item, deleteFromS3 = true) {
    if (!item || !item.id) return;

    try {
        await ITEMS_COL.doc(item.id).delete();

        if (deleteFromS3 && isArchiveConfigured() && item.archiveId && item.s3Key) {
            const delUrl = `${S3_ENDPOINT}/${item.archiveId}/${encodeURIComponent(item.s3Key)}`;
            fetch(delUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': IA_AUTH_HEADER,
                    'x-archive-cascade-delete': '1'
                }
            }).catch(e => console.warn("S3 delete file warning:", e));
        }

        if (item.type === 'folder') {
            const children = allDriveItems.filter(child => child.parentId === item.id);
            for (const child of children) {
                await deleteDriveItem(child, deleteFromS3);
            }

            if (deleteFromS3 && isArchiveConfigured() && item.archiveId) {
                const delBucketUrl = `${S3_ENDPOINT}/${item.archiveId}`;
                fetch(delBucketUrl, {
                    method: 'DELETE',
                    headers: { 'Authorization': IA_AUTH_HEADER }
                }).catch(e => console.warn("S3 delete archive warning:", e));
            }
        }

        showToast(`"${item.name}" deleted.`, "success");
    } catch (err) {
        console.error("Delete error:", err);
        showToast("Failed to delete: " + err.message, "error");
    }
}

// ==========================================
// 3. Smart Scan & Sync with Archive.org S3
// ==========================================

async function syncWithArchiveOrg() {
    if (!isArchiveConfigured()) {
        showToast("Please configure your Archive.org S3 keys first.", "warning");
        window.openSettingsModal();
        return;
    }
    if (isSyncingArchive) return;
    isSyncingArchive = true;

    const modal = document.getElementById('syncProgressModal');
    const modalCard = document.getElementById('syncProgressModalCard');
    const progressBar = document.getElementById('syncProgressBar');
    const progressText = document.getElementById('syncProgressText');
    const progressPercent = document.getElementById('syncProgressPercent');
    const progressDetail = document.getElementById('syncProgressDetail');
    const sideSyncIcon = document.getElementById('sideSyncIcon');
    const quickSyncIcon = document.getElementById('quickSyncIcon');

    if (sideSyncIcon) sideSyncIcon.classList.add('fa-spin');
    if (quickSyncIcon) quickSyncIcon.classList.add('fa-spin');

    if (modal && modalCard) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            modalCard.classList.remove('scale-95');
            modalCard.classList.add('scale-100');
        }, 10);
    }

    try {
        if (progressDetail) progressDetail.textContent = "Connecting to Archive.org IAS3...";
        if (progressText) progressText.textContent = "Scanning owned S3 buckets...";
        if (progressBar) progressBar.style.width = "5%";
        if (progressPercent) progressPercent.textContent = "5%";

        const response = await fetch(S3_ENDPOINT, {
            method: 'GET',
            headers: { 'Authorization': IA_AUTH_HEADER }
        });

        if (!response.ok) {
            throw new Error(`S3 Error: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

        const ownerName = xmlDoc.querySelector('Owner > DisplayName')?.textContent;
        if (ownerName) {
            localStorage.setItem('waydrive_owner_name', ownerName);
            const ownerEl = document.getElementById('ownerNameDisplay');
            if (ownerEl) ownerEl.textContent = ownerName;
        }

        const bucketNodes = xmlDoc.querySelectorAll('Buckets > Bucket');
        const bucketIds = Array.from(bucketNodes).map(node => node.querySelector('Name')?.textContent || '').filter(Boolean);

        const totalBuckets = bucketIds.length;
        const isFirstImport = allDriveItems.length === 0;
        if (progressDetail) progressDetail.textContent = `Checking ${totalBuckets} archives for uploads & thumbnails...`;

        let reelzFolder = allDriveItems.find(it => it.type === 'folder' && it.name.toLowerCase() === 'reelz');
        let reelzFolderId = reelzFolder ? reelzFolder.id : 'root';

        const batchSize = 6;
        let processedCount = 0;

        for (let i = 0; i < bucketIds.length; i += batchSize) {
            const chunk = bucketIds.slice(i, i + batchSize);
            
            await Promise.all(chunk.map(async (archiveId) => {
                try {
                    const existingItems = allDriveItems.filter(it => it.archiveId === archiveId);

                    if (existingItems.length > 0) {
                        // Already in VFS! Only upgrade missing or placeholder thumbnails.
                        const needsUpdate = existingItems.some(it => it.type === 'file' && (!it.thumbnailUrl || it.thumbnailUrl.endsWith('__ia_thumb.jpg')));
                        if (!needsUpdate) return;

                        const metaRes = await fetch(`https://archive.org/metadata/${archiveId}`);
                        if (!metaRes.ok) return;
                        const data = await metaRes.json();
                        const files = data.files || [];
                        const subThumbs = files.filter(f => f.name && f.name.includes('.thumbs/'));
                        const thumbFile = subThumbs[1] || subThumbs[0] || files.find(f => f.name === '__ia_thumb.jpg');
                        const archiveThumbUrl = thumbFile
                            ? `https://archive.org/download/${archiveId}/${encodeURIComponent(thumbFile.name)}`
                            : null;

                        if (archiveThumbUrl) {
                            for (const it of existingItems) {
                                if (it.type === 'file' && (!it.thumbnailUrl || it.thumbnailUrl.endsWith('__ia_thumb.jpg')) && it.thumbnailUrl !== archiveThumbUrl) {
                                    await ITEMS_COL.doc(it.id).update({
                                        thumbnailUrl: archiveThumbUrl
                                    });
                                }
                            }
                        }
                        return;
                    }

                    // Fetch metadata for unindexed bucket
                    const metaRes = await fetch(`https://archive.org/metadata/${archiveId}`);
                    if (!metaRes.ok) return;
                    const data = await metaRes.json();
                    const metadata = data.metadata || {};
                    const files = data.files || [];

                    // Exclude system files (.xml, .sqlite, .torrent, .thumbs) and .ia.mp4 derivatives
                    const userFiles = files.filter(f => !isSystemFile(f.name) && !f.name.endsWith('.ia.mp4'));
                    if (userFiles.length === 0) return;

                    // If not initial import, ignore old deleted buckets
                    if (!isFirstImport) {
                        const lastSyncCutoff = parseInt(localStorage.getItem('waydrive_last_sync_cutoff') || '0', 10);
                        const latestMtimeMs = Math.max(...userFiles.map(f => f.mtime ? parseInt(f.mtime, 10) * 1000 : 0));
                        const pubDateMs = metadata.publicdate ? new Date(metadata.publicdate).getTime() : 0;
                        if (lastSyncCutoff > 0 && Math.max(latestMtimeMs, pubDateMs) < lastSyncCutoff) return;
                    }

                    const displayTitle = metadata.title || archiveId;
                    const subThumbs = files.filter(f => f.name && f.name.includes('.thumbs/'));
                    const thumbFile = subThumbs[1] || subThumbs[0] || files.find(f => f.name === '__ia_thumb.jpg');
                    const archiveThumbUrl = thumbFile
                        ? `https://archive.org/download/${archiveId}/${encodeURIComponent(thumbFile.name)}`
                        : `https://archive.org/download/${archiveId}/__ia_thumb.jpg`;

                    // Single-file buckets get imported directly as clean files; multi-file buckets get a folder
                    let targetParentId = 'root';
                    if (userFiles.length > 1) {
                        const folderRef = await ITEMS_COL.add({
                            name: displayTitle,
                            type: 'folder',
                            parentId: 'root',
                            archiveId: archiveId,
                            itemCount: userFiles.length,
                            createdAt: metadata.publicdate ? new Date(metadata.publicdate).getTime() : Date.now(),
                            updatedAt: Date.now()
                        });
                        targetParentId = folderRef.id;
                    } else if (isVideoFile(userFiles[0].name) && reelzFolderId !== 'root') {
                        targetParentId = reelzFolderId;
                    }

                    for (const f of userFiles) {
                        const isVideo = isVideoFile(f.name);
                        const ext = f.name.includes('.') ? '.' + f.name.split('.').pop() : '';
                        let cleanName = f.name.replace(/^\d{10,14}_/, '');
                        if (userFiles.length === 1 && displayTitle && displayTitle !== archiveId) {
                            cleanName = displayTitle.endsWith(ext) ? displayTitle : (displayTitle + ext);
                        }

                        const fileTime = f.mtime ? parseInt(f.mtime, 10) * 1000 : Date.now();
                        await ITEMS_COL.add({
                            name: cleanName,
                            type: 'file',
                            parentId: targetParentId,
                            archiveId: archiveId,
                            s3Key: f.name,
                            downloadUrl: `https://archive.org/download/${archiveId}/${encodeURIComponent(f.name)}`,
                            thumbnailUrl: isVideo ? archiveThumbUrl : null,
                            size: parseInt(f.size || 0, 10),
                            format: f.format || (isVideo ? 'MPEG4' : 'File'),
                            isSystem: false,
                            mtime: fileTime,
                            createdAt: fileTime,
                            updatedAt: Date.now()
                        });
                    }
                } catch (itemErr) {
                    console.warn(`Sync item ${archiveId} warning:`, itemErr);
                }
            }));

            processedCount += chunk.length;
            const pct = Math.min(Math.round((processedCount / Math.max(totalBuckets, 1)) * 100), 98);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPercent) progressPercent.textContent = `${pct}%`;
            if (progressText) progressText.textContent = `Syncing ${processedCount} of ${totalBuckets} archives...`;
        }

        localStorage.setItem('waydrive_last_sync_cutoff', String(Date.now()));

        if (progressBar) progressBar.style.width = "100%";
        if (progressPercent) progressPercent.textContent = "100%";
        if (progressText) progressText.textContent = "Sync complete!";
        if (progressDetail) progressDetail.textContent = "All archives and thumbnails are up to date.";

        showToast("Sync with Archive.org completed!", "success");

        setTimeout(() => {
            if (modal && modalCard) {
                modal.classList.remove('opacity-100');
                modal.classList.add('opacity-0');
                modalCard.classList.remove('scale-100');
                modalCard.classList.add('scale-95');
                setTimeout(() => modal.classList.add('hidden'), 250);
            }
        }, 1200);

    } catch (err) {
        console.error("Sync error:", err);
        showToast("Sync failed: " + err.message, "error");
        if (modal) modal.classList.add('hidden');
    } finally {
        isSyncingArchive = false;
        if (sideSyncIcon) sideSyncIcon.classList.remove('fa-spin');
        if (quickSyncIcon) quickSyncIcon.classList.remove('fa-spin');
    }
}

function isVideoFile(fileName) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'm4v', 'ogv'].includes(ext);
}

window.refreshActiveView = () => {
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.add('fa-spin');
    renderCurrentDirectory();
    setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
        showToast("Drive refreshed.", "info");
    }, 400);
};

// ==========================================
// 4. Upload Logic & IAS3 Queue Management
// ==========================================

function enqueueUploads(files) {
    if (!isArchiveConfigured()) {
        showToast("Please configure your Archive.org S3 keys before uploading.", "warning");
        window.openSettingsModal();
        return;
    }
    const wasEmpty = uploadQueue.length === 0;
    files.forEach(f => uploadQueue.push(f));
    if (wasEmpty) totalBatchCount = uploadQueue.length;
    else totalBatchCount += files.length;
    processUploadQueue();
}

async function processUploadQueue() {
    if (isUploading || uploadQueue.length === 0) return;
    isUploading = true;

    const file = uploadQueue[0];
    const relativePath = file.relativePath || file.name;

    let targetArchiveId = null;
    let targetParentId = currentFolderId;

    if (currentFolderId !== 'root') {
        const curFolder = allDriveItems.find(it => it.id === currentFolderId);
        if (curFolder && curFolder.archiveId) {
            targetArchiveId = curFolder.archiveId;
        }
    }

    if (!targetArchiveId) {
        const cleanSlug = IA_ACCESS_KEY.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'public';
        targetArchiveId = DEFAULT_VAULT_BUCKET || `waydrive-vault-${cleanSlug}`;
    }

    const widget = document.getElementById('uploadProgressWidget');
    const widgetTitle = document.getElementById('widgetTitle');
    const widgetFileName = document.getElementById('widgetFileName');
    const widgetFileSize = document.getElementById('widgetFileSize');
    const widgetProgressBar = document.getElementById('widgetProgressBar');
    const widgetStatusText = document.getElementById('widgetStatusText');
    const widgetProgressPercent = document.getElementById('widgetProgressPercent');

    widgetProgressBar.classList.remove('bg-emerald-500', 'bg-rose-500');
    widgetProgressBar.classList.add('bg-amber-500');
    widgetFileName.textContent = relativePath;
    widgetFileSize.textContent = formatBytes(file.size);
    widgetProgressBar.style.width = '0%';
    widgetProgressPercent.textContent = '0%';
    widgetStatusText.textContent = 'Uploading to Archive.org S3...';

    const remaining = uploadQueue.length;
    const completed = totalBatchCount - remaining + 1;
    widgetTitle.textContent = totalBatchCount > 1 ? `Uploading ${completed} of ${totalBatchCount}` : 'Uploading 1 item';

    widget.classList.remove('hidden');
    setTimeout(() => {
        widget.classList.remove('translate-y-2', 'opacity-0');
        widget.classList.add('opacity-100');
    }, 10);

    try {
        const uploadUrl = `${S3_ENDPOINT}/${targetArchiveId}/${encodeURIComponent(relativePath)}`;
        
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Authorization', IA_AUTH_HEADER);
            xhr.setRequestHeader('x-archive-auto-make-bucket', '1');
            xhr.setRequestHeader('x-archive-interactive-priority', '1');
            if (file.size > 0) {
                xhr.setRequestHeader('x-archive-size-hint', String(file.size));
            }

            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable) {
                    const percent = Math.round((evt.loaded / evt.total) * 100);
                    widgetProgressBar.style.width = percent + '%';
                    widgetProgressPercent.textContent = percent + '%';
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else if (xhr.status === 503) reject(new Error("HTTP 503 SlowDown: Archive.org queue is busy. Try again shortly."));
                else reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            };

            xhr.onerror = () => reject(new Error("Network error during S3 upload"));
            xhr.send(file);
        });

        const isVideo = isVideoFile(file.name);
        const downloadUrl = `https://archive.org/download/${targetArchiveId}/${encodeURIComponent(relativePath)}`;
        const nowMs = Date.now();
        
        await ITEMS_COL.add({
            name: file.name,
            type: 'file',
            parentId: targetParentId,
            archiveId: targetArchiveId,
            s3Key: relativePath,
            downloadUrl: downloadUrl,
            thumbnailUrl: isVideo ? `https://archive.org/download/${targetArchiveId}/__ia_thumb.jpg` : null,
            size: file.size,
            format: file.type || 'File',
            isSystem: false,
            mtime: nowMs,
            createdAt: nowMs,
            updatedAt: nowMs
        });

        showToast(`"${file.name}" uploaded successfully!`, "success");
        uploadQueue.shift();
        isUploading = false;

        if (uploadQueue.length > 0) {
            processUploadQueue();
        } else {
            widgetStatusText.textContent = 'Upload complete';
            widgetProgressBar.classList.remove('bg-amber-500');
            widgetProgressBar.classList.add('bg-emerald-500');
            totalBatchCount = 0;
            setTimeout(window.closeProgressWidget, 3500);
        }
    } catch (err) {
        console.error("Upload error:", err);
        showToast(`Failed to upload "${file.name}": ${err.message}`, "error");
        widgetStatusText.textContent = 'Upload failed';
        widgetProgressBar.classList.remove('bg-amber-500');
        widgetProgressBar.classList.add('bg-rose-500');
        uploadQueue.shift();
        isUploading = false;
        if (uploadQueue.length > 0) {
            setTimeout(processUploadQueue, 2500);
        }
    }
}

window.closeProgressWidget = () => {
    const widget = document.getElementById('uploadProgressWidget');
    if (!widget) return;
    widget.classList.remove('opacity-100');
    widget.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => widget.classList.add('hidden'), 300);
};

// ==========================================
// 5. Delete Execution
// ==========================================

async function executePendingDeletion() {
    if (!pendingDeleteTarget) return;
    const deleteS3Checkbox = document.getElementById('deleteS3Checkbox');
    const deleteFromS3 = deleteS3Checkbox ? deleteS3Checkbox.checked : true;

    try {
        if (pendingDeleteTarget.type === 'multi') {
            showToast(`Deleting ${selectedItems.length} items...`, "info");
            for (const it of selectedItems) {
                await deleteDriveItem(it, deleteFromS3);
            }
            clearSelection();
        } else {
            await deleteDriveItem(pendingDeleteTarget, deleteFromS3);
        }
    } catch (err) {
        console.error("Execution error:", err);
        showToast("Error during deletion: " + err.message, "error");
    } finally {
        pendingDeleteTarget = null;
    }
}

// ==========================================
// 6. Cloud Onboarding & Settings Wizard
// ==========================================

window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    const card = document.getElementById('settingsModalCard');
    if (!modal || !card) return;

    document.getElementById('inputS3AccessKey').value = IA_ACCESS_KEY;
    document.getElementById('inputS3SecretKey').value = IA_SECRET_KEY;
    document.getElementById('inputDefaultBucket').value = DEFAULT_VAULT_BUCKET;
    document.getElementById('selectVfsMode').value = VFS_MODE;
    document.getElementById('inputFirebaseJson').value = savedFirebaseConfig ? JSON.stringify(savedFirebaseConfig, null, 2) : '';

    window.toggleFirebaseConfigSection(VFS_MODE);

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
    }, 10);
};

window.closeSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    const card = document.getElementById('settingsModalCard');
    if (!modal || !card) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 220);
};

window.toggleFirebaseConfigSection = (mode) => {
    const fbSection = document.getElementById('firebaseConfigSection');
    if (!fbSection) return;
    if (mode === 'firebase') {
        fbSection.classList.remove('hidden');
    } else {
        fbSection.classList.add('hidden');
    }
};

window.testArchiveS3Connection = async () => {
    const accessKey = document.getElementById('inputS3AccessKey')?.value.trim();
    const secretKey = document.getElementById('inputS3SecretKey')?.value.trim();
    const statusBox = document.getElementById('s3TestResultBox');

    if (!accessKey || !secretKey) {
        showToast("Enter both S3 Access Key and Secret Key first.", "warning");
        return;
    }

    if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.className = 'mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-mono';
        statusBox.textContent = 'Testing connection to https://s3.us.archive.org ...';
    }

    try {
        const [authRes, limitRes] = await Promise.all([
            fetch(S3_ENDPOINT, {
                method: 'GET',
                headers: { 'Authorization': `LOW ${accessKey}:${secretKey}` }
            }),
            fetch(`${S3_ENDPOINT}/?check_limit=1&accesskey=${encodeURIComponent(accessKey)}`)
        ]);

        if (!authRes.ok) {
            throw new Error(`HTTP ${authRes.status} — Invalid S3 keys or network error.`);
        }

        const xmlText = await authRes.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
        const ownerName = xmlDoc.querySelector('Owner > DisplayName')?.textContent || 'Authenticated User';
        const bucketCount = xmlDoc.querySelectorAll('Buckets > Bucket').length;

        let queueStatus = 'Ready (over_limit: 0)';
        if (limitRes.ok) {
            const limitJson = await limitRes.json();
            queueStatus = limitJson.over_limit === 1 ? 'Busy (over_limit: 1 — Throttle recommended)' : 'Healthy (over_limit: 0)';
        }

        if (statusBox) {
            statusBox.className = 'mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono space-y-1';
            statusBox.innerHTML = `
                <div><i class="fas fa-check-circle mr-1"></i> <b>Connected!</b> Owner: ${ownerName}</div>
                <div>📦 Owned Buckets: <b>${bucketCount}</b> | 🚦 Queue: <b>${queueStatus}</b></div>
            `;
        }
        showToast(`Connected as ${ownerName}!`, "success");
    } catch (err) {
        if (statusBox) {
            statusBox.className = 'mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono';
            statusBox.textContent = '❌ Connection failed: ' + err.message;
        }
        showToast("S3 test failed: " + err.message, "error");
    }
};

window.saveWayDriveSettings = () => {
    const accessKey = document.getElementById('inputS3AccessKey')?.value.trim() || '';
    const secretKey = document.getElementById('inputS3SecretKey')?.value.trim() || '';
    const defaultBucket = document.getElementById('inputDefaultBucket')?.value.trim() || '';
    const vfsMode = document.getElementById('selectVfsMode')?.value || 'local';
    const fbRaw = document.getElementById('inputFirebaseJson')?.value.trim() || '';

    IA_ACCESS_KEY = accessKey;
    IA_SECRET_KEY = secretKey;
    IA_AUTH_HEADER = (accessKey && secretKey) ? `LOW ${accessKey}:${secretKey}` : '';
    DEFAULT_VAULT_BUCKET = defaultBucket;
    VFS_MODE = vfsMode;

    localStorage.setItem('waydrive_s3_access', accessKey);
    localStorage.setItem('waydrive_s3_secret', secretKey);
    localStorage.setItem('waydrive_default_bucket', defaultBucket);
    localStorage.setItem('waydrive_vfs_mode', vfsMode);

    if (vfsMode === 'firebase' && fbRaw) {
        try {
            // Support either raw JSON object or pasted firebaseConfig snippet
            const cleaned = fbRaw
                .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
                .replace(/,\s*}/g, '}');
            savedFirebaseConfig = JSON.parse(cleaned);
            localStorage.setItem('waydrive_firebase_config', JSON.stringify(savedFirebaseConfig));
        } catch (e) {
            showToast("Invalid Firebase config JSON format. Please check syntax.", "error");
            return;
        }
    }

    initializeVfsEngine();
    initFirestoreListener();
    window.closeSettingsModal();
    showToast("Settings saved & VFS Engine reloaded!", "success");
};
