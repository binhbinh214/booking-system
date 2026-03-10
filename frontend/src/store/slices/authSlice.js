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
  verificationSuccess: false,
};

// thunks
export const register = createAsyncThunk(
  "auth/register",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Đăng ký thất bại"
      );
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response.data;
    } catch (err) {
      const data = err.response?.data;
      if (data?.message && data?.message.includes("xác thực")) {
        return rejectWithValue({
          message: data.message,
          requireVerification: true,
          email: credentials.email,
        });
      }
      return rejectWithValue(
        data?.message || err.message || "Đăng nhập thất bại"
      );
    }
  }
);

export const verifyOTP = createAsyncThunk(
  "auth/verifyOTP",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await authService.verifyOTP(payload);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Xác thực thất bại"
      );
    }
  }
);

export const resendOTP = createAsyncThunk(
  "auth/resendOTP",
  async (email, { rejectWithValue }) => {
    try {
      const response = await authService.resendOTP(email);
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Gửi lại OTP thất bại"
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
      localStorage.removeItem("token");
    },
    clearError: (state) => {
      state.error = null;
    },
    clearVerificationSuccess: (state) => {
      state.verificationSuccess = false;
    },
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      localStorage.setItem("token", action.payload.token);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.requireVerification = true;
        state.verificationEmail = action.payload.data?.email || null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        const payload = action.payload?.data || action.payload;
        if (payload?.token && payload?.user) {
          state.user = payload.user;
          state.token = payload.token;
          state.isAuthenticated = true;
          localStorage.setItem("token", payload.token);
        } else {
          state.error = "Đăng nhập không hợp lệ";
        }
        state.isLoading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        if (action.payload?.requireVerification) {
          state.requireVerification = true;
          state.verificationEmail = action.payload.email;
          state.error = action.payload.message;
        } else state.error = action.payload;
      })

      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.verificationSuccess = false;
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload = action.payload || {};
        if (
          payload.success &&
          payload.data &&
          payload.data.token &&
          payload.data.user
        ) {
          state.user = payload.data.user;
          state.token = payload.data.token;
          state.isAuthenticated = true;
          localStorage.setItem("token", payload.data.token);
          state.requireVerification = false;
          state.verificationEmail = null;
          state.verificationSuccess = true;
          return;
        }
        if (payload.success) {
          state.requireVerification = false;
          state.verificationEmail = null;
          state.verificationSuccess = true;
          state.error = null;
          return;
        }
        state.error = payload.message || "Xác thực thất bại";
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

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
      });
  },
});

export const { logout, clearError, clearVerificationSuccess, setCredentials } =
  authSlice.actions;
export default authSlice.reducer;
