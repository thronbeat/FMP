const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const { protect, optionalAuth } = require("../middleware/auth");
const { validate, deviceValidation, idParamValidation } = require("../middleware/validation");
const qrCodeService = require("../services/qrcode.service");

// @route   POST /api/devices
// @desc    Register a new device
// @access  Private
router.post("/", protect, deviceValidation, validate, async (req, res) => {
    try {
        const { deviceType, brand, model, identifiers, description, purchaseInfo, photos, color, notes } = req.body;

        // Check if device with same identifiers already exists
        const existingDevice = await Device.identifierExists(identifiers);
        if (existingDevice) {
            // Return info about the existing device
            const statusMessages = {
                "registered": "This device is already registered to another user.",
                "pending_transfer": "This device is currently in a transfer process.",
                "reported_lost": "This device has been reported as lost.",
                "reported_stolen": "This device has been reported as stolen. Please contact authorities.",
                "found": "This device has been reported as found."
            };

            return res.status(409).json({
                error: "Device already registered",
                message: statusMessages[existingDevice.status] || "This device already exists in the system.",
                status: existingDevice.status,
                deviceId: existingDevice._id,
                canRequestTransfer: existingDevice.status === "registered"
            });
        }

        // Validate that phone has at least one IMEI
        if (deviceType === "phone" && !identifiers.imei1) {
            return res.status(400).json({ error: "Phone devices require at least one IMEI" });
        }

        // Validate that non-phone devices have serial number
        if (deviceType !== "phone" && !identifiers.serialNumber) {
            return res.status(400).json({ error: `${deviceType} devices require a serial number` });
        }

        // Create device
        const device = new Device({
            deviceType,
            brand,
            model,
            identifiers,
            description,
            purchaseInfo,
            photos,
            color,
            notes,
            currentOwner: req.user._id,
            status: "registered"
        });

        await device.save();

        res.status(201).json({
            message: "Device registered successfully",
            device
        });
    } catch (error) {
        console.error("Device registration error:", error);
        res.status(500).json({ error: "Failed to register device" });
    }
});

// @route   GET /api/devices
// @desc    Get all devices owned by current user
// @access  Private
router.get("/", protect, async (req, res) => {
    try {
        const { status, deviceType, page = 1, limit = 10 } = req.query;
        
        const filter = { currentOwner: req.user._id };
        if (status) filter.status = status;
        if (deviceType) filter.deviceType = deviceType;

        const devices = await Device.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Device.countDocuments(filter);

        res.json({
            devices,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get devices error:", error);
        res.status(500).json({ error: "Failed to fetch devices" });
    }
});

// @route   GET /api/devices/check/:identifier
// @desc    Check if a device exists by identifier (IMEI/Serial)
// @access  Public (limited info) / Private (full info)
router.get("/check/:identifier", optionalAuth, async (req, res) => {
    try {
        const { identifier } = req.params;

        const device = await Device.findByIdentifier(identifier);
        
        if (!device) {
            return res.json({
                exists: false,
                message: "Device not found in registry. You can register it."
            });
        }

        // Public info
        const response = {
            exists: true,
            status: device.status,
            deviceType: device.deviceType,
            brand: device.brand,
            model: device.model
        };

        // Status-specific messages
        const statusMessages = {
            "registered": "This device is registered.",
            "pending_transfer": "This device has a pending transfer.",
            "reported_lost": "WARNING: This device has been reported as LOST.",
            "reported_stolen": "WARNING: This device has been reported as STOLEN.",
            "found": "This device has been reported as found."
        };
        response.message = statusMessages[device.status];

        // If authenticated user is the owner, show full details
        if (req.user && device.currentOwner.toString() === req.user._id.toString()) {
            response.isOwner = true;
            response.device = device;
        }

        res.json(response);
    } catch (error) {
        console.error("Check device error:", error);
        res.status(500).json({ error: "Failed to check device" });
    }
});

// @route   GET /api/devices/:id
// @desc    Get device by ID
// @access  Private (owner only)
router.get("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id)
            .populate("currentOwner", "firstName lastName phoneNumber");

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check ownership
        if (device.currentOwner._id.toString() !== req.user._id.toString() && 
            !["police", "admin"].includes(req.user.role)) {
            return res.status(403).json({ error: "Not authorized to view this device" });
        }

        res.json({ device });
    } catch (error) {
        console.error("Get device error:", error);
        res.status(500).json({ error: "Failed to fetch device" });
    }
});

// @route   PUT /api/devices/:id
// @desc    Update device info
// @access  Private (owner only)
router.put("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check ownership
        if (device.currentOwner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to update this device" });
        }

        // Fields that can be updated
        const allowedUpdates = ["description", "purchaseInfo", "photos", "color", "notes"];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const updatedDevice = await Device.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        res.json({
            message: "Device updated successfully",
            device: updatedDevice
        });
    } catch (error) {
        console.error("Update device error:", error);
        res.status(500).json({ error: "Failed to update device" });
    }
});

// @route   POST /api/devices/:id/qr-code
// @desc    Generate transfer QR code for device
// @access  Private (owner only)
router.post("/:id/qr-code", protect, idParamValidation, validate, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check ownership
        if (device.currentOwner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to generate QR for this device" });
        }

        // Check if device can be transferred
        if (!["registered"].includes(device.status)) {
            return res.status(400).json({ 
                error: `Cannot generate transfer QR. Device status: ${device.status}` 
            });
        }

        const { expiryMinutes } = req.body;
        
        // Generate QR code
        const qrResult = await qrCodeService.generateTransferQR({
            deviceId: device._id,
            sellerId: req.user._id,
            expiryMinutes
        });

        // Save QR data to device
        device.qrCode = {
            data: qrResult.data,
            generatedAt: new Date(),
            expiresAt: qrResult.expiresAt
        };
        await device.save();

        res.json({
            message: "QR code generated successfully",
            qrCode: qrResult.dataUrl,
            expiresAt: qrResult.expiresAt
        });
    } catch (error) {
        console.error("Generate QR error:", error);
        res.status(500).json({ error: "Failed to generate QR code" });
    }
});

// @route   DELETE /api/devices/:id
// @desc    Remove device (soft delete - mark as inactive)
// @access  Private (owner only)
router.delete("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Check ownership
        if (device.currentOwner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to delete this device" });
        }

        // Don't actually delete, just remove owner reference
        // This keeps the device in the system for historical purposes
        await Device.findByIdAndDelete(req.params.id);

        res.json({ message: "Device removed successfully" });
    } catch (error) {
        console.error("Delete device error:", error);
        res.status(500).json({ error: "Failed to remove device" });
    }
});

module.exports = router;
