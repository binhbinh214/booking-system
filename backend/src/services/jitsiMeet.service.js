const crypto = require("crypto");

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || "meet.jit.si";

/**
 * Tạo room name ngẫu nhiên (ưu tiên dùng appointmentId nếu có)
 */
const generateRoomName = (appointmentId) => {
  const base = appointmentId ? `appt-${appointmentId}` : `room-${Date.now()}`;
  const rand = crypto.randomBytes(4).toString("hex");
  return `${base}-${rand}`;
};

/**
 * Tạo link Jitsi Meet cho appointment
 * @param {{ appointmentId?: string, prefix?: string }} opts
 * @returns {{ success: boolean, meetLink?: string, roomName?: string, domain?: string, error?: string }}
 */
const createMeetingLink = (opts = {}) => {
  try {
    const roomName = generateRoomName(opts.appointmentId);
    const base = `https://${JITSI_DOMAIN}/${roomName}`;

    // Thêm một số config mặc định trong fragment nếu muốn
    const params = new URLSearchParams({
      "config.prejoinPageEnabled": "true",
      "config.startWithAudioMuted": "false",
      "config.startWithVideoMuted": "false",
    });

    const meetLink = `${base}#${params.toString()}`;

    return { success: true, meetLink, roomName, domain: JITSI_DOMAIN };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
};

/**
 * Fallback đơn giản nếu cần chỉ link không params
 */
const generateSimpleMeetLink = (appointmentId) => {
  const roomName = generateRoomName(appointmentId);
  return {
    meetLink: `https://${JITSI_DOMAIN}/${roomName}`,
    roomName,
    domain: JITSI_DOMAIN,
  };
};

module.exports = {
  createMeetingLink,
  generateSimpleMeetLink,
  generateRoomName,
  JITSI_DOMAIN,
};
