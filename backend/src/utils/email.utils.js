const noopResult = async () => ({
  success: true,
  info: "email disabled (no-op)",
});

module.exports = {
  // kept API surface so gọi từ code khác không lỗi
  sendEmailRaw: async ({ to, subject, html, text }) => {
    console.log(`[EMAIL NO-OP] to=${to} subject=${subject}`);
    return noopResult();
  },

  sendOTPEmail: async (email, otp, purpose = "verification") => {
    console.log(`[EMAIL NO-OP] sendOTPEmail to=${email} otp=${otp}`);
    return noopResult();
  },

  sendWelcomeEmail: async (email, fullName) => {
    console.log(`[EMAIL NO-OP] sendWelcomeEmail to=${email}`);
    return noopResult();
  },

  sendTestEmail: async (to) => {
    console.log(`[EMAIL NO-OP] sendTestEmail to=${to}`);
    return noopResult();
  },

  sendAppointmentConfirmation: async (appointment) => {
    console.log(
      `[EMAIL NO-OP] sendAppointmentConfirmation appointmentId=${
        appointment?._id || "n/a"
      }`
    );
    return noopResult();
  },
};
