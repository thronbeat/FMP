const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Device = require("../models/Device");
const Transfer = require("../models/Transfer");
const Report = require("../models/Report");
const { protect, restrictTo } = require("../middleware/auth");

// All admin routes require authentication and police/admin role
router.use(protect);
router.use(restrictTo("police", "admin"));

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Admin/Police
router.get("/stats", async (req, res) => {
    try {
        const [
            totalUsers,
            totalDevices,
            totalTransfers,
            pendingTransfers,
            lostDevices,
            stolenDevices,
            foundDevices,
            openReports
        ] = await Promise.all([
            User.countDocuments({ role: "citizen" }),
            Device.countDocuments(),
            Transfer.countDocuments({ status: "completed" }),
            Transfer.countDocuments({ status: "pending" }),
            Device.countDocuments({ status: "reported_lost" }),
            Device.countDocuments({ status: "reported_stolen" }),
            Device.countDocuments({ status: "found" }),
            Report.countDocuments({ status: "open" })
        ]);

        // Get recent activity
        const recentTransfers = await Transfer.find({ status: "completed" })
            .sort({ completedAt: -1 })
            .limit(5)
            .populate("device", "brand model")
            .populate("fromUser", "firstName lastName")
            .populate("toUser", "firstName lastName");

        const recentReports = await Report.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("device", "brand model")
            .populate("reportedBy", "firstName lastName");

        res.json({
            stats: {
                totalUsers,
                totalDevices,
                totalTransfers,
                pendingTransfers,
                lostDevices,
                stolenDevices,
                foundDevices,
                openReports
            },
            recentActivity: {
                transfers: recentTransfers,
                reports: recentReports
            }
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

// @route   GET /api/admin/devices/search
// @desc    Search all devices
// @access  Admin/Police
router.get("/devices/search", async (req, res) => {
    try {
        const { 
            identifier, 
            status, 
            deviceType, 
            brand,
            ownerPhone,
            ownerNationalId,
            page = 1, 
            limit = 20 
        } = req.query;

        let filter = {};

        // Search by identifier (IMEI, serial, MAC)
        if (identifier) {
            filter.$or = [
                { "identifiers.imei1": { $regex: identifier, $options: "i" } },
                { "identifiers.imei2": { $regex: identifier, $options: "i" } },
                { "identifiers.serialNumber": { $regex: identifier, $options: "i" } },
                { "identifiers.macAddress": { $regex: identifier, $options: "i" } }
            ];
        }

        if (status) filter.status = status;
        if (deviceType) filter.deviceType = deviceType;
        if (brand) filter.brand = { $regex: brand, $options: "i" };

        // Search by owner
        if (ownerPhone || ownerNationalId) {
            const ownerFilter = {};
            if (ownerPhone) ownerFilter.phoneNumber = ownerPhone;
            if (ownerNationalId) ownerFilter.nationalId = ownerNationalId;
            
            const owners = await User.find(ownerFilter).select("_id");
            filter.currentOwner = { $in: owners.map(o => o._id) };
        }

        const devices = await Device.find(filter)
            .populate("currentOwner", "firstName lastName phoneNumber nationalId")
            .sort({ updatedAt: -1 })
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
        console.error("Device search error:", error);
        res.status(500).json({ error: "Failed to search devices" });
    }
});

// @route   GET /api/admin/devices/:id
// @desc    Get full device details including history
// @access  Admin/Police
router.get("/devices/:id", async (req, res) => {
    try {
        const device = await Device.findById(req.params.id)
            .populate("currentOwner", "firstName lastName phoneNumber nationalId address");

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Get transfer history
        const transferHistory = await Transfer.find({
            device: device._id,
            status: "completed"
        })
        .populate("fromUser", "firstName lastName phoneNumber nationalId")
        .populate("toUser", "firstName lastName phoneNumber nationalId")
        .sort({ completedAt: -1 });

        // Get reports
        const reports = await Report.find({ device: device._id })
            .populate("reportedBy", "firstName lastName phoneNumber")
            .sort({ createdAt: -1 });

        res.json({
            device,
            transferHistory,
            reports
        });
    } catch (error) {
        console.error("Get device details error:", error);
        res.status(500).json({ error: "Failed to fetch device details" });
    }
});

// @route   GET /api/admin/devices/:id/history
// @desc    Get device ownership history
// @access  Admin/Police
router.get("/devices/:id/history", async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        const transfers = await Transfer.find({
            device: req.params.id,
            status: "completed"
        })
        .populate("fromUser", "firstName lastName phoneNumber nationalId")
        .populate("toUser", "firstName lastName phoneNumber nationalId")
        .sort({ completedAt: 1 }); // Chronological order

        // Build ownership timeline
        const timeline = transfers.map((t, index) => ({
            sequence: index + 1,
            from: t.fromUser,
            to: t.toUser,
            transferType: t.transferType,
            price: t.price,
            transferredAt: t.completedAt,
            qrCodeUsed: t.qrCodeUsed
        }));

        res.json({
            device: {
                _id: device._id,
                brand: device.brand,
                model: device.model,
                identifiers: device.identifiers,
                registeredAt: device.createdAt
            },
            currentOwner: await User.findById(device.currentOwner)
                .select("firstName lastName phoneNumber nationalId"),
            ownershipHistory: timeline,
            totalTransfers: transfers.length
        });
    } catch (error) {
        console.error("Get history error:", error);
        res.status(500).json({ error: "Failed to fetch ownership history" });
    }
});

// @route   GET /api/admin/reports
// @desc    Get all reports
// @access  Admin/Police
router.get("/reports", async (req, res) => {
    try {
        const { reportType, status, province, district, page = 1, limit = 20 } = req.query;

        let filter = {};
        if (reportType) filter.reportType = reportType;
        if (status) filter.status = status;
        if (province) filter["location.province"] = province;
        if (district) filter["location.district"] = district;

        const reports = await Report.find(filter)
            .populate("device", "brand model deviceType identifiers")
            .populate("reportedBy", "firstName lastName phoneNumber nationalId")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Report.countDocuments(filter);

        // Get summary stats
        const stats = await Report.aggregate([
            { $group: {
                _id: { type: "$reportType", status: "$status" },
                count: { $sum: 1 }
            }}
        ]);

        res.json({
            reports,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            },
            stats
        });
    } catch (error) {
        console.error("Get reports error:", error);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

// @route   PUT /api/admin/reports/:id/status
// @desc    Update report status
// @access  Admin/Police
router.put("/reports/:id/status", async (req, res) => {
    try {
        const { status, notes } = req.body;

        if (!["open", "investigating", "resolved", "closed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        report.status = status;
        if (notes) report.notes = notes;
        if (status === "resolved" || status === "closed") {
            report.resolvedAt = new Date();
            report.resolvedBy = req.user._id;
        }
        await report.save();

        // Update device status if resolving lost/stolen report
        if ((status === "resolved" || status === "closed") && 
            report.device && 
            (report.reportType === "lost" || report.reportType === "stolen")) {
            await Device.findByIdAndUpdate(report.device, { status: "registered" });
        }

        res.json({
            message: "Report status updated",
            report
        });
    } catch (error) {
        console.error("Update report status error:", error);
        res.status(500).json({ error: "Failed to update report status" });
    }
});

// @route   GET /api/admin/users
// @desc    List all users
// @access  Admin only
router.get("/users", restrictTo("admin"), async (req, res) => {
    try {
        const { role, isVerified, search, page = 1, limit = 20 } = req.query;

        let filter = {};
        if (role) filter.role = role;
        if (isVerified !== undefined) filter.isVerified = isVerified === "true";
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } },
                { nationalId: { $regex: search, $options: "i" } }
            ];
        }

        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);

        res.json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Admin only
router.put("/users/:id/role", restrictTo("admin"), async (req, res) => {
    try {
        const { role } = req.body;

        if (!["citizen", "verified_seller", "police", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User role updated", user });
    } catch (error) {
        console.error("Update user role error:", error);
        res.status(500).json({ error: "Failed to update user role" });
    }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Activate/Deactivate user
// @access  Admin only
router.put("/users/:id/status", restrictTo("admin"), async (req, res) => {
    try {
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ 
            message: `User ${isActive ? "activated" : "deactivated"}`, 
            user 
        });
    } catch (error) {
        console.error("Update user status error:", error);
        res.status(500).json({ error: "Failed to update user status" });
    }
});

// @route   POST /api/admin/verify/:deviceId
// @desc    Log a device verification check
// @access  Admin/Police
router.post("/verify/:deviceId", async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId)
            .populate("currentOwner", "firstName lastName phoneNumber nationalId");

        if (!device) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Get any reports
        const reports = await Report.find({
            device: device._id,
            status: { $in: ["open", "investigating"] }
        });

        // Log the verification (could be saved to a separate collection in production)
        console.log(`Device verification by ${req.user.firstName} ${req.user.lastName} (${req.user.role}):`, {
            deviceId: device._id,
            identifiers: device.identifiers,
            verifiedAt: new Date()
        });

        res.json({
            verified: true,
            device: {
                _id: device._id,
                deviceType: device.deviceType,
                brand: device.brand,
                model: device.model,
                identifiers: device.identifiers,
                status: device.status,
                registeredAt: device.createdAt
            },
            owner: device.currentOwner,
            activeReports: reports,
            alerts: reports.length > 0 ? 
                `WARNING: ${reports.length} active report(s) on this device` : 
                null,
            verifiedBy: {
                name: `${req.user.firstName} ${req.user.lastName}`,
                role: req.user.role,
                verifiedAt: new Date()
            }
        });
    } catch (error) {
        console.error("Verify device error:", error);
        res.status(500).json({ error: "Failed to verify device" });
    }
});

module.exports = router;
