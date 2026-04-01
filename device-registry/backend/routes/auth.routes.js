const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { validateUserRegistration, validateLogin, validateOTP } = require('../middleware/validation');
const { sendOTP, sendVerificationSuccess } = require('../services/sms.service');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register new user
router.post('/register', validateUserRegistration, async (req, res) => {
    try {
        const { nationalId, firstName, lastName, phoneNumber, email, password, address } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ nationalId }, { phoneNumber }]
        });

        if (existingUser) {
            const field = existingUser.nationalId === nationalId ? 'National ID' : 'Phone number';
            return res.status(400).json({ error: `${field} is already registered.` });
        }

        // Create user
        const user = new User({
            nationalId,
            firstName,
            lastName,
            phoneNumber,
            email,
            password,
            address
        });

        // Generate OTP for verification
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS
        await sendOTP(phoneNumber, otp);

        res.status(201).json({
            message: 'Registration successful. Please verify your phone number.',
            userId: user._id,
            requiresVerification: true
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Verify phone with OTP
router.post('/verify-otp', validateOTP, async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Account already verified.' });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        user.isVerified = true;
        user.otp = undefined;
        await user.save();

        // Send verification success SMS
        await sendVerificationSuccess(user.phoneNumber, user.firstName);

        const token = generateToken(user._id);

        res.json({
            message: 'Phone number verified successfully.',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'Account already verified.' });
        }

        const otp = user.generateOTP();
        await user.save();

        await sendOTP(user.phoneNumber, otp);

        res.json({ message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        const user = await User.findOne({ phoneNumber }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.isActive) {
            return res.status(401).json({ error: 'Account has been deactivated.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.isVerified) {
            // Send new OTP for unverified users
            const otp = user.generateOTP();
            await user.save();
            await sendOTP(user.phoneNumber, otp);

            return res.status(403).json({
                error: 'Account not verified. OTP sent to your phone.',
                userId: user._id,
                requiresVerification: true
            });
        }

        const token = generateToken(user._id);

        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        res.json({
            user: {
                id: user._id,
                nationalId: user.nationalId,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                address: user.address,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile.' });
    }
});

// Update profile
router.put('/me', authenticate, async (req, res) => {
    try {
        const { email, address } = req.body;
        const updates = {};

        if (email) updates.email = email;
        if (address) updates.address = address;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true }
        );

        res.json({
            message: 'Profile updated successfully.',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                email: user.email,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Change password
router.put('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.userId).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            // Don't reveal if user exists
            return res.json({ message: 'If the phone number is registered, you will receive an OTP.' });
        }

        const otp = user.generateOTP();
        await user.save();
        await sendOTP(user.phoneNumber, otp);

        res.json({
            message: 'OTP sent to your phone number.',
            userId: user._id
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

// Reset password with OTP
router.post('/reset-password', validateOTP, async (req, res) => {
    try {
        const { userId, otp, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        user.password = newPassword;
        user.otp = undefined;
        await user.save();

        res.json({ message: 'Password reset successfully. You can now login.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});

module.exports = router;
