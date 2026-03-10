const nodemailer = require("nodemailer");
const FROM =
  process.env.EMAIL_FROM || process.env.SMTP_USER || "onboarding@resend.dev";

async function createTransportCandidates() {
  const candidates = [];
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    candidates.push({
      name: "SMTPS (465, secure)",
      options: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 60000,
        greetingTimeout: 60000,
        socketTimeout: 60000,
        tls:
          process.env.SMTP_REJECT_UNAUTHORIZED === "false"
            ? { rejectUnauthorized: false }
            : undefined,
      },
    });
    candidates.push({
      name: "STARTTLS (587, insecure connect -> upgrade)",
      options: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 60000,
        greetingTimeout: 60000,
        socketTimeout: 60000,
        tls:
          process.env.SMTP_REJECT_UNAUTHORIZED === "false"
            ? { rejectUnauthorized: false }
            : undefined,
      },
    });
  }
  return candidates;
}

let transporter = null;

async function initTransporter() {
  const candidates = await createTransportCandidates();
  for (const c of candidates) {
    try {
      const t = nodemailer.createTransport(c.options);
      await t.verify();
      console.log(`✅ SMTP transporter verified using ${c.name}`);
      transporter = t;
      return transporter;
    } catch (err) {
      console.warn(
        `⚠️ Transport ${c.name} failed:`,
        err && err.message ? err.message : err
      );
    }
  }
  console.warn("No SMTP transport could be verified.");
  return null;
}

// init at load
initTransporter().catch((e) => console.error("initTransporter error:", e));

async function sendEmailRaw({ to, subject, html, text }) {
  if (!transporter) {
    await initTransporter();
    if (!transporter)
      return {
        success: false,
        error: "SMTP transporter not configured/verified",
      };
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
      messageId: info.messageId || info.response,
      raw: info,
    };
  } catch (err) {
    console.error("SMTP sendMail error:", err && (err.stack || err));
    return {
      success: false,
      error: err && (err.message || JSON.stringify(err)),
      details: err,
    };
  }
}

module.exports = {
  sendEmailRaw,
  sendOTPEmail: async (e, o) =>
    sendEmailRaw({ to: e, subject: `OTP: ${o}`, text: `OTP: ${o}` }),
  sendWelcomeEmail: async (e) =>
    sendEmailRaw({ to: e, subject: "Welcome", text: "Welcome" }),
  sendTestEmail: async (to) =>
    sendEmailRaw({ to: to || FROM, subject: "Test", text: "Test" }),
};
