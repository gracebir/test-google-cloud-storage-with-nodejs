import { Storage } from '@google-cloud/storage';
import prisma from '../prisma';
import path from 'path';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const getBucket = () => {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set');
  }
  return storage.bucket(bucketName);
};

export interface UploadResult {
  id: number;
  name: string;
  url: string;
  createdAt: Date;
}

export class ImageService {
  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    try {
      const bucket = getBucket();

      // Create unique filename with timestamp
      const fileName = `${Date.now()}${path.extname(file.originalname)}`;
      const blob = bucket.file(fileName);

      // Upload to GCS with public access (for uniform bucket-level access)
      await blob.save(file.buffer, {
        resumable: false,
        contentType: file.mimetype,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Generate public URL (bucket must have public access configured)
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      // Save to database
      const savedImage = await prisma.image.create({
        data: {
          name: file.originalname,
          url: publicUrl,
        },
      });

      return savedImage;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  async getAllImages(): Promise<UploadResult[]> {
    try {
      return await prisma.image.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching images:', error);
      throw new Error('Failed to fetch images');
    }
  }

  async getImageById(id: number): Promise<UploadResult | null> {
    try {
      return await prisma.image.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Error fetching image:', error);
      throw new Error('Failed to fetch image');
    }
  }

  async deleteImage(id: number): Promise<void> {
    try {
      const bucket = getBucket();

      const image = await prisma.image.findUnique({
        where: { id },
      });

      if (!image) {
        throw new Error('Image not found');
      }

      // Extract filename from URL
      const fileName = image.url.split('/').pop();
      if (fileName) {
        await bucket.file(fileName).delete();
      }

      // Delete from database
      await prisma.image.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }
}

export const imageService = new ImageService();
