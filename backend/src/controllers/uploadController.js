const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("../config/cloudinary");

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(os.tmpdir(), "resqbridge-uploads");
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const MIME_MAP = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_MAP));

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIMES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);
  if (mimeOk && extOk) cb(null, true);
  else cb(new Error("Only image files are allowed."), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 15 * 1024 * 1024 } });

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file provided." });

  const ext = MIME_MAP[req.file.mimetype] || path.extname(req.file.originalname).toLowerCase();
  const isPublic = req.body.visibility === "public";
  const uuid = uuidv4();

  try {
    const processedBuffer = await sharp(req.file.buffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    const options = {
      folder: "resqbridge/images",
      public_id: uuid,
      resource_type: "image",
    };

    if (isPublic) {
      const result = await uploadToCloudinary(processedBuffer, options);
      return res.json({ url: result.secure_url });
    }

    const result = await uploadToCloudinary(processedBuffer, {
      ...options,
      type: "authenticated",
    });

    const signedUrl = cloudinary.url(result.public_id, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    });

    res.json({ url: result.public_id, signedUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(400).json({ message: "Invalid or corrupt image file." });
  }
};

const MIME_LOOKUP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function serveFile(req, res) {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(STORAGE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found." });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_LOOKUP[ext] || "application/octet-stream";

  if (!MIME_LOOKUP[ext]) {
    return res.status(403).json({ message: "Forbidden." });
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
}

module.exports = { upload, uploadImage, fileFilter, ALLOWED_EXTENSIONS, serveFile, STORAGE_DIR, uploadToCloudinary };
