const mongoose = require('mongoose');

const timingSchema = new mongoose.Schema({
    stopName: { type: String, required: true },
    departure: { type: String },
    arrival: { type: String },
    priceFromStart: { type: Number, default: 0 },
    order: { type: Number }
}, { _id: false });

const busSchema = mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'Path', required: true },
    busName: { type: String, required: true },
    busNumber: { type: String, required: true, unique: true },
    totalSeats: { type: Number, required: true },
    isAC: { type: Boolean, default: false },
    basePrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    departureTime: { type: String },
    timings: [timingSchema],
    forwardTimings: [timingSchema],
    reverseTimings: [timingSchema],
    isTwoWay: { type: Boolean, required: true },
    bookedSeats: [{
        seatNumber: { type: Number },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
});

module.exports = mongoose.model('Bus', busSchema);