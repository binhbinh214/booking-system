// ...existing code...
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "../../services/auth.service";

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requireVerification: false,
  verificationEmail: null,
  verificationSuccess: false, // new flag for OTP success without immediate login
};

// Async thunks
export const register = createAsyncThunk(
  "auth/register",
  async (userData, { rejectWithValue }) => {
    try {
      console.log("📝 Attempting registration with:", {
        email: userData.email,
        fullName: userData.fullName,
        phone: userData.phone,
        role: userData.role,
        password: "***hidden***",
      });

      const response = await authService.register(userData);
      console.log("✅ Register response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Register error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data ? JSON.parse(error.config.data) : null,
        },
      });

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Đăng ký thất bại. Vui lòng thử lại.";

      console.error("❌ Returning error:", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      console.log("🔐 Attempting login for:", credentials.email);
      const response = await authService.login(credentials);
      console.log("✅ Login response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Login error:", error.response?.data);
      const data = error.response?.data;
      if (data?.requireVerification) {
        return rejectWithValue({
          message: data.message,
          requireVerification: true,
          email: credentials.email,
        });
      }
      return rejectWithValue(data?.message || "Đăng nhập thất bại");
    }
  }
);

export const verifyOTP = createAsyncThunk(
  "auth/verifyOTP",
  async (data, { rejectWithValue }) => {
    try {
      console.log("🔑 Verifying OTP for:", data.email);
      const response = await authService.verifyOTP(data);
      console.log("✅ Verify OTP response:", response.data);
      return response.data; // may be { success: true, message: "...", data: { token, user } } OR { success: true, message: "..." }
    } catch (error) {
      console.error("❌ Verify OTP error:", error.response?.data);
      const msg = error.response?.data?.message || "Xác thực OTP thất bại";
      return rejectWithValue(msg);
    }
  }
);

export const resendOTP = createAsyncThunk(
  "auth/resendOTP",
  async (email, { rejectWithValue }) => {
    try {
      console.log("📧 Resending OTP to:", email);
      const response = await authService.resendOTP(email);
      console.log("✅ OTP resent:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Resend OTP error:", error.response?.data);
      return rejectWithValue(
        error.response?.data?.message || "Gửi lại OTP thất bại"
      );
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (email, { rejectWithValue }) => {
    try {
      const response = await authService.forgotPassword(email);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Gửi yêu cầu thất bại"
      );
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (data, { rejectWithValue }) => {
    try {
      const response = await authService.resetPassword(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Đặt lại mật khẩu thất bại"
      );
    }
  }
);

export const getMe = createAsyncThunk(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getMe();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Lấy thông tin thất bại"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem("token");
    },
    clearError: (state) => {
      state.error = null;
    },
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    clearVerificationSuccess: (state) => {
      state.verificationSuccess = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        console.log("⏳ Register pending...");
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        console.log("✅ Register fulfilled:", action.payload);
        state.isLoading = false;
        state.requireVerification = true;
        state.verificationEmail = action.payload.data?.email;
      })
      .addCase(register.rejected, (state, action) => {
        console.log("❌ Register rejected:", action.payload);
        state.isLoading = false;
        state.error = action.payload || "Đăng ký thất bại";
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;

        const responseData = action.payload.data || action.payload;
        const { token, user } = responseData;

        console.log("📦 Processing login - token:", !!token, "user:", !!user);

        if (token && user) {
          state.user = user;
          state.token = token;
          state.isAuthenticated = true;
          localStorage.setItem("token", token);
          console.log("✅ Login successful");
        } else {
          console.error("❌ Invalid login response:", action.payload);
          state.error = "Lỗi đăng nhập. Vui lòng thử lại.";
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        if (action.payload?.requireVerification) {
          state.requireVerification = true;
          state.verificationEmail = action.payload.email;
          state.error = action.payload.message;
        } else {
          state.error = action.payload;
        }
      })
      // Verify OTP
      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.verificationSuccess = false;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload = action.payload || {};

        // Case A: backend returns token+user inside payload.data -> log user in
        if (
          payload.success &&
          payload.data &&
          payload.data.token &&
          payload.data.user
        ) {
          state.user = payload.data.user;
          state.token = payload.data.token;
          state.isAuthenticated = true;
          state.requireVerification = false;
          state.verificationEmail = null;
          state.verificationSuccess = true;
          localStorage.setItem("token", payload.data.token);
          console.log("✅ OTP verification -> user logged in");
          return;
        }

        // Case B: backend returns success (no token) -> mark verification success (user must login)
        if (payload.success) {
          state.requireVerification = false;
          state.verificationEmail = null;
          state.verificationSuccess = true;
          state.error = null;
          console.log("✅ OTP verification success (no token returned)");
          return;
        }

        // Otherwise treat as error
        state.error = payload.message || "Lỗi xác thực. Vui lòng thử lại.";
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Xác thực OTP thất bại";
      })
      // Resend OTP
      .addCase(resendOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resendOTP.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(resendOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Me
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload.data;
      })
      .addCase(getMe.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        localStorage.removeItem("token");
      });
  },
});

export const { logout, clearError, setCredentials, clearVerificationSuccess } =
  authSlice.actions;
export default authSlice.reducer;
