import { io } from "socket.io-client";

/**
 * Resolve socket URL:
 * - Use REACT_APP_SOCKET_URL when provided (preferred for production)
 * - For localhost, prefer REACT_APP_SOCKET_URL or REACT_APP_API_URL (strip /api)
 * - For other hosts assume same-origin (protocol + hostname + optional port)
 */
const resolveSocketUrl = () => {
  if (typeof window === "undefined") {
    return process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
  }

  // explicit env (Vercel) - allow both with/without trailing slash
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL.replace(/\/+$/, "");
  }

  const { protocol, hostname, port } = window.location;

  // ngrok/preview - use same origin
  if (
    hostname.includes(".ngrok.io") ||
    hostname.includes(".ngrok-free.app") ||
    hostname.includes(".now.sh") ||
    hostname.includes("vercel.app")
  ) {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  // localhost dev: use API_URL without /api when available
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, "");
    }
    return "http://localhost:5000";
  }

  // production same-origin
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
};

const SOCKET_URL = resolveSocketUrl();
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

  connect(token) {
    this.currentToken = token;

    if (this.socket && this.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const opts = {
      auth: token ? { token } : {},
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      withCredentials: true,
      extraHeaders: typeof window !== "undefined" ? {} : undefined,
      forceNew: true,
      autoConnect: true,
    };

    try {
      this.socket = io(SOCKET_URL, opts);
      this.setupEventListeners();
      return this.socket;
    } catch (err) {
      console.error("❌ Socket initialization error:", err);
      return null;
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      console.log("✅ Socket connected", this.socket.id);
    });

    if (this.socket.io && this.socket.io.engine) {
      this.socket.io.engine.on("upgrade", (transport) => {
        console.log("🔄 Transport upgraded to", transport.name);
      });
    }

    this.socket.on("disconnect", (reason) => {
      this.connected = false;
      this.notifyConnectionChange(false);
      console.log("❌ Socket disconnected:", reason);
      if (reason === "io server disconnect" && this.currentToken) {
        setTimeout(() => {
          try {
            this.socket.auth = { token: this.currentToken };
            this.socket.connect();
          } catch (e) {}
        }, 1000);
      }
    });

    this.socket.on("connect_error", (err) => {
      this.reconnectAttempts++;
      console.error("❌ Socket connect_error:", err?.message || err);
      this.notifyConnectionChange(false);
    });

    this.socket.on("error", (err) => {
      console.error("❌ Socket error:", err);
    });

    this.socket.io?.on("reconnect", (attempt) => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      this.restoreListeners();
      console.log("🔄 Reconnected after", attempt, "attempts");
    });

    this.socket.io?.on("reconnect_attempt", (attempt) => {
      console.log("🔄 Reconnect attempt", attempt);
    });

    this.socket.io?.on("reconnect_failed", () => {
      console.error("❌ Reconnect failed");
      this.notifyConnectionChange(false);
    });
  }

  onConnectionChange(cb) {
    if (typeof cb !== "function") return () => {};
    this.connectionCallbacks.push(cb);
    try {
      cb(this.isConnected());
    } catch (e) {}
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(
        (c) => c !== cb
      );
    };
  }

  notifyConnectionChange(isConnected) {
    this.connectionCallbacks.forEach((cb) => {
      try {
        cb(isConnected);
      } catch (e) {
        console.error("Connection callback error:", e);
      }
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.connected = false;
    this.listeners.clear();
    this.currentToken = null;
    this.notifyConnectionChange(false);
  }

  emit(event, data, cb) {
    if (!this.socket) {
      if (cb) cb({ success: false, message: "Socket not initialized" });
      return;
    }
    if (!this.isConnected()) {
      if (cb) cb({ success: false, message: "Socket not connected" });
      return;
    }
    this.socket.emit(event, data, cb);
  }

  emitAsync(event, data, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        return reject(new Error("Socket not connected"));
      }
      const timer = setTimeout(
        () => reject(new Error("Socket emit timeout")),
        timeout
      );
      this.socket.emit(event, data, (res) => {
        clearTimeout(timer);
        if (res?.success === false)
          return reject(new Error(res.message || "Socket failed"));
        resolve(res);
      });
    });
  }

  on(event, cb) {
    if (!this.socket) return;
    this.socket.on(event, cb);
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
  }

  once(event, cb) {
    if (!this.socket) return;
    this.socket.once(event, cb);
  }

  off(event, cb) {
    if (!this.socket || !this.listeners.has(event)) return;
    if (cb) {
      this.socket.off(event, cb);
      const arr = this.listeners.get(event).filter((fn) => fn !== cb);
      if (arr.length) this.listeners.set(event, arr);
      else this.listeners.delete(event);
    } else {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

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

  restoreListeners() {
    this.listeners.forEach((arr, event) => {
      arr.forEach((cb) => {
        try {
          this.socket.on(event, cb);
        } catch (e) {
          console.error("Restore listener error:", e);
        }
      });
    });
  }

  isConnected() {
    return !!(this.socket && this.socket.connected && this.connected);
  }

  getSocketId() {
    return this.socket?.id || null;
  }

  getSocketUrl() {
    return SOCKET_URL;
  }

  getSocket() {
    return this.socket;
  }

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

  // Message helpers
  sendMessage(data, cb) {
    this.emit("send_message", data, cb);
  }

  sendMessageAsync(data) {
    return this.emitAsync("send_message", data);
  }

  startTyping(receiverId) {
    this.emit("typing_start", { receiverId });
  }

  stopTyping(receiverId) {
    this.emit("typing_stop", { receiverId });
  }

  markAsRead(messageId) {
    this.emit("mark_read", { messageId });
  }

  markConversationRead(otherUserId) {
    this.emit("mark_conversation_read", { otherUserId });
  }

  joinConversation(conversationId) {
    this.emit("join_conversation", { conversationId });
  }

  leaveConversation(conversationId) {
    this.emit("leave_conversation", { conversationId });
  }

  // Video call helpers
  initiateCall(receiverId, offer) {
    this.emit("call_initiate", { receiverId, offer });
  }

  answerCall(callerId, answer) {
    this.emit("call_answer", { callerId, answer });
  }

  rejectCall(callerId) {
    this.emit("call_reject", { callerId });
  }

  endCall(otherUserId) {
    this.emit("call_end", { otherUserId });
  }

  sendIceCandidate(otherUserId, candidate) {
    this.emit("ice_candidate", { otherUserId, candidate });
  }

  subscribeToNotifications() {
    this.emit("subscribe_notifications", {});
  }

  unsubscribeFromNotifications() {
    this.emit("unsubscribe_notifications", {});
  }

  updatePresence(status) {
    this.emit("presence_update", { status });
  }

  getOnlineUsers(userIds) {
    this.emit("get_online_users", { userIds });
  }
}

const socketService = new SocketService();
export default socketService;
