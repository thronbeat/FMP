const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const Device = require("../models/Device");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { validate, reportValidation, idParamValidation } = require("../middleware/validation");
const smsService = require("../services/sms.service");

// @route   POST /api/reports
// @desc    Create a lost/stolen/found report
// @access  Private
router.post("/", protect, reportValidation, validate, async (req, res) => {
    try {
        const { 
            reportType, 
            deviceId, 
            deviceIdentifier, 
            deviceDescription,
            location, 
            incidentDate,
            policeReference,
            policeStation,
            notes 
        } = req.body;

        let device = null;
        let existingOwner = null;

        // If deviceId provided, verify ownership for lost/stolen reports
        if (deviceId) {
            device = await Device.findById(deviceId).populate("currentOwner");
            if (!device) {
                return res.status(404).json({ error: "Device not found" });
            }

            if (reportType === "lost" || reportType === "stolen") {
                // Only owner can report their device as lost/stolen
                if (device.currentOwner._id.toString() !== req.user._id.toString()) {
                    return res.status(403).json({ 
                        error: "You can only report your own devices as lost or stolen" 
                    });
                }

                // Check if already reported
                if (device.status === "reported_lost" || device.status === "reported_stolen") {
                    return res.status(400).json({ 
                        error: `Device already reported as ${device.status.replace("reported_", "")}` 
                    });
                }
            } else if (reportType === "found") {
                // For found devices, get owner info
                existingOwner = device.currentOwner;
            }
        } else if (deviceIdentifier) {
            // Check if device exists by identifier
            device = await Device.findByIdentifier(deviceIdentifier);
            if (device) {
                existingOwner = await User.findById(device.currentOwner);
            }
        }

        // Create report
        const report = new Report({
            device: device ? device._id : null,
            reportType,
            reportedBy: req.user._id,
            deviceIdentifier: deviceIdentifier || (device ? device.identifiers.imei1 || device.identifiers.serialNumber : null),
            deviceDescription,
            location,
            incidentDate: incidentDate || new Date(),
            policeReference,
            policeStation,
            notes,
            contactInfo: {
                phone: req.user.phoneNumber,
                email: req.user.email
            }
        });

        await report.save();

        // If found device and we have the owner, notify them
        if (reportType === "found" && existingOwner && 
            (device?.status === "reported_lost" || device?.status === "reported_stolen")) {
            await smsService.sendFoundDeviceAlert(
                existingOwner.phoneNumber,
                `${device.brand} ${device.model}`,
                `${req.user.firstName} ${req.user.lastName}`
            );
        }

        // Look for matching reports
        let matches = [];
        if (reportType === "found" && deviceIdentifier) {
            matches = await Report.find({
                reportType: { $in: ["lost", "stolen"] },
                status: { $in: ["open", "investigating"] },
                $or: [
                    { deviceIdentifier: deviceIdentifier },
                    { device: device?._id }
                ]
            }).populate("reportedBy", "firstName lastName phoneNumber");
        } else if ((reportType === "lost" || reportType === "stolen") && device) {
            matches = await Report.find({
                reportType: "found",
                status: { $in: ["open", "investigating"] },
                $or: [
                    { deviceIdentifier: device.identifiers.imei1 },
                    { deviceIdentifier: device.identifiers.serialNumber },
                    { device: device._id }
                ]
            }).populate("reportedBy", "firstName lastName phoneNumber");
        }

        const response = {
            message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report created successfully`,
            report: await Report.findById(report._id)
                .populate("device", "brand model deviceType identifiers")
                .populate("reportedBy", "firstName lastName phoneNumber")
        };

        if (matches.length > 0) {
            response.potentialMatches = matches;
            response.matchMessage = `Found ${matches.length} potential matching report(s)!`;
        }

        res.status(201).json(response);
    } catch (error) {
        console.error("Create report error:", error);
        res.status(500).json({ error: "Failed to create report" });
    }
});

// @route   GET /api/reports
// @desc    Get all reports by current user
// @access  Private
router.get("/", protect, async (req, res) => {
    try {
        const { reportType, status, page = 1, limit = 10 } = req.query;

        const filter = { reportedBy: req.user._id };
        if (reportType) filter.reportType = reportType;
        if (status) filter.status = status;

        const reports = await Report.find(filter)
            .populate("device", "brand model deviceType identifiers")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Report.countDocuments(filter);

        res.json({
            reports,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get reports error:", error);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

// @route   GET /api/reports/my-devices
// @desc    Get reports for current user's devices (to see if any were found)
// @access  Private
router.get("/my-devices", protect, async (req, res) => {
    try {
        // Get user's devices
        const userDevices = await Device.find({ currentOwner: req.user._id });
        const deviceIds = userDevices.map(d => d._id);

        // Find reports about user's devices
        const reports = await Report.find({
            device: { $in: deviceIds },
            reportedBy: { $ne: req.user._id } // Reports by others (found reports)
        })
        .populate("device", "brand model deviceType")
        .populate("reportedBy", "firstName lastName phoneNumber")
        .sort({ createdAt: -1 });

        res.json({ reports });
    } catch (error) {
        console.error("Get my device reports error:", error);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

// @route   GET /api/reports/:id
// @desc    Get report by ID
// @access  Private
router.get("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate("device")
            .populate("reportedBy", "firstName lastName phoneNumber")
            .populate("matchedWith")
            .populate("resolvedBy", "firstName lastName");

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        // Check authorization
        const isReporter = report.reportedBy._id.toString() === req.user._id.toString();
        const isAdmin = ["police", "admin"].includes(req.user.role);
        
        // Also allow device owner to see reports about their device
        let isDeviceOwner = false;
        if (report.device) {
            const device = await Device.findById(report.device._id);
            isDeviceOwner = device && device.currentOwner.toString() === req.user._id.toString();
        }

        if (!isReporter && !isAdmin && !isDeviceOwner) {
            return res.status(403).json({ error: "Not authorized to view this report" });
        }

        res.json({ report });
    } catch (error) {
        console.error("Get report error:", error);
        res.status(500).json({ error: "Failed to fetch report" });
    }
});

// @route   PUT /api/reports/:id
// @desc    Update report
// @access  Private
router.put("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        // Check authorization
        if (report.reportedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to update this report" });
        }

        // Only allow updates on open reports
        if (report.status !== "open") {
            return res.status(400).json({ error: "Can only update open reports" });
        }

        const allowedUpdates = ["location", "notes", "policeReference", "policeStation", "incidentDate"];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const updatedReport = await Report.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).populate("device", "brand model deviceType");

        res.json({
            message: "Report updated",
            report: updatedReport
        });
    } catch (error) {
        console.error("Update report error:", error);
        res.status(500).json({ error: "Failed to update report" });
    }
});

// @route   PUT /api/reports/:id/resolve
// @desc    Mark report as resolved
// @access  Private
router.put("/:id/resolve", protect, idParamValidation, validate, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        // Check authorization - reporter or admin
        const isReporter = report.reportedBy.toString() === req.user._id.toString();
        const isAdmin = ["police", "admin"].includes(req.user.role);

        if (!isReporter && !isAdmin) {
            return res.status(403).json({ error: "Not authorized to resolve this report" });
        }

        report.status = "resolved";
        report.resolvedAt = new Date();
        report.resolvedBy = req.user._id;
        report.notes = req.body.resolution || report.notes;
        await report.save();

        // If device was reported lost/stolen and is now resolved, update device status
        if (report.device && (report.reportType === "lost" || report.reportType === "stolen")) {
            await Device.findByIdAndUpdate(report.device, { status: "registered" });
        }

        res.json({
            message: "Report resolved",
            report
        });
    } catch (error) {
        console.error("Resolve report error:", error);
        res.status(500).json({ error: "Failed to resolve report" });
    }
});

// @route   DELETE /api/reports/:id
// @desc    Delete/Cancel a report
// @access  Private
router.delete("/:id", protect, idParamValidation, validate, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        // Check authorization
        if (report.reportedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized to delete this report" });
        }

        // Only allow deletion of open reports
        if (report.status !== "open") {
            return res.status(400).json({ error: "Can only delete open reports" });
        }

        // Reset device status if it was a lost/stolen report
        if (report.device && (report.reportType === "lost" || report.reportType === "stolen")) {
            await Device.findByIdAndUpdate(report.device, { status: "registered" });
        }

        await Report.findByIdAndDelete(req.params.id);

        res.json({ message: "Report deleted" });
    } catch (error) {
        console.error("Delete report error:", error);
        res.status(500).json({ error: "Failed to delete report" });
    }
});

module.exports = router;
