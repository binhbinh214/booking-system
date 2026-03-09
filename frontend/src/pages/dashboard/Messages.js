import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  Grid,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  Paper,
  Chip,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Snackbar,
  Alert,
  Popover,
  ClickAwayListener,
} from "@mui/material";
import {
  Send,
  Search,
  AttachFile,
  Image as ImageIcon,
  EmojiEmotions,
  MoreVert,
  Check,
  DoneAll,
  Phone,
  VideoCall,
  Info,
  Close,
  InsertDriveFile,
  PictureAsPdf,
  Description,
  Download,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { isToday, format } from "date-fns";
import { vi } from "date-fns/locale";
import EmojiPicker from "emoji-picker-react";
import messageService from "../../services/message.service";
import socketService from "../../services/socket.service";

// Quick emojis for fast access
const QUICK_EMOJIS = [
  "👍",
  "❤️",
  "😊",
  "😂",
  "😍",
  "🙏",
  "👋",
  "🎉",
  "💪",
  "🤔",
  "😢",
  "😮",
];

const Messages = () => {
  const { user, token } = useSelector((state) => state.auth);
  const location = useLocation();
  const initialOtherUser = location.state?.otherUser;
  const theme = useTheme();

  // State
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Emoji Picker state
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);

  // File upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewDialog, setFilePreviewDialog] = useState(false);

  // Notification states
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Refs
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentConversationRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  // Update ref when conversation changes
  useEffect(() => {
    currentConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Clear processed message IDs when changing conversation
  useEffect(() => {
    if (selectedConversation) {
      processedMessageIds.current.clear();
    }
  }, [selectedConversation?.conversationId]);

  // Initialize socket connection
  useEffect(() => {
    let unsubscribeConnection = null;

    if (token) {
      socketService.connect(token);

      unsubscribeConnection = socketService.onConnectionChange(
        (isConnected) => {
          console.log("🔌 Connection status changed:", isConnected);
          setSocketConnected(isConnected);
        }
      );

      setSocketConnected(socketService.isConnected());
    }

    fetchConversations();
    setupSocketListeners();

    if (initialOtherUser) {
      handleInitialUser(initialOtherUser);
    }

    return () => {
      cleanupSocketListeners();
      if (unsubscribeConnection) {
        unsubscribeConnection();
      }
    };
  }, [token]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ==================== EMOJI FUNCTIONS ====================

  // Open emoji picker
  const handleOpenEmojiPicker = (event) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  // Close emoji picker
  const handleCloseEmojiPicker = () => {
    setEmojiAnchorEl(null);
  };

  // Handle emoji selection from picker
  const handleEmojiClick = (emojiData) => {
    insertEmoji(emojiData.emoji);
  };

  // Handle quick emoji selection
  const handleQuickEmojiClick = (emoji) => {
    insertEmoji(emoji);
  };

  // Insert emoji at cursor position
  const insertEmoji = (emoji) => {
    const input = messageInputRef.current;

    if (input) {
      const inputElement =
        input.querySelector("textarea") || input.querySelector("input");

      if (inputElement) {
        const start = inputElement.selectionStart || newMessage.length;
        const end = inputElement.selectionEnd || newMessage.length;
        const newText =
          newMessage.slice(0, start) + emoji + newMessage.slice(end);

        setNewMessage(newText);

        // Set cursor position after emoji
        setTimeout(() => {
          const newPosition = start + emoji.length;
          inputElement.focus();
          inputElement.setSelectionRange(newPosition, newPosition);
        }, 0);
      } else {
        setNewMessage((prev) => prev + emoji);
      }
    } else {
      setNewMessage((prev) => prev + emoji);
    }
  };

  // Toggle quick emoji bar
  const toggleQuickEmojis = () => {
    setShowQuickEmojis((prev) => !prev);
  };

  // ==================== END EMOJI FUNCTIONS ====================

  const handleInitialUser = async (otherUser) => {
    const conversationId = [user._id, otherUser._id].sort().join("_");
    const newConversation = {
      conversationId,
      otherUser,
      lastMessage: { content: "", createdAt: new Date() },
      unreadCount: 0,
    };
    setSelectedConversation(newConversation);
    fetchMessagesForUser(otherUser._id);
  };

  const setupSocketListeners = () => {
    console.log("🔧 Setting up socket listeners...");

    socketService.on("new_message", handleNewMessage);
    socketService.on("user_typing", handleUserTyping);
    socketService.on("user_stop_typing", handleUserStopTyping);
    socketService.on("message_read", handleMessageRead);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("message_notification", handleMessageNotification);
  };

  const cleanupSocketListeners = () => {
    socketService.off("new_message");
    socketService.off("user_typing");
    socketService.off("user_stop_typing");
    socketService.off("message_read");
    socketService.off("messages_read");
    socketService.off("message_notification");
  };

  // Handle new message from socket - Fixed to prevent duplicates
  const handleNewMessage = useCallback(
    (message) => {
      if (processedMessageIds.current.has(message._id)) {
        console.log("📩 Message already processed, skipping:", message._id);
        return;
      }

      const currentConv = currentConversationRef.current;
      if (currentConv) {
        const conversationId = [user._id, currentConv.otherUser._id]
          .sort()
          .join("_");

        if (message.conversationId === conversationId) {
          if (message.sender._id === user._id) {
            console.log(
              "📩 Own message from socket, skipping (handled by callback)"
            );
            return;
          }

          setMessages((prev) => {
            const exists = prev.some((m) => m._id === message._id);
            if (exists) return prev;
            processedMessageIds.current.add(message._id);
            return [...prev, message];
          });

          socketService.markAsRead(message._id);
        }
      }
      fetchConversations();
    },
    [user?._id]
  );

  const handleUserTyping = useCallback((data) => {
    const currentConv = currentConversationRef.current;
    if (currentConv && data.userId === currentConv.otherUser._id) {
      setIsTyping(true);
    }
  }, []);

  const handleUserStopTyping = useCallback((data) => {
    const currentConv = currentConversationRef.current;
    if (currentConv && data.userId === currentConv.otherUser._id) {
      setIsTyping(false);
    }
  }, []);

  const handleMessageRead = useCallback((data) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === data.messageId ? { ...m, isRead: true } : m))
    );
  }, []);

  const handleMessagesRead = useCallback(
    (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.conversationId === data.conversationId && m.sender._id === user?._id
            ? { ...m, isRead: true }
            : m
        )
      );
    },
    [user?._id]
  );

  const handleMessageNotification = useCallback((data) => {
    const currentConv = currentConversationRef.current;
    if (!currentConv || data.conversationId !== currentConv.conversationId) {
      setSnackbar({
        open: true,
        message: `${data.from}: ${data.message}`,
        severity: "info",
      });
    }
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await messageService.getConversations();
      setConversations(response.data.data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setSnackbar({
        open: true,
        message: "Lỗi tải danh sách hội thoại",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForUser = async (userId) => {
    try {
      const response = await messageService.getConversation(userId);
      const fetchedMessages = response.data.data || [];

      fetchedMessages.forEach((msg) => {
        processedMessageIds.current.add(msg._id);
      });

      setMessages(fetchedMessages);

      await messageService.markAsRead(userId);
      socketService.markConversationRead(userId);
      fetchConversations();
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchMessages = async (conversation) => {
    setSelectedConversation(conversation);
    await fetchMessagesForUser(conversation.otherUser._id);
  };

  // Handle file selection
  const handleFileSelect = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setSnackbar({
        open: true,
        message: "File quá lớn. Kích thước tối đa là 25MB",
        severity: "error",
      });
      return;
    }

    setSelectedFile(file);

    if (type === "image" && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
        setFilePreviewDialog(true);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreviewDialog(true);
    }

    event.target.value = "";
  };

  // Upload and send file
  const handleSendFile = async () => {
    if (!selectedFile || !selectedConversation) return;

    setUploadingFile(true);
    setUploadProgress(10);

    try {
      setUploadProgress(30);
      const uploadResponse = await messageService.uploadAttachment(
        selectedFile
      );
      const attachmentData = uploadResponse.data.data;
      setUploadProgress(70);

      const messageData = {
        receiverId: selectedConversation.otherUser._id,
        content: attachmentData.fileName,
        type: attachmentData.fileType,
        attachment: {
          url: attachmentData.url,
          fileName: attachmentData.fileName,
          fileSize: attachmentData.fileSize,
          mimeType: attachmentData.mimeType,
        },
      };

      socketService.sendMessage(messageData, (response) => {
        if (response && response.success && response.data) {
          processedMessageIds.current.add(response.data._id);

          setMessages((prev) => {
            const exists = prev.some((m) => m._id === response.data._id);
            if (exists) return prev;
            return [...prev, response.data];
          });

          console.log("✅ File message sent successfully");
        } else {
          console.error("❌ Failed to send file message:", response?.message);
          setSnackbar({
            open: true,
            message: "Gửi file thất bại. Vui lòng thử lại.",
            severity: "error",
          });
        }
      });

      setUploadProgress(100);

      setSelectedFile(null);
      setPreviewImage(null);
      setFilePreviewDialog(false);

      setSnackbar({
        open: true,
        message: "Đã gửi file thành công!",
        severity: "success",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      setSnackbar({
        open: true,
        message:
          error.response?.data?.message || "Lỗi tải file. Vui lòng thử lại.",
        severity: "error",
      });
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  // Send text message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    const tempMessage = {
      _id: tempId,
      sender: {
        _id: user._id,
        fullName: user.fullName,
        avatar: user.avatar,
      },
      receiver: {
        _id: selectedConversation.otherUser._id,
        fullName: selectedConversation.otherUser.fullName,
        avatar: selectedConversation.otherUser.avatar,
      },
      content: messageContent,
      type: "text",
      createdAt: new Date(),
      isDelivered: false,
      isRead: false,
      isTemp: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    // Close emoji picker when sending
    handleCloseEmojiPicker();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socketService.stopTyping(selectedConversation.otherUser._id);
    }

    setSendingMessage(true);

    socketService.sendMessage(
      {
        receiverId: selectedConversation.otherUser._id,
        content: messageContent,
        type: "text",
      },
      (response) => {
        setSendingMessage(false);

        if (response && response.success && response.data) {
          processedMessageIds.current.add(response.data._id);

          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...response.data, isTemp: false } : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, sendFailed: true, isTemp: false } : m
            )
          );
        }
      }
    );
  };

  const handleRetryMessage = async (message) => {
    setMessages((prev) => prev.filter((m) => m._id !== message._id));
    setNewMessage(message.content);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!selectedConversation) return;

    socketService.startTyping(selectedConversation.otherUser._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(selectedConversation.otherUser._id);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    } else {
      return format(messageDate, "dd/MM HH:mm");
    }
  };

  const formatLastMessageTime = (date) => {
    if (!date) return "";
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    } else {
      return format(messageDate, "dd/MM", { locale: vi });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileExtension = (mimeType, fileName) => {
    if (fileName) {
      const parts = fileName.split(".");
      if (parts.length > 1) {
        return parts.pop().toLowerCase();
      }
    }

    const mimeToExt = {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
      "text/plain": "txt",
      "application/zip": "zip",
      "application/x-rar-compressed": "rar",
      "application/x-7z-compressed": "7z",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
    };

    return mimeToExt[mimeType] || "";
  };

  const getDownloadFileName = (attachment) => {
    if (!attachment) return "file";

    const { fileName, mimeType } = attachment;
    const extension = getFileExtension(mimeType, fileName);

    if (fileName && fileName.includes(".")) {
      return fileName;
    }

    const baseName = fileName || "file";
    return extension ? `${baseName}.${extension}` : baseName;
  };

  const handleFileDownload = async (attachment) => {
    if (!attachment?.url) return;

    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();

      const downloadName = getDownloadFileName(attachment);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSnackbar({
        open: true,
        message: `Đã tải xuống: ${downloadName}`,
        severity: "success",
      });
    } catch (error) {
      console.error("Download error:", error);
      setSnackbar({
        open: true,
        message: "Lỗi tải file. Vui lòng thử lại.",
        severity: "error",
      });
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes("pdf"))
      return <PictureAsPdf sx={{ color: "#f44336", fontSize: 40 }} />;
    if (mimeType?.includes("word") || mimeType?.includes("document"))
      return <Description sx={{ color: "#2196f3", fontSize: 40 }} />;
    if (mimeType?.includes("sheet") || mimeType?.includes("excel"))
      return <Description sx={{ color: "#4caf50", fontSize: 40 }} />;
    if (mimeType?.includes("presentation") || mimeType?.includes("powerpoint"))
      return <Description sx={{ color: "#ff9800", fontSize: 40 }} />;
    return <InsertDriveFile sx={{ color: "#9e9e9e", fontSize: 40 }} />;
  };

  const getMessageStatusIcon = (message) => {
    if (message.sendFailed) {
      return (
        <Tooltip title="Gửi thất bại. Nhấn để thử lại">
          <ErrorIcon
            sx={{ fontSize: 14, color: "error.main", cursor: "pointer" }}
            onClick={() => handleRetryMessage(message)}
          />
        </Tooltip>
      );
    }
    if (message.isTemp) {
      return <CircularProgress size={12} />;
    }
    if (message.isRead) {
      return <DoneAll sx={{ fontSize: 14, color: "primary.main" }} />;
    }
    if (message.isDelivered) {
      return <DoneAll sx={{ fontSize: 14, color: "text.secondary" }} />;
    }
    return <Check sx={{ fontSize: 14, color: "text.secondary" }} />;
  };

  // Check if message is emoji-only (for larger display)
  const isEmojiOnly = (text) => {
    if (!text) return false;
    const emojiRegex = /^[\p{Emoji}\s]+$/u;
    const trimmed = text.trim();
    return emojiRegex.test(trimmed) && trimmed.length <= 8;
  };

  // Render message content based on type
  const renderMessageContent = (message) => {
    const isMine = message.sender._id === user._id;

    switch (message.type) {
      case "image":
        return (
          <Box sx={{ maxWidth: 300 }}>
            <Box
              component="img"
              src={message.attachment?.url}
              alt={message.attachment?.fileName || "Image"}
              sx={{
                maxWidth: "100%",
                borderRadius: 2,
                cursor: "pointer",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "scale(1.02)",
                },
              }}
              onClick={() => setPreviewImage(message.attachment?.url)}
              onError={(e) => {
                e.target.src = "/placeholder-image.png";
              }}
            />
            {message.content &&
              message.content !== message.attachment?.fileName && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {message.content}
                </Typography>
              )}
          </Box>
        );

      case "file":
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: isMine
                ? alpha(theme.palette.common.white, 0.15)
                : alpha(theme.palette.primary.main, 0.08),
              minWidth: 220,
              maxWidth: 300,
            }}
          >
            {getFileIcon(message.attachment?.mimeType)}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                title={getDownloadFileName(message.attachment)}
              >
                {getDownloadFileName(message.attachment)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(message.attachment?.fileSize)}
              </Typography>
            </Box>
            <Tooltip title="Tải xuống">
              <IconButton
                size="small"
                onClick={() => handleFileDownload(message.attachment)}
                sx={{
                  color: isMine ? "white" : "primary.main",
                  "&:hover": {
                    backgroundColor: alpha(
                      isMine
                        ? theme.palette.common.white
                        : theme.palette.primary.main,
                      0.2
                    ),
                  },
                }}
              >
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );

      case "video":
        return (
          <Box sx={{ maxWidth: 350 }}>
            <video
              src={message.attachment?.url}
              controls
              style={{
                maxWidth: "100%",
                borderRadius: 8,
              }}
            />
          </Box>
        );

      default:
        // Check if emoji-only message
        if (isEmojiOnly(message.content)) {
          return (
            <Typography
              sx={{
                fontSize: "2.5rem",
                lineHeight: 1.2,
              }}
            >
              {message.content}
            </Typography>
          );
        }
        return <Typography variant="body1">{message.content}</Typography>;
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser?.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const emojiPickerOpen = Boolean(emojiAnchorEl);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{ height: "100vh", display: "flex", flexDirection: "column", pb: 2 }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Tin nhắn
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {conversations.length} cuộc trò chuyện
          </Typography>
        </Box>
        <Chip
          icon={
            socketConnected ? (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "success.main",
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "error.main",
                }}
              />
            )
          }
          label={socketConnected ? "Đã kết nối" : "Mất kết nối"}
          size="small"
          color={socketConnected ? "success" : "error"}
          variant="outlined"
        />
      </Box>

      {/* Main Chat Container */}
      <Card
        sx={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          boxShadow: theme.shadows[4],
          borderRadius: 2,
        }}
      >
        <Grid container sx={{ height: "100%" }}>
          {/* Conversations Sidebar */}
          <Grid
            item
            xs={12}
            md={4}
            sx={{
              borderRight: { md: 1 },
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Search Box */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm cuộc trò chuyện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  },
                }}
              />
            </Box>

            {/* Conversations List */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-track": {
                  background: alpha(theme.palette.primary.main, 0.05),
                },
                "&::-webkit-scrollbar-thumb": {
                  background: alpha(theme.palette.primary.main, 0.3),
                  borderRadius: "4px",
                },
              }}
            >
              {filteredConversations.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Typography color="text.secondary" variant="body2">
                    Chưa có cuộc trò chuyện nào
                  </Typography>
                </Box>
              ) : (
                <List sx={{ py: 0 }}>
                  {filteredConversations.map((conv) => (
                    <ListItemButton
                      key={conv.conversationId}
                      selected={
                        selectedConversation?.conversationId ===
                        conv.conversationId
                      }
                      onClick={() => fetchMessages(conv)}
                      sx={{
                        borderBottom: 1,
                        borderColor: "divider",
                        py: 2,
                        px: 2,
                        transition: "all 0.2s",
                        "&:hover": {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.08
                          ),
                        },
                        "&.Mui-selected": {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.12
                          ),
                          borderLeft: 3,
                          borderLeftColor: "primary.main",
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={conv.unreadCount}
                          color="error"
                          overlap="circular"
                        >
                          <Avatar
                            src={conv.otherUser?.avatar}
                            sx={{
                              width: 48,
                              height: 48,
                              border: 2,
                              borderColor:
                                conv.unreadCount > 0
                                  ? "primary.main"
                                  : "transparent",
                            }}
                          >
                            {conv.otherUser?.fullName?.charAt(0)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              mb: 0.5,
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              fontWeight={conv.unreadCount > 0 ? 700 : 600}
                              noWrap
                              sx={{ flex: 1 }}
                            >
                              {conv.otherUser?.fullName}
                            </Typography>
                            {conv.otherUser?.role !== "customer" && (
                              <Chip
                                label={
                                  conv.otherUser?.role === "doctor"
                                    ? "BS"
                                    : "CG"
                                }
                                size="small"
                                color="primary"
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                            fontWeight={conv.unreadCount > 0 ? 600 : 400}
                          >
                            {conv.lastMessage?.isMine && "Bạn: "}
                            {conv.lastMessage?.content}
                          </Typography>
                        }
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatLastMessageTime(conv.lastMessage?.createdAt)}
                      </Typography>
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          </Grid>

          {/* Chat Area */}
          <Grid
            item
            xs={12}
            md={8}
            sx={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <Box
                  sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: "divider",
                    backgroundColor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar
                        src={selectedConversation.otherUser?.avatar}
                        sx={{
                          width: 48,
                          height: 48,
                          border: 2,
                          borderColor: "primary.main",
                        }}
                      >
                        {selectedConversation.otherUser?.fullName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          {selectedConversation.otherUser?.fullName}
                        </Typography>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Chip
                            label={
                              selectedConversation.otherUser?.role === "doctor"
                                ? "Bác sĩ"
                                : selectedConversation.otherUser?.role ===
                                  "healer"
                                ? "Chuyên gia tâm lý"
                                : "Người dùng"
                            }
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                          {isTyping && (
                            <Typography
                              variant="caption"
                              color="primary"
                              sx={{ fontStyle: "italic" }}
                            >
                              đang nhập...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="Gọi điện thoại">
                        <IconButton size="small" color="primary">
                          <Phone />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Video call">
                        <IconButton size="small" color="primary">
                          <VideoCall />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Thông tin">
                        <IconButton size="small" color="primary">
                          <Info />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                      >
                        <MoreVert />
                      </IconButton>
                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={() => setAnchorEl(null)}
                      >
                        <MenuItem onClick={() => setAnchorEl(null)}>
                          Xóa cuộc trò chuyện
                        </MenuItem>
                        <MenuItem onClick={() => setAnchorEl(null)}>
                          Chặn người dùng
                        </MenuItem>
                      </Menu>
                    </Box>
                  </Box>
                </Box>

                {/* Messages Container */}
                <Box
                  ref={messagesContainerRef}
                  sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 2,
                    backgroundColor: alpha(
                      theme.palette.background.default,
                      0.5
                    ),
                    "&::-webkit-scrollbar": { width: "8px" },
                    "&::-webkit-scrollbar-track": {
                      background: alpha(theme.palette.primary.main, 0.05),
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: alpha(theme.palette.primary.main, 0.3),
                      borderRadius: "4px",
                    },
                  }}
                >
                  {messages.length === 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      <Box sx={{ textAlign: "center" }}>
                        <Avatar
                          sx={{
                            width: 80,
                            height: 80,
                            mx: "auto",
                            mb: 2,
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.1
                            ),
                            color: "primary.main",
                          }}
                        >
                          <EmojiEmotions sx={{ fontSize: 40 }} />
                        </Avatar>
                        <Typography
                          variant="h6"
                          color="text.secondary"
                          gutterBottom
                        >
                          Chưa có tin nhắn nào
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Hãy bắt đầu cuộc trò chuyện!
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      {messages.map((message, index) => {
                        const isMine = message.sender._id === user._id;
                        const showAvatar =
                          index === 0 ||
                          messages[index - 1].sender._id !== message.sender._id;
                        const showTimestamp =
                          index === 0 ||
                          new Date(message.createdAt).getTime() -
                            new Date(messages[index - 1].createdAt).getTime() >
                            300000;

                        // Check if this is an emoji-only message
                        const emojiOnly =
                          message.type === "text" &&
                          isEmojiOnly(message.content);

                        return (
                          <Box key={message._id}>
                            {showTimestamp && (
                              <Box sx={{ textAlign: "center", my: 2 }}>
                                <Chip
                                  label={formatMessageTime(message.createdAt)}
                                  size="small"
                                  sx={{
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.1
                                    ),
                                    fontSize: "0.7rem",
                                  }}
                                />
                              </Box>
                            )}
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: isMine
                                  ? "flex-end"
                                  : "flex-start",
                                mb: 1,
                                alignItems: "flex-end",
                                gap: 1,
                              }}
                            >
                              {!isMine && showAvatar && (
                                <Avatar
                                  src={message.sender.avatar}
                                  sx={{ width: 32, height: 32 }}
                                >
                                  {message.sender.fullName?.charAt(0)}
                                </Avatar>
                              )}
                              {!isMine && !showAvatar && (
                                <Box sx={{ width: 32 }} />
                              )}

                              {/* Emoji-only messages don't have bubble */}
                              {emojiOnly ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: isMine
                                      ? "flex-end"
                                      : "flex-start",
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: "2.5rem",
                                      lineHeight: 1.2,
                                      opacity: message.isTemp ? 0.7 : 1,
                                    }}
                                  >
                                    {message.content}
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        opacity: 0.7,
                                        fontSize: "0.65rem",
                                        color: "text.secondary",
                                      }}
                                    >
                                      {format(
                                        new Date(message.createdAt),
                                        "HH:mm"
                                      )}
                                    </Typography>
                                    {isMine && getMessageStatusIcon(message)}
                                  </Box>
                                </Box>
                              ) : (
                                <Paper
                                  elevation={1}
                                  sx={{
                                    p: message.type === "file" ? 0.5 : 1.5,
                                    maxWidth: "70%",
                                    borderRadius: isMine
                                      ? "16px 16px 4px 16px"
                                      : "16px 16px 16px 4px",
                                    backgroundColor: isMine
                                      ? message.sendFailed
                                        ? "error.light"
                                        : "primary.main"
                                      : "background.paper",
                                    color: isMine ? "white" : "text.primary",
                                    opacity: message.isTemp ? 0.7 : 1,
                                  }}
                                >
                                  {renderMessageContent(message)}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      alignItems: "center",
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        opacity: 0.7,
                                        fontSize: "0.65rem",
                                      }}
                                    >
                                      {format(
                                        new Date(message.createdAt),
                                        "HH:mm"
                                      )}
                                    </Typography>
                                    {isMine && getMessageStatusIcon(message)}
                                  </Box>
                                </Paper>
                              )}
                            </Box>
                          </Box>
                        );
                      })}

                      {isTyping && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            ml: 5,
                            mb: 2,
                          }}
                        >
                          <Paper
                            elevation={1}
                            sx={{
                              p: 1.5,
                              borderRadius: "16px 16px 16px 4px",
                              backgroundColor: "background.paper",
                            }}
                          >
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              {[0, 1, 2].map((i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: "text.secondary",
                                    animation:
                                      "bounce 1.4s infinite ease-in-out",
                                    animationDelay: `${i * 0.16}s`,
                                    "@keyframes bounce": {
                                      "0%, 80%, 100%": {
                                        transform: "scale(0)",
                                        opacity: 0.5,
                                      },
                                      "40%": {
                                        transform: "scale(1)",
                                        opacity: 1,
                                      },
                                    },
                                  }}
                                />
                              ))}
                            </Box>
                          </Paper>
                        </Box>
                      )}

                      <div ref={messagesEndRef} />
                    </>
                  )}
                </Box>

                {/* Message Input */}
                <Box
                  component="form"
                  onSubmit={handleSendMessage}
                  sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: "divider",
                    backgroundColor: "background.paper",
                  }}
                >
                  {/* Quick Emoji Bar */}
                  {showQuickEmojis && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 1.5,
                        py: 1,
                        px: 1,
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.05
                        ),
                        borderRadius: 2,
                        overflowX: "auto",
                        "&::-webkit-scrollbar": { height: 4 },
                        "&::-webkit-scrollbar-thumb": {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.3
                          ),
                          borderRadius: 2,
                        },
                      }}
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <Tooltip key={emoji} title="Chèn emoji" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleQuickEmojiClick(emoji)}
                            sx={{
                              fontSize: "1.3rem",
                              padding: "6px",
                              minWidth: "36px",
                              transition: "transform 0.15s ease",
                              "&:hover": {
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.15
                                ),
                                transform: "scale(1.25)",
                              },
                            }}
                          >
                            {emoji}
                          </IconButton>
                        </Tooltip>
                      ))}
                    </Box>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileSelect(e, "file")}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z"
                  />
                  <input
                    type="file"
                    ref={imageInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileSelect(e, "image")}
                    accept="image/*"
                  />

                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <Tooltip title="Đính kèm file (PDF, Word, Excel...)">
                      <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile || !socketConnected}
                        sx={{
                          mb: 0.5,
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <AttachFile />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Gửi hình ảnh">
                      <IconButton
                        size="small"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingFile || !socketConnected}
                        sx={{
                          mb: 0.5,
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <ImageIcon />
                      </IconButton>
                    </Tooltip>
                    <TextField
                      ref={messageInputRef}
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder={
                        socketConnected
                          ? "Nhập tin nhắn..."
                          : "Đang kết nối lại..."
                      }
                      value={newMessage}
                      onChange={handleTyping}
                      onKeyPress={handleKeyPress}
                      disabled={
                        sendingMessage || uploadingFile || !socketConnected
                      }
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 3,
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.05
                          ),
                        },
                      }}
                    />

                    {/* Emoji Button with Picker */}
                    <Tooltip
                      title={showQuickEmojis ? "Ẩn emoji nhanh" : "Emoji"}
                    >
                      <IconButton
                        size="small"
                        onClick={handleOpenEmojiPicker}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          toggleQuickEmojis();
                        }}
                        sx={{
                          mb: 0.5,
                          color:
                            emojiPickerOpen || showQuickEmojis
                              ? "primary.main"
                              : "text.secondary",
                          backgroundColor: emojiPickerOpen
                            ? alpha(theme.palette.primary.main, 0.1)
                            : "transparent",
                          "&:hover": {
                            color: "primary.main",
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.1
                            ),
                          },
                        }}
                      >
                        <EmojiEmotions />
                      </IconButton>
                    </Tooltip>

                    {/* Emoji Picker Popover */}
                    <Popover
                      open={emojiPickerOpen}
                      anchorEl={emojiAnchorEl}
                      onClose={handleCloseEmojiPicker}
                      anchorOrigin={{
                        vertical: "top",
                        horizontal: "right",
                      }}
                      transformOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                      }}
                      sx={{
                        "& .MuiPopover-paper": {
                          borderRadius: 3,
                          boxShadow: theme.shadows[10],
                        },
                      }}
                    >
                      <Box sx={{ position: "relative" }}>
                        {/* Quick emoji toggle button inside picker */}
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 10,
                          }}
                        >
                          <Tooltip
                            title={
                              showQuickEmojis
                                ? "Ẩn emoji nhanh"
                                : "Hiện emoji nhanh"
                            }
                          >
                            <Chip
                              label={
                                showQuickEmojis
                                  ? "Ẩn thanh nhanh"
                                  : "Hiện thanh nhanh"
                              }
                              size="small"
                              onClick={toggleQuickEmojis}
                              sx={{
                                cursor: "pointer",
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.1
                                ),
                                "&:hover": {
                                  backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.2
                                  ),
                                },
                              }}
                            />
                          </Tooltip>
                        </Box>
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          autoFocusSearch={false}
                          theme="light"
                          height={400}
                          width={350}
                          searchPlaceHolder="Tìm emoji..."
                          previewConfig={{
                            showPreview: true,
                            defaultCaption: "Chọn emoji",
                            defaultEmoji: "1f60a",
                          }}
                          categories={[
                            { name: "Gần đây", category: "suggested" },
                            { name: "Mặt cười", category: "smileys_people" },
                            { name: "Động vật", category: "animals_nature" },
                            { name: "Đồ ăn", category: "food_drink" },
                            { name: "Du lịch", category: "travel_places" },
                            { name: "Hoạt động", category: "activities" },
                            { name: "Đối tượng", category: "objects" },
                            { name: "Biểu tượng", category: "symbols" },
                            { name: "Cờ", category: "flags" },
                          ]}
                          skinTonesDisabled={false}
                          searchDisabled={false}
                          lazyLoadEmojis={true}
                        />
                      </Box>
                    </Popover>

                    <Tooltip title="Gửi tin nhắn">
                      <span>
                        <IconButton
                          type="submit"
                          color="primary"
                          disabled={
                            !newMessage.trim() ||
                            sendingMessage ||
                            uploadingFile ||
                            !socketConnected
                          }
                          sx={{
                            mb: 0.5,
                            backgroundColor: "primary.main",
                            color: "white",
                            "&:hover": { backgroundColor: "primary.dark" },
                            "&.Mui-disabled": {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.3
                              ),
                            },
                          }}
                        >
                          {sendingMessage ? (
                            <CircularProgress size={24} color="inherit" />
                          ) : (
                            <Send />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <Box sx={{ textAlign: "center" }}>
                  <Avatar
                    sx={{
                      width: 120,
                      height: 120,
                      mx: "auto",
                      mb: 3,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    }}
                  >
                    <EmojiEmotions sx={{ fontSize: 60 }} />
                  </Avatar>
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    Chọn một cuộc trò chuyện
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Chọn cuộc trò chuyện bên trái để bắt đầu nhắn tin
                  </Typography>
                </Box>
              </Box>
            )}
          </Grid>
        </Grid>
      </Card>

      {/* File Preview Dialog */}
      <Dialog
        open={filePreviewDialog}
        onClose={() => {
          if (!uploadingFile) {
            setFilePreviewDialog(false);
            setSelectedFile(null);
            setPreviewImage(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6">
              {previewImage ? "Gửi hình ảnh" : "Gửi file"}
            </Typography>
            <IconButton
              onClick={() => {
                if (!uploadingFile) {
                  setFilePreviewDialog(false);
                  setSelectedFile(null);
                  setPreviewImage(null);
                }
              }}
              disabled={uploadingFile}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewImage ? (
            <Box sx={{ textAlign: "center" }}>
              <img
                src={previewImage}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 400,
                  borderRadius: 8,
                }}
              />
            </Box>
          ) : (
            selectedFile && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderRadius: 2,
                }}
              >
                {getFileIcon(selectedFile.type)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
              </Box>
            )
          )}

          {uploadingFile && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: "block" }}
              >
                Đang tải lên... {uploadProgress}%
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setFilePreviewDialog(false);
              setSelectedFile(null);
              setPreviewImage(null);
            }}
            disabled={uploadingFile}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleSendFile}
            disabled={uploadingFile}
            startIcon={
              uploadingFile ? <CircularProgress size={20} /> : <Send />
            }
          >
            {uploadingFile ? "Đang gửi..." : "Gửi"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full Image Preview Dialog */}
      <Dialog
        open={!!previewImage && !filePreviewDialog}
        onClose={() => setPreviewImage(null)}
        maxWidth="lg"
      >
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ position: "relative" }}>
            <IconButton
              onClick={() => setPreviewImage(null)}
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "white",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" },
              }}
            >
              <Close />
            </IconButton>
            <img
              src={previewImage}
              alt="Full preview"
              style={{ maxWidth: "100%", maxHeight: "90vh" }}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Messages;
