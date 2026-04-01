const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        index: true
    },
    reportType: {
        type: String,
        required: true,
        enum: ['lost', 'stolen', 'found'],
        index: true
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // For unregistered devices that are found
    unregisteredDevice: {
        deviceType: {
            type: String,
            enum: ['phone', 'laptop', 'tablet', 'tv', 'other']
        },
        brand: String,
        model: String,
        identifier: String, // IMEI or serial number
        description: String,
        color: String
    },
    location: {
        province: String,
        district: String,
        sector: String,
        description: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    incidentDate: {
        type: Date,
        default: Date.now
    },
    reportDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['open', 'investigating', 'resolved', 'closed'],
        default: 'open',
        index: true
    },
    policeReference: {
        type: String,
        trim: true
    },
    assignedOfficer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolution: {
        type: {
            type: String,
            enum: ['recovered', 'returned_to_owner', 'claimed_by_owner', 'unclaimed', 'false_report']
        },
        resolvedAt: Date,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    },
    contactInfo: {
        preferredContact: {
            type: String,
            enum: ['phone', 'email'],
            default: 'phone'
        },
        alternatePhone: String
    },
    notes: {
        type: String,
        maxlength: 1000
    },
    photos: [{
        type: String // URLs to photos related to the report
    }],
    timeline: [{
        action: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        performedAt: {
            type: Date,
            default: Date.now
        },
        notes: String
    }]
}, {
    timestamps: true
});

// Add timeline entry helper
reportSchema.methods.addTimelineEntry = function(action, userId, notes = '') {
    this.timeline.push({
        action,
        performedBy: userId,
        performedAt: new Date(),
        notes
    });
};

// Static method to find matching found reports for lost device
reportSchema.statics.findMatchingFoundReports = async function(identifier) {
    return await this.find({
        reportType: 'found',
        status: { $in: ['open', 'investigating'] },
        'unregisteredDevice.identifier': identifier
    }).populate('reportedBy', 'firstName lastName phoneNumber');
};

// Indexes
reportSchema.index({ reportType: 1, status: 1 });
reportSchema.index({ 'unregisteredDevice.identifier': 1 });
reportSchema.index({ reportDate: -1 });

module.exports = mongoose.model('Report', reportSchema);
