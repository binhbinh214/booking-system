const nodemailer = require("nodemailer");

const FROM =
  process.env.EMAIL_FROM || process.env.SMTP_USER || "onboarding@resend.dev";

let transporter = null;

function initTransporter() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn(
      "SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Email sending disabled."
    );
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  // add explicit timeouts and debug to help diagnose timeouts/connection issues
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 60000), // 60s
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 60000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 60000),
    logger: true,
    debug: process.env.SMTP_DEBUG === "true",
    tls:
      process.env.SMTP_REJECT_UNAUTHORIZED === "false"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  transporter
    .verify()
    .then(() => console.log("✅ SMTP transporter verified"))
    .catch((err) =>
      console.warn(
        "⚠️ SMTP verify failed:",
        err && err.message ? err.message : err
      )
    );

  return transporter;
}

initTransporter();

async function sendEmailRaw({ to, subject, html, text }) {
  if (!transporter) {
    initTransporter();
    if (!transporter) {
      return { success: false, error: "SMTP transporter not configured" };
    }
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: info.messageId || info.response || null,
      raw: info,
    };
  } catch (err) {
    // log full error for debugging
    console.error("SMTP sendMail error:", err && (err.stack || err));
    return {
      success: false,
      error:
        (err && (err.message || JSON.stringify(err))) || "Unknown send error",
      details: err, // caller can inspect
    };
  }
}

async function sendOTPEmail(email, otp, purpose = "verification") {
  const subjects = {
    verification: "Xác thực tài khoản - Mental Healthcare",
    reset: "Đặt lại mật khẩu - Mental Healthcare",
  };
  const subject = subjects[purpose] || subjects.verification;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; color:#333;">
      <div style="background:#667eea; color:#fff; padding:18px; border-radius:8px 8px 0 0; text-align:center;">
        <h2 style="margin:0">Mental Healthcare</h2>
      </div>
      <div style="background:#fff; padding:20px; border:1px solid #eee; border-top:0; border-radius:0 0 8px 8px;">
        <p>Xin chào,</p>
        <p>Mã <strong>OTP</strong> của bạn là:</p>
        <div style="font-size:28px; font-weight:700; letter-spacing:6px; text-align:center; margin:12px 0;">
          ${otp}
        </div>
        <p style="color:#666; font-size:13px;">Mã có hiệu lực trong 10 phút.</p>
      </div>
    </div>
  `;

  const text = `Mã OTP của bạn: ${otp} (hết hạn sau 10 phút)`;

  return await sendEmailRaw({ to: email, subject, html, text });
}

async function sendWelcomeEmail(email, fullName) {
  const subject = "Chào mừng đến Mental Healthcare";
  const html = `<p>Xin chào ${
    fullName || ""
  },</p><p>Cảm ơn bạn đã đăng ký tại Mental Healthcare.</p>`;
  const text = `Xin chào ${
    fullName || ""
  }, Cảm ơn bạn đã đăng ký tại Mental Healthcare.`;

  return await sendEmailRaw({ to: email, subject, html, text });
}

async function sendTestEmail(to) {
  return await sendEmailRaw({
    to: to || process.env.DEV_TEST_EMAIL || FROM,
    subject: "Test Email - Mental Healthcare",
    html: "<p>Test email</p>",
    text: "Test email",
  });
}

module.exports = {
  sendEmailRaw,
  sendOTPEmail,
  sendWelcomeEmail,
  sendTestEmail,
};
