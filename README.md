# Google Cloud Storage File Upload API

A simple Express.js + TypeScript application that allows you to upload files (images and PDFs) to Google Cloud Storage and stores the file URLs in a PostgreSQL database using Prisma ORM.

## Features

- Upload images (JPEG, PNG, GIF, WebP, SVG, etc.) and PDF files
- Automatic file upload to Google Cloud Storage
- Store file metadata and URLs in PostgreSQL database
- RESTful API endpoints for CRUD operations
- TypeScript for type safety
- Clean MVC architecture (Controllers, Services, Routes)
- File size validation (5MB limit)
- File type validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Cloud Storage**: Google Cloud Storage (GCS)
- **File Upload**: Multer
- **Package Manager**: pnpm

## Project Structure

```
├── src/
│   ├── controllers/       # Request handlers
│   │   └── imageController.ts
│   ├── services/          # Business logic
│   │   └── imageService.ts
│   ├── routes/            # API route definitions
│   │   └── imageRoutes.ts
│   ├── prisma/            # Prisma client singleton
│   │   └── index.ts
│   ├── generated/         # Generated Prisma client
│   └── main.ts            # Application entry point
├── prisma/
│   └── schema.prisma      # Database schema
├── .env                   # Environment variables
└── package.json
```

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [PostgreSQL](https://www.postgresql.org/) (running locally or remote)
- [Google Cloud Platform Account](https://cloud.google.com/)
- Google Cloud Storage bucket created
- Service account key JSON file

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd test-google-cloud
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Google Cloud Storage

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Enable the Cloud Storage API
4. Create a storage bucket:
   - Go to Cloud Storage > Buckets
   - Click "Create Bucket"
   - Choose a unique name (e.g., "my-app-bucket")
   - Select location and storage class
   - Click "Create"

5. Make the bucket publicly accessible (for public file URLs):
   - Go to your bucket's "Permissions" tab
   - Click "Grant Access"
   - Add principal: `allUsers`
   - Select role: "Storage Object Viewer"
   - Click "Save"

6. Create a service account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name and click "Create"
   - Grant role: "Storage Admin" or "Storage Object Admin"
   - Click "Done"
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose JSON format
   - Download the key file and save it in your project root

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/your_database?schema=public"

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT="your-project-id"
GCS_BUCKET_NAME="your-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS="./path-to-your-service-account-key.json"

# Server (optional)
PORT=5000
```

Replace the values with your actual configuration:
- `DATABASE_URL`: Your PostgreSQL connection string
- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
- `GCS_BUCKET_NAME`: Your bucket name
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to your service account JSON key

### 5. Setup Database

```bash
# Push the schema to your database
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 6. Run the Application

**Development mode:**
```bash
pnpm run dev
```

**Production mode:**
```bash
# Build TypeScript
pnpm run build

# Start the server
pnpm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

## API Endpoints

### Upload File
```http
POST /api/upload
Content-Type: multipart/form-data

Field: image (file)
```

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "image=@/path/to/your/file.jpg"
```

**Response:**
```json
{
  "message": "Upload successful",
  "image": {
    "id": 1,
    "name": "photo.jpg",
    "url": "https://storage.googleapis.com/your-bucket/1234567890.jpg",
    "createdAt": "2025-10-30T12:00:00.000Z"
  }
}
```

### Get All Images
```http
GET /api/images
```

**Response:**
```json
{
  "images": [
    {
      "id": 1,
      "name": "photo.jpg",
      "url": "https://storage.googleapis.com/your-bucket/1234567890.jpg",
      "createdAt": "2025-10-30T12:00:00.000Z"
    }
  ]
}
```

### Get Image by ID
```http
GET /api/images/:id
```

**Response:**
```json
{
  "image": {
    "id": 1,
    "name": "photo.jpg",
    "url": "https://storage.googleapis.com/your-bucket/1234567890.jpg",
    "createdAt": "2025-10-30T12:00:00.000Z"
  }
}
```

### Delete Image
```http
DELETE /api/images/:id
```

**Response:**
```json
{
  "message": "Image deleted successfully"
}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## File Constraints

- **Allowed file types**: Images (JPEG, PNG, GIF, WebP, SVG, etc.) and PDF files
- **Maximum file size**: 5MB
- **File naming**: Files are renamed with timestamp to avoid conflicts

## Testing

You can test the API using:

- **Postman**: Import endpoints and test with form-data
- **curl**: Use the examples above
- **Thunder Client** (VS Code extension)
- **Insomnia**

## Troubleshooting

### Error: "A bucket name is needed to use Cloud Storage"
- Make sure `.env` file exists and `GCS_BUCKET_NAME` is set
- Ensure `dotenv.config()` is called before importing services

### Error: "Cannot find module '../generated/prisma'"
- Run `npx prisma generate` to generate the Prisma client

### Error: "Cannot update access control for an object when uniform bucket-level access is enabled"
- Your bucket has uniform bucket-level access enabled
- Make the entire bucket public using GCP Console (see Setup Instructions #3)

### Upload succeeds but URL is not accessible
- Check that your bucket is publicly accessible
- Verify the bucket permissions allow `allUsers` with "Storage Object Viewer" role

## Security Considerations

⚠️ **Important**: This setup makes uploaded files publicly accessible. For production:

- Consider using signed URLs for temporary access
- Implement authentication/authorization
- Add virus scanning for uploaded files
- Use environment-specific buckets
- Implement rate limiting
- Add input validation and sanitization
- Never commit `.env` or service account keys to version control

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
