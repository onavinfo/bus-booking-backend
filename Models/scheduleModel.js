// const mongoose = require('mongoose');

// const scheduleSchema = mongoose.Schema({
//     owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
//     pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'Path', required: true },
//     busName: {type: String,required:true},
//     busNumber: {type: String,required:true},
//     departureTime: { type: String, required: true },
//     arrivalTime: { type: String, required: true },
//     boardingPoints: [{ type: String, required: true }],
//     droppingPoints: [{ type: String, required: true }],
//     baseFare: { type: Number, required: true }
// })

// module.exports = mongoose.model('Schedule',scheduleSchema);