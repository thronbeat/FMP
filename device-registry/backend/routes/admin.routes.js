const express = require('express');
const Device = require('../models/Device');
const User = require('../models/User');
const Transfer = require('../models/Transfer');
const Report = require('../models/Report');
const { authenticate, authorize } = require('../middleware/auth');
const { validateMongoId } = require('../middleware/validation');

const router = express.Router();

// All admin routes require authentication and admin/police role
router.use(authenticate);
router.use(authorize('admin', 'police'));

// Dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers,
            totalDevices,
            totalTransfers,
            pendingTransfers,
            openReports,
            lostDevices,
            stolenDevices
        ] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Device.countDocuments(),
            Transfer.countDocuments({ status: 'completed' }),
            Transfer.countDocuments({ status: 'pending' }),
            Report.countDocuments({ status: 'open' }),
            Device.countDocuments({ status: 'reported_lost' }),
            Device.countDocuments({ status: 'reported_stolen' })
        ]);

        // Recent activity
        const recentRegistrations = await Device.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('currentOwner', 'firstName lastName');

        const recentReports = await Report.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('reportedBy', 'firstName lastName');

        res.json({
            stats: {
                totalUsers,
                totalDevices,
                totalTransfers,
                pendingTransfers,
                openReports,
                lostDevices,
                stolenDevices
            },
            recentActivity: {
                registrations: recentRegistrations,
                reports: recentReports
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics.' });
    }
});

// Search devices
router.get('/devices/search', async (req, res) => {
    try {
        const { q, status, deviceType, page = 1, limit = 20 } = req.query;
        const query = {};

        if (q) {
            query.$or = [
                { 'identifiers.imei1': { $regex: q, $options: 'i' } },
                { 'identifiers.imei2': { $regex: q, $options: 'i' } },
                { 'identifiers.serialNumber': { $regex: q, $options: 'i' } },
                { brand: { $regex: q, $options: 'i' } },
                { model: { $regex: q, $options: 'i' } }
            ];
        }

        if (status) query.status = status;
        if (deviceType) query.deviceType = deviceType;

        const devices = await Device.find(query)
            .populate('currentOwner', 'firstName lastName phoneNumber nationalId')
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
        console.error('Search devices error:', error);
        res.status(500).json({ error: 'Failed to search devices.' });
    }
});

// Get device ownership history
router.get('/devices/:id/history', validateMongoId, async (req, res) => {
    try {
        const device = await Device.findById(req.params.id)
            .populate('currentOwner', 'firstName lastName phoneNumber nationalId');

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        // Get all transfers for this device
        const transfers = await Transfer.find({ device: req.params.id })
            .populate('fromUser', 'firstName lastName phoneNumber nationalId')
            .populate('toUser', 'firstName lastName phoneNumber nationalId')
            .sort({ createdAt: 1 });

        // Get all reports for this device
        const reports = await Report.find({ device: req.params.id })
            .populate('reportedBy', 'firstName lastName phoneNumber')
            .sort({ createdAt: -1 });

        res.json({
            device,
            ownershipHistory: transfers,
            reports
        });
    } catch (error) {
        console.error('Get device history error:', error);
        res.status(500).json({ error: 'Failed to fetch device history.' });
    }
});

// Get all reports
router.get('/reports', async (req, res) => {
    try {
        const { reportType, status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (reportType) query.reportType = reportType;
        if (status) query.status = status;

        const reports = await Report.find(query)
            .populate('device', 'brand model deviceType identifiers')
            .populate('reportedBy', 'firstName lastName phoneNumber')
            .populate('assignedOfficer', 'firstName lastName')
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

// Update report status
router.put('/reports/:id/status', validateMongoId, async (req, res) => {
    try {
        const { status, notes, assignedOfficer } = req.body;

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        if (status) report.status = status;
        if (assignedOfficer) report.assignedOfficer = assignedOfficer;
        
        report.addTimelineEntry(`Status changed to ${status}`, req.userId, notes);
        await report.save();

        res.json({
            message: 'Report status updated.',
            report
        });
    } catch (error) {
        console.error('Update report status error:', error);
        res.status(500).json({ error: 'Failed to update report.' });
    }
});

// Resolve report
router.put('/reports/:id/resolve', validateMongoId, async (req, res) => {
    try {
        const { resolutionType, notes } = req.body;

        const report = await Report.findById(req.params.id).populate('device');
        if (!report) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        report.status = 'resolved';
        report.resolution = {
            type: resolutionType,
            resolvedAt: new Date(),
            resolvedBy: req.userId,
            notes
        };
        report.addTimelineEntry(`Resolved: ${resolutionType}`, req.userId, notes);
        await report.save();

        // Update device status if applicable
        if (report.device && ['recovered', 'returned_to_owner', 'claimed_by_owner'].includes(resolutionType)) {
            const device = await Device.findById(report.device._id);
            if (device) {
                device.status = 'registered';
                await device.save();
            }
        }

        res.json({
            message: 'Report resolved.',
            report
        });
    } catch (error) {
        console.error('Resolve report error:', error);
        res.status(500).json({ error: 'Failed to resolve report.' });
    }
});

// Search users
router.get('/users', async (req, res) => {
    try {
        const { q, role, page = 1, limit = 20 } = req.query;
        const query = {};

        if (q) {
            query.$or = [
                { firstName: { $regex: q, $options: 'i' } },
                { lastName: { $regex: q, $options: 'i' } },
                { phoneNumber: { $regex: q, $options: 'i' } },
                { nationalId: { $regex: q, $options: 'i' } }
            ];
        }

        if (role) query.role = role;

        const users = await User.find(query)
            .select('-password -refreshToken')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// Get user details with their devices
router.get('/users/:id', validateMongoId, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -refreshToken');
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const devices = await Device.find({ currentOwner: req.params.id });
        const transfers = await Transfer.find({
            $or: [{ fromUser: req.params.id }, { toUser: req.params.id }]
        }).limit(10).sort({ createdAt: -1 });
        const reports = await Report.find({ reportedBy: req.params.id }).limit(10);

        res.json({
            user,
            devices,
            recentTransfers: transfers,
            reports
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details.' });
    }
});

// Update user role (admin only)
router.put('/users/:id/role', authorize('admin'), validateMongoId, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['citizen', 'verified_seller', 'police', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            message: 'User role updated.',
            user
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});

// Deactivate/activate user (admin only)
router.put('/users/:id/status', authorize('admin'), validateMongoId, async (req, res) => {
    try {
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            message: `User ${isActive ? 'activated' : 'deactivated'}.`,
            user
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Failed to update user status.' });
    }
});

// Log device verification (for audit trail)
router.post('/verify/:deviceId', validateMongoId, async (req, res) => {
    try {
        const { verificationType, notes } = req.body;

        const device = await Device.findById(req.params.deviceId)
            .populate('currentOwner', 'firstName lastName phoneNumber nationalId');

        if (!device) {
            return res.status(404).json({ error: 'Device not found.' });
        }

        // In production, you'd log this to a separate verification log collection
        console.log(`[VERIFICATION] Device: ${device._id}, Type: ${verificationType}, Officer: ${req.userId}, Notes: ${notes}`);

        res.json({
            message: 'Verification logged.',
            device,
            verificationResult: {
                status: device.status,
                owner: device.currentOwner,
                registeredAt: device.createdAt,
                hasActiveReports: ['reported_lost', 'reported_stolen'].includes(device.status)
            }
        });
    } catch (error) {
        console.error('Verify device error:', error);
        res.status(500).json({ error: 'Failed to verify device.' });
    }
});

module.exports = router;
