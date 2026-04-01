const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
        index: true
    },
    reportType: {
        type: String,
        required: true,
        enum: ["lost", "stolen", "found"],
        index: true
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    // Used when device is not in the system
    deviceIdentifier: {
        type: String,
        trim: true
    },
    deviceDescription: {
        type: String,
        trim: true
    },
    location: {
        province: String,
        district: String,
        sector: String,
        description: String, // More detailed location description
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    reportDate: {
        type: Date,
        default: Date.now
    },
    incidentDate: Date, // When the device was lost/stolen/found
    status: {
        type: String,
        enum: ["open", "investigating", "resolved", "closed"],
        default: "open",
        index: true
    },
    policeReference: String, // Police case number if applicable
    policeStation: String,
    contactInfo: {
        phone: String,
        email: String
    },
    notes: String,
    // For found devices - to match with lost reports
    matchedWith: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report"
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true
});

// Indexes
reportSchema.index({ reportType: 1, status: 1 });
reportSchema.index({ deviceIdentifier: 1 });
reportSchema.index({ "location.province": 1, "location.district": 1 });

// Static method to find matching reports
reportSchema.statics.findMatches = async function(identifier) {
    return this.find({
        $or: [
            { deviceIdentifier: identifier },
            { device: { $exists: true } }
        ],
        status: { $in: ["open", "investigating"] }
    }).populate("device").populate("reportedBy", "firstName lastName phoneNumber");
};

// Update device status when report is created
reportSchema.pre("save", async function(next) {
    if (this.isNew && this.device) {
        const Device = mongoose.model("Device");
        const statusMap = {
            "lost": "reported_lost",
            "stolen": "reported_stolen",
            "found": "found"
        };
        await Device.findByIdAndUpdate(this.device, {
            status: statusMap[this.reportType]
        });
    }
    next();
});

module.exports = mongoose.model("Report", reportSchema);
