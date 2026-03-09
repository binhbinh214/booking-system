const Message = require("../models/Message.model");
const User = require("../models/User.model");
const {
  deleteFromCloudinary,
  getPublicIdFromUrl,
} = require("../config/cloudinary");

// @desc    Send message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, type, attachment, appointmentId } = req.body;

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người nhận",
      });
    }

    // Generate conversation ID
    const conversationId = Message.getConversationId(req.user.id, receiverId);

    const message = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      conversationId,
      content: content || "",
      type: type || "text",
      attachment,
      appointment: appointmentId,
    });

    await message.populate([
      { path: "sender", select: "fullName avatar" },
      { path: "receiver", select: "fullName avatar" },
    ]);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// @desc    Upload attachment for message (Cloudinary)
// @route   POST /api/messages/upload
// @access  Private
exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file để tải lên",
      });
    }

    const file = req.file;

    // Cloudinary returns the URL in file.path
    const fileUrl = file.path;

    // Determine file type
    let fileType = "file";
    if (file.mimetype.startsWith("image/")) {
      fileType = "image";
    } else if (file.mimetype.startsWith("video/")) {
      fileType = "video";
    } else if (file.mimetype.startsWith("audio/")) {
      fileType = "voice";
    }

    res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType,
        publicId: file.filename, // Cloudinary public_id
      },
    });
  } catch (error) {
    console.error("Upload attachment error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tải file",
      error: error.message,
    });
  }
};

// @desc    Upload image for message (Cloudinary)
// @route   POST /api/messages/upload/image
// @access  Private
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn hình ảnh để tải lên",
      });
    }

    const file = req.file;

    res.status(200).json({
      success: true,
      data: {
        url: file.path,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType: "image",
        publicId: file.filename,
      },
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi tải hình ảnh",
      error: error.message,
    });
  }
};

// @desc    Get conversation messages
// @route   GET /api/messages/conversation/:userId
// @access  Private
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversationId = Message.getConversationId(req.user.id, userId);

    const messages = await Message.find({
      conversationId,
      $or: [
        { deletedBySender: false, sender: req.user.id },
        { deletedByReceiver: false, receiver: req.user.id },
      ],
    })
      .populate("sender", "fullName avatar")
      .populate("receiver", "fullName avatar")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments({ conversationId });

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// @desc    Get all conversations
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    // Get all unique conversations for current user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", req.user._id] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);

    // Populate user info
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId =
          conv.lastMessage.sender.toString() === req.user.id
            ? conv.lastMessage.receiver
            : conv.lastMessage.sender;

        const otherUser = await User.findById(otherUserId).select(
          "fullName avatar role"
        );

        // Format last message content based on type
        let lastMessageContent = conv.lastMessage.content;
        if (conv.lastMessage.type === "image") {
          lastMessageContent = "📷 Đã gửi hình ảnh";
        } else if (conv.lastMessage.type === "file") {
          lastMessageContent = "📎 Đã gửi file";
        } else if (conv.lastMessage.type === "voice") {
          lastMessageContent = "🎤 Tin nhắn thoại";
        } else if (conv.lastMessage.type === "video") {
          lastMessageContent = "🎥 Đã gửi video";
        }

        return {
          conversationId: conv._id,
          otherUser,
          lastMessage: {
            content: lastMessageContent,
            type: conv.lastMessage.type,
            createdAt: conv.lastMessage.createdAt,
            isMine: conv.lastMessage.sender.toString() === req.user.id,
          },
          unreadCount: conv.unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: populatedConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:userId
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversationId = Message.getConversationId(req.user.id, userId);

    await Message.updateMany(
      {
        conversationId,
        receiver: req.user.id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: "Đã đánh dấu đã đọc",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn",
      });
    }

    // Mark as deleted for current user
    if (message.sender.toString() === req.user.id) {
      message.deletedBySender = true;
    } else if (message.receiver.toString() === req.user.id) {
      message.deletedByReceiver = true;
    } else {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xóa",
      });
    }

    // If both users deleted, remove from Cloudinary and database
    if (message.deletedBySender && message.deletedByReceiver) {
      // Delete attachment from Cloudinary if exists
      if (message.attachment?.url) {
        const publicId = getPublicIdFromUrl(message.attachment.url);
        if (publicId) {
          let resourceType = "raw";
          if (message.type === "image") resourceType = "image";
          else if (message.type === "video") resourceType = "video";

          try {
            await deleteFromCloudinary(publicId, resourceType);
          } catch (cloudinaryError) {
            console.error("Error deleting from Cloudinary:", cloudinaryError);
          }
        }
      }
      await Message.findByIdAndDelete(req.params.id);
    } else {
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: "Đã xóa tin nhắn",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// @desc    Get unread count
// @route   GET /api/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
