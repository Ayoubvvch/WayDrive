# 📚 Internet Archive S3 (`IAS3`) API — Complete Engineering & Limits Guide

WayDrive is built on top of the official **Internet Archive S3-like API (`IAS3`)** (`https://s3.us.archive.org`) and the **Internet Archive Metadata API** (`https://archive.org/metadata/{identifier}`).

Because the Internet Archive is a non-profit digital library running on distributed storage nodes and asynchronous catalog queues—rather than a commercial pay-per-GB object store—understanding its architecture, limits, and custom headers is essential for building fast, reliable tools.

---

## 1. Storage Quotas & File Size Limits

| Metric | Official Limit / Recommendation | Technical Explanation |
| :--- | :--- | :--- |
| **Total Account Storage** | **Unlimited** *(Free)* | There is no hard cap on total bytes stored across your account, provided uploads comply with Internet Archive's Terms of Use. |
| **Max Size per Item (Bucket)** | **1 TB** *(Hard Limit)*<br>**500 GB** *(Recommended)* | Each Archive.org "item" acts as an S3 bucket. IA Systems Engineering recommends keeping individual items under **500 GB** so background `derive` tasks do not time out. |
| **Max Files per Item (Bucket)** | **1,000 files** *(Recommended)* | Having more than 1,000 files inside a single bucket slows down `_files.xml` catalog indexing and metadata fetches. WayDrive solves this by letting you organize unlimited virtual folders in VFS regardless of physical buckets. |
| **Large Uploads (`> 10 GB`)** | Pass `x-archive-size-hint` | When uploading files or items larger than **10 GB**, send `x-archive-size-hint: <bytes>` so IA's storage router allocates a storage node with sufficient contiguous disk space. |

---

## 2. Rate Limits, Queue Throttling & `HTTP 503 SlowDown`

Unlike AWS S3 (which throttles primarily on requests-per-second), Internet Archive's `IAS3` throttles based on **catalog task queue depth**:

1. **Why Throttling Happens:**
   Every `PUT` or `DELETE` request spawns background catalog tasks (`derive.php`, thumbnail generation, torrent creation, SQLite/XML indexing).
2. **`HTTP 503 SlowDown`:**
   If your account's queue or the target storage node becomes congested, `s3.us.archive.org` returns `HTTP 503 SlowDown`.
3. **Pre-Checking Your Rate Limit Programmatically (`?check_limit=1`):**
   Before running bulk uploads, you can query IAS3 to check if your queue is clear:
   ```bash
   curl "https://s3.us.archive.org/?check_limit=1&accesskey=YOUR_ACCESS_KEY&bucket=YOUR_BUCKET"
   ```
   **Response:**
   ```json
   {
     "over_limit": 0,
     "detail": {
       "accesskey_ration": 50,
       "accesskey_tasks_queued": 1,
       "bucket_ration": 20,
       "bucket_tasks_queued": 0
     }
   }
   ```
   - `over_limit: 0` → Queue is healthy; safe to upload.
   - `over_limit: 1` → Queue is saturated; pause or apply exponential backoff.
   *(WayDrive includes a built-in **"Test S3 & Queue Limit"** button inside the Settings modal that queries this endpoint live!)*
4. **Optimal Concurrency:**
   Keep concurrent `PUT` uploads between **1 and 3 parallel streams**. Avoid blasting 20+ simultaneous connections, which triggers automated abuse/rate protection.

---

## 3. Essential `IAS3` Custom HTTP Headers

When sending `PUT` or `DELETE` requests to `https://s3.us.archive.org/{bucket}/{filename}`, you can control the Internet Archive pipeline using these headers:

```http
Authorization: LOW <ACCESS_KEY>:<SECRET_KEY>
x-archive-auto-make-bucket: 1
x-archive-interactive-priority: 1
x-archive-size-hint: 6855395
x-archive-queue-derive: 1
```

### Header Reference:
- **`x-archive-auto-make-bucket: 1`**
  Automatically creates the Archive.org item (bucket) on the first file `PUT` if it does not already exist.
- **`x-archive-size-hint: <bytes>`**
  Informs the storage cluster of the exact byte size of the upload (critical for files `> 10 GB`).
- **`x-archive-interactive-priority: 1`**
  Marks the upload as an interactive user action so it receives higher priority in the catalog queue compared to background batch crawlers.
- **`x-archive-queue-derive: 0 | 1`**
  - `1` *(default)*: Runs the background derivation pipeline (generates `.thumbs/*.jpg` video frames, `__ia_thumb.jpg`, `.ia.mp4`, etc.).
  - `0`: Skips background derivation. Useful when uploading raw datasets or archives where you want instant ingestion without server-side transcoding.
- **`x-archive-cascade-delete: 1`**
  Used on `DELETE` requests. Instructs Archive.org to automatically delete all server-generated derivative files (such as `.thumbs/` and `.ia.mp4`) associated with the deleted source file.
- **`x-archive-meta-title: uri(<encoded_title>)`**
  Sets a human-readable UTF-8 title (supports Arabic, emojis, symbols) on the item metadata.

---

## 4. Why Raw Archive.org Needs a Virtual File System (VFS)

If you use Archive.org S3 directly without a VFS layer:
1. **Every upload creates a separate public bucket** with an ugly slug (`my-video-20261025-x8f2`).
2. **Metadata changes take 5–15 minutes** to propagate through Archive.org's catalog queue.
3. **Moving a file between folders is impossible** without re-uploading and deleting the original bucket.
4. **Each bucket is cluttered with system files** (`_meta.xml`, `_files.xml`, `_meta.sqlite`, `_archive.torrent`, `.thumbs/`, `.ia.mp4`).

**How WayDrive Solves This:**
WayDrive decouples **Physical Storage (Archive.org S3)** from **Logical Organization (Firebase Firestore or Local Browser VFS)**:
- Renaming a file or folder takes **< 50ms** in the VFS without touching Archive.org's slow metadata queue.
- Moving 50 videos into a `/WayDrive/Reelz` folder is an instant pointer update (`parentId`).
- System derivative files are automatically filtered out at the VFS layer while still leveraging Archive.org's `.thumbs/` directory for zero-cost video thumbnails!

---

## 5. Legal & Acceptable Use Guidelines

- **100% Official APIs:** WayDrive exclusively uses the official, documented Internet Archive S3 (`https://s3.us.archive.org`) and Metadata (`https://archive.org/metadata/`) endpoints with your personal API keys.
- **Public Nature of Internet Archive Items:** Remember that buckets created on `archive.org` are part of a public digital library. Do **not** upload sensitive private personal documents (passwords, private IDs, financial records) unencrypted, and always respect copyright laws and the [Internet Archive Terms of Use](https://archive.org/about/terms.php).
