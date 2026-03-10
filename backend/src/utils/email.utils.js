const nodemailer = require("nodemailer");

// Create transporter with retry logic
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
  };

  console.log("📧 Creating transporter with:", {
    host: config.host,
    port: config.port,
    user: config.auth.user,
    passLength: config.auth.pass?.length,
  });

  return nodemailer.createTransporter(config);
};

// Send email with timeout and retry
const sendEmail = async (options, retries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const transporter = createTransporter();

      // Verify connection first
      console.log(
        `📧 Verifying connection (attempt ${attempt + 1}/${retries + 1})...`
      );
      await transporter.verify();
      console.log("✅ Email transporter verified");

      const mailOptions = {
        from: `Mental Healthcare <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(
        "✅ Email sent successfully:",
        info.messageId,
        "to:",
        options.email
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(`❌ Email attempt ${attempt + 1} failed:`, error.message);

      if (attempt < retries) {
        console.log(`⏳ Retrying in ${(attempt + 1) * 1000}ms...`);
        await new Promise((resolve) =>
          setTimeout(resolve, (attempt + 1) * 1000)
        );
      }
    }
  }

  console.error("❌ All email attempts failed:", lastError.message);
  return { success: false, error: lastError.message };
};

// Send OTP email
const sendOTPEmail = async (email, otp, purpose = "verification") => {
  const subjects = {
    verification: "Xác thực tài khoản - Mental Healthcare",
    reset: "Đặt lại mật khẩu - Mental Healthcare",
  };

  const messages = {
    verification: `Mã OTP để xác thực tài khoản của bạn là: <strong>${otp}</strong>`,
    reset: `Mã OTP để đặt lại mật khẩu của bạn là: <strong>${otp}</strong>`,
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🧠 Mental Healthcare</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>${messages[purpose]}</p>
          <div style="font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: white; border-radius: 8px; letter-spacing: 5px;">${otp}</div>
          <p style="color: #e74c3c; font-size: 14px;">⚠️ Mã OTP hết hạn sau 10 phút.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject: subjects[purpose],
    html,
    text: `Mã OTP của bạn là: ${otp}. Mã này hết hạn sau 10 phút.`,
  });
};

// Send welcome email
const sendWelcomeEmail = async (email, fullName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🧠 Mental Healthcare</h1>
          <p>Chào mừng bạn!</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2>Xin chào ${fullName}!</h2>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại Mental Healthcare.</p>
          <p>Chúng tôi rất vui khi bạn tham gia cộng đồng chăm sóc sức khỏe tinh thần của chúng tôi.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject: "Chào mừng đến với Mental Healthcare! 🧠",
    html,
    text: `Xin chào ${fullName}! Cảm ơn bạn đã đăng ký tài khoản.`,
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
};
