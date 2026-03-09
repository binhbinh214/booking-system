const nodemailer = require("nodemailer");

const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
  return nodemailer.createTransport(config);
};

const getBaseTemplate = (title, bodyHtml, footerText = "") => `
<!doctype html>
<html lang="vi">
  <head><meta charset="utf-8" /></head>
  <body style="font-family: Arial, sans-serif; background:#f4f6f8; margin:0; padding:20px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(90deg,#667eea,#764ba2);color:#fff;padding:20px 24px;">
        <h2 style="margin:0;font-size:18px">${title}</h2>
      </div>
      <div style="padding:20px 24px;color:#1f2937;line-height:1.5;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;font-size:12px;color:#6b7280;background:#fafafa;text-align:center">
        ${footerText || "Mental Healthcare © " + new Date().getFullYear()}
      </div>
    </div>
  </body>
</html>
`;

// Generic send
const sendEmail = async ({ email, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    const mailOptions = {
      from: `"Mental Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: text || "",
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("Email send error:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
};

// Simple appointment confirmed email with meeting link (used for both patient and provider)
const sendAppointmentConfirmedWithMeetLink = async ({
  recipientEmail,
  recipientName,
  otherPartyName,
  roleLabel = "Cuộc hẹn",
  scheduledDate,
  scheduledTime,
  duration = 60,
  meetingLink,
  appointmentId,
}) => {
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const body = `
    <p>Xin chào <strong>${recipientName}</strong>,</p>
    <p>Cuộc hẹn <strong>${roleLabel}</strong> đã được xác nhận với <strong>${otherPartyName}</strong>.</p>

    <table style="width:100%;margin:16px 0;border-radius:8px;background:#f3f4f6;padding:12px;">
      <tr><td style="padding:6px 0"><strong>Ngày:</strong> ${dateStr}</td></tr>
      <tr><td style="padding:6px 0"><strong>Giờ:</strong> ${scheduledTime}</td></tr>
      <tr><td style="padding:6px 0"><strong>Thời lượng:</strong> ${duration} phút</td></tr>
    </table>

    <div style="text-align:center;margin:18px 0;">
      <a href="${meetingLink}" target="_blank" style="display:inline-block;padding:12px 26px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        🚀 Tham gia cuộc họp
      </a>
    </div>

    <p style="font-size:13px;color:#374151">Hoặc dùng link trực tiếp:<br/><a href="${meetingLink}" target="_blank" style="word-break:break-all;color:#2563eb">${meetingLink}</a></p>

    <p style="margin-top:16px;color:#374151">Nếu cần thay đổi giờ, vui lòng vào trang lịch của bạn hoặc liên hệ hỗ trợ.</p>
  `;

  const html = getBaseTemplate("Lịch hẹn đã được xác nhận", body, "Mental Healthcare — Hãy tham gia đúng giờ");

  return await sendEmail({
    email: recipientEmail,
    subject: `✅ Lịch hẹn đã xác nhận ${dateStr} • ${scheduledTime}`,
    html,
  });
};

// Helper to send same meeting link to both patient and provider
const sendAppointmentConfirmedToBoth = async ({ appointment, meetingLink }) => {
  const {
    patientEmail,
    patientName,
    providerEmail,
    providerName,
    scheduledDate,
    scheduledTime,
    duration,
    _id,
  } = appointment;

  const tasks = [];
  if (providerEmail) {
    tasks.push(
      sendAppointmentConfirmedWithMeetLink({
        recipientEmail: providerEmail,
        recipientName: providerName || "Chuyên gia",
        otherPartyName: patientName || "Bệnh nhân",
        roleLabel: "Buổi hẹn (Provider)",
        scheduledDate,
        scheduledTime,
        duration,
        meetingLink,
        appointmentId: _id,
      })
    );
  }
  if (patientEmail) {
    tasks.push(
      sendAppointmentConfirmedWithMeetLink({
        recipientEmail: patientEmail,
        recipientName: patientName || "Bệnh nhân",
        otherPartyName: providerName || "Chuyên gia",
        roleLabel: "Buổi hẹn (Patient)",
        scheduledDate,
        scheduledTime,
        duration,
        meetingLink,
        appointmentId: _id,
      })
    );
  }

  const results = await Promise.all(tasks);
  return results;
};

// New appointment notification to provider (simple)
const sendNewAppointmentToProvider = async ({
  providerEmail,
  providerName,
  patientName,
  scheduledDate,
  scheduledTime,
  fee,
  appointmentId,
}) => {
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const body = `
    <p>Xin chào <strong>${providerName}</strong>,</p>
    <p>Bạn có lịch hẹn mới từ <strong>${patientName}</strong>.</p>
    <ul>
      <li><strong>Ngày:</strong> ${dateStr}</li>
      <li><strong>Giờ:</strong> ${scheduledTime}</li>
      <li><strong>Phí:</strong> ${fee ? fee.toLocaleString("vi-VN") + "đ" : "—"}</li>
    </ul>
    <p><a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/provider/appointments" style="color:#2563eb">Xem chi tiết</a></p>
  `;

  const html = getBaseTemplate("Lịch hẹn mới", body, "Vui lòng xác nhận trong 24 giờ");

  return await sendEmail({
    email: providerEmail,
    subject: `🔔 Lịch hẹn mới từ ${patientName}`,
    html,
  });
};

// Sent to patient when appointment is pending
const sendAppointmentPendingToPatient = async ({
  patientEmail,
  patientName,
  providerName,
  scheduledDate,
  scheduledTime,
  fee,
}) => {
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const body = `
    <p>Xin chào <strong>${patientName}</strong>,</p>
    <p>Yêu cầu đặt lịch của bạn với <strong>${providerName}</strong> đã được gửi và đang chờ xác nhận.</p>
    <ul>
      <li><strong>Ngày:</strong> ${dateStr}</li>
      <li><strong>Giờ:</strong> ${scheduledTime}</li>
      <li><strong>Phí:</strong> ${fee ? fee.toLocaleString("vi-VN") + "đ" : "—"}</li>
    </ul>
    <p>Bạn sẽ nhận email xác nhận kèm link họp khi chuyên gia chấp nhận.</p>
    <p><a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/appointments" style="color:#2563eb">Xem lịch của tôi</a></p>
  `;

  const html = getBaseTemplate("Đặt lịch thành công - Đang chờ", body, "Mental Healthcare");

  return await sendEmail({
    email: patientEmail,
    subject: `✨ Đặt lịch thành công - Chờ xác nhận`,
    html,
  });
};

const sendAppointmentCancelled = async ({
  recipientEmail,
  recipientName,
  otherPartyName,
  scheduledDate,
  scheduledTime,
  reason,
}) => {
  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleDateString("vi-VN")
    : "";

  const body = `
    <p>Xin chào <strong>${recipientName}</strong>,</p>
    <p>Cuộc hẹn với <strong>${otherPartyName}</strong> vào <strong>${dateStr} ${scheduledTime}</strong> đã bị hủy.</p>
    ${reason ? `<p><strong>Lý do:</strong> ${reason}</p>` : ""}
    <p><a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/appointments" style="color:#2563eb">Xem lịch của tôi</a></p>
  `;

  const html = getBaseTemplate("Lịch hẹn bị hủy", body, "Nếu cần hỗ trợ, liên hệ bộ phận hỗ trợ.");

  return await sendEmail({
    email: recipientEmail,
    subject: `❌ Lịch hẹn đã bị hủy`,
    html,
  });
};

// OTP and welcome (kept simple)
const sendOTPEmail = async (email, otp, purpose = "verification") => {
  const subject = purpose === "reset" ? "🔑 Đặt lại mật khẩu" : "🔐 Xác thực tài khoản";
  const body = `
    <p>Xin chào,</p>
    <p>Mã OTP của bạn: <strong style="font-size:18px">${otp}</strong></p>
    <p>Mã có hiệu lực trong 10 phút.</p>
  `;
  const html = getBaseTemplate(subject, body);
  return await sendEmail({ email, subject, html });
};

const sendWelcomeEmail = async (email, fullName) => {
  const body = `
    <p>Xin chào <strong>${fullName}</strong>,</p>
    <p>Chào mừng bạn đến với Mental Healthcare. Chúng tôi sẵn sàng hỗ trợ bạn.</p>
    <p><a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" style="color:#2563eb">Bắt đầu</a></p>
  `;
  const html = getBaseTemplate("Chào mừng đến với Mental Healthcare", body);
  return await sendEmail({ email, subject: "🎉 Chào mừng!", html });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendNewAppointmentToProvider,
  sendAppointmentPendingToPatient,
  sendAppointmentConfirmedWithMeetLink,
  sendAppointmentConfirmedToBoth,
  sendAppointmentCancelled,
};