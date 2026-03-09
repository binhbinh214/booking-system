const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { Readable } = require("stream");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom storage engine for Cloudinary
const createCloudinaryStorage = (options) => {
  return {
    _handleFile: (req, file, cb) => {
      const uploadOptions = {
        folder: options.folder || "mental-healthcare/uploads",
        resource_type: "auto",
        ...options.params,
      };

      // Create upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            return cb(error);
          }
          cb(null, {
            path: result.secure_url,
            filename: result.public_id,
            size: result.bytes,
            format: result.format,
            resourceType: result.resource_type,
            publicId: result.public_id,
            url: result.secure_url,
          });
        }
      );

      // Pipe file to Cloudinary
      file.stream.pipe(uploadStream);
    },
    _removeFile: (req, file, cb) => {
      if (file.publicId) {
        cloudinary.uploader.destroy(
          file.publicId,
          { resource_type: "auto" },
          cb
        );
      } else {
        cb(null);
      }
    },
  };
};

// Storage configurations
const messageImageStorage = createCloudinaryStorage({
  folder: "mental-healthcare/messages/images",
  params: {
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 1200, height: 1200, crop: "limit", quality: "auto" },
    ],
    resource_type: "image",
  },
});

const messageFileStorage = createCloudinaryStorage({
  folder: "mental-healthcare/messages/files",
  params: {
    resource_type: "auto",
  },
});

const avatarStorage = createCloudinaryStorage({
  folder: "mental-healthcare/avatars",
  params: {
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      {
        width: 400,
        height: 400,
        crop: "fill",
        gravity: "face",
        quality: "auto",
      },
    ],
    resource_type: "image",
  },
});

// File filter for allowed types
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}`), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Text
    "text/plain",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}`), false);
  }
};

// Multer upload instances
const uploadMessageImage = multer({
  storage: messageImageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
});

const uploadMessageFile = multer({
  storage: messageFileStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB for files
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatars
  },
});

// Generic upload for any file type
const uploadAttachment = multer({
  storage: messageFileStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

// Helper function to upload buffer directly to Cloudinary
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || "mental-healthcare/uploads",
      resource_type: options.resourceType || "auto",
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Convert buffer to stream and pipe
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
};

// Helper function to get public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;

  // Extract public_id from Cloudinary URL
  // URL format: https://res.cloudinary.com/cloud_name/resource_type/upload/v123/folder/public_id.ext
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  return matches ? matches[1] : null;
};

module.exports = {
  cloudinary,
  uploadMessageImage,
  uploadMessageFile,
  uploadAvatar,
  uploadAttachment,
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
};
