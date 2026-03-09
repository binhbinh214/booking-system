const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const {
  sendMessage,
  getConversation,
  getConversations,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  uploadAttachment,
  uploadImage,
} = require("../controllers/message.controller");
const {
  uploadMessageImage,
  uploadAttachment: uploadFile,
} = require("../config/cloudinary");

// Apply auth middleware to all routes
router.use(protect);

// Message routes
router.post("/", sendMessage);
router.get("/conversations", getConversations);
router.get("/conversation/:userId", getConversation);
router.put("/read/:userId", markAsRead);
router.delete("/:id", deleteMessage);
router.get("/unread-count", getUnreadCount);

// Upload routes (Cloudinary)
router.post("/upload", uploadFile.single("file"), uploadAttachment);
router.post("/upload/image", uploadMessageImage.single("image"), uploadImage);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File quá lớn. Kích thước tối đa là 25MB",
    });
  }
  if (error.message.includes("Loại file không được hỗ trợ")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
});

module.exports = router;
