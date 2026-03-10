const Appointment = require("../models/Appointment.model");
const User = require("../models/User.model");
const Payment = require("../models/Payment.model");
const jitsiMeetService = require("../services/jitsiMeet.service");

/**
 * Create appointment
 * - process payment and balances
 * - create appointment record
 * - email sending removed (no-op): logs only
 */
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

    if (!providerId || !scheduledDate || !scheduledTime || !reasonForVisit) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    const patient = await User.findById(req.user.id).select("+balance");
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin bệnh nhân",
      });
    }

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

    if (patient.balance < consultationFee) {
      return res.status(400).json({
        success: false,
        message: `Số dư không đủ. Cần thêm ${(
          consultationFee - patient.balance
        ).toLocaleString("vi-VN")}đ`,
      });
    }

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

    await User.findByIdAndUpdate(
      patient._id,
      { $inc: { balance: -consultationFee } },
      { new: true }
    );

    await User.findByIdAndUpdate(
      providerId,
      { $inc: { balance: providerEarning } },
      { new: true }
    );

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
      meetingLink: null,
    });

    await Payment.findByIdAndUpdate(payment._id, {
      appointment: appointment._id,
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("patient", "fullName email phone avatar")
      .populate("provider", "fullName email phone avatar role specialization")
      .populate("paymentId");

    console.log("✅ Appointment created:", populatedAppointment._id);

    res.status(201).json({
      success: true,
      message: "Đặt lịch thành công! Vui lòng chờ chuyên gia xác nhận.",
      data: populatedAppointment,
    });

    // Email functionality removed: log instead of sending
    console.log(
      `[EMAIL NO-OP] Provider (${provider.email}) and patient (${patient.email}) notifications disabled.`
    );

    return;
  } catch (error) {
    console.error("Create appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo lịch hẹn",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get my appointments (patient)
 */
const getMyAppointments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const query = { patient: req.user.id };

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

/**
 * Get appointment by ID
 */
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

    return res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    console.error("Get appointment by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin lịch hẹn",
    });
  }
};

/**
 * Cancel appointment
 */
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

    const isPatient = appointment.patient._id.toString() === userId;
    const isProvider = appointment.provider._id.toString() === userId;
    const isAdmin = userRole === "admin";

    if (!isPatient && !isProvider && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền hủy lịch hẹn này",
      });
    }

    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể hủy lịch hẹn có trạng thái "${appointment.status}"`,
      });
    }

    const now = new Date();
    const appointmentDateTime = new Date(appointment.scheduledDate);
    const timeParts = appointment.scheduledTime?.split(":") || ["0", "0"];
    appointmentDateTime.setHours(
      parseInt(timeParts[0]),
      parseInt(timeParts[1])
    );

    const hoursUntilAppointment =
      (appointmentDateTime - now) / (1000 * 60 * 60);

    let refundPercentage = isProvider
      ? 1.0
      : hoursUntilAppointment >= 24
      ? 1.0
      : 0.5;
    const refundAmount = Math.floor((appointment.fee || 0) * refundPercentage);

    appointment.status = "cancelled";
    appointment.cancelledBy = userId;
    appointment.cancelledAt = new Date();
    appointment.cancelReason = reason || cancellationReason || "Không có lý do";
    appointment.refundAmount = refundAmount;
    await appointment.save();

    if (refundAmount > 0) {
      await User.findByIdAndUpdate(appointment.patient._id, {
        $inc: { balance: refundAmount },
      });

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
    }

    if (refundAmount > 0 && appointment.isPaid) {
      const platformFeeRate = 0.1;
      const providerDeduction = Math.floor(
        refundAmount * (1 - platformFeeRate)
      );
      await User.findByIdAndUpdate(appointment.provider._id, {
        $inc: { balance: -providerDeduction },
      });
    }

    // Email disabled: just log
    console.log(
      `[EMAIL NO-OP] Notification for cancellation disabled. Patient: ${appointment.patient.email}`
    );

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy lịch hẹn",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Rate appointment
 */
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

    await Appointment.findByIdAndUpdate(id, {
      "rating.byPatient.rating": ratingValue,
      "rating.byPatient.review": review || "",
      "rating.byPatient.createdAt": new Date(),
    });

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

    return res.json({
      success: true,
      message: "Cảm ơn bạn đã đánh giá!",
    });
  } catch (error) {
    console.error("Rate appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi đánh giá",
    });
  }
};

/**
 * Get provider appointments
 */
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

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách lịch hẹn",
    });
  }
};

/**
 * Update appointment status (provider)
 * - when confirming, create Jitsi meeting link
 * - email sending removed (logs only)
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

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

    if (
      userRole !== "admin" &&
      appointment.provider._id.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền cập nhật lịch hẹn này",
      });
    }

    // Handle rejected/cancelled refunds
    if (status === "rejected" || status === "cancelled") {
      const refundAmount = appointment.fee || 0;

      if (refundAmount > 0 && appointment.isPaid) {
        await User.findByIdAndUpdate(appointment.patient._id, {
          $inc: { balance: refundAmount },
        });

        const platformFeeRate = 0.1;
        const providerDeduction = Math.floor(
          refundAmount * (1 - platformFeeRate)
        );
        await User.findByIdAndUpdate(appointment.provider._id, {
          $inc: { balance: -providerDeduction },
        });

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
      }

      appointment.status = "cancelled";
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = userId;
      await appointment.save();

      console.log(
        `[EMAIL NO-OP] Cancellation notification disabled for ${appointment.patient.email}`
      );

      return res.json({
        success: true,
        message: `Đã ${status === "rejected" ? "từ chối" : "hủy"} lịch hẹn.`,
        data: appointment,
      });
    }

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
        meetingLink = jitsiMeetService.generateSimpleMeetLink().meetLink;
        console.log("🔄 Fallback Jitsi link:", meetingLink);
      }
    }

    appointment.status = status;
    if (meetingLink) appointment.meetingLink = meetingLink;
    if (status === "completed") appointment.completedAt = new Date();
    if (status === "confirmed") appointment.confirmedAt = new Date();
    await appointment.save();

    console.log("✅ Appointment updated:", {
      status: appointment.status,
      meetingLink: appointment.meetingLink,
    });

    // Email disabled: log instead of sending confirmation
    if (status === "confirmed" && meetingLink) {
      console.log(
        `[EMAIL NO-OP] Confirmation with meeting link disabled. link=${meetingLink}`
      );
    }

    if (status === "completed") {
      console.log(
        `[EMAIL NO-OP] Completion email disabled for ${appointment.patient.email}`
      );
    }

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái lịch hẹn thành "${status}"`,
      data: appointment,
    });
  } catch (error) {
    console.error("Update appointment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update consultation notes, sendRecommendation, getAllAppointments
 * - sendRecommendation previously sent email; now just log
 */
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

    return res.json({
      success: true,
      message: "Đã cập nhật ghi chú tư vấn",
      data: populatedAppointment,
    });
  } catch (error) {
    console.error("Update consultation notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật ghi chú",
    });
  }
};

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
    if (followUpDate) appointment.followUpDate = new Date(followUpDate);
    if (additionalNotes) appointment.additionalNotes = additionalNotes;
    await appointment.save();

    // Email disabled: log instead
    console.log(
      `[EMAIL NO-OP] Recommendation email disabled for ${appointment.patient.email}`
    );

    return res.json({
      success: true,
      message: "Đã lưu đề xuất (email disabled)",
      data: appointment,
    });
  } catch (error) {
    console.error("Send recommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi đề xuất",
    });
  }
};

/**
 * Get all appointments (admin)
 */
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

    if (providerId) query.provider = providerId;
    if (patientId) query.patient = patientId;

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

    return res.json({
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
    return res.status(500).json({
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
