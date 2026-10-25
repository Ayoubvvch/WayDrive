/**
 * WayDrive — Optional Static Configuration Template (For Self-Hosted Deployments)
 *
 * Usage:
 * 1. Copy this file to `js/config.local.js`
 * 2. Include `<script src="js/config.local.js"></script>` before `js/config.js` in `index.html`
 * 3. Or simply configure everything via the built-in UI Settings Modal in the browser!
 */

window.WAYDRIVE_STATIC_CONFIG = {
    // Get your free S3 keys from: https://archive.org/account/s3.php
    s3AccessKey: "YOUR_ARCHIVE_ORG_S3_ACCESS_KEY",
    s3SecretKey: "YOUR_ARCHIVE_ORG_S3_SECRET_KEY",

    // Default Archive.org bucket identifier for root uploads (lowercase letters, numbers, hyphens)
    defaultBucket: "waydrive-vault-myusername",

    // Optional: Firebase Firestore Configuration for multi-device realtime VFS sync
    // Leave empty to use WayDrive's built-in Local Browser VFS Engine!
    firebaseConfig: {
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: "",
        collectionName: "waydrive_items"
    }
};
