const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    nationalId: {
        type: String,
        required: [true, 'National ID is required'],
        unique: true,
        trim: true,
        match: [/^\d{16}$/, 'National ID must be 16 digits']
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        match: [/^\+250\d{9}$/, 'Phone number must be in format +250XXXXXXXXX']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['citizen', 'verified_seller', 'police', 'admin'],
        default: 'citizen'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profilePhoto: {
        type: String
    },
    address: {
        province: String,
        district: String,
        sector: String,
        cell: String
    },
    otp: {
        code: String,
        expiresAt: Date
    },
    refreshToken: {
        type: String,
        select: false
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };
    return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function(inputOTP) {
    if (!this.otp || !this.otp.code) return false;
    if (new Date() > this.otp.expiresAt) return false;
    return this.otp.code === inputOTP;
};

// Get full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
