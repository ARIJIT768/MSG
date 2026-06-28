const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const crypto = require('crypto');

const distPath = path.join(__dirname, '../../dist');
const zipPath = path.join(__dirname, '../latest-update.zip');
let currentVersion = '1.0.0'; // We will base this on a hash of the dist folder

// Generate a zip file of the dist folder and compute its hash to act as the version
function generateUpdateZip() {
  if (!fs.existsSync(distPath)) {
    console.log('No dist folder found. Skipping OTA zip generation.');
    return;
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Highest compression
    });

    output.on('close', function() {
      console.log(`OTA Update Zip created: ${archive.pointer()} total bytes`);
      
      // Generate a hash of the zip to serve as the version number
      const fileBuffer = fs.readFileSync(zipPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      currentVersion = hashSum.digest('hex').substring(0, 8);
      console.log(`Current OTA Version: ${currentVersion}`);
      resolve();
    });

    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn(err);
      } else {
        reject(err);
      }
    });

    archive.on('error', function(err) {
      reject(err);
    });

    archive.pipe(output);

    // Append files from the dist directory, putting them at the root of the zip
    // because Capacitor Updater expects index.html to be at the root of the zip
    archive.directory(distPath, false);

    archive.finalize();
  });
}

// Generate it on startup
generateUpdateZip().catch(err => console.error('Failed to generate OTA zip on startup:', err));

// Route to check for the latest version
router.get('/check', (req, res) => {
  // Respect Render's HTTPS proxy headers if deployed
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  res.json({
    version: currentVersion,
    url: `${protocol}://${req.get('host')}/api/update/download`
  });
});

// Route to download the zip file
router.get('/download', (req, res) => {
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'Update not found' });
  }
  res.download(zipPath, `update-${currentVersion}.zip`);
});

// Route to manually trigger a rebuild of the zip (if needed)
router.post('/trigger', async (req, res) => {
  try {
    await generateUpdateZip();
    res.json({ success: true, version: currentVersion });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate update' });
  }
});

module.exports = router;
