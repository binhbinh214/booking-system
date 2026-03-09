import axios from "axios";

// Determine API URL based on environment
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;

  console.log("🌐 Detecting environment:", { hostname, port, protocol });

  // Ngrok URLs - use same origin (proxy handles routing)
  if (
    hostname.includes(".ngrok.io") ||
    hostname.includes(".ngrok-free.app") ||
    hostname.includes(".ngrok-free.dev")
  ) {
    const apiUrl = `${protocol}//${hostname}/api`;
    console.log("🔗 Using ngrok API URL:", apiUrl);
    return apiUrl;
  }

  // Local development with proxy (port 4000)
  if (port === "4000") {
    return `${protocol}//${hostname}:${port}/api`;
  }

  // Default local development (port 3000 -> backend 5000)
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return process.env.REACT_APP_API_URL || "http://localhost:5000/api";
  }

  // Fallback - relative path
  return "/api";
};

const API_URL = getApiUrl();

console.log("🔗 Final API URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor - add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      `📤 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${
        config.url
      }`
    );

    return config;
  },
  (error) => {
    console.error("📤 Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("📥 API Error:", {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      console.warn("🔐 Authentication failed - clearing tokens");
      localStorage.removeItem("token");
      localStorage.removeItem("persist:mental-healthcare");

      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register") &&
        !window.location.pathname.includes("/forgot-password")
      ) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export const checkApiHealth = async () => {
  try {
    const response = await api.get("/health");
    console.log("✅ API Health Check:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ API Health Check Failed:", error.message);
    throw error;
  }
};

export const getCurrentApiUrl = () => API_URL;

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("persist:mental-healthcare");
  delete api.defaults.headers.common["Authorization"];
};

export default api;
