const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    nationalId: {
        type: String,
        required: [true, "National ID is required"],
        unique: true,
        trim: true,
        minlength: [16, "National ID must be 16 characters"],
        maxlength: [16, "National ID must be 16 characters"]
    },
    firstName: {
        type: String,
        required: [true, "First name is required"],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, "Last name is required"],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        unique: true,
        trim: true,
        match: [/^\+250[0-9]{9}$/, "Phone number must be in format +250XXXXXXXXX"]
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"]
    },
    role: {
        type: String,
        enum: ["citizen", "verified_seller", "police", "admin"],
        default: "citizen"
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
    refreshToken: String,
    lastLogin: Date
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
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
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };
    return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function(code) {
    if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
        return false;
    }
    if (new Date() > this.otp.expiresAt) {
        return false;
    }
    return this.otp.code === code;
};

// Remove sensitive fields from JSON response
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.otp;
    delete user.refreshToken;
    return user;
};

module.exports = mongoose.model("User", userSchema);
