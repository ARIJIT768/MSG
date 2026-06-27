const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
require('dotenv').config();

// Create mongo connection
const conn = mongoose.createConnection(process.env.MONGODB_URI);

let gfs;
let gridfsBucket;

conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `${Date.now()}_${file.originalname}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads'
      };
      resolve(fileInfo);
    });
  }
});
const upload = multer({ storage });

// @route POST /api/media/upload
// @desc  Uploads file to DB
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Return the URL that can be used to fetch this file
  const fileUrl = `${req.protocol}://${req.get('host')}/api/media/${req.file.id}`;
  res.json({ url: fileUrl, fileId: req.file.id });
});

// @route GET /api/media/:id
// @desc  Display single file
router.get('/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Check if file exists
    const cursor = gridfsBucket.find({ _id: fileId });
    const files = await cursor.toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No file exists' });
    }

    const file = files[0];
    
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    
    const readstream = gridfsBucket.openDownloadStream(file._id);
    readstream.pipe(res);
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;
