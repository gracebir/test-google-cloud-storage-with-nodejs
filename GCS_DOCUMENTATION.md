# Google Cloud Storage with Node.js - Complete Guide

This document explains how Google Cloud Storage works with Node.js and how it's implemented in this application.

## Table of Contents

1. [What is Google Cloud Storage?](#what-is-google-cloud-storage)
2. [How GCS Works](#how-gcs-works)
3. [Setting Up GCS in Node.js](#setting-up-gcs-in-nodejs)
4. [Authentication Methods](#authentication-methods)
5. [Implementation in This App](#implementation-in-this-app)
6. [Common Operations](#common-operations)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## What is Google Cloud Storage?

Google Cloud Storage (GCS) is a RESTful online file storage web service for storing and accessing data on Google Cloud Platform infrastructure. It's similar to AWS S3 or Azure Blob Storage.

### Key Features:

- **Scalable**: Store unlimited amounts of data
- **Durable**: 99.999999999% (11 9's) annual durability
- **Available**: 99.95% availability SLA
- **Secure**: Encryption at rest and in transit
- **Cost-effective**: Pay only for what you use
- **Global CDN**: Fast content delivery worldwide

### Use Cases:

- Serving website content (images, videos, documents)
- Storing and sharing files
- Backup and disaster recovery
- Data archival
- Content distribution

## How GCS Works

### Core Concepts

1. **Project**: A GCP project that contains your resources
2. **Bucket**: A container for storing objects (like a folder)
   - Must have a globally unique name
   - Has a location (region or multi-region)
   - Contains storage class and access controls

3. **Object**: An individual file stored in a bucket
   - Can be any file type
   - Has metadata (content type, cache control, etc.)
   - Identified by a unique name within the bucket

4. **Permissions**: Control who can access buckets and objects
   - IAM (Identity and Access Management)
   - ACLs (Access Control Lists) - legacy
   - Uniform bucket-level access (recommended)

### Architecture

```
Google Cloud Project
  └── Bucket (my-app-bucket)
       ├── Object 1 (image1.jpg)
       ├── Object 2 (document.pdf)
       └── Object 3 (video.mp4)
```

### Access Methods

1. **Public URLs**: Direct HTTP access
   ```
   https://storage.googleapis.com/bucket-name/object-name
   ```

2. **Signed URLs**: Time-limited access with authentication
   ```
   https://storage.googleapis.com/bucket-name/object-name?X-Goog-Algorithm=...
   ```

3. **API Access**: Programmatic access via SDKs

## Setting Up GCS in Node.js

### 1. Install the SDK

```bash
npm install @google-cloud/storage
```

### 2. Authentication

Google Cloud uses service accounts for server-to-server authentication.

**Create Service Account:**
1. Go to GCP Console > IAM & Admin > Service Accounts
2. Create a new service account
3. Grant it the "Storage Admin" role
4. Generate and download a JSON key file

**Set Environment Variable:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
```

Or in `.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
```

### 3. Initialize the Client

```typescript
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'your-project-id',
  keyFilename: './path/to/key.json',
});
```

## Authentication Methods

### Method 1: Service Account Key File (This App Uses This)

```typescript
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
```

**Pros:**
- Simple to implement
- Works everywhere (local, server, CI/CD)
- Full control over permissions

**Cons:**
- Key file must be secured
- Must be distributed to all environments

### Method 2: Application Default Credentials (ADC)

```typescript
// No credentials specified - uses environment
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});
```

**Pros:**
- No key file needed in production
- Works automatically on GCP services (Cloud Run, GKE, etc.)
- More secure (no keys to manage)

**Cons:**
- Requires setup for local development
- Different setup per environment

### Method 3: Explicit Credentials

```typescript
const storage = new Storage({
  projectId: 'your-project-id',
  credentials: {
    client_email: 'service-account@project.iam.gserviceaccount.com',
    private_key: process.env.PRIVATE_KEY,
  },
});
```

## Implementation in This App

### Architecture Overview

```
User Request
    ↓
Express Router (imageRoutes.ts)
    ↓ (with Multer middleware)
Controller (imageController.ts)
    ↓
Service (imageService.ts)
    ↓
Google Cloud Storage + PostgreSQL (via Prisma)
    ↓
Response with public URL
```

### File Upload Flow

1. **Client sends file** via multipart/form-data
2. **Multer middleware** intercepts and stores file in memory buffer
3. **Route handler** validates file (type, size)
4. **Controller** receives the request
5. **Service layer** handles business logic:
   - Generates unique filename (timestamp + extension)
   - Creates GCS file reference
   - Uploads buffer to GCS
   - Generates public URL
   - Saves metadata to PostgreSQL
6. **Response** returns file URL to client

### Code Breakdown

#### 1. Service Configuration (`imageService.ts`)

```typescript
import { Storage } from '@google-cloud/storage';

// Initialize Storage client
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Lazy initialization to ensure env vars are loaded
const getBucket = () => {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set');
  }
  return storage.bucket(bucketName);
};
```

**Why lazy initialization?**
- Environment variables must be loaded by `dotenv` first
- Prevents "bucket name required" errors
- Validates configuration at runtime

#### 2. File Upload Implementation

```typescript
async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
  const bucket = getBucket();

  // Generate unique filename
  const fileName = `${Date.now()}${path.extname(file.originalname)}`;

  // Get file reference
  const blob = bucket.file(fileName);

  // Upload file buffer to GCS
  await blob.save(file.buffer, {
    resumable: false,      // No resumable upload (small files)
    contentType: file.mimetype,
    metadata: {
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    },
  });

  // Generate public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

  // Save to database
  const savedImage = await prisma.image.create({
    data: {
      name: file.originalname,
      url: publicUrl,
    },
  });

  return savedImage;
}
```

**Key points:**
- `file.buffer`: In-memory file content from Multer
- `resumable: false`: For files < 5MB (simpler, faster)
- `contentType`: Ensures browser renders correctly
- `metadata.cacheControl`: Improves performance via CDN caching

#### 3. File Deletion

```typescript
async deleteImage(id: number): Promise<void> {
  const bucket = getBucket();

  // Get image metadata from database
  const image = await prisma.image.findUnique({ where: { id } });

  if (!image) {
    throw new Error('Image not found');
  }

  // Extract filename from URL
  const fileName = image.url.split('/').pop();

  // Delete from GCS
  if (fileName) {
    await bucket.file(fileName).delete();
  }

  // Delete from database
  await prisma.image.delete({ where: { id } });
}
```

### Why This Architecture?

**Separation of Concerns:**
- **Routes**: Handle HTTP routing and validation
- **Controllers**: Process requests/responses
- **Services**: Business logic and external API calls
- **Database**: Prisma handles data persistence

**Benefits:**
- Easy to test (mock services)
- Easy to modify (change GCS to S3)
- Easy to understand (clear responsibilities)
- Reusable service methods

## Common Operations

### Upload a File

```typescript
const bucket = storage.bucket('my-bucket');
const file = bucket.file('path/to/file.jpg');

// From buffer (this app)
await file.save(buffer, {
  contentType: 'image/jpeg',
});

// From local file
await bucket.upload('./local-file.jpg', {
  destination: 'remote-file.jpg',
});

// From stream
const writeStream = file.createWriteStream({
  metadata: { contentType: 'image/jpeg' },
});
readStream.pipe(writeStream);
```

### Download a File

```typescript
// To buffer
const [contents] = await file.download();

// To local file
await file.download({ destination: './downloaded.jpg' });

// Stream
const readStream = file.createReadStream();
readStream.pipe(outputStream);
```

### List Files

```typescript
const [files] = await bucket.getFiles();
files.forEach(file => {
  console.log(file.name);
});

// With prefix (folder-like)
const [files] = await bucket.getFiles({ prefix: 'images/' });
```

### Delete File

```typescript
await file.delete();
```

### Make File Public

```typescript
// For individual files (not compatible with uniform bucket-level access)
await file.makePublic();

// For entire bucket (recommended)
await bucket.makePublic();
```

### Generate Signed URL

```typescript
const [url] = await file.getSignedUrl({
  version: 'v4',
  action: 'read',
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
});
```

### Get File Metadata

```typescript
const [metadata] = await file.getMetadata();
console.log(metadata.contentType);
console.log(metadata.size);
console.log(metadata.timeCreated);
```

### Copy File

```typescript
await file.copy('new-bucket/new-file.jpg');
```

### Move File

```typescript
await file.move('new-location.jpg');
```

## Best Practices

### 1. Security

✅ **Do:**
- Use service accounts with minimal required permissions
- Never commit service account keys to version control
- Use `.gitignore` for `.env` and `.json` key files
- Implement authentication/authorization in your API
- Use signed URLs for sensitive content
- Enable uniform bucket-level access

❌ **Don't:**
- Don't make buckets public unless necessary
- Don't use personal accounts for service authentication
- Don't hardcode credentials in source code
- Don't grant excessive permissions

### 2. Performance

✅ **Do:**
- Use `resumable: false` for files < 5MB
- Set appropriate `Cache-Control` headers
- Use CDN for frequently accessed files
- Compress files before upload when possible
- Use multi-region buckets for global access

❌ **Don't:**
- Don't download/upload large files synchronously
- Don't fetch metadata unnecessarily
- Don't create new Storage instances per request

### 3. Error Handling

```typescript
try {
  await file.save(buffer);
} catch (error) {
  if (error.code === 404) {
    console.error('Bucket not found');
  } else if (error.code === 403) {
    console.error('Permission denied');
  } else {
    console.error('Upload failed:', error);
  }
  throw error;
}
```

### 4. Cost Optimization

- Use appropriate storage classes (Standard, Nearline, Coldline, Archive)
- Enable lifecycle management to auto-delete old files
- Use compression for large files
- Monitor usage with Cloud Monitoring
- Set up budget alerts

### 5. File Naming

✅ **Good:**
```typescript
// Unique, organized, no conflicts
const fileName = `uploads/${userId}/${Date.now()}-${uuid()}.jpg`;
```

❌ **Bad:**
```typescript
// Conflicts, not organized
const fileName = 'image.jpg';
```

## Troubleshooting

### Error: "The caller does not have permission"

**Cause**: Service account lacks required IAM roles

**Fix:**
1. Go to IAM & Admin in GCP Console
2. Find your service account
3. Add role: "Storage Admin" or "Storage Object Admin"

### Error: "Bucket does not exist"

**Cause**: Bucket name is wrong or bucket not created

**Fix:**
1. Verify `GCS_BUCKET_NAME` in `.env`
2. Check bucket exists in GCP Console
3. Ensure you're using the correct project

### Error: "Could not load the default credentials"

**Cause**: Authentication not configured

**Fix:**
1. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. Ensure key file path is correct
3. Verify key file is valid JSON

### Error: "Cannot update access control for an object when uniform bucket-level access is enabled"

**Cause**: Trying to use `makePublic()` on individual files

**Fix:**
- Make the entire bucket public via IAM
- Or use signed URLs instead

### Upload succeeds but URL returns 403 Forbidden

**Cause**: File/bucket is not public

**Fix:**
1. Go to bucket permissions in GCP Console
2. Add `allUsers` with "Storage Object Viewer" role
3. Or generate signed URLs for temporary access

## Additional Resources

- [GCS Node.js Client Documentation](https://googleapis.dev/nodejs/storage/latest/)
- [GCS Official Documentation](https://cloud.google.com/storage/docs)
- [Best Practices Guide](https://cloud.google.com/storage/docs/best-practices)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [IAM Permissions Reference](https://cloud.google.com/storage/docs/access-control/iam-permissions)

## Conclusion

Google Cloud Storage with Node.js provides a powerful, scalable solution for file storage. This application demonstrates a production-ready implementation with proper architecture, error handling, and security considerations. The key is understanding the authentication flow, proper bucket configuration, and following best practices for performance and security.
