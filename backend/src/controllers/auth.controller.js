const User = require("../models/User.model");
const { generateToken, sendTokenResponse } = require("../utils/jwt.utils");
const { sendOTPEmail, sendWelcomeEmail } = require("../utils/email.utils");
const {
  generateOTP,
  isOTPExpired,
  getOTPExpiry,
} = require("../utils/otp.utils");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * Register user
 * - creates user (handles duplicate key)
 * - generates and stores OTP
 * - responds immediately
 * - sends OTP email in background with timeout
 */
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, phone, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
      });
    }

    // fast check
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email đã được sử dụng",
      });
    }

    // create user with duplicate-key handling
    let user;
    try {
      user = await User.create({
        email,
        password,
        fullName,
        phone,
        role: role || "customer",
        status: "pending",
        isVerified: false,
      });
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Email đã được sử dụng",
        });
      }
      throw createErr;
    }

    // generate and persist OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();
    await user.save();

    // immediate response
    const responseData = {
      success: true,
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
      data: {
        userId: user._id,
        email: user.email,
        emailSent: false,
      },
    };
    if (process.env.NODE_ENV === "development") {
      responseData.data.devOtp = otp;
    }
    console.log("✅ Register: sending immediate response for", email);
    res.status(201).json(responseData);

    // send OTP in background with timeout
    setImmediate(async () => {
      try {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`📧 Sending registration OTP to: ${email}`);

        const sendWithTimeout = (ms) =>
          Promise.race([
            sendOTPEmail(email, otp, "verification"),
            new Promise((_, rej) =>
              setTimeout(() => rej(new Error("sendOTPEmail timeout")), ms)
            ),
          ]);

        let emailResult = { success: false };
        try {
          emailResult = await sendWithTimeout(15000);
        } catch (err) {
          console.error(
            "📛 sendOTPEmail failed or timed out:",
            err?.message || err
          );
          emailResult = { success: false, error: err?.message || err };
        }

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

    return;
  } catch (error) {
    console.error("Register error:", error);
    if (res.headersSent) return;
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Login user
 * - requires email & password
 * - optionally require isVerified
 * - sends tokens via sendTokenResponse
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Chưa cung cấp email hoặc mật khẩu" });
    }

    const user = await User.findOne({ email }).select(
      "+password +isVerified +status"
    );
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }

    if (user.status === "suspended") {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản đã bị tạm khóa" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Tài khoản chưa được xác thực. Vui lòng kiểm tra email để nhận OTP.",
      });
    }

    return sendTokenResponse(user, 200, res, "Đăng nhập thành công");
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi đăng nhập" });
  }
};

/**
 * Verify OTP
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu email hoặc OTP" });
    }

    const user = await User.findOne({ email }).select(
      "+otp +otpExpires +isVerified"
    );
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Yêu cầu không hợp lệ" });
    }

    if (user.isVerified) {
      return res
        .status(200)
        .json({ success: true, message: "Tài khoản đã được xác thực" });
    }

    if (user.otp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Mã OTP không đúng" });
    }

    if (isOTPExpired(user.otpExpires)) {
      return res
        .status(400)
        .json({ success: false, message: "Mã OTP đã hết hạn" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // send welcome email in background
    setImmediate(async () => {
      try {
        await sendWelcomeEmail(user.email, user.fullName);
      } catch (err) {
        console.error("Welcome email error:", err);
      }
    });

    res.status(200).json({ success: true, message: "Xác thực thành công" });
  } catch (err) {
    console.error("verifyOTP error:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi xác thực OTP" });
  }
};

/**
 * Resend OTP
 */
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email là bắt buộc" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = getOTPExpiry();
    await user.save();

    setImmediate(async () => {
      try {
        await sendOTPEmail(email, otp, "verification");
      } catch (err) {
        console.error("resendOTP email error:", err);
      }
    });

    const resp = {
      success: true,
      message: "OTP đã được gửi (nếu email hợp lệ)",
    };
    if (process.env.NODE_ENV === "development") resp.devOtp = otp;
    res.status(200).json(resp);
  } catch (err) {
    console.error("resendOTP error:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi gửi lại OTP" });
  }
};

/**
 * Forgot password - send reset OTP
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email là bắt buộc" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(200).json({
        success: true,
        message:
          "Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu",
      });

    const otp = generateOTP();
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    setImmediate(async () => {
      try {
        await sendOTPEmail(email, otp, "reset");
      } catch (err) {
        console.error("forgotPassword email error:", err);
      }
    });

    const resp = {
      success: true,
      message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi",
    };
    if (process.env.NODE_ENV === "development") resp.devOtp = otp;
    res.status(200).json(resp);
  } catch (err) {
    console.error("forgotPassword error:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi xử lý yêu cầu" });
  }
};

/**
 * Reset password with OTP (already present in file, keep behavior)
 */
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
    if (user.otp !== otp && user.resetPasswordToken !== otp) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không đúng",
      });
    }

    // Check if OTP expired
    if (
      isOTPExpired(user.otpExpires) &&
      (!user.resetPasswordExpires || Date.now() > user.resetPasswordExpires)
    ) {
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

/**
 * Change password
 */
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

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

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

/**
 * Logout
 */
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

/**
 * Get current logged in user
 */
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

/**
 * Refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Không có refresh token",
      });
    }

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

    sendTokenResponse(user, 200, res, "Refresh token thành công");
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};
