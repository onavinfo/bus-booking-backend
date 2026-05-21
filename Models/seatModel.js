const mongoose = require("mongoose");

const seatLockSchema = mongoose.Schema({
    busId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bus"
    },
    seatNumber: Number,
    journeyDate: String,
    from: String, 
    to: String,
    lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    expiresAt: {
        type: Date,
        index: { expires: 300 } // auto delete after 5 min
    }
});

seatLockSchema.index({
    busId: 1,
    date: 1,
    seatNumber: 1,
    expiresAt: 1
},{unique: true});

module.exports = mongoose.model("SeatLock", seatLockSchema);