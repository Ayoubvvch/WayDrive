/**
 * WayDrive — Open-Source Cloud Drive & Virtual File System (VFS) on Internet Archive S3
 * Configuration & Dual VFS Engine (Firebase Firestore + Zero-Setup Local VFS)
 *
 * No personal API keys are hardcoded in this file.
 * Users can configure credentials directly in the UI Settings Modal (stored locally in their browser)
 * or via js/config.local.js for self-hosted deployments.
 */

const S3_ENDPOINT = "https://s3.us.archive.org";

// Load saved credentials from browser localStorage or optional static config
const staticCfg = window.WAYDRIVE_STATIC_CONFIG || {};

let IA_ACCESS_KEY = localStorage.getItem('waydrive_s3_access') || staticCfg.s3AccessKey || "";
let IA_SECRET_KEY = localStorage.getItem('waydrive_s3_secret') || staticCfg.s3SecretKey || "";
let IA_AUTH_HEADER = (IA_ACCESS_KEY && IA_SECRET_KEY) ? `LOW ${IA_ACCESS_KEY}:${IA_SECRET_KEY}` : "";
let DEFAULT_VAULT_BUCKET = localStorage.getItem('waydrive_default_bucket') || staticCfg.defaultBucket || "";

// VFS Mode: 'local' (Zero-Setup Browser VFS) or 'firebase' (Realtime Multi-Device Cloud VFS)
let VFS_MODE = localStorage.getItem('waydrive_vfs_mode') || (staticCfg.firebaseConfig?.projectId ? 'firebase' : 'local');

let savedFirebaseConfig = null;
try {
    const rawFb = localStorage.getItem('waydrive_firebase_config');
    if (rawFb) savedFirebaseConfig = JSON.parse(rawFb);
    else if (staticCfg.firebaseConfig) savedFirebaseConfig = staticCfg.firebaseConfig;
} catch (e) {
    console.warn("Invalid saved Firebase config JSON:", e);
}

// ============================================================================
// Local VFS Adapter ( Firestore-compatible API for Zero-Setup Instant Usage )
// ============================================================================
class LocalVFSCollection {
    constructor(storageKey = 'waydrive_local_vfs_items') {
        this.storageKey = storageKey;
        this.listeners = [];
    }

    _readAll() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    _writeAll(items) {
        localStorage.setItem(this.storageKey, JSON.stringify(items));
        this._notify();
    }

    _notify() {
        const items = this._readAll();
        const docs = items.map(item => {
            const { id, ...rest } = item;
            return { id, data: () => rest };
        });
        const fakeSnapshot = {
            docs,
            forEach: (cb) => docs.forEach(cb)
        };
        this.listeners.forEach(fn => {
            try { fn(fakeSnapshot); } catch (e) { console.error(e); }
        });
    }

    onSnapshot(successCb) {
        this.listeners.push(successCb);
        setTimeout(() => this._notify(), 10);
        return () => {
            this.listeners = this.listeners.filter(l => l !== successCb);
        };
    }

    async add(data) {
        const items = this._readAll();
        const id = 'wd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        items.push({ id, ...data });
        this._writeAll(items);
        return { id };
    }

    doc(docId) {
        return {
            update: async (patch) => {
                const items = this._readAll();
                const idx = items.findIndex(i => i.id === docId);
                if (idx !== -1) {
                    items[idx] = { ...items[idx], ...patch };
                    this._writeAll(items);
                }
            },
            delete: async () => {
                const items = this._readAll().filter(i => i.id !== docId);
                this._writeAll(items);
            }
        };
    }
}

// ============================================================================
// Initialize Active VFS Engine (Firebase Firestore OR Local VFS)
// ============================================================================
let firebaseApp = null;
let db = null;
let ITEMS_COL = new LocalVFSCollection();

function initializeVfsEngine() {
    if (VFS_MODE === 'firebase' && savedFirebaseConfig && savedFirebaseConfig.apiKey && savedFirebaseConfig.projectId) {
        try {
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
                    firebaseApp = firebase.initializeApp(savedFirebaseConfig);
                } else {
                    firebaseApp = firebase.app();
                }
                db = firebase.firestore();
                ITEMS_COL = db.collection(savedFirebaseConfig.collectionName || 'waydrive_items');
                return;
            }
        } catch (e) {
            console.error("Firebase initialization failed, falling back to Local VFS:", e);
        }
    }
    VFS_MODE = 'local';
    ITEMS_COL = new LocalVFSCollection();
}

initializeVfsEngine();

function isArchiveConfigured() {
    return Boolean(IA_ACCESS_KEY && IA_SECRET_KEY);
}

// ============================================================================
// Global VFS & Explorer State
// ============================================================================
let allDriveItems = [];         // In-memory cache of all VFS items (folders & files)
let currentFolderId = 'root';   // Active folder ID ('root' = My Drive)
let folderPathStack = [
    { id: 'root', name: 'My Drive' }
];

let currentView = 'grid';        // 'grid' or 'list'
let showSystemFiles = false;     // Hide system derivative files (.xml, .sqlite, .torrent, .thumbs)
let selectedItems = [];          // Multi-selection array
let marqueeDragStarted = false;  // Flag for mouse drag marquee box

// Sorting & Filter State ('date-desc' = Newest First default)
let currentSort = localStorage.getItem('waydrive_sort') || 'date-desc';
let showRawPath = localStorage.getItem('waydrive_raw_path') === 'true';

// Media Player State
let isLoopEnabled = localStorage.getItem('ia_player_loop') === 'true';
let isPlayerMinimized = false;
let playerSpeed = 1.0;
let currentMediaUrl = '';
let currentMediaIsVideo = false;
let plyrVideoInstance = null;
let plyrAudioInstance = null;

// Sidebar & Layout State
let isSidebarCollapsed = true;

// Upload Queue State
let uploadQueue = [];
let isUploading = false;
let totalBatchCount = 0;

// Modals & Pending Actions State
let pendingDeleteTarget = null;
let pendingRenameTarget = null;
let pendingMoveTarget = null;
let activeDetailsItem = null;
let isSyncingArchive = false;
