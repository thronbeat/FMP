const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect, generateToken, generateRefreshToken } = require("../middleware/auth");
const { validate, registerValidation, loginValidation, otpValidation } = require("../middleware/validation");
const smsService = require("../services/sms.service");

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", registerValidation, validate, async (req, res) => {
    try {
        const { nationalId, firstName, lastName, phoneNumber, password, email, address } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ nationalId }, { phoneNumber }]
        });

        if (existingUser) {
            if (existingUser.nationalId === nationalId) {
                return res.status(400).json({ error: "National ID already registered" });
            }
            return res.status(400).json({ error: "Phone number already registered" });
        }

        // Create user
        const user = new User({
            nationalId,
            firstName,
            lastName,
            phoneNumber,
            password,
            email,
            address
        });

        // Generate OTP for verification
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS
        await smsService.sendOTP(phoneNumber, otp);

        res.status(201).json({
            message: "Registration successful. Please verify your phone number with the OTP sent.",
            userId: user._id
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
// @access  Public
router.post("/verify-otp", otpValidation, validate, async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Clear OTP and mark as verified
        user.otp = undefined;
        user.isVerified = true;
        await user.save();

        // Generate tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            message: "Phone number verified successfully",
            token,
            refreshToken,
            user
        });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: "Verification failed" });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", loginValidation, validate, async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        // Find user and include password for comparison
        const user = await User.findOne({ phoneNumber }).select("+password");
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({ error: "Account has been deactivated" });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check if verified
        if (!user.isVerified) {
            // Generate new OTP
            const otp = user.generateOTP();
            await user.save();
            await smsService.sendOTP(phoneNumber, otp);
            
            return res.status(403).json({
                error: "Phone number not verified. New OTP sent.",
                requiresVerification: true
            });
        }

        // Generate tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();

        res.json({
            message: "Login successful",
            token,
            refreshToken,
            user
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post("/resend-otp", async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Generate new OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS
        await smsService.sendOTP(phoneNumber, otp);

        res.json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post("/forgot-password", async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            // Don't reveal if user exists
            return res.json({ message: "If this number is registered, you will receive an OTP" });
        }

        // Generate OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS
        await smsService.sendOTP(phoneNumber, otp);

        res.json({ message: "If this number is registered, you will receive an OTP" });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to process request" });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post("/reset-password", async (req, res) => {
    try {
        const { phoneNumber, otp, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Update password
        user.password = newPassword;
        user.otp = undefined;
        await user.save();

        res.json({ message: "Password reset successful" });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password" });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get("/me", protect, async (req, res) => {
    res.json({ user: req.user });
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
    try {
        const allowedUpdates = ["firstName", "lastName", "email", "address", "profilePhoto"];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        );

        res.json({ message: "Profile updated", user });
    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put("/change-password", protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters" });
        }

        const user = await User.findById(req.user._id).select("+password");
        
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Failed to change password" });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", protect, async (req, res) => {
    try {
        req.user.refreshToken = undefined;
        await req.user.save();
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ error: "Logout failed" });
    }
});

module.exports = router;
