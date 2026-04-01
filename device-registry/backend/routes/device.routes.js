const express = require('express');
const Device = require('../models/Device');
const Report = require('../models/Report');
const { authenticate, requireVerified, optionalAuth } = require('../middleware/auth');
const { validateDeviceRegistration, validateMongoId } = require('../middleware/validation');
const { generateDeviceInfoQR, generateTransferQR } = require('../services/qrcode.service');
const { sendRegistrationConfirmation } = require('../services/sms.service');

const router = express.Router();

// Register a new device
router.post('/', authenticate, requireVerified, validateDeviceRegistration, async (req, res) => {
    try {
        const { deviceType, brand, model, identifiers, description, color, purchaseInfo, photos } = req.body;

        // Validate that phone has IMEI
        if (deviceType === 'phone' && !identifiers?.imei1) {
            return res.status(400).json({ error: 'IMEI is required for phone registration.' });
        }

        // Validate that non-phone has serial number
        if (deviceType !== 'phone' && !identifiers?.serialNumber) {
            return res.status(400).json({ error: 'Serial number is required for this device type.' });
        }

        // Check if device already exists
        const existingDevice = await Device.findByIdentifier(
            identifiers?.imei1 || identifiers?.serialNumber
        );

        if (existingDevice) {
            // Check if device is reported lost/stolen
            if (['reported_lost', 'reported_stolen'].includes(existingDevice.status)) {
                return res.status(403).json({
                    error: 'This device has been reported as lost or stolen.',
                    status: existingDevice.status,
                    action: 'contact_authorities'
                });
            }

            // Device belongs to another user
            if (existingDevice.currentOwner.toString() !== req.userId.toString()) {
                return res.status(409).json({
                    error: 'This device is already registered to another user.',
                    action: 'request_transfer',
                    deviceId: existingDevice._id
                });
            }

            return res.status(400).json({ error: 'You have already registered this device.' });
        }

        // Create new device
        const device = new Device({
            deviceType,
            brand,
            model,
            identifiers,
            description,
            color,
            purchaseInfo,
            photos,
            currentOwner: req.userId
        });

        await device.save();

        // Send confirmation SMS
        await sendRegistrationConfirmation(req.user.phoneNumber, `${brand} ${model}`);

        res.status(201).json({
            message: 'Device registered successfully.',
            device: {
                id: device._id,
                deviceType: device.deviceType,
                brand: device.brand,
                model: device.model,
                status: device.status,
                createdAt: device.createdAt
            }
        });
    } catch (error) {
        console.error('Device registration error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'A device with this identifier already exists.' });
        }
        res.status(500).json({ error: 'Failed to register device.' });
    }
});

// Get all devices for current user
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, deviceType, page = 1, limit = 10 } = req.query;
        const query = { currentOwner: req.userId };

        if (status) query.status = status;
        if (deviceType) query.deviceType = deviceType;

        const devices = await Device.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Device.countDocuments(query);

        res.json({
            devices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices.' });
    }
});

// Get single device by ID
router.get('/:id', authenticate, validateMongoId, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id)
            .populate('currentOwner', 'firstName lastName phoneNumber');

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        // Check ownership or admin access
        const isOwner = device.currentOwner._id.toString() === req.userId.toString();
        const isAdmin = ['admin', 'police'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        res.json({ device });
    } catch (error) {
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Failed to fetch device.' });
    }
});

// Update device info
router.put('/:id', authenticate, validateMongoId, async (req, res) => {
    try {
        const { description, color, photos, purchaseInfo } = req.body;

        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        if (device.currentOwner.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Only allow updating non-critical fields
        if (description) device.description = description;
        if (color) device.color = color;
        if (photos) device.photos = photos;
        if (purchaseInfo) {
            device.purchaseInfo = { ...device.purchaseInfo, ...purchaseInfo };
        }

        await device.save();

        res.json({
            message: 'Device updated successfully.',
            device
        });
    } catch (error) {
        console.error('Update device error:', error);
        res.status(500).json({ error: 'Failed to update device.' });
    }
});

// Check if device exists by identifier (public)
router.get('/check/:identifier', optionalAuth, async (req, res) => {
    try {
        const { identifier } = req.params;

        const device = await Device.findByIdentifier(identifier);

        if (!device) {
            return res.json({
                exists: false,
                message: 'Device not found in registry.'
            });
        }

        // Check for matching lost/found reports
        const reports = await Report.find({
            $or: [
                { device: device._id, reportType: { $in: ['lost', 'stolen'] }, status: 'open' },
                { 'unregisteredDevice.identifier': identifier, status: 'open' }
            ]
        });

        const response = {
            exists: true,
            status: device.status,
            deviceType: device.deviceType,
            brand: device.brand,
            model: device.model,
            hasActiveReport: reports.length > 0
        };

        // If user is logged in and is the owner, show more details
        if (req.user && device.currentOwner.toString() === req.userId.toString()) {
            response.isOwner = true;
            response.deviceId = device._id;
        }

        if (['reported_lost', 'reported_stolen'].includes(device.status)) {
            response.warning = 'This device has been reported as lost or stolen.';
        }

        res.json(response);
    } catch (error) {
        console.error('Check device error:', error);
        res.status(500).json({ error: 'Failed to check device.' });
    }
});

// Generate QR code for transfer
router.post('/:id/qr-code', authenticate, requireVerified, validateMongoId, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        if (device.currentOwner.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the device owner can generate transfer QR.' });
        }

        if (!device.isTransferable()) {
            return res.status(400).json({
                error: 'Device cannot be transferred in current status.',
                status: device.status
            });
        }

        const qrData = await generateTransferQR(device._id, req.userId);

        // Save QR data to device
        device.qrCode = {
            data: qrData.token,
            generatedAt: new Date(),
            expiresAt: qrData.expiresAt
        };
        await device.save();

        res.json({
            message: 'Transfer QR code generated.',
            qrCode: qrData.qrCode,
            expiresAt: qrData.expiresAt,
            expiresInMinutes: 15
        });
    } catch (error) {
        console.error('Generate QR error:', error);
        res.status(500).json({ error: 'Failed to generate QR code.' });
    }
});

// Get device verification QR (for display purposes)
router.get('/:id/verification-qr', authenticate, validateMongoId, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        if (device.currentOwner.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const qrData = await generateDeviceInfoQR(device._id);

        res.json({
            qrCode: qrData.qrCode,
            verificationUrl: qrData.url
        });
    } catch (error) {
        console.error('Verification QR error:', error);
        res.status(500).json({ error: 'Failed to generate verification QR.' });
    }
});

module.exports = router;
