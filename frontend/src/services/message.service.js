import api from "./api";

const messageService = {
  // Send message via HTTP
  sendMessage: (data) => api.post("/messages", data),

  // Upload attachment to Cloudinary
  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/messages/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log("Upload progress:", percentCompleted);
      },
    });
  },

  // Upload image specifically
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/messages/upload/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Get conversations
  getConversations: () => api.get("/messages/conversations"),

  // Get conversation with specific user
  getConversation: (userId, params) =>
    api.get(`/messages/conversation/${userId}`, { params }),

  // Mark messages as read
  markAsRead: (userId) => api.put(`/messages/read/${userId}`),

  // Delete message
  deleteMessage: (id) => api.delete(`/messages/${id}`),

  // Get unread count
  getUnreadCount: () => api.get("/messages/unread-count"),
};

export default messageService;
