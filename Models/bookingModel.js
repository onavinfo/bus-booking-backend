const mongoose = require('mongoose');

const bookingSchema = mongoose.Schema({
  bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  seats: [{ type: Number, required: true }],
  date: { type: Date, required: true },
  from: { type: String, required: true, trim: true },
  to: { type: String, required: true, trim: true },
  routeType: { type: String, enum: ["forward", "backward"], default: "forward" },
  farePerSeat: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
  paidAt: { type: Date, default: null },
  status: { type: String, enum: ["confirmed", "cancelled", "completed"], default: "confirmed" }
}, { timestamps: true });

bookingSchema.index({
  bus: 1,
  date: 1,
  from: 1,
  to: 1
});

module.exports = mongoose.model("Booking", bookingSchema);  