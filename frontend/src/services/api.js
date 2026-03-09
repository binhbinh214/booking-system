import axios from "axios";

/**
 * Resolve API base URL:
 * - Prefer REACT_APP_API_URL (set in Vercel for production)
 * - For dev (localhost) use REACT_APP_API_URL or default http://localhost:5000/api
 * - As last resort use same-origin + /api (only when you intentionally host backend on same origin)
 */
const resolveApiUrl = () => {
  if (typeof window === "undefined") {
    // server-side or build-time fallback (shouldn't be used in CRA runtime)
    return process.env.REACT_APP_API_URL || "http://localhost:5000/api";
  }

  // 1) explicit env set at build time (Vercel/Netlify)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, ""); // remove trailing slash
  }

  const { protocol, hostname, port } = window.location;

  // 2) local dev: localhost -> default backend port 5000
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }

  // 3) ngrok / preview domains - assume backend sits on same origin + /api
  if (
    hostname.includes(".ngrok.io") ||
    hostname.includes(".ngrok-free.app") ||
    hostname.includes(".now.sh") ||
    hostname.includes("vercel.app")
  ) {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}/api`;
  }

  // 4) production same-origin fallback
  return `${protocol}//${hostname}${port ? `:${port}` : ""}/api`;
};

const API_BASE = resolveApiUrl();
console.log("🔗 Final API URL:", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
  withCredentials: true,
});

// Attach token from localStorage if present
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore localStorage errors
    }

    console.log(
      `📤 API Request: ${config.method?.toUpperCase() || "GET"} ${
        config.baseURL
      }${config.url}`
    );
    return config;
  },
  (error) => {
    console.error("📤 Request Error:", error);
    return Promise.reject(error);
  }
);

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
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("persist:mental-healthcare");
      } catch (e) {}
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
    const res = await api.get("/health");
    return res.data;
  } catch (err) {
    console.error("❌ API Health Check Failed:", err.message);
    throw err;
  }
};

export const getCurrentApiUrl = () => API_BASE;

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      localStorage.setItem("token", token);
    } catch (e) {}
  } else {
    delete api.defaults.headers.common["Authorization"];
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("persist:mental-healthcare");
    } catch (e) {}
  }
};

export const clearAuth = () => {
  delete api.defaults.headers.common["Authorization"];
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("persist:mental-healthcare");
  } catch (e) {}
};

export default api;
