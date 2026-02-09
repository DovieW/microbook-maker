const crypto = require('crypto');
const path = require('path');

function createTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function sanitizeFileComponent(input, fallback = 'file') {
  const safe = String(input || fallback)
    .replace(/\0/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

  return safe || fallback;
}

function generateJobId() {
  return `${createTimestamp()}_${crypto.randomUUID()}`;
}

function getSafeUploadFilename(originalName) {
  const extension = path.extname(originalName || '').toLowerCase();
  const base = path.basename(originalName || 'upload', extension);
  const safeBase = sanitizeFileComponent(base, 'upload');
  const safeExtension = sanitizeFileComponent(extension, '.txt');
  return `${createTimestamp()}_${safeBase}${safeExtension}`;
}

module.exports = {
  createTimestamp,
  sanitizeFileComponent,
  generateJobId,
  getSafeUploadFilename,
};
