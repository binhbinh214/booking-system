import axios from "axios";

/**
 * Resolve API base URL:
 * - Prefer REACT_APP_API_URL (set in Vercel for production)
 * - For dev (localhost) use REACT_APP_API_URL or default http://localhost:5000/api
 */
const resolveApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;

  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, "");
    console.log("🔗 Using API URL from env:", cleanUrl);
    return cleanUrl;
  }

  console.log("🔗 Using default API URL: http://localhost:5000/api");
  return "http://localhost:5000/api";
};

const API_BASE = resolveApiUrl();

// Log configuration on startup
console.log("=".repeat(50));
console.log("🚀 API Configuration");
console.log("=".repeat(50));
console.log("Environment:", process.env.NODE_ENV);
console.log("API Base URL:", API_BASE);
console.log("=".repeat(50));

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 30 seconds
  withCredentials: true,
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn("⚠️ Could not access localStorage:", e);
    }

    // Log request in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `📤 ${config.method?.toUpperCase() || "GET"} ${config.baseURL}${
          config.url
        }`
      );
    }

    return config;
  },
  (error) => {
    console.error("📤 Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle responses and errors
api.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `📥 ${response.status} ${response.config.url}`,
        response.data
      );
    }

    return response;
  },
  (error) => {
    // Enhanced error logging
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
    };

    console.error("📥 API Error:", errorDetails);

    // Handle specific error cases
    if (error.response?.status === 401) {
      console.warn("🔒 Unauthorized - clearing auth and redirecting to login");

      try {
        localStorage.removeItem("token");
        localStorage.removeItem("persist:mental-healthcare");
      } catch (e) {
        console.warn("⚠️ Could not clear localStorage:", e);
      }

      // Only redirect if not already on auth pages
      const authPages = [
        "/login",
        "/register",
        "/forgot-password",
        "/verify-otp",
        "/reset-password",
      ];
      const currentPath = window.location.pathname;

      if (!authPages.some((page) => currentPath.includes(page))) {
        console.log("↪️ Redirecting to login...");
        window.location.href = "/login";
      }
    }

    // Handle CORS errors
    if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
      console.error(
        "🌐 Network Error - possible CORS issue or backend is down"
      );
      console.error("   - Check if backend is running");
      console.error("   - Verify CORS settings");
      console.error("   - Check API URL:", API_BASE);
    }

    // Handle timeout errors
    if (error.code === "ECONNABORTED") {
      console.error("⏱️ Request timeout - backend may be slow or down");
    }

    return Promise.reject(error);
  }
);

/**
 * Check API health
 */
export const checkApiHealth = async () => {
  try {
    console.log("🏥 Checking API health...");
    const res = await api.get("/health");
    console.log("✅ API Health OK:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ API Health Check Failed:", err.message);
    throw err;
  }
};

/**
 * Get current API URL
 */
export const getCurrentApiUrl = () => API_BASE;

/**
 * Set authentication token
 */
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      localStorage.setItem("token", token);
      console.log("✅ Token set successfully");
    } catch (e) {
      console.warn("⚠️ Could not save token to localStorage:", e);
    }
  } else {
    delete api.defaults.headers.common["Authorization"];
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("persist:mental-healthcare");
      console.log("✅ Token cleared successfully");
    } catch (e) {
      console.warn("⚠️ Could not clear token from localStorage:", e);
    }
  }
};

/**
 * Clear authentication
 */
export const clearAuth = () => {
  console.log("🧹 Clearing authentication...");
  delete api.defaults.headers.common["Authorization"];
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("persist:mental-healthcare");
    console.log("✅ Auth cleared successfully");
  } catch (e) {
    console.warn("⚠️ Could not clear localStorage:", e);
  }
};

// Log API instance creation
console.log("✅ API instance created successfully");

export default api;
