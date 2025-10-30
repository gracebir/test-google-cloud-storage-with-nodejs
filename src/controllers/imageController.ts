import { Request, Response } from 'express';
import { imageService } from '../services/imageService';

export class ImageController {
  async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await imageService.uploadImage(req.file);

      res.status(201).json({
        message: 'Upload successful',
        image: result,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getAllImages(_req: Request, res: Response): Promise<void> {
    try {
      const images = await imageService.getAllImages();
      res.status(200).json({ images });
    } catch (error) {
      console.error('Fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch images',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getImageById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid image ID' });
        return;
      }

      const image = await imageService.getImageById(id);

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      res.status(200).json({ image });
    } catch (error) {
      console.error('Fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch image',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid image ID' });
        return;
      }

      await imageService.deleteImage(id);

      res.status(200).json({
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        error: 'Failed to delete image',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const imageController = new ImageController();
