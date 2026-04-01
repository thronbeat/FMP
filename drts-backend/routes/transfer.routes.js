const express = require("express");
const router = express.Router();
const Transfer = require("../models/Transfer");
const Device = require("../models/Device");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { validate, transferValidation, idParamValidation, otpValidation } = require("../middleware/validation");
const smsService = require("../services/sms.service");
const qrCodeService = require("../services/qrcode.service");

// @route   POST /api/transfers
// @desc    Initiate a device transfer
// @access  Private
router.post("/", protect, transferValidation, validate, async (req, res) => {
    try {
        const { deviceId, toUserPhone, transferType, price, notes } = req.body;

        // Find the device
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check ownership
        if (device.currentOwner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "You can only transfer devices you own" });
        }

        // Check if device can be transferred
        if (device.status !== "registered") {
            return res.status(400).json({ 
                error: `Cannot transfer device. Current status: ${device.status}` 
            });
        }

        // Check for pending transfers
        const pendingTransfer = await Transfer.findOne({
            device: deviceId,
            status: "pending"
        });
        if (pendingTransfer) {
            return res.status(400).json({ 
                error: "This device already has a pending transfer",
                transferId: pendingTransfer._id
            });
        }

        // Find buyer by phone number
        let buyer = await User.findOne({ phoneNumber: toUserPhone });
        
        if (!buyer) {
            // Send invitation to unregistered user
            await smsService.sendInvitation(toUserPhone, `${req.user.firstName} ${req.user.lastName}`);
            return res.status(404).json({
                error: "Buyer not registered",
                message: "The buyer is not registered. An invitation has been sent to register.",
                invitationSent: true
            });
        }

        // Cannot transfer to yourself
        if (buyer._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: "Cannot transfer device to yourself" });
        }

        // Create transfer request
        const transfer = new Transfer({
            device: deviceId,
            fromUser: req.user._id,
            toUser: buyer._id,
            transferType: transferType || "sale",
            price,
            notes,
            status: "pending"
        });

        await transfer.save();

        // Update device status
        device.status = "pending_transfer";
        await device.save();

        // Notify buyer via SMS
        await smsService.sendTransferNotification(
            buyer.phoneNumber,
            `${req.user.firstName} ${req.user.lastName}`,
            `${device.brand} ${device.model}`
        );

        res.status(201).json({
            message: "Transfer request created. Waiting for buyer to accept.",
            transfer: await Transfer.findById(transfer._id)
                .populate("device", "brand model deviceType")
                .populate("toUser", "firstName lastName phoneNumber")
        });
    } catch (error) {
        console.error("Create transfer error:", error);
        res.status(500).json({ error: "Failed to create transfer" });
    }
});

// @route   GET /api/transfers
// @desc    Get all transfers for current user
// @access  Private
router.get("/", protect, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 10 } = req.query;

        let filter = {
            $or: [
                { fromUser: req.user._id },
                { toUser: req.user._id }
            ]
        };

        if (type === "outgoing") {
            filter = { fromUser: req.user._id };
        } else if (type === "incoming") {
            filter = { toUser: req.user._id };
        }

        if (status) {
            filter.status = status;
        }

        const transfers = await Transfer.find(filter)
            .populate("device", "brand model deviceType identifiers")
            .populate("fromUser", "firstName lastName phoneNumber")
            .populate("toUser", "firstName lastName phoneNumber")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Transfer.countDocuments(filter);

        res.json({
            transfers,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get transfers error:", error);
        res.status(500).json({ error: "Failed to fetch transfers" });
    }
});

// @route   GET /api/transfers/:id
// @desc    Get transfer by ID
// @access  Private
router.get("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id)
            .populate("device")
            .populate("fromUser", "firstName lastName phoneNumber")
            .populate("toUser", "firstName lastName phoneNumber");

        if (!transfer) {
            return res.status(404).json({ error: "Transfer not found" });
        }

        // Check authorization
        const isParty = transfer.fromUser._id.toString() === req.user._id.toString() ||
                        transfer.toUser._id.toString() === req.user._id.toString();
        const isAdmin = ["police", "admin"].includes(req.user.role);

        if (!isParty && !isAdmin) {
            return res.status(403).json({ error: "Not authorized to view this transfer" });
        }

        res.json({ transfer });
    } catch (error) {
        console.error("Get transfer error:", error);
        res.status(500).json({ error: "Failed to fetch transfer" });
    }
});

// @route   PUT /api/transfers/:id/accept
// @desc    Accept a transfer (buyer)
// @access  Private
router.put("/:id/accept", protect, idParamValidation, validate, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id)
            .populate("device")
            .populate("fromUser", "firstName lastName phoneNumber");

        if (!transfer) {
            return res.status(404).json({ error: "Transfer not found" });
        }

        // Check if user is the buyer
        if (transfer.toUser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the buyer can accept this transfer" });
        }

        // Check status
        if (transfer.status !== "pending") {
            return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
        }

        // Check if expired
        if (transfer.isExpired()) {
            transfer.status = "expired";
            await transfer.save();
            
            // Reset device status
            await Device.findByIdAndUpdate(transfer.device._id, { status: "registered" });
            
            return res.status(400).json({ error: "Transfer has expired" });
        }

        // Mark buyer as verified and complete transfer
        transfer.buyerOtpVerified = true;
        await transfer.complete();

        // Notify both parties
        await smsService.sendTransferComplete(
            req.user.phoneNumber,
            `${transfer.device.brand} ${transfer.device.model}`,
            true
        );
        await smsService.sendTransferComplete(
            transfer.fromUser.phoneNumber,
            `${transfer.device.brand} ${transfer.device.model}`,
            false
        );

        res.json({
            message: "Transfer accepted successfully",
            transfer: await Transfer.findById(transfer._id)
                .populate("device")
                .populate("fromUser", "firstName lastName")
                .populate("toUser", "firstName lastName")
        });
    } catch (error) {
        console.error("Accept transfer error:", error);
        res.status(500).json({ error: "Failed to accept transfer" });
    }
});

// @route   PUT /api/transfers/:id/reject
// @desc    Reject a transfer (buyer)
// @access  Private
router.put("/:id/reject", protect, idParamValidation, validate, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id);

        if (!transfer) {
            return res.status(404).json({ error: "Transfer not found" });
        }

        // Check if user is the buyer
        if (transfer.toUser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the buyer can reject this transfer" });
        }

        // Check status
        if (transfer.status !== "pending") {
            return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
        }

        transfer.status = "rejected";
        transfer.notes = req.body.reason || transfer.notes;
        await transfer.save();

        // Reset device status
        await Device.findByIdAndUpdate(transfer.device, { status: "registered" });

        res.json({
            message: "Transfer rejected",
            transfer
        });
    } catch (error) {
        console.error("Reject transfer error:", error);
        res.status(500).json({ error: "Failed to reject transfer" });
    }
});

// @route   PUT /api/transfers/:id/cancel
// @desc    Cancel a transfer (seller)
// @access  Private
router.put("/:id/cancel", protect, idParamValidation, validate, async (req, res) => {
    try {
        const transfer = await Transfer.findById(req.params.id);

        if (!transfer) {
            return res.status(404).json({ error: "Transfer not found" });
        }

        // Check if user is the seller
        if (transfer.fromUser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the seller can cancel this transfer" });
        }

        // Check status
        if (transfer.status !== "pending") {
            return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
        }

        transfer.status = "cancelled";
        transfer.notes = req.body.reason || transfer.notes;
        await transfer.save();

        // Reset device status
        await Device.findByIdAndUpdate(transfer.device, { status: "registered" });

        res.json({
            message: "Transfer cancelled",
            transfer
        });
    } catch (error) {
        console.error("Cancel transfer error:", error);
        res.status(500).json({ error: "Failed to cancel transfer" });
    }
});

// @route   POST /api/transfers/qr-scan
// @desc    Process QR code transfer (instant transfer)
// @access  Private
router.post("/qr-scan", protect, async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({ error: "QR code data is required" });
        }

        // Verify QR code
        const qrResult = qrCodeService.verifyTransferQR(qrData);
        if (!qrResult.valid) {
            return res.status(400).json({ error: qrResult.error });
        }

        const { deviceId, sellerId } = qrResult.data;

        // Cannot scan your own QR
        if (sellerId === req.user._id.toString()) {
            return res.status(400).json({ error: "Cannot transfer device to yourself" });
        }

        // Get device and verify
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Verify seller still owns the device
        if (device.currentOwner.toString() !== sellerId) {
            return res.status(400).json({ error: "QR code is no longer valid. Device ownership has changed." });
        }

        // Check device status
        if (device.status !== "registered") {
            return res.status(400).json({ error: `Cannot transfer device. Status: ${device.status}` });
        }

        // Create and complete transfer instantly
        const transfer = new Transfer({
            device: deviceId,
            fromUser: sellerId,
            toUser: req.user._id,
            transferType: "sale",
            status: "pending",
            qrCodeUsed: true,
            sellerOtpVerified: true,
            buyerOtpVerified: true
        });

        await transfer.save();
        await transfer.complete();

        // Clear QR code from device
        device.qrCode = undefined;
        await device.save();

        // Get seller info for notification
        const seller = await User.findById(sellerId);

        // Notify both parties
        await smsService.sendTransferComplete(
            req.user.phoneNumber,
            `${device.brand} ${device.model}`,
            true
        );
        if (seller) {
            await smsService.sendTransferComplete(
                seller.phoneNumber,
                `${device.brand} ${device.model}`,
                false
            );
        }

        res.json({
            message: "QR transfer completed successfully",
            transfer: await Transfer.findById(transfer._id)
                .populate("device", "brand model deviceType")
                .populate("fromUser", "firstName lastName")
                .populate("toUser", "firstName lastName")
        });
    } catch (error) {
        console.error("QR scan transfer error:", error);
        res.status(500).json({ error: "Failed to process QR transfer" });
    }
});

// @route   GET /api/transfers/device/:deviceId/history
// @desc    Get transfer history for a device
// @access  Private (owner or admin)
router.get("/device/:deviceId/history", protect, async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check authorization
        const isOwner = device.currentOwner.toString() === req.user._id.toString();
        const isAdmin = ["police", "admin"].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: "Not authorized to view transfer history" });
        }

        const transfers = await Transfer.find({
            device: req.params.deviceId,
            status: "completed"
        })
        .populate("fromUser", "firstName lastName")
        .populate("toUser", "firstName lastName")
        .sort({ completedAt: -1 });

        res.json({ transfers });
    } catch (error) {
        console.error("Get transfer history error:", error);
        res.status(500).json({ error: "Failed to fetch transfer history" });
    }
});

module.exports = router;
