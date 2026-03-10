// ...existing code...
const { Resend } = require("resend");
let resendClient = null;

try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log("Email provider: Resend API enabled");
  } else {
    console.log(
      "Email provider: Resend API key not found — will fallback to nodemailer if available"
    );
  }
} catch (e) {
  console.warn("Resend init error:", e && e.message ? e.message : e);
  resendClient = null;
}

// optional nodemailer fallback (keeps previous behavior)
let nodemailerFallback = null;
if (!resendClient) {
  try {
    const nodemailer = require("nodemailer");
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    nodemailerFallback = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED !== "false",
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    });
    console.log("Nodemailer fallback ready");
  } catch (err) {
    console.warn(
      "Nodemailer not available or failed to init:",
      err && err.message ? err.message : err
    );
    nodemailerFallback = null;
  }
}

const FROM =
  process.env.EMAIL_FROM || process.env.EMAIL_USER || "no-reply@example.com";

async function sendViaResend({ to, subject, html, text }) {
  try {
    const res = await resendClient.emails.send({
      from: FROM,
      to,
      subject,
      html,
      reply_to: FROM,
    });
    // Resend returns { id, object, status, ... } — return id as messageId
    return { success: true, messageId: res.id };
  } catch (err) {
    return {
      success: false,
      error: err && (err.message || JSON.stringify(err)),
    };
  }
}

async function sendViaNodemailer({ to, subject, html, text }) {
  try {
    if (!nodemailerFallback) throw new Error("nodemailer not configured");
    const info = await nodemailerFallback.sendMail({
      from: FROM,
      to,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
      html,
    });
    return { success: true, messageId: info.messageId || info.response };
  } catch (err) {
    return {
      success: false,
      error: err && (err.message || JSON.stringify(err)),
    };
  }
}

// Public API
const sendEmail = async ({ email, subject, html, text }) => {
  const to = email;
  if (resendClient) {
    const r = await sendViaResend({ to, subject, html, text });
    if (r.success) return r;
    console.warn("Resend failed, trying fallback:", r.error);
  }
  // fallback to nodemailer if available
  if (nodemailerFallback) {
    return await sendViaNodemailer({ to, subject, html, text });
  }
  return { success: false, error: "No email provider configured" };
};

const sendOTPEmail = async (email, otp, purpose = "verification") => {
  const subjects = {
    verification: "Xác thực tài khoản - Mental Healthcare",
    reset: "Đặt lại mật khẩu - Mental Healthcare",
  };
  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#667eea;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h2>Mental Healthcare</h2>
      </div>
      <div style="background:#fff;padding:20px;border:1px solid #eee;border-top:0;border-radius:0 0 8px 8px;">
        <p>Mã OTP của bạn:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:10px 0;text-align:center;">${otp}</div>
        <p style="color:#666;font-size:13px;">Mã hết hạn sau 10 phút.</p>
      </div>
    </div>
  `;
  return await sendEmail({
    email,
    subject: subjects[purpose] || subjects.verification,
    html,
    text: `Mã OTP của bạn: ${otp} (hết hạn sau 10 phút)`,
  });
};

const sendWelcomeEmail = async (email, fullName) => {
  const html = `<p>Xin chào ${fullName},<br/>Cảm ơn bạn đã đăng ký tại Mental Healthcare.</p>`;
  return await sendEmail({
    email,
    subject: "Chào mừng - Mental Healthcare",
    html,
    text: `Xin chào ${fullName}`,
  });
};

const sendTestEmail = async (to) => {
  return await sendEmail({
    email: to || process.env.DEV_TEST_EMAIL || process.env.EMAIL_USER,
    subject: "Test Email - Mental Healthcare",
    html: "<p>Test</p>",
    text: "Test",
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendTestEmail,
};
// ...existing code...
