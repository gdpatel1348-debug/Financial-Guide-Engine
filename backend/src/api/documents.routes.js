import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Form16Extractor } from '../services/form16Extractor.js';

const router = Router();
router.use(requireAuth);

// Temporary upload storage with strict file size limits
const uploadDir = path.join(os.tmpdir(), 'fge_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `form16-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMime = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg'
  ];
  const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type. Please upload a Form 16 PDF or an image (JPG, PNG, WebP).');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB
  }
});

/**
 * POST /api/documents/form16
 * Accepts 'file' or 'form16' form-data field
 */
router.post(
  '/form16',
  (req, res, next) => {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'form16', maxCount: 1 }
    ])(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            data: null,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'The uploaded file exceeds the 15MB size limit.'
            },
            meta: { requestId: req.id }
          });
        }
        return res.status(400).json({
          data: null,
          error: { code: 'UPLOAD_ERROR', message: err.message },
          meta: { requestId: req.id }
        });
      } else if (err) {
        return res.status(400).json({
          data: null,
          error: {
            code: err.code || 'INVALID_UPLOAD',
            message: err.message || 'File upload failed.'
          },
          meta: { requestId: req.id }
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    const uploadedFile = req.files?.file?.[0] || req.files?.form16?.[0];

    if (!uploadedFile) {
      return res.status(400).json({
        data: null,
        error: {
          code: 'FILE_MISSING',
          message: 'No Form 16 file was uploaded. Please select a file.'
        },
        meta: { requestId: req.id }
      });
    }

    const filePath = uploadedFile.path;

    try {
      // Read file into buffer
      const buffer = await fs.promises.readFile(filePath);

      // Perform extraction
      const result = await Form16Extractor.extract(
        buffer,
        uploadedFile.mimetype,
        uploadedFile.originalname
      );

      // Check if completely empty
      if (Object.keys(result.extracted).length === 0) {
        return res.status(422).json({
          data: null,
          error: {
            code: 'EXTRACTION_EMPTY',
            message: 'Could not extract financial figures from this document. Please check the file or enter details manually.'
          },
          meta: { requestId: req.id }
        });
      }

      // Return structured response
      return res.json({
        data: {
          extracted: result.extracted,
          warnings: result.warnings,
          meta: result.meta
        },
        extracted: result.extracted,
        warnings: result.warnings,
        meta: {
          requestId: req.id,
          ...result.meta
        },
        error: null
      });
    } catch (extractErr) {
      return res.status(422).json({
        data: null,
        error: {
          code: 'EXTRACTION_FAILED',
          message: extractErr.message || 'Failed to read document. Please ensure it is a legible Form 16 or enter values manually.'
        },
        meta: { requestId: req.id }
      });
    } finally {
      // Clean up temporary file to ensure sensitive data is not kept on disk
      if (filePath) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }
  }
);

export default router;
