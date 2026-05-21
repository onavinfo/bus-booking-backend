const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, required: [true, 'Name is required'] },
    email: { type: String, required: [true, 'Email is required'], unique: true },
    password: {
        type: String, required: function () {
            return !this.googleId;
        }
    },
    otp: String,
    otpExpiry: Date,
    phnNo: { type: String, },
    DOB: { type: String },
    role: { type: String, enum: ['user', 'owner', 'admin'], default: 'user' },
    googleId: String,
    profileImage: { type: String },
    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
        country: { type: String }
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

module.exports = mongoose.model('User', userSchema);