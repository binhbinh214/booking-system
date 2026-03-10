const Appointment = require("../models/Appointment.model");
const User = require("../models/User.model");
const Payment = require("../models/Payment.model");
const {
  sendEmail,
  sendAppointmentConfirmationWithMeet,
} = require("../utils/email.utils");
const jitsiMeetService = require("../services/jitsiMeet.service");

// Create appointment
const createAppointment = async (req, res) => {
  try {
    const {
      providerId,
      providerType,
      sessionType,
      scheduledDate,
      scheduledTime,
      duration,
      reasonForVisit,
      patientNotes,
    } = req.body;

    console.log("=== CREATE APPOINTMENT ===");
    console.log("Request body:", req.body);

    // Validation
    if (!providerId || !scheduledDate || !scheduledTime || !reasonForVisit) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    // Get patient info
    const patient = await User.findById(req.user.id).select("+balance");
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin bệnh nhân",
      });
    }

    // Get provider info
    const provider = await User.findById(providerId);
    if (!provider || !["doctor", "healer"].includes(provider.role)) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin bác sĩ/chuyên gia",
      });
    }

    const consultationFee = provider.consultationFee || 0;
    const platformFeeRate = 0.1;
    const platformFee = Math.floor(consultationFee * platformFeeRate);
    const providerEarning = consultationFee - platformFee;

    // Check patient balance
    if (patient.balance < consultationFee) {
      return res.status(400).json({
        success: false,
        message: `Số dư không đủ. Cần thêm ${(
          consultationFee - patient.balance
        ).toLocaleString("vi-VN")}đ`,
      });
    }

    // Check for conflicting appointments
    const conflictingAppointment = await Appointment.findOne({
      $or: [{ patient: patient._id }, { provider: providerId }],
      scheduledDate: new Date(scheduledDate),
      scheduledTime: scheduledTime,
      status: { $in: ["pending", "confirmed"] },
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        success: false,
        message:
          "Thời gian này đã có lịch hẹn khác. Vui lòng chọn thời gian khác.",
      });
    }

    // Create payment record
    const payment = await Payment.create({
      user: patient._id,
      type: "appointment",
      transactionType: "appointment",
      amount: consultationFee,
      finalAmount: consultationFee,
      platformFee: platformFee,
      providerAmount: providerEarning,
      provider: providerId,
      status: "completed",
      paymentMethod: "wallet",
      description: `Thanh toán phí tư vấn với ${provider.fullName}`,
      metadata: {
        providerId: providerId,
        providerName: provider.fullName,
        appointmentDate: scheduledDate,
        appointmentTime: scheduledTime,
        sessionType: sessionType || "consultation",
      },
    });

    // Deduct from patient balance
    await User.findByIdAndUpdate(
      patient._id,
      { $inc: { balance: -consultationFee } },
      { new: true }
    );

    // Add to provider balance (minus platform fee)
    await User.findByIdAndUpdate(
      providerId,
      { $inc: { balance: providerEarning } },
      { new: true }
    );

    // Create appointment (chưa có meeting link, sẽ tạo khi confirm)
    const appointment = await Appointment.create({
      patient: patient._id,
      provider: providerId,
      providerType: providerType || provider.role,
      appointmentType: "online",
      sessionType: sessionType || "consultation",
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration: duration || 60,
      reasonForVisit,
      patientNotes,
      fee: consultationFee,
      platformFee: platformFee,
      providerEarning: providerEarning,
      status: "pending",
      isPaid: true,
      paymentId: payment._id,
      meetingLink: null, // Sẽ tạo khi confirm
    });

    // Update payment with appointment ID
    await Payment.findByIdAndUpdate(payment._id, {
      appointment: appointment._id,
    });

    const populatedAppointment = await Appointment.findById(
      appointment._1d ? appointment._id : appointment._id
    )
      .populate("patient", "fullName email phone avatar")
      .populate("provider", "fullName email phone avatar role specialization")
      .populate("paymentId");

    console.log("✅ Appointment created:", populatedAppointment._id);

    // Respond immediately to client
    res.status(201).json({
      success: true,
      message: "Đặt lịch thành công! Vui lòng chờ chuyên gia xác nhận.",
      data: populatedAppointment,
    });

    // SEND EMAILS IN BACKGROUND (non-blocking)
    setImmediate(async () => {
      // Provider notification
      try {
        await sendEmail({
          email: provider.email,
          subject: "🔔 Có lịch hẹn mới cần xác nhận - Mental Healthcare",
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1>🧠 Mental Healthcare</h1>
                  <p>Có lịch hẹn mới!</p>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <h2>Xin chào ${provider.fullName}!</h2>
                  <p>Bạn có lịch hẹn mới cần xác nhận:</p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <p><strong>👤 Bệnh nhân:</strong> ${patient.fullName}</p>
                    <p><strong>📅 Ngày:</strong> ${new Date(
                      scheduledDate
                    ).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</p>
                    <p><strong>⏰ Giờ:</strong> ${scheduledTime}</p>
                    <p><strong>📝 Lý do:</strong> ${reasonForVisit}</p>
                    <p><strong>💰 Phí:</strong> ${consultationFee.toLocaleString(
                      "vi-VN"
                    )}đ (Đã thanh toán)</p>
                  </div>
                  
                  <p style="color: #e74c3c;">⚠️ Vui lòng xác nhận hoặc từ chối lịch hẹn này trong vòng 24 giờ.</p>
                  
                  <center>
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }/provider/appointments" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 15px;">
                      Xem lịch hẹn
                    </a>
                  </center>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        console.log("✅ Provider email queued/sent:", provider.email);
      } catch (emailError) {
        console.error(
          "Provider email error:",
          emailError.message || emailError
        );
      }

      // Patient confirmation
      try {
        await sendEmail({
          email: patient.email,
          subject: "✅ Đặt lịch thành công - Mental Healthcare",
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1>🧠 Mental Healthcare</h1>
                  <p>Đặt lịch thành công!</p>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <h2>Xin chào ${patient.fullName}!</h2>
                  <p>Bạn đã đặt lịch hẹn thành công. Vui lòng chờ chuyên gia xác nhận.</p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                    <p><strong>👨‍⚕️ Chuyên gia:</strong> ${provider.fullName}</p>
                    <p><strong>📅 Ngày:</strong> ${new Date(
                      scheduledDate
                    ).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</p>
                    <p><strong>⏰ Giờ:</strong> ${scheduledTime}</p>
                    <p><strong>💰 Phí:</strong> ${consultationFee.toLocaleString(
                      "vi-VN"
                    )}đ (Đã thanh toán)</p>
                  </div>
                  
                  <p style="color: #27ae60;">✅ Bạn sẽ nhận được email xác nhận kèm link cuộc họp khi chuyên gia chấp nhận lịch hẹn.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        console.log("✅ Patient email queued/sent:", patient.email);
      } catch (emailError) {
        console.error("Patient email error:", emailError.message || emailError);
      }
    });

    return;
  } catch (error) {
    console.error("Create appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo lịch hẹn",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
const getMyAppointments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const query = { patient: req.user.id };

    // optional filters
    if (req.query.status) query.status = req.query.status;
    if (req.query.providerId) query.provider = req.query.providerId;

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate("provider", "fullName email avatar specialization role")
      .populate("patient", "fullName email avatar")
      .populate("paymentId")
      .sort({ scheduledDate: -1, scheduledTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: appointments,
      pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
};
// Get appointment by ID
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate("patient", "fullName email phone avatar")
      .populate("provider", "fullName email phone avatar role specialization")
      .populate("paymentId", "amount status");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Check permission
    const userId = req.user.id;
    const userRole = req.user.role;

    if (
      userRole !== "admin" &&
      appointment.patient._id.toString() !== userId &&
      appointment.provider._id.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xem lịch hẹn này",
      });
    }

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    console.error("Get appointment by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin lịch hẹn",
    });
  }
};

// Cancel appointment
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancellationReason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log("=== CANCEL APPOINTMENT ===");
    console.log("Appointment ID:", id);
    console.log("User ID:", userId);
    console.log("User Role:", userRole);

    const appointment = await Appointment.findById(id)
      .populate("patient", "fullName email")
      .populate("provider", "fullName email");

    if (!appointment) {
      console.log("❌ Appointment not found");
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Check permission - cho phép patient, provider, admin
    const isPatient = appointment.patient._id.toString() === userId;
    const isProvider = appointment.provider._id.toString() === userId;
    const isAdmin = userRole === "admin";

    console.log("Is Patient:", isPatient);
    console.log("Is Provider:", isProvider);
    console.log("Is Admin:", isAdmin);

    if (!isPatient && !isProvider && !isAdmin) {
      console.log("❌ Permission denied");
      return res.status(403).json({
        success: false,
        message: "Không có quyền hủy lịch hẹn này",
      });
    }

    // Check status
    if (!["pending", "confirmed"].includes(appointment.status)) {
      console.log("❌ Invalid status:", appointment.status);
      return res.status(400).json({
        success: false,
        message: `Không thể hủy lịch hẹn có trạng thái "${appointment.status}"`,
      });
    }

    // Calculate refund
    const now = new Date();
    const appointmentDateTime = new Date(appointment.scheduledDate);
    const timeParts = appointment.scheduledTime?.split(":") || ["0", "0"];
    appointmentDateTime.setHours(
      parseInt(timeParts[0]),
      parseInt(timeParts[1])
    );

    const hoursUntilAppointment =
      (appointmentDateTime - now) / (1000 * 60 * 60);

    // Provider hủy -> hoàn 100%, Patient hủy trước 24h -> 100%, sau 24h -> 50%
    let refundPercentage = isProvider
      ? 1.0
      : hoursUntilAppointment >= 24
      ? 1.0
      : 0.5;
    const refundAmount = Math.floor((appointment.fee || 0) * refundPercentage);

    console.log("Hours until appointment:", hoursUntilAppointment);
    console.log("Refund percentage:", refundPercentage * 100, "%");
    console.log("Refund amount:", refundAmount);

    // Update appointment
    appointment.status = "cancelled";
    appointment.cancelledBy = userId;
    appointment.cancelledAt = new Date();
    appointment.cancelReason = reason || cancellationReason || "Không có lý do";
    appointment.refundAmount = refundAmount;
    await appointment.save();

    console.log("✅ Appointment status updated to cancelled");

    // Process refund to patient
    if (refundAmount > 0) {
      await User.findByIdAndUpdate(appointment.patient._id, {
        $inc: { balance: refundAmount },
      });
      console.log("✅ Refund to patient:", refundAmount);

      // Create refund payment record
      await Payment.create({
        user: appointment.patient._id,
        type: "refund",
        transactionType: "refund",
        amount: refundAmount,
        finalAmount: refundAmount,
        status: "completed",
        paymentMethod: "wallet",
        appointment: appointment._id,
        description: `Hoàn tiền hủy lịch hẹn với ${appointment.provider.fullName}`,
        metadata: {
          originalAppointmentId: appointment._id,
          refundPercentage: refundPercentage * 100,
          cancelledBy: isPatient
            ? "patient"
            : isProvider
            ? "provider"
            : "admin",
          originalFee: appointment.fee,
        },
      });
      console.log("✅ Refund payment record created");
    }

    // Deduct from provider balance if already credited
    if (refundAmount > 0 && appointment.isPaid) {
      const platformFeeRate = 0.1;
      const providerDeduction = Math.floor(
        refundAmount * (1 - platformFeeRate)
      );
      await User.findByIdAndUpdate(appointment.provider._id, {
        $inc: { balance: -providerDeduction },
      });
      console.log("✅ Provider balance deducted:", providerDeduction);
    }

    // Send email notifications
    try {
      await sendEmail({
        email: appointment.patient.email,
        subject: "❌ Lịch hẹn đã bị hủy - Mental Healthcare",
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>🧠 Mental Healthcare</h1>
                <p>Lịch hẹn đã bị hủy</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Lịch hẹn của bạn đã bị hủy.</p>
                <p><strong>Lý do:</strong> ${appointment.cancelReason}</p>
                ${
                  refundAmount > 0
                    ? `<p style="color: #27ae60;"><strong>💰 Hoàn tiền:</strong> ${refundAmount.toLocaleString(
                        "vi-VN"
                      )}đ đã được hoàn vào ví của bạn.</p>`
                    : ""
                }
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    res.json({
      success: true,
      message: `Đã hủy lịch hẹn thành công.${
        refundAmount > 0
          ? ` Hoàn ${refundAmount.toLocaleString("vi-VN")}đ vào ví.`
          : ""
      }`,
      data: {
        appointment,
        refundAmount,
        refundPercentage: refundPercentage * 100,
      },
    });
  } catch (error) {
    console.error("❌ Cancel appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy lịch hẹn",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Rate appointment
const rateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review, score } = req.body;
    const userId = req.user.id;

    const ratingValue = rating || score;

    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({
        success: false,
        message: "Điểm đánh giá phải từ 1 đến 5",
      });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    if (appointment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể đánh giá lịch hẹn đã hoàn thành",
      });
    }

    if (appointment.patient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền đánh giá lịch hẹn này",
      });
    }

    // Update rating
    await Appointment.findByIdAndUpdate(id, {
      "rating.byPatient.rating": ratingValue,
      "rating.byPatient.review": review || "",
      "rating.byPatient.createdAt": new Date(),
    });

    // Update provider's average rating
    const allRatings = await Appointment.find({
      provider: appointment.provider,
      "rating.byPatient.rating": { $exists: true, $ne: null },
    }).select("rating.byPatient.rating");

    const ratings = allRatings
      .map((a) => a.rating?.byPatient?.rating)
      .filter((r) => r);

    if (ratings.length > 0) {
      const averageRating =
        ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      await User.findByIdAndUpdate(appointment.provider, {
        rating: Math.round(averageRating * 10) / 10,
        totalRatings: ratings.length,
      });
    }

    res.json({
      success: true,
      message: "Cảm ơn bạn đã đánh giá!",
    });
  } catch (error) {
    console.error("Rate appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đánh giá",
    });
  }
};

// Get provider appointments
const getProviderAppointments = async (req, res) => {
  try {
    const { status, date, limit = 20, page = 1 } = req.query;

    const query = { provider: req.user.id };

    if (status) {
      const statusArray = status.split(",").map((s) => s.trim());
      query.status = { $in: statusArray };
    }

    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.scheduledDate = { $gte: targetDate, $lt: nextDay };
    }

    const appointments = await Appointment.find(query)
      .populate("patient", "fullName email phone avatar")
      .populate("paymentId", "amount status")
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get provider appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách lịch hẹn",
    });
  }
};

// Update appointment status (for providers) - QUAN TRỌNG: Tạo Jitsi link khi confirm
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log("=== UPDATE APPOINTMENT STATUS ===");
    console.log("Appointment ID:", id);
    console.log("New Status:", status);

    const validStatuses = [
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "rejected",
      "no-show",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const appointment = await Appointment.findById(id)
      .populate("patient", "fullName email phone")
      .populate("provider", "fullName email phone");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    // Check permission
    if (
      userRole !== "admin" &&
      appointment.provider._id.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền cập nhật lịch hẹn này",
      });
    }

    // Handle rejected status - refund to patient
    if (status === "rejected" || status === "cancelled") {
      const refundAmount = appointment.fee || 0;

      if (refundAmount > 0 && appointment.isPaid) {
        // Refund to patient
        await User.findByIdAndUpdate(appointment.patient._id, {
          $inc: { balance: refundAmount },
        });

        // Deduct from provider
        const platformFeeRate = 0.1;
        const providerDeduction = Math.floor(
          refundAmount * (1 - platformFeeRate)
        );
        await User.findByIdAndUpdate(appointment.provider._id, {
          $inc: { balance: -providerDeduction },
        });

        // Create refund record
        await Payment.create({
          user: appointment.patient._id,
          type: "refund",
          transactionType: "refund",
          amount: refundAmount,
          finalAmount: refundAmount,
          status: "completed",
          paymentMethod: "wallet",
          appointment: appointment._id,
          description: `Hoàn tiền - Lịch hẹn bị ${
            status === "rejected" ? "từ chối" : "hủy"
          }`,
        });

        console.log("✅ Refund processed:", refundAmount);
      }

      appointment.status = "cancelled";
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = userId;
      await appointment.save();

      // Send email to patient
      try {
        await sendEmail({
          email: appointment.patient.email,
          subject: `❌ Lịch hẹn bị ${
            status === "rejected" ? "từ chối" : "hủy"
          } - Mental Healthcare`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1>🧠 Mental Healthcare</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p>Rất tiếc, lịch hẹn của bạn đã bị ${
                    status === "rejected" ? "từ chối" : "hủy"
                  } bởi chuyên gia.</p>
                  <p style="color: #27ae60;"><strong>💰 Hoàn tiền:</strong> ${refundAmount.toLocaleString(
                    "vi-VN"
                  )}đ đã được hoàn vào ví.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
      } catch (emailError) {
        console.error("Email error:", emailError.message);
      }

      return res.json({
        success: true,
        message: `Đã ${
          status === "rejected" ? "từ chối" : "hủy"
        } lịch hẹn. Đã hoàn ${refundAmount.toLocaleString(
          "vi-VN"
        )}đ cho bệnh nhân.`,
        data: appointment,
      });
    }

    // Generate Jitsi meeting link when CONFIRMING
    let meetingLink = appointment.meetingLink;
    if (status === "confirmed" && !meetingLink) {
      console.log("🎥 Creating Jitsi meeting link...");

      const meetingResult = jitsiMeetService.createMeetingLink({
        patientName: appointment.patient.fullName,
        providerName: appointment.provider.fullName,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        sessionType: appointment.sessionType,
      });

      if (meetingResult.success) {
        meetingLink = meetingResult.meetLink;
        console.log("✅ Jitsi meeting link created:", meetingLink);
      } else {
        // Fallback
        meetingLink = jitsiMeetService.generateSimpleMeetLink().meetLink;
        console.log("🔄 Fallback Jitsi link:", meetingLink);
      }
    }

    // Update appointment
    appointment.status = status;
    if (meetingLink) {
      appointment.meetingLink = meetingLink;
    }
    if (status === "completed") {
      appointment.completedAt = new Date();
    }
    if (status === "confirmed") {
      appointment.confirmedAt = new Date();
    }
    await appointment.save();

    console.log("✅ Appointment updated:", {
      status: appointment.status,
      meetingLink: appointment.meetingLink,
    });

    // Send email with meeting link when confirmed
    if (status === "confirmed" && meetingLink) {
      const formattedDate = new Date(
        appointment.scheduledDate
      ).toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const sessionTypeLabels = {
        consultation: "Tư vấn",
        therapy: "Trị liệu",
        "follow-up": "Tái khám",
      };

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 15px 15px 0 0;">
              <h1 style="margin: 0 0 10px 0; font-size: 28px;">🧠 Mental Healthcare</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Lịch hẹn đã được xác nhận!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <center>
                <span style="display: inline-block; background: #27ae60; color: white; padding: 8px 20px; border-radius: 25px; font-weight: bold; margin-bottom: 20px;">✅ ĐÃ XÁC NHẬN</span>
              </center>
              
              <h2 style="text-align: center; color: #333; margin-bottom: 5px;">Xin chào!</h2>
              <p style="text-align: center; color: #6c757d; margin-top: 0;">Lịch hẹn của bạn đã được xác nhận.</p>
              
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h3 style="margin-top: 0; color: #667eea;">📋 Thông tin lịch hẹn</h3>
                <p><strong>👨‍⚕️ Chuyên gia:</strong> ${
                  appointment.provider.fullName
                }</p>
                <p><strong>👤 Bệnh nhân:</strong> ${
                  appointment.patient.fullName
                }</p>
                <p><strong>📅 Ngày:</strong> ${formattedDate}</p>
                <p><strong>⏰ Giờ:</strong> ${appointment.scheduledTime}</p>
                <p><strong>🏥 Loại:</strong> ${
                  sessionTypeLabels[appointment.sessionType] || "Tư vấn"
                }</p>
                <p><strong>⏱️ Thời lượng:</strong> ${
                  appointment.duration || 60
                } phút</p>
              </div>

              <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center; color: white;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎥 Tham gia cuộc họp video</h3>
                <p style="margin: 0 0 15px 0; opacity: 0.9;">Nhấn nút bên dưới để tham gia cuộc gọi video vào đúng giờ hẹn</p>
                
                <a href="${meetingLink}" style="display: inline-block; background: white; color: #00b894; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px; margin: 10px 5px;" target="_blank">
                  📹 Tham gia cuộc họp
                </a>
                
                <div style="background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 8px; margin-top: 15px; word-break: break-all; font-family: monospace; font-size: 14px;">
                  <strong>Link cuộc họp:</strong><br/>
                  <a href="${meetingLink}" style="color: white;">${meetingLink}</a>
                </div>
              </div>

              <div style="background: #fff3cd; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h4 style="margin: 0 0 15px 0; color: #856404;">💡 Lưu ý quan trọng:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #856404;">
                  <li>Vui lòng tham gia <strong>đúng giờ</strong></li>
                  <li>Chuẩn bị <strong>không gian yên tĩnh</strong></li>
                  <li>Kiểm tra <strong>camera và microphone</strong> trước khi vào họp</li>
                  <li>Đảm bảo <strong>kết nối internet ổn định</strong></li>
                  <li>Sử dụng trình duyệt <strong>Chrome hoặc Firefox</strong> để có trải nghiệm tốt nhất</li>
                </ul>
              </div>

              <center>
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:3000"
                }/appointments" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 15px;">
                  Xem chi tiết lịch hẹn
                </a>
              </center>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6c757d;">
              <p>© ${new Date().getFullYear()} Mental Healthcare. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send to patient
      try {
        await sendEmail({
          email: appointment.patient.email,
          subject: `✅ Xác nhận lịch hẹn - ${formattedDate} lúc ${appointment.scheduledTime}`,
          html: emailHtml,
        });
        console.log(
          "✅ Confirmation email sent to patient:",
          appointment.patient.email
        );
      } catch (emailError) {
        console.error("Email to patient failed:", emailError.message);
      }

      // Send to provider
      try {
        await sendEmail({
          email: appointment.provider.email,
          subject: `✅ Đã xác nhận lịch hẹn - ${formattedDate} lúc ${appointment.scheduledTime}`,
          html: emailHtml,
        });
        console.log(
          "✅ Confirmation email sent to provider:",
          appointment.provider.email
        );
      } catch (emailError) {
        console.error("Email to provider failed:", emailError.message);
      }
    }

    // Send email when completed
    if (status === "completed") {
      try {
        await sendEmail({
          email: appointment.patient.email,
          subject: "✅ Buổi tư vấn đã hoàn thành - Mental Healthcare",
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1>🧠 Mental Healthcare</h1>
                  <p>Buổi tư vấn đã hoàn thành!</p>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
                  <p>Vui lòng đánh giá buổi tư vấn để giúp chúng tôi cải thiện dịch vụ.</p>
                  <center>
                    <a href="${
                      process.env.FRONTEND_URL || "http://localhost:3000"
                    }/appointments/${
            appointment._id
          }" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                      Đánh giá ngay
                    </a>
                  </center>
                </div>
              </div>
            </body>
            </html>
          `,
        });
      } catch (emailError) {
        console.error("Email error:", emailError.message);
      }
    }

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái lịch hẹn thành "${status}"`,
      data: appointment,
    });
  } catch (error) {
    console.error("Update appointment status error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update consultation notes (for providers)
const updateConsultationNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { consultationNotes, diagnosis, prescription } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    if (appointment.provider.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền cập nhật ghi chú",
      });
    }

    if (consultationNotes) appointment.consultationNotes = consultationNotes;
    if (diagnosis) appointment.diagnosis = diagnosis;
    if (prescription) appointment.prescription = prescription;

    await appointment.save();

    const populatedAppointment = await Appointment.findById(id)
      .populate("patient", "fullName email")
      .populate("provider", "fullName email");

    res.json({
      success: true,
      message: "Đã cập nhật ghi chú tư vấn",
      data: populatedAppointment,
    });
  } catch (error) {
    console.error("Update consultation notes error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật ghi chú",
    });
  }
};

// Send recommendation (for providers)
const sendRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const { recommendations, followUpDate, additionalNotes } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findById(id)
      .populate("patient", "fullName email")
      .populate("provider", "fullName email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch hẹn",
      });
    }

    if (appointment.provider._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền gửi đề xuất",
      });
    }

    appointment.recommendations = recommendations;
    if (followUpDate) {
      appointment.followUpDate = new Date(followUpDate);
    }
    if (additionalNotes) {
      appointment.additionalNotes = additionalNotes;
    }
    await appointment.save();

    // Send email with recommendations
    try {
      await sendEmail({
        email: appointment.patient.email,
        subject: "📋 Đề xuất từ chuyên gia - Mental Healthcare",
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>🧠 Mental Healthcare</h1>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2>Đề xuất từ ${appointment.provider.fullName}</h2>
                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                  <p>${recommendations}</p>
                </div>
                ${
                  followUpDate
                    ? `<p><strong>📅 Lịch tái khám:</strong> ${new Date(
                        followUpDate
                      ).toLocaleDateString("vi-VN")}</p>`
                    : ""
                }
                ${
                  additionalNotes
                    ? `<p><strong>📝 Ghi chú thêm:</strong> ${additionalNotes}</p>`
                    : ""
                }
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Email error:", emailError.message);
    }

    res.json({
      success: true,
      message: "Đã gửi đề xuất cho bệnh nhân",
      data: appointment,
    });
  } catch (error) {
    console.error("Send recommendation error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi đề xuất",
    });
  }
};

// Get all appointments (for admin)
const getAllAppointments = async (req, res) => {
  try {
    const {
      status,
      providerId,
      patientId,
      startDate,
      endDate,
      limit = 20,
      page = 1,
    } = req.query;

    const query = {};

    if (status) {
      const statusArray = status.split(",").map((s) => s.trim());
      query.status = { $in: statusArray };
    }

    if (providerId) {
      query.provider = providerId;
    }

    if (patientId) {
      query.patient = patientId;
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(query)
      .populate("patient", "fullName email phone avatar")
      .populate("provider", "fullName email phone avatar role specialization")
      .populate("paymentId", "amount status")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);

    const stats = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalFee: { $sum: "$fee" },
        },
      },
    ]);

    res.json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
      stats,
    });
  } catch (error) {
    console.error("Get all appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách lịch hẹn",
    });
  }
};

module.exports = {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  rateAppointment,
  getProviderAppointments,
  updateAppointmentStatus,
  updateConsultationNotes,
  sendRecommendation,
  getAllAppointments,
};
