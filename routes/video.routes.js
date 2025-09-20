import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRequired } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { videoUploadSchema } from '../utils/validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'videos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Upload video
router.post('/upload', authRequired, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const { error, value } = videoUploadSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { title, description } = value;
    const file = req.file;

    // Get video duration (simplified - in production use ffprobe)
    const duration_seconds = 0; // Placeholder

    const result = await query(
      `INSERT INTO videos (title, description, filename, file_path, file_size, mime_type, duration_seconds)
       VALUES (:title, :description, :filename, :file_path, :file_size, :mime_type, :duration_seconds)`,
      {
        title,
        description: description || null,
        filename: file.filename,
        file_path: file.path,
        file_size: file.size,
        mime_type: file.mimetype,
        duration_seconds
      }
    );

    const video = await query('SELECT * FROM videos WHERE id = :id', { id: result.insertId });
    res.status(201).json({ video: video[0] });
  } catch (err) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// Get all videos
router.get('/', async (req, res) => {
  try {
    const videos = await query(
      'SELECT id, title, description, filename, file_size, mime_type, duration_seconds, created_at FROM videos WHERE is_active = TRUE ORDER BY created_at DESC'
    );
    res.json({ videos });
  } catch (err) {
    console.error('Get videos error:', err);
    res.status(500).json({ error: 'Failed to get videos' });
  }
});

// Get video by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const videos = await query(
      'SELECT * FROM videos WHERE id = :id AND is_active = TRUE',
      { id }
    );
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];
    res.json({ video });
  } catch (err) {
    console.error('Get video error:', err);
    res.status(500).json({ error: 'Failed to get video' });
  }
});

// Serve video file
router.get('/:id/file', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const videos = await query(
      'SELECT file_path, mime_type, filename FROM videos WHERE id = :id AND is_active = TRUE',
      { id }
    );
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];
    const filePath = path.join(__dirname, '..', video.file_path);
    
    res.setHeader('Content-Type', video.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${video.filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Serve video error:', err);
    res.status(500).json({ error: 'Failed to serve video' });
  }
});

// Delete video (admin only)
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Soft delete
    await query('UPDATE videos SET is_active = FALSE WHERE id = :id', { id });
    
    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
