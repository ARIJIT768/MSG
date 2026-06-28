const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const stream = require('stream');
require('dotenv').config();

// Use memory storage for reliable uploads
const upload = multer({ storage: multer.memoryStorage() });

// @route POST /api/media/upload
// @desc  Uploads file to DB using native GridFSBucket
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const db = mongoose.connection.db;
  if (!db) {
    return res.status(500).json({ error: 'Database not connected yet' });
  }

  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'uploads'
  });

  const filename = `${Date.now()}_${req.file.originalname}`;
  
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: req.file.mimetype
  });

  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer);
  
  bufferStream.pipe(uploadStream)
    .on('error', (error) => {
      console.error('GridFS Upload Error:', error);
      res.status(500).json({ error: 'Upload failed' });
    })
    .on('finish', () => {
      const fileUrl = `${req.protocol}://${req.get('host')}/api/media/${uploadStream.id}`;
      res.json({ url: fileUrl, fileId: uploadStream.id });
    });
});

// @route GET /api/media/:id
// @desc  Display single file
router.get('/:id', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not connected yet' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads'
    });

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Check if file exists
    const cursor = bucket.find({ _id: fileId });
    const files = await cursor.toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No file exists' });
    }

    const file = files[0];
    
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    
    const readstream = bucket.openDownloadStream(file._id);
    readstream.pipe(res);
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;
