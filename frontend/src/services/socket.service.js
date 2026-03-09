import { io } from "socket.io-client";

// Determine Socket URL based on environment
const getSocketUrl = () => {
  // Check if running in browser
  if (typeof window === "undefined") {
    return process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
  }

  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;

  console.log("🔌 Detecting socket environment:", {
    hostname,
    port,
    protocol,
    href: window.location.href,
  });

  // Ngrok URLs - use same origin (proxy handles routing)
  if (
    hostname.includes(".ngrok.io") ||
    hostname.includes(".ngrok-free.app") ||
    hostname.includes(".ngrok-free.dev") ||
    hostname.includes("ngrok")
  ) {
    const socketUrl = `${protocol}//${hostname}`;
    console.log("🔌 Using ngrok Socket URL:", socketUrl);
    return socketUrl;
  }

  // Local development with proxy (port 4000)
  if (port === "4000") {
    const socketUrl = `${protocol}//${hostname}:${port}`;
    console.log("🔌 Using proxy Socket URL:", socketUrl);
    return socketUrl;
  }

  // Default local development - connect directly to backend
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const socketUrl =
      process.env.REACT_APP_SOCKET_URL ||
      process.env.REACT_APP_API_URL?.replace("/api", "") ||
      "http://localhost:5000";
    console.log("🔌 Using local Socket URL:", socketUrl);
    return socketUrl;
  }

  // Production or other environments - same origin
  const socketUrl = `${protocol}//${hostname}`;
  console.log("🔌 Using same-origin Socket URL:", socketUrl);
  return socketUrl;
};

const SOCKET_URL = getSocketUrl();

console.log("🔌 Final Socket URL:", SOCKET_URL);

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.connectionCallbacks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.currentToken = null;
  }

  /**
   * Connect to socket server
   * @param {string} token - JWT token for authentication
   */
  connect(token) {
    // Store token for reconnection
    this.currentToken = token;

    if (this.socket && this.connected) {
      console.log("🔌 Socket already connected:", this.socket.id);
      return this.socket;
    }

    // Disconnect existing socket if any
    if (this.socket) {
      console.log("🔌 Disconnecting existing socket...");
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    console.log("🔌 Connecting to socket server:", SOCKET_URL);
    console.log("🔌 Token provided:", token ? "Yes" : "No");

    try {
      this.socket = io(SOCKET_URL, {
        auth: { token },
        // QUAN TRỌNG: polling trước để tương thích với ngrok
        transports: ["polling", "websocket"],
        upgrade: true,
        rememberUpgrade: false,
        // Reconnection settings
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        // Timeout settings
        timeout: 30000,
        // CORS và credentials
        withCredentials: true,
        // Headers cho ngrok
        extraHeaders: {
          "ngrok-skip-browser-warning": "true",
        },
        // Force new connection
        forceNew: true,
        // Auto connect
        autoConnect: true,
      });

      this.setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error("❌ Socket initialization error:", error);
      return null;
    }
  }

  /**
   * Setup socket event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    // Connection successful
    this.socket.on("connect", () => {
      console.log("✅ Socket connected successfully!");
      console.log("   Socket ID:", this.socket.id);
      console.log("   Transport:", this.socket.io.engine.transport.name);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    });

    // Transport upgrade (polling -> websocket)
    this.socket.io.engine.on("upgrade", (transport) => {
      console.log("🔄 Socket transport upgraded to:", transport.name);
    });

    // Disconnection
    this.socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      this.connected = false;
      this.notifyConnectionChange(false);

      // Handle specific disconnect reasons
      if (reason === "io server disconnect") {
        console.log("🔄 Server initiated disconnect, attempting reconnect...");
        setTimeout(() => {
          if (this.currentToken) {
            this.socket.auth = { token: this.currentToken };
            this.socket.connect();
          }
        }, 1000);
      }
    });

    // Connection error
    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      console.error("   Error details:", error);
      this.connected = false;
      this.reconnectAttempts++;
      this.notifyConnectionChange(false);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("🔌 Max reconnection attempts reached. Stopping.");
      }
    });

    // Generic error
    this.socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
    });

    // Reconnection events
    this.socket.io.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      this.restoreListeners();
    });

    this.socket.io.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Socket reconnection attempt:", attemptNumber);
    });

    this.socket.io.on("reconnect_error", (error) => {
      console.error("❌ Socket reconnection error:", error.message);
    });

    this.socket.io.on("reconnect_failed", () => {
      console.error("❌ Socket reconnection failed after all attempts");
      this.notifyConnectionChange(false);
    });

    // Ping/Pong for connection health
    this.socket.on("ping", () => {
      console.log("🏓 Socket ping");
    });

    this.socket.on("pong", (latency) => {
      console.log("🏓 Socket pong, latency:", latency, "ms");
    });
  }

  /**
   * Register callback for connection status changes
   * @param {function} callback - Callback function (isConnected) => void
   * @returns {function} Unsubscribe function
   */
  onConnectionChange(callback) {
    if (typeof callback !== "function") {
      console.warn("⚠️ onConnectionChange: callback must be a function");
      return () => {};
    }

    this.connectionCallbacks.push(callback);

    // Immediately notify current state
    callback(this.isConnected());

    // Return unsubscribe function
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * Notify all connection callbacks
   * @param {boolean} isConnected
   */
  notifyConnectionChange(isConnected) {
    console.log("🔔 Notifying connection change:", isConnected);
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error("Error in connection callback:", error);
      }
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect() {
    if (this.socket) {
      console.log("🔌 Disconnecting socket...");
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
      this.reconnectAttempts = 0;
      this.currentToken = null;
      this.notifyConnectionChange(false);
      console.log("✅ Socket disconnected successfully");
    }
  }

  /**
   * Emit event to server
   * @param {string} event - Event name
   * @param {*} data - Data to send
   * @param {function} callback - Optional callback function
   */
  emit(event, data, callback) {
    if (!this.socket) {
      console.warn("⚠️ Socket not initialized. Cannot emit:", event);
      if (callback)
        callback({ success: false, message: "Socket not initialized" });
      return;
    }

    if (!this.connected) {
      console.warn("⚠️ Socket not connected. Cannot emit:", event);
      if (callback)
        callback({ success: false, message: "Socket not connected" });
      return;
    }

    console.log("📤 Emitting event:", event);
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  /**
   * Emit event with promise
   * @param {string} event - Event name
   * @param {*} data - Data to send
   * @param {number} timeout - Timeout in ms (default 10000)
   * @returns {Promise}
   */
  emitAsync(event, data, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Socket emit timeout: ${event}`));
      }, timeout);

      this.socket.emit(event, data, (response) => {
        clearTimeout(timer);
        if (response?.success === false) {
          reject(new Error(response.message || "Socket operation failed"));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Listen to event from server
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn("⚠️ Socket not initialized. Cannot listen to:", event);
      return;
    }

    this.socket.on(event, callback);

    // Store listener for re-registration after reconnection
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    console.log("👂 Listening to event:", event);
  }

  /**
   * Listen to event once
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  once(event, callback) {
    if (!this.socket) {
      console.warn("⚠️ Socket not initialized. Cannot listen once to:", event);
      return;
    }
    this.socket.once(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} callback - Optional specific callback to remove
   */
  off(event, callback) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
      // Remove from stored listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } else {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name (optional, removes all if not provided)
   */
  removeAllListeners(event) {
    if (!this.socket) return;

    if (event) {
      this.socket.off(event);
      this.listeners.delete(event);
    } else {
      this.socket.removeAllListeners();
      this.listeners.clear();
    }
  }

  /**
   * Restore all event listeners (after reconnection)
   */
  restoreListeners() {
    console.log("🔄 Restoring", this.listeners.size, "event listeners...");
    this.listeners.forEach((callbacks, event) => {
      if (this.socket) {
        callbacks.forEach((callback) => {
          this.socket.on(event, callback);
        });
        console.log(
          `   ✅ Restored ${callbacks.length} listeners for: ${event}`
        );
      }
    });
  }

  /**
   * Check if socket is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.socket?.connected === true && this.connected === true;
  }

  /**
   * Get socket ID
   * @returns {string|null}
   */
  getSocketId() {
    return this.socket?.id || null;
  }

  /**
   * Get current socket URL
   * @returns {string}
   */
  getSocketUrl() {
    return SOCKET_URL;
  }

  /**
   * Get socket instance
   * @returns {Socket|null}
   */
  getSocket() {
    return this.socket;
  }

  /**
   * Get connection stats
   * @returns {object}
   */
  getStats() {
    return {
      connected: this.isConnected(),
      socketId: this.getSocketId(),
      socketUrl: SOCKET_URL,
      transport: this.socket?.io?.engine?.transport?.name || "none",
      reconnectAttempts: this.reconnectAttempts,
      listenerCount: this.listeners.size,
    };
  }

  // ============ MESSAGE METHODS ============

  /**
   * Send message via socket
   * @param {object} data - Message data { receiverId, content, type, attachment }
   * @param {function} callback - Optional callback
   */
  sendMessage(data, callback) {
    this.emit("send_message", data, callback);
  }

  /**
   * Send message via socket (async version)
   * @param {object} data - Message data
   * @returns {Promise}
   */
  sendMessageAsync(data) {
    return this.emitAsync("send_message", data);
  }

  /**
   * Start typing indicator
   * @param {string} receiverId - Receiver user ID
   */
  startTyping(receiverId) {
    this.emit("typing_start", { receiverId });
  }

  /**
   * Stop typing indicator
   * @param {string} receiverId - Receiver user ID
   */
  stopTyping(receiverId) {
    this.emit("typing_stop", { receiverId });
  }

  /**
   * Mark single message as read
   * @param {string} messageId - Message ID
   */
  markAsRead(messageId) {
    this.emit("mark_read", { messageId });
  }

  /**
   * Mark all messages in conversation as read
   * @param {string} otherUserId - Other user ID
   */
  markConversationRead(otherUserId) {
    this.emit("mark_conversation_read", { otherUserId });
  }

  /**
   * Join a conversation room
   * @param {string} conversationId - Conversation ID
   */
  joinConversation(conversationId) {
    this.emit("join_conversation", { conversationId });
  }

  /**
   * Leave a conversation room
   * @param {string} conversationId - Conversation ID
   */
  leaveConversation(conversationId) {
    this.emit("leave_conversation", { conversationId });
  }

  // ============ VIDEO CALL METHODS ============

  /**
   * Initiate a video call
   * @param {string} receiverId - Receiver user ID
   * @param {object} offer - WebRTC offer
   */
  initiateCall(receiverId, offer) {
    this.emit("call_initiate", { receiverId, offer });
  }

  /**
   * Answer a video call
   * @param {string} callerId - Caller user ID
   * @param {object} answer - WebRTC answer
   */
  answerCall(callerId, answer) {
    this.emit("call_answer", { callerId, answer });
  }

  /**
   * Reject a video call
   * @param {string} callerId - Caller user ID
   */
  rejectCall(callerId) {
    this.emit("call_reject", { callerId });
  }

  /**
   * End a video call
   * @param {string} otherUserId - Other user ID
   */
  endCall(otherUserId) {
    this.emit("call_end", { otherUserId });
  }

  /**
   * Send ICE candidate
   * @param {string} otherUserId - Other user ID
   * @param {object} candidate - ICE candidate
   */
  sendIceCandidate(otherUserId, candidate) {
    this.emit("ice_candidate", { otherUserId, candidate });
  }

  // ============ NOTIFICATION METHODS ============

  /**
   * Subscribe to notifications
   */
  subscribeToNotifications() {
    this.emit("subscribe_notifications", {});
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribeFromNotifications() {
    this.emit("unsubscribe_notifications", {});
  }

  // ============ PRESENCE METHODS ============

  /**
   * Update user presence status
   * @param {string} status - Status ('online', 'away', 'busy', 'offline')
   */
  updatePresence(status) {
    this.emit("presence_update", { status });
  }

  /**
   * Get online users
   * @param {Array} userIds - Array of user IDs to check
   */
  getOnlineUsers(userIds) {
    this.emit("get_online_users", { userIds });
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
