const { Resend } = require("resend");

let resendClient = null;

try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log("Email provider: Resend API enabled");
  } else {
    console.warn(
      "Email provider: RESEND_API_KEY not set — email sending disabled"
    );
  }
} catch (e) {
  console.warn("Resend init error:", e && e.message ? e.message : e);
  resendClient = null;
}

const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

async function sendViaResend({ to, subject, html, text }) {
  if (!resendClient) {
    return {
      success: false,
      error: "Resend client not configured (RESEND_API_KEY missing)",
    };
  }

  try {
    const res = await resendClient.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
      reply_to: FROM,
    });
    return { success: true, messageId: res?.id || null, raw: res };
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
  const r = await sendViaResend({ to, subject, html, text });
  if (r.success) return r;
  // If Resend failed, return the error (no SMTP fallback)
  console.warn("Resend send failed:", r.error);
  return { success: false, error: r.error || "Resend failed" };
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
    email: to || process.env.DEV_TEST_EMAIL || process.env.EMAIL_FROM || FROM,
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
