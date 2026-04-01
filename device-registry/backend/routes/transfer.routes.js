const express = require('express');
const Transfer = require('../models/Transfer');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validateTransfer, validateMongoId, validateOTP } = require('../middleware/validation');
const { verifyQRCode, generateTransferQR } = require('../services/qrcode.service');
const { sendOTP, sendTransferRequest, sendTransferComplete } = require('../services/sms.service');

const router = express.Router();

// Initiate a transfer
router.post('/', authenticate, requireVerified, validateTransfer, async (req, res) => {
    try {
        const { deviceId, buyerIdentifier, transferType, price, notes } = req.body;

        // Find the device
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        if (device.currentOwner.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'You can only transfer devices you own.' });
        }

        if (!device.isTransferable()) {
            return res.status(400).json({
                error: 'Device cannot be transferred in current status.',
                status: device.status
            });
        }

        // Check for pending transfers
        const pendingTransfer = await Transfer.findOne({
            device: deviceId,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        });

        if (pendingTransfer) {
            return res.status(400).json({
                error: 'There is already a pending transfer for this device.',
                transferId: pendingTransfer._id
            });
        }

        // Find buyer by phone or national ID
        const buyer = await User.findOne({
            $or: [
                { phoneNumber: buyerIdentifier },
                { nationalId: buyerIdentifier }
            ]
        });

        if (!buyer) {
            return res.status(404).json({
                error: 'Buyer not found. They must register on DRTS first.',
                action: 'invite_user'
            });
        }

        if (buyer._id.toString() === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot transfer device to yourself.' });
        }

        if (!buyer.isVerified) {
            return res.status(400).json({ error: 'Buyer account is not verified.' });
        }

        // Create transfer request
        const transfer = new Transfer({
            device: deviceId,
            fromUser: req.userId,
            toUser: buyer._id,
            transferType: transferType || 'sale',
            price,
            notes,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        });

        await transfer.save();

        // Update device status
        device.status = 'pending_transfer';
        await device.save();

        // Notify buyer
        await sendTransferRequest(buyer.phoneNumber, req.user.fullName, `${device.brand} ${device.model}`);

        res.status(201).json({
            message: 'Transfer request sent successfully.',
            transfer: {
                id: transfer._id,
                status: transfer.status,
                expiresAt: transfer.expiresAt,
                buyer: {
                    id: buyer._id,
                    name: buyer.fullName,
                    phone: buyer.phoneNumber
                }
            }
        });
    } catch (error) {
        console.error('Create transfer error:', error);
        res.status(500).json({ error: 'Failed to create transfer.' });
    }
});

// Get user's transfers
router.get('/', authenticate, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 10 } = req.query;
        const query = {
            $or: [{ fromUser: req.userId }, { toUser: req.userId }]
        };

        if (type === 'incoming') {
            delete query.$or;
            query.toUser = req.userId;
        } else if (type === 'outgoing') {
            delete query.$or;
            query.fromUser = req.userId;
        }

        if (status) query.status = status;

        const transfers = await Transfer.find(query)
            .populate('device', 'brand model deviceType identifiers')
            .populate('fromUser', 'firstName lastName phoneNumber')
            .populate('toUser', 'firstName lastName phoneNumber')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Transfer.countDocuments(query);

        res.json({
            transfers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get transfers error:', error);
        res.status(500).json({ error: 'Failed to fetch transfers.' });
    }
});

// Get single transfer
router.get('/:id', authenticate, validateMongoId, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id)
            .populate('device')
            .populate('fromUser', 'firstName lastName phoneNumber')
            .populate('toUser', 'firstName lastName phoneNumber');

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        // Check if user is involved in transfer
        const isInvolved = [transfer.fromUser._id.toString(), transfer.toUser._id.toString()]
            .includes(req.userId.toString());
        const isAdmin = ['admin', 'police'].includes(req.user.role);

        if (!isInvolved && !isAdmin) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        res.json({ transfer });
    } catch (error) {
        console.error('Get transfer error:', error);
        res.status(500).json({ error: 'Failed to fetch transfer.' });
    }
});

// Accept transfer (buyer)
router.put('/:id/accept', authenticate, requireVerified, validateMongoId, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id)
            .populate('device')
            .populate('fromUser');

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        if (transfer.toUser.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the buyer can accept this transfer.' });
        }

        if (transfer.status !== 'pending') {
            return res.status(400).json({ error: `Transfer is already ${transfer.status}.` });
        }

        if (transfer.isExpired()) {
            transfer.status = 'expired';
            await transfer.save();
            return res.status(400).json({ error: 'Transfer request has expired.' });
        }

        transfer.status = 'accepted';
        transfer.respondedAt = new Date();
        await transfer.save();

        // Send OTP to both parties for final verification
        const sellerOtp = transfer.fromUser.generateOTP();
        await transfer.fromUser.save();
        await sendOTP(transfer.fromUser.phoneNumber, sellerOtp);

        const buyer = await User.findById(req.userId);
        const buyerOtp = buyer.generateOTP();
        await buyer.save();
        await sendOTP(buyer.phoneNumber, buyerOtp);

        res.json({
            message: 'Transfer accepted. Both parties need to verify with OTP to complete.',
            transferId: transfer._id,
            requiresOtpVerification: true
        });
    } catch (error) {
        console.error('Accept transfer error:', error);
        res.status(500).json({ error: 'Failed to accept transfer.' });
    }
});

// Verify transfer with OTP
router.put('/:id/verify-otp', authenticate, validateMongoId, validateOTP, async (req, res) => {
    try {
        const { otp } = req.body;
        const transfer = await Transfer.findById(req.params.id)
            .populate('device')
            .populate('fromUser')
            .populate('toUser');

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        if (transfer.status !== 'accepted') {
            return res.status(400).json({ error: 'Transfer must be accepted first.' });
        }

        const user = await User.findById(req.userId);
        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        // Clear OTP
        user.otp = undefined;
        await user.save();

        // Update verification status
        const isSeller = transfer.fromUser._id.toString() === req.userId.toString();
        const isBuyer = transfer.toUser._id.toString() === req.userId.toString();

        if (isSeller) {
            transfer.sellerOtpVerified = true;
        } else if (isBuyer) {
            transfer.buyerOtpVerified = true;
        } else {
            return res.status(403).json({ error: 'You are not part of this transfer.' });
        }

        await transfer.save();

        // Check if both verified
        if (transfer.sellerOtpVerified && transfer.buyerOtpVerified) {
            // Complete the transfer
            transfer.status = 'completed';
            transfer.completedAt = new Date();
            await transfer.save();

            // Update device ownership
            const device = await Device.findById(transfer.device._id);
            device.currentOwner = transfer.toUser._id;
            device.status = 'transferred';
            device.qrCode = undefined; // Clear old QR
            await device.save();

            // Notify both parties
            await sendTransferComplete(transfer.fromUser.phoneNumber, `${device.brand} ${device.model}`, 'seller');
            await sendTransferComplete(transfer.toUser.phoneNumber, `${device.brand} ${device.model}`, 'buyer');

            return res.json({
                message: 'Transfer completed successfully!',
                status: 'completed',
                newOwner: {
                    id: transfer.toUser._id,
                    name: transfer.toUser.fullName
                }
            });
        }

        res.json({
            message: 'OTP verified. Waiting for other party to verify.',
            sellerVerified: transfer.sellerOtpVerified,
            buyerVerified: transfer.buyerOtpVerified
        });
    } catch (error) {
        console.error('Verify transfer OTP error:', error);
        res.status(500).json({ error: 'Failed to verify OTP.' });
    }
});

// Reject transfer (buyer)
router.put('/:id/reject', authenticate, validateMongoId, async (req, res) => {
    try {
        const { reason } = req.body;
        const transfer = await Transfer.findById(req.params.id).populate('device');

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        if (transfer.toUser.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the buyer can reject this transfer.' });
        }

        if (transfer.status !== 'pending') {
            return res.status(400).json({ error: `Transfer is already ${transfer.status}.` });
        }

        transfer.status = 'rejected';
        transfer.rejectionReason = reason;
        transfer.respondedAt = new Date();
        await transfer.save();

        // Reset device status
        const device = await Device.findById(transfer.device._id);
        device.status = 'registered';
        await device.save();

        res.json({
            message: 'Transfer rejected.',
            transferId: transfer._id
        });
    } catch (error) {
        console.error('Reject transfer error:', error);
        res.status(500).json({ error: 'Failed to reject transfer.' });
    }
});

// Cancel transfer (seller)
router.put('/:id/cancel', authenticate, validateMongoId, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id).populate('device');

        if (!transfer) {
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        if (transfer.fromUser.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the seller can cancel this transfer.' });
        }

        if (!['pending', 'accepted'].includes(transfer.status)) {
            return res.status(400).json({ error: `Cannot cancel ${transfer.status} transfer.` });
        }

        transfer.status = 'cancelled';
        await transfer.save();

        // Reset device status
        const device = await Device.findById(transfer.device._id);
        device.status = 'registered';
        await device.save();

        res.json({
            message: 'Transfer cancelled.',
            transferId: transfer._id
        });
    } catch (error) {
        console.error('Cancel transfer error:', error);
        res.status(500).json({ error: 'Failed to cancel transfer.' });
    }
});

// Process QR code scan (quick transfer)
router.post('/qr-scan', authenticate, requireVerified, async (req, res) => {
    try {
        const { qrData } = req.body;

        const verification = verifyQRCode(qrData);
        if (!verification.valid) {
            return res.status(400).json({ error: verification.error });
        }

        const { deviceId, sellerId, token } = verification.payload;

        // Verify device and seller
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        if (device.currentOwner.toString() !== sellerId) {
            return res.status(400).json({ error: 'Invalid QR code. Seller is not the current owner.' });
        }

        // Verify QR token matches
        if (!device.qrCode || device.qrCode.data !== token) {
            return res.status(400).json({ error: 'QR code has been invalidated.' });
        }

        if (device.qrCode.expiresAt < new Date()) {
            return res.status(400).json({ error: 'QR code has expired.' });
        }

        // Cannot scan own QR
        if (sellerId === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot transfer device to yourself.' });
        }

        // Check for existing pending transfer
        let transfer = await Transfer.findOne({
            device: deviceId,
            status: 'pending',
            qrTransferToken: token
        });

        if (!transfer) {
            // Create new transfer
            transfer = new Transfer({
                device: deviceId,
                fromUser: sellerId,
                toUser: req.userId,
                transferType: 'sale',
                qrCodeUsed: true,
                qrTransferToken: token,
                status: 'pending',
                expiresAt: device.qrCode.expiresAt
            });
            await transfer.save();

            device.status = 'pending_transfer';
            await device.save();
        }

        // Get seller info
        const seller = await User.findById(sellerId);

        res.json({
            message: 'QR code verified. Review device details and confirm transfer.',
            transfer: {
                id: transfer._id,
                status: transfer.status
            },
            device: {
                id: device._id,
                deviceType: device.deviceType,
                brand: device.brand,
                model: device.model,
                identifiers: device.identifiers
            },
            seller: {
                name: seller.fullName,
                phone: seller.phoneNumber
            }
        });
    } catch (error) {
        console.error('QR scan error:', error);
        res.status(500).json({ error: 'Failed to process QR code.' });
    }
});

module.exports = router;
