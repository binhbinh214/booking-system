const nodemailer = require("nodemailer");

let cachedTransporter = null;
let transporterVerified = false;

const createTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const secure = port === 465;

  const config = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // in some envs setting false is required; change via EMAIL_REJECT_UNAUTHORIZED if needed
      rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED !== "false",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  };

  // Mask user for logs
  console.log("Email config:", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user
      ? config.auth.user.replace(/(.).+(@.+)/, "$1***$2")
      : undefined,
  });

  // Correct function: createTransport (not createTransporter)
  cachedTransporter = nodemailer.createTransport(config);
  return cachedTransporter;
};

const sendEmail = async (options, retries = 1) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const transporter = createTransporter();

      if (!transporterVerified) {
        try {
          await transporter.verify();
          transporterVerified = true;
          console.log("✅ Email transporter verified");
        } catch (verifyErr) {
          console.warn(
            "⚠️ Email transporter verify failed:",
            verifyErr.message
          );
          // continue to attempt send; sendMail will throw with detailed error
        }
      }

      const mailOptions = {
        from: `Mental Healthcare <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text:
          options.text ||
          (options.html ? options.html.replace(/<[^>]+>/g, "") : ""),
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent:", info.messageId, "to:", options.email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(
        `❌ Email attempt ${attempt + 1} failed:`,
        error && error.message ? error.message : error
      );
      if (attempt < retries)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message || String(lastError) : "unknown",
  };
};

const sendOTPEmail = async (email, otp, purpose = "verification") => {
  const subjects = {
    verification: "Xác thực tài khoản - Mental Healthcare",
    reset: "Đặt lại mật khẩu - Mental Healthcare",
  };

  const html = `<div>Mã OTP: <strong>${otp}</strong></div><p>Hết hạn sau 10 phút.</p>`;
  return await sendEmail({
    email,
    subject: subjects[purpose] || subjects.verification,
    html,
    text: `Mã OTP của bạn: ${otp} (hết hạn sau 10 phút)`,
  });
};

const sendWelcomeEmail = async (email, fullName) => {
  const html = `<div>Xin chào ${fullName}, chào mừng tới Mental Healthcare.</div>`;
  return await sendEmail({
    email,
    subject: "Chào mừng - Mental Healthcare",
    html,
    text: `Xin chào ${fullName}`,
  });
};

const sendTestEmail = async (to) => {
  return await sendEmail(
    {
      email: to || process.env.DEV_TEST_EMAIL || process.env.EMAIL_USER,
      subject: "Test Email",
      text: "Test",
      html: "<p>Test</p>",
    },
    0
  );
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendTestEmail,
};
