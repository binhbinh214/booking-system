import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "../../services/auth.service";

const token =
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const initialState = {
  user: null,
  token,
  // isAuthenticated true when token exists so PrivateRoute won't redirect incorrectly on reload
  isAuthenticated: !!token,
  isLoading: false,
  error: null,
};

// Helpers
const normalizeResponse = (payload) => {
  // support shapes: { data: {...} }, {...}, { success, data: {...} }
  const p = payload?.data ?? payload ?? {};
  // If the payload is already the user object (no wrapper)
  const user = p.user ?? p.data ?? p;
  const token = p.token ?? payload?.token ?? null;
  return { user, token };
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
      return rejectWithValue(
        data?.message || err.message || "Đăng nhập thất bại"
      );
    }
  }
);

export const getMe = createAsyncThunk(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return rejectWithValue("No token available");
      }
      const response = await authService.getMe();
      return response.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || "Failed to fetch user"
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
      const { user, token } = action.payload;
      if (user) state.user = user;
      if (token) {
        state.token = token;
        localStorage.setItem("token", token);
      }
      state.isAuthenticated = !!(user || token);
    },
    // merge updates into user (useful to update balance after deposit/topup)
    updateUser: (state, action) => {
      if (state.user && typeof state.user === "object") {
        state.user = { ...state.user, ...action.payload };
      } else if (action.payload) {
        state.user = action.payload;
      }
      // keep isAuthenticated true if token exists
      state.isAuthenticated = !!(state.token || state.user);
    },
  },
  extraReducers: (builder) => {
    builder
      // register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error?.message;
      })

      // login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, token } = normalizeResponse(action.payload);
        if (token) {
          state.token = token;
          localStorage.setItem("token", token);
        }
        if (user && typeof user === "object" && Object.keys(user).length) {
          state.user = user;
        }
        state.isAuthenticated = !!(state.token || state.user);
        if (!state.isAuthenticated) {
          state.error = "Đăng nhập không hợp lệ";
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error?.message;
      })

      // getMe
      .addCase(getMe.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, token } = normalizeResponse(action.payload);
        if (user && typeof user === "object" && Object.keys(user).length) {
          state.user = user;
        }
        if (token) {
          state.token = token;
          localStorage.setItem("token", token);
        }
        // If we have either a token or user, consider authenticated
        state.isAuthenticated = !!(state.token || state.user);
      })
      .addCase(getMe.rejected, (state, action) => {
        // don't forcibly logout on transient getMe failures (network/server)
        state.isLoading = false;
        state.error = action.payload || action.error?.message;
        // Note: handle token expiry/401 in axios interceptor to call logout()
      });
  },
});

export const { logout, clearError, setCredentials, updateUser } =
  authSlice.actions;
export default authSlice.reducer;
