import { Router } from 'express';
import multer from 'multer';
import { imageController } from '../controllers/imageController';

const router = Router();

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images and PDFs
    const allowedMimeTypes = [
      'image/',           // All image types
      'application/pdf',  // PDF files
    ];

    const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));

    if (!isAllowed) {
      cb(new Error('Only image and PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Image routes
router.post('/upload', upload.single('image'), (req, res) => imageController.uploadImage(req, res));
router.get('/images', (req, res) => imageController.getAllImages(req, res));
router.get('/images/:id', (req, res) => imageController.getImageById(req, res));
router.delete('/images/:id', (req, res) => imageController.deleteImage(req, res));

export default router;
