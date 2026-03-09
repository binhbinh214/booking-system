const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerType: {
      type: String,
      enum: ["doctor", "therapist", "counselor"],
      required: true,
    },
    appointmentType: {
      type: String,
      enum: ["online"],
      default: "online",
      required: true,
    },
    sessionType: {
      type: String,
      enum: ["consultation", "therapy", "follow-up"],
      default: "consultation",
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    scheduledTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 60, // minutes
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "rejected"],
      default: "pending",
    },
    reasonForVisit: {
      type: String,
      required: true,
      maxlength: 500,
    },
    patientNotes: {
      type: String,
      maxlength: 500,
    },
    consultationNotes: {
      diagnosis: String,
      treatment: String,
      notes: String,
    },
    fee: {
      type: Number,
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    meetingLink: {
      type: String,
      default: null,
    },
    googleCalendarEventId: {
      type: String,
      default: null,
    },
    rating: {
      byPatient: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        createdAt: { type: Date, default: Date.now },
      },
      byProvider: {
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        createdAt: { type: Date, default: Date.now },
      },
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for queries
appointmentSchema.index({ patient: 1, scheduledDate: 1 });
appointmentSchema.index({ provider: 1, scheduledDate: 1 });
appointmentSchema.index({ status: 1, scheduledDate: 1 });

// Virtual for formatted date
appointmentSchema.virtual("formattedDate").get(function () {
  return this.scheduledDate.toLocaleDateString("vi-VN");
});

// Pre-save middleware to ensure online appointment type
appointmentSchema.pre("save", function (next) {
  // Force appointmentType to be "online"
  this.appointmentType = "online";
  next();
});

module.exports = mongoose.model("Appointment", appointmentSchema);
