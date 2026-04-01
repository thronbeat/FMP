const express = require('express');
const Report = require('../models/Report');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validateReport, validateMongoId } = require('../middleware/validation');
const { sendDeviceFoundAlert } = require('../services/sms.service');

const router = express.Router();

// Create a report (lost, stolen, or found)
router.post('/', authenticate, requireVerified, validateReport, async (req, res) => {
    try {
        const { reportType, deviceId, unregisteredDevice, location, incidentDate, notes, policeReference, photos } = req.body;

        let device = null;

        if (deviceId) {
            device = await Device.findById(deviceId);
            if (!device) {
                return res.status(404).json({ error: 'Device not found.' });
            }

            // For lost/stolen, must be the owner
            if (['lost', 'stolen'].includes(reportType)) {
                if (device.currentOwner.toString() !== req.userId.toString()) {
                    return res.status(403).json({ error: 'You can only report your own devices as lost/stolen.' });
                }

                // Check if already reported
                const existingReport = await Report.findOne({
                    device: deviceId,
                    reportType: { $in: ['lost', 'stolen'] },
                    status: { $in: ['open', 'investigating'] }
                });

                if (existingReport) {
                    return res.status(400).json({
                        error: 'This device already has an active lost/stolen report.',
                        reportId: existingReport._id
                    });
                }
            }
        }

        // For found reports without deviceId, require unregisteredDevice info
        if (reportType === 'found' && !deviceId && !unregisteredDevice?.identifier) {
            return res.status(400).json({
                error: 'For found devices, please provide either a device ID or device identifier (IMEI/serial number).'
            });
        }

        // Create the report
        const report = new Report({
            device: deviceId || null,
            reportType,
            reportedBy: req.userId,
            unregisteredDevice: !deviceId ? unregisteredDevice : undefined,
            location,
            incidentDate: incidentDate || new Date(),
            notes,
            policeReference,
            photos
        });

        report.addTimelineEntry('Report created', req.userId);
        await report.save();

        // Update device status if applicable
        if (device && ['lost', 'stolen'].includes(reportType)) {
            device.status = reportType === 'lost' ? 'reported_lost' : 'reported_stolen';
            await device.save();
        }

        // If reporting found device, check if it matches any lost/stolen reports
        if (reportType === 'found') {
            const identifier = unregisteredDevice?.identifier || device?.identifiers?.imei1 || device?.identifiers?.serialNumber;
            
            if (identifier) {
                // Check if device exists in system
                const matchedDevice = await Device.findByIdentifier(identifier);
                
                if (matchedDevice && ['reported_lost', 'reported_stolen'].includes(matchedDevice.status)) {
                    // Notify the owner
                    const owner = await User.findById(matchedDevice.currentOwner);
                    if (owner) {
                        await sendDeviceFoundAlert(owner.phoneNumber, `${matchedDevice.brand} ${matchedDevice.model}`);
                        
                        report.addTimelineEntry('Owner notified - device matches lost/stolen report', req.userId);
                        report.device = matchedDevice._id;
                        await report.save();
                    }
                }
            }
        }

        res.status(201).json({
            message: 'Report submitted successfully.',
            report: {
                id: report._id,
                reportType: report.reportType,
                status: report.status,
                createdAt: report.createdAt
            }
        });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ error: 'Failed to submit report.' });
    }
});

// Get user's reports
router.get('/', authenticate, async (req, res) => {
    try {
        const { reportType, status, page = 1, limit = 10 } = req.query;
        const query = { reportedBy: req.userId };

        if (reportType) query.reportType = reportType;
        if (status) query.status = status;

        const reports = await Report.find(query)
            .populate('device', 'brand model deviceType identifiers')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Report.countDocuments(query);

        res.json({
            reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports.' });
    }
});

// Get single report
router.get('/:id', authenticate, validateMongoId, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate('device')
            .populate('reportedBy', 'firstName lastName phoneNumber')
            .populate('assignedOfficer', 'firstName lastName');

        if (!report) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        // Check access
        const isReporter = report.reportedBy._id.toString() === req.userId.toString();
        const isAdmin = ['admin', 'police'].includes(req.user.role);

        if (!isReporter && !isAdmin) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        res.json({ report });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to fetch report.' });
    }
});

// Update report
router.put('/:id', authenticate, validateMongoId, async (req, res) => {
    try {
        const { location, notes, policeReference, photos } = req.body;

        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        if (report.reportedBy.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        if (['resolved', 'closed'].includes(report.status)) {
            return res.status(400).json({ error: 'Cannot update a resolved or closed report.' });
        }

        if (location) report.location = { ...report.location, ...location };
        if (notes) report.notes = notes;
        if (policeReference) report.policeReference = policeReference;
        if (photos) report.photos = [...report.photos, ...photos];

        report.addTimelineEntry('Report updated', req.userId);
        await report.save();

        res.json({
            message: 'Report updated successfully.',
            report
        });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Failed to update report.' });
    }
});

// Mark own device as found (resolve lost report)
router.put('/:id/found', authenticate, validateMongoId, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id).populate('device');

        if (!report) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        if (report.reportedBy.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the reporter can mark as found.' });
        }

        if (!['lost', 'stolen'].includes(report.reportType)) {
            return res.status(400).json({ error: 'Only lost/stolen reports can be marked as found.' });
        }

        if (report.status === 'resolved') {
            return res.status(400).json({ error: 'Report is already resolved.' });
        }

        report.status = 'resolved';
        report.resolution = {
            type: 'recovered',
            resolvedAt: new Date(),
            resolvedBy: req.userId,
            notes: req.body.notes || 'Device recovered by owner'
        };
        report.addTimelineEntry('Marked as found by owner', req.userId);
        await report.save();

        // Update device status
        if (report.device) {
            const device = await Device.findById(report.device._id);
            device.status = 'registered';
            await device.save();
        }

        res.json({
            message: 'Device marked as found. Report resolved.',
            report
        });
    } catch (error) {
        console.error('Mark found error:', error);
        res.status(500).json({ error: 'Failed to update report.' });
    }
});

// Get found devices that might match user's lost devices
router.get('/matching/found', authenticate, async (req, res) => {
    try {
        // Get user's lost/stolen devices
        const userDevices = await Device.find({
            currentOwner: req.userId,
            status: { $in: ['reported_lost', 'reported_stolen'] }
        });

        if (userDevices.length === 0) {
            return res.json({ matches: [] });
        }

        // Get identifiers
        const identifiers = userDevices.flatMap(d => [
            d.identifiers.imei1,
            d.identifiers.imei2,
            d.identifiers.serialNumber
        ]).filter(Boolean);

        // Find matching found reports
        const matches = await Report.find({
            reportType: 'found',
            status: { $in: ['open', 'investigating'] },
            $or: [
                { device: { $in: userDevices.map(d => d._id) } },
                { 'unregisteredDevice.identifier': { $in: identifiers } }
            ]
        }).populate('reportedBy', 'firstName lastName phoneNumber');

        res.json({ matches });
    } catch (error) {
        console.error('Get matching found error:', error);
        res.status(500).json({ error: 'Failed to fetch matching reports.' });
    }
});

module.exports = router;
