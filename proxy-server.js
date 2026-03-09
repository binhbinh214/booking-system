const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = 4000;

// CORS - cho phép tất cả origins
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

// Log requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Proxy API -> Backend (giữ nguyên /api prefix)
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://localhost:5000",
    changeOrigin: true,
    secure: false,
    pathRewrite: {
      "^/api": "/api",
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("ngrok-skip-browser-warning", "true");
      console.log(
        `🔄 API: ${req.method} /api${req.url} -> http://localhost:5000/api${req.url}`
      );
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`📥 API Response: ${proxyRes.statusCode} /api${req.url}`);
    },
    onError: (err, req, res) => {
      console.error("❌ API Proxy Error:", err.message);
      res
        .status(502)
        .json({ error: "Backend unavailable", message: err.message });
    },
  })
);

// Proxy uploads
app.use(
  "/uploads",
  createProxyMiddleware({
    target: "http://localhost:5000",
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("ngrok-skip-browser-warning", "true");
    },
  })
);

// Proxy Socket.IO - QUAN TRỌNG cho real-time
app.use(
  "/socket.io",
  createProxyMiddleware({
    target: "http://localhost:5000",
    changeOrigin: true,
    secure: false,
    ws: true,
    logLevel: "warn",
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("ngrok-skip-browser-warning", "true");
      console.log(`🔌 Socket.IO: ${req.method} ${req.url}`);
    },
    onProxyReqWs: (proxyReq, req, socket, options, head) => {
      console.log("🔌 WebSocket upgrade request:", req.url);
    },
    onError: (err, req, res) => {
      console.error("❌ Socket.IO Proxy Error:", err.message);
    },
  })
);

// Proxy everything else -> Frontend
app.use(
  "/",
  createProxyMiddleware({
    target: "http://localhost:3000",
    changeOrigin: true,
    secure: false,
    ws: true,
    onError: (err, req, res) => {
      console.error("❌ Frontend Proxy Error:", err.message);
      res.status(502).json({ error: "Frontend unavailable" });
    },
  })
);

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🔄 PROXY SERVER RUNNING`);
  console.log(`${"=".repeat(50)}`);
  console.log(`📡 Proxy URL: http://localhost:${PORT}`);
  console.log(`📡 API: /api/* -> http://localhost:5000/api/*`);
  console.log(`🔌 Socket.IO: /socket.io/* -> http://localhost:5000`);
  console.log(`🌐 Frontend: /* -> http://localhost:3000`);
  console.log(`\n💡 To share via ngrok, run:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`\n⚠️  Make sure these are running:`);
  console.log(`   1. Backend on port 5000`);
  console.log(`   2. Frontend on port 3000`);
  console.log(`${"=".repeat(50)}\n`);
});

// Handle WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  console.log("🔌 WebSocket upgrade event:", req.url);
});
