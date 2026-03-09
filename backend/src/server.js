const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const connectDB = require("./config/database");

// Load environment variables
dotenv.config();

// Connect to DB
connectDB();

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 1000 : 100,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Allowed origins from env (comma separated) or defaults for local dev
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000,http://localhost:4000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("🌐 Allowed Origins:", allowedOrigins);

// Check origin helper
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow server-to-server calls, tools without Origin header

  if (allowedOrigins.includes(origin)) return true;

  // allow localhost/127.0.0.1 any port
  try {
    if (origin.includes("localhost") || origin.includes("127.0.0.1"))
      return true;
  } catch (e) {
    // ignore
  }

  // allow ngrok patterns used in dev/testing
  if (
    origin.includes(".ngrok.io") ||
    origin.includes(".ngrok-free.app") ||
    origin.includes(".ngrok-free.dev") ||
    origin.includes("ngrok")
  ) {
    return true;
  }

  return false;
};

// CORS config - DENY by default for unknown origins (safer in production)
const corsConfig = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS origin denied: ${origin}`);
      callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-requested-with",
    "Accept",
    "Origin",
    "ngrok-skip-browser-warning",
  ],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
};

app.use(cors(corsConfig));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static uploads (note: filesystem ephemeral on Render - use Cloudinary/S3 in prod)
app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1d",
    etag: true,
  })
);

// Health check
app.get("/api/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    message: "Mental Healthcare API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    allowedOrigins,
    requestOrigin: req.get("Origin") || "No origin header",
    socketIO: { enabled: true, transports: ["polling", "websocket"] },
    memory: process.memoryUsage(),
    pid: process.pid,
  };
  res.json(healthCheck);
});

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/appointments", require("./routes/appointment.routes"));
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/journals", require("./routes/journal.routes"));
app.use("/api/content", require("./routes/content.routes"));
app.use("/api/reports", require("./routes/report.routes"));
// app.use("/api/chatbot", require("./routes/chatbot.routes"));
app.use("/api/messages", require("./routes/message.routes"));

// Request logging helper (dev)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`, {
      origin: req.get("Origin"),
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });
  }
  next();
});

// Error handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  const errorResponse = {
    success: false,
    message: "Internal Server Error",
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  };

  if (process.env.NODE_ENV === "development") {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  res.status(err.status || 500).json(errorResponse);
});

// 404
app.use((req, res) => {
  console.warn(`❓ Route not found: ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "GET /api/health",
      "POST /api/auth/login",
      "POST /api/auth/register",
      "GET /api/content",
      "GET /api/users/providers",
    ],
  });
});

// Socket.io setup (strict CORS)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Socket.IO CORS denied: ${origin}`);
        callback(new Error("Socket.IO CORS not allowed"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  },
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  upgradeTimeout: 30000,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  allowEIO3: true,
  maxHttpBufferSize: 1e8,
});

// Load socket handlers
require("./sockets/chat.socket")(io);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`👋 ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("🛑 HTTP server closed");
    // close DB connection if needed (database.js handles events)
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error("Forcing shutdown");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`${"=".repeat(50)}`);
  console.log("🚀 BACKEND SERVER RUNNING");
  console.log(`${"=".repeat(50)}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  const publicHealthUrl =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    `http://localhost:${PORT}`;
  console.log(
    `🔗 Health check: ${publicHealthUrl.replace(/\/$/, "")}/api/health`
  );
  console.log(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
  console.log(`⚡ Socket.IO: Enabled (polling + websocket)`);
  console.log(`📊 Rate limit: ${limiter.max} requests per 15 minutes`);
  console.log(`${"=".repeat(50)}\n`);
});

module.exports = { app, io, server };
