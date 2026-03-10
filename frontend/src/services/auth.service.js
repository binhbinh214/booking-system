const axios = require("axios").default;

const API_BASE = process.env.REACT_APP_API_URL || "";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const register = (data) => api.post("/api/auth/register", data);
const login = (data) => api.post("/api/auth/login", data);
const verifyOTP = (data) => api.post("/api/auth/verify-otp", data);
const resendOTP = (email) => api.post("/api/auth/resend-otp", { email });
const forgotPassword = (email) =>
  api.post("/api/auth/forgot-password", { email });
const resetPassword = (data) => api.post("/api/auth/reset-password", data);
const getMe = () => api.get("/api/auth/me");
const refreshToken = (token) =>
  api.post("/api/auth/refresh-token", { refreshToken: token });
const logout = () => api.post("/api/auth/logout");

module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  getMe,
  refreshToken,
  logout,
};
