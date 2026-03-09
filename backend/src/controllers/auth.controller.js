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

    // Create user
    const user = await User.create({
      email,
      password,
      fullName,
      phone,
      role: role || "customer",
      status: "pending",
      isVerified: false,
    });

    // Generate OTP for email verification
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();
    await user.save();

    // Send OTP email
    console.log(`\n${"=".repeat(50)}`);
    console.log(`📧 Sending registration OTP to: ${email}`);
    const emailResult = await sendOTPEmail(email, otp, "verification");

    // Log OTP to console in development mode for easy testing
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 OTP Code: ${otp}`);
      console.log(
        `📧 Email sent status: ${
          emailResult.success ? "✅ Success" : "❌ Failed"
        }`
      );
      if (!emailResult.success) {
        console.log(`❌ Email error: ${emailResult.error}`);
      }
    }
    console.log(`${"=".repeat(50)}\n`);

    // Response based on email result
    const responseData = {
      success: true,
      message: emailResult.success
        ? "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản."
        : "Đăng ký thành công nhưng có lỗi khi gửi email. Vui lòng yêu cầu gửi lại OTP.",
      data: {
        userId: user._id,
        email: user.email,
        emailSent: emailResult.success,
      },
    };

    // Include OTP in response for development only
    if (process.env.NODE_ENV === "development") {
      responseData.data.devOtp = otp;
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email và mã OTP",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
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
        message: "Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.",
      });
    }

    // Verify user
    user.isVerified = true;
    user.status = "active";
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send welcome email (don't block the response)
    sendWelcomeEmail(user.email, user.fullName).catch((err) => {
      console.error("Error sending welcome email:", err);
    });

    // Send token response
    sendTokenResponse(user, 200, res, "Xác thực email thành công");
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản đã được xác thực",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();
    await user.save();

    // Send OTP email
    console.log(`\n${"=".repeat(50)}`);
    console.log(`📧 Resending OTP to: ${email}`);
    const emailResult = await sendOTPEmail(email, otp, "verification");

    // Log OTP to console in development mode
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 OTP Code: ${otp}`);
      console.log(
        `📧 Email sent status: ${
          emailResult.success ? "✅ Success" : "❌ Failed"
        }`
      );
      if (!emailResult.success) {
        console.log(`❌ Email error: ${emailResult.error}`);
      }
    }
    console.log(`${"=".repeat(50)}\n`);

    const responseData = {
      success: true,
      message: emailResult.success
        ? "Đã gửi lại mã OTP"
        : "Có lỗi khi gửi email. Vui lòng thử lại sau.",
    };

    // Include OTP in response for development only
    if (process.env.NODE_ENV === "development") {
      responseData.devOtp = otp;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email và mật khẩu",
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    // Check if user is suspended
    if (user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Generate new OTP
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = getOTPExpiry();
      await user.save();

      // Send OTP email
      console.log(`\n${"=".repeat(50)}`);
      console.log(`📧 Sending verification OTP to unverified user: ${email}`);
      const emailResult = await sendOTPEmail(email, otp, "verification");

      // Log OTP to console in development mode
      if (process.env.NODE_ENV === "development") {
        console.log(`🔑 OTP Code: ${otp}`);
        console.log(
          `📧 Email sent status: ${
            emailResult.success ? "✅ Success" : "❌ Failed"
          }`
        );
      }
      console.log(`${"=".repeat(50)}\n`);

      const responseData = {
        success: false,
        message: emailResult.success
          ? "Tài khoản chưa được xác thực. Chúng tôi đã gửi mã OTP mới đến email của bạn."
          : "Tài khoản chưa được xác thực. Có lỗi khi gửi OTP, vui lòng yêu cầu gửi lại.",
        requireVerification: true,
      };

      // Include OTP in response for development only
      if (process.env.NODE_ENV === "development") {
        responseData.devOtp = otp;
      }

      return res.status(403).json(responseData);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Send token response
    sendTokenResponse(user, 200, res, "Đăng nhập thành công");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email",
      });
    }

    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Send OTP email
    console.log(`\n${"=".repeat(50)}`);
    console.log(`📧 Sending password reset OTP to: ${email}`);
    const emailResult = await sendOTPEmail(email, otp, "reset");

    // Log OTP to console in development mode
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 Reset Password OTP: ${otp}`);
      console.log(
        `📧 Email sent status: ${
          emailResult.success ? "✅ Success" : "❌ Failed"
        }`
      );
      if (!emailResult.success) {
        console.log(`❌ Email error: ${emailResult.error}`);
      }
    }
    console.log(`${"=".repeat(50)}\n`);

    const responseData = {
      success: true,
      message:
        "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
    };

    // Include OTP in response for development only
    if (process.env.NODE_ENV === "development") {
      responseData.devOtp = otp;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

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
