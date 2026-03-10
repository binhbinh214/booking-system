const User = require("../models/User.model");
const { generateToken, sendTokenResponse } = require("../utils/jwt.utils");
const { sendOTPEmail, sendWelcomeEmail } = require("../utils/email.utils");
const {
  generateOTP,
  isOTPExpired,
  getOTPExpiry,
} = require("../utils/otp.utils");
const crypto = require("crypto");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
// ...existing code...
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, phone, role } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email đã được sử dụng",
      });
    }

    // Create user (User model should handle password hashing)
    const user = await User.create({
      email,
      password,
      fullName,
      phone,
      role: role || "customer",
      status: "pending",
      isVerified: false,
    });

    // Generate OTP for email verification and persist to user
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();
    await user.save();

    // Prepare response immediately (do not wait for email send)
    const responseData = {
      success: true,
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
      data: {
        userId: user._id,
        email: user.email,
        emailSent: false, // will be attempted in background
      },
    };

    // Include OTP in response for development only (convenience)
    if (process.env.NODE_ENV === "development") {
      responseData.data.devOtp = otp;
    }

    // send response now
    res.status(201).json(responseData);

    // Send OTP email in background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`📧 Sending registration OTP to: ${email}`);
        const emailResult = await sendOTPEmail(email, otp, "verification");

        if (process.env.NODE_ENV === "development") {
          console.log(`🔑 OTP Code: ${otp}`);
          console.log(
            `📧 Email sent status: ${
              emailResult?.success ? "✅ Success" : "❌ Failed"
            }`
          );
          if (!emailResult?.success) {
            console.log(`❌ Email error: ${emailResult?.error || "unknown"}`);
          }
        }

        console.log(`${"=".repeat(50)}\n`);
      } catch (err) {
        console.error("Error sending registration OTP (background):", err);
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// ...existing code...

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu không hợp lệ",
      });
    }

    // Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không đúng",
      });
    }

    // Check if OTP expired
    if (isOTPExpired(user.otpExpires)) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu lại.",
      });
    }

    // Set new password
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log(`✅ Password reset successful for: ${email}`);

    res.status(200).json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed successfully for: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res.cookie("refreshToken", "", {
      expires: new Date(0),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    res.status(200).json({
      success: true,
      data: user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Không có refresh token",
      });
    }

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại",
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị tạm khóa",
      });
    }

    // Generate new tokens
    sendTokenResponse(user, 200, res, "Refresh token thành công");
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};
